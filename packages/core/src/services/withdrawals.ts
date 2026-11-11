import { and, asc, eq, gte, isNull } from "drizzle-orm";
import { lagosDate, naira, quoteWithdrawal, toWire, windowStatus, type WithdrawalWindow } from "@fluravest/domain";
import type { DbLike, Db } from "../db/client";
import { bankAccounts, quotes, users, withdrawalWindows, withdrawals } from "../db/schema";
import { decrypt } from "../crypto";
import { AppError, notFound } from "../errors";
import { providers } from "../providers";
import { audit } from "../audit";
import { verifyPassword } from "./auth";
import { accounts, memberBalances, post } from "./ledger";
import { lockUser } from "./wallet";
import { notify } from "./notify";

const QUOTE_TTL_MS = 2 * 60_000;

export async function loadWindows(db: DbLike): Promise<WithdrawalWindow[]> {
  const today = lagosDate(new Date());
  const rows = await db
    .select()
    .from(withdrawalWindows)
    .where(gte(withdrawalWindows.endsOn, today))
    .orderBy(asc(withdrawalWindows.startsOn));
  return rows.map((r) => ({ startsOn: r.startsOn, endsOn: r.endsOn, label: r.label }));
}

export async function currentWindow(db: DbLike) {
  return windowStatus(await loadWindows(db), new Date());
}

async function requireTier2(db: DbLike, userId: string) {
  const [u] = await db.select({ kycTier: users.kycTier }).from(users).where(eq(users.id, userId));
  if (!u) throw notFound("User");
  if (u.kycTier < 2) throw new AppError(403, "kyc_required", "Verify your identity (Tier 2) first");
}

export async function createWithdrawalQuote(db: Db, userId: string, amountNaira: number) {
  await requireTier2(db, userId);
  const gross = naira(amountNaira);
  const { available } = await memberBalances(db, userId);
  if (gross > available) throw new AppError(422, "insufficient_funds", "Amount is more than your available balance");
  const w = await currentWindow(db);
  const q = quoteWithdrawal(gross, w.open);
  const [row] = await db
    .insert(quotes)
    .values({ userId, kind: "withdrawal", payload: { gross: toWire(q.gross), fee: toWire(q.fee), net: toWire(q.net), windowOpen: w.open }, expiresAt: new Date(Date.now() + QUOTE_TTL_MS) })
    .returning();
  return { quoteId: row.id, gross: toWire(q.gross), fee: toWire(q.fee), net: toWire(q.net), feeApplies: q.feeApplies, window: w, expiresAt: row.expiresAt };
}

export async function confirmWithdrawal(db: Db, userId: string, quoteId: string, password: string) {
  return db.transaction(async (tx) => {
    const user = await lockUser(tx, userId);
    // Step-up: money leaving the platform needs the password again.
    if (!(await verifyPassword(user.passwordHash, password))) throw new AppError(401, "step_up_failed", "Password is incorrect");

    const [q] = await tx.select().from(quotes).where(and(eq(quotes.id, quoteId), eq(quotes.userId, userId), eq(quotes.kind, "withdrawal"), isNull(quotes.usedAt))).for("update");
    if (!q) throw new AppError(410, "quote_invalid", "This quote has already been used or doesn't exist");
    if (q.expiresAt.getTime() < Date.now()) throw new AppError(410, "quote_expired", "This quote expired. Please start again.");
    const p = q.payload as { gross: string; fee: string; net: string; windowOpen: boolean };

    // Re-check the window at confirmation; if it closed since the quote, the member must re-quote.
    const w = await currentWindow(tx);
    if (w.open !== p.windowOpen) throw new AppError(409, "window_changed", "The free withdrawal window changed. Please get a new quote.");

    const gross = BigInt(p.gross), fee = BigInt(p.fee), net = BigInt(p.net);
    const { available } = await memberBalances(tx, userId);
    if (gross > available) throw new AppError(422, "insufficient_funds", "Amount is more than your available balance");

    const [bank] = await tx.select().from(bankAccounts).where(and(eq(bankAccounts.userId, userId), eq(bankAccounts.active, true)));
    if (!bank) throw new AppError(422, "no_bank", "Add a payout account first");
    if (bank.usableFrom.getTime() > Date.now()) throw new AppError(423, "cooling_off", "Your payout account was changed recently. Withdrawals reopen after the security hold.");

    await tx.update(quotes).set({ usedAt: new Date() }).where(eq(quotes.id, q.id));
    const entries = [
      { account: accounts.available(userId), amount: gross },
      { account: accounts.bank(), amount: -net },
    ];
    if (fee > 0n) entries.push({ account: accounts.withdrawalFees(), amount: -fee });
    const { transactionId } = await post(tx, { kind: "withdrawal", idempotencyKey: `withdrawal:${q.id}`, memo: fee > 0n ? "Withdrawal (early, 5% fee)" : "Withdrawal (free window)", userId, entries });

    // Demo: the mock payout runs inline. In production this is enqueued via the outbox after commit.
    const payout = await providers.payments.payout({ amount: net, bankCode: bank.bankCode, accountNumber: decrypt(bank.accountNumberEnc), reference: q.id });
    const [wd] = await tx
      .insert(withdrawals)
      .values({ userId, bankAccountId: bank.id, gross, fee, net, status: payout.status, providerRef: payout.providerRef, transactionId })
      .returning();
    await notify(tx, userId, "Withdrawal sent", `₦${(Number(net) / 100).toLocaleString("en-NG", { minimumFractionDigits: 2 })} is on its way to ${bank.bankName} ••••${bank.accountNumberLast4}.`);
    await audit(tx, { actorType: "member", actorId: userId, action: "wallet.withdrawal", entity: "withdrawal", entityId: wd.id, data: { gross, fee, net } });
    return { id: wd.id, gross: toWire(gross), fee: toWire(fee), net: toWire(net), status: wd.status };
  });
}
