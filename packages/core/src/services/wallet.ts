import { and, desc, eq } from "drizzle-orm";
import { naira, toWire } from "@fluravest/domain";
import type { Db, Tx } from "../db/client";
import { deposits, goals, users } from "../db/schema";
import { AppError, forbidden, notFound } from "../errors";
import { providers } from "../providers";
import { audit } from "../audit";
import { accounts, memberActivity, memberBalances, post } from "./ledger";
import { notify } from "./notify";

/** Demo stand-in for CBN tiered limits: maximum single deposit by KYC tier. */
const MAX_DEPOSIT_BY_TIER: Record<number, bigint> = { 1: naira(50_000), 2: naira(10_000_000) };

export async function lockUser(tx: Tx, userId: string) {
  const [u] = await tx.select().from(users).where(eq(users.id, userId)).for("update");
  if (!u) throw notFound("User");
  if (u.status !== "active") throw forbidden("This account is frozen");
  return u;
}

export async function deposit(db: Db, userId: string, amountNaira: number, method: "card" | "transfer" | "ussd", idempotencyKey: string) {
  const amount = naira(amountNaira);
  return db.transaction(async (tx) => {
    const user = await lockUser(tx, userId);
    const max = MAX_DEPOSIT_BY_TIER[user.kycTier] ?? 0n;
    if (amount > max) throw new AppError(422, "tier_limit", user.kycTier < 2 ? "Verify your identity (Tier 2) to deposit more than ₦50,000" : "Amount is above your deposit limit");

    // Mock provider confirms instantly; a real gateway would confirm via a signed webhook.
    const pay = await providers.payments.collect({ amount, method, reference: idempotencyKey });
    const { transactionId, duplicate } = await post(tx, {
      kind: "deposit",
      idempotencyKey: `deposit:${userId}:${idempotencyKey}`,
      memo: `Wallet top-up (${method})`,
      userId,
      entries: [
        { account: accounts.bank(), amount },
        { account: accounts.available(userId), amount: -amount },
      ],
    });
    if (!duplicate) {
      await tx.insert(deposits).values({ userId, amount, method, status: pay.status, provider: providers.payments.name, providerRef: pay.providerRef, transactionId });
      await notify(tx, userId, "Deposit received", `₦${amountNaira.toLocaleString("en-NG")} was added to your wallet.`);
      await audit(tx, { actorType: "member", actorId: userId, action: "wallet.deposit", entity: "ledger_transaction", entityId: transactionId, data: { amount, method } });
    }
    return { transactionId, duplicate };
  });
}

export async function walletSummary(db: Db, userId: string) {
  const b = await memberBalances(db, userId);
  const activity = await memberActivity(db, userId, 15);
  const g = await db.select().from(goals).where(eq(goals.userId, userId)).orderBy(desc(goals.createdAt));
  return {
    available: toWire(b.available),
    escrow: toWire(b.escrow),
    total: toWire(b.total),
    goals: g.map((x) => ({ id: x.id, name: x.name, target: toWire(x.targetKobo) })),
    activity: activity.map((a) => ({ id: a.id, kind: a.kind, memo: a.memo, createdAt: a.createdAt, amount: toWire(a.amount) })),
  };
}

export async function createGoal(db: Db, userId: string, name: string, targetNaira: number) {
  const count = await db.select({ id: goals.id }).from(goals).where(eq(goals.userId, userId));
  if (count.length >= 10) throw new AppError(422, "too_many_goals", "You can have up to 10 goals");
  const [g] = await db.insert(goals).values({ userId, name, targetKobo: naira(targetNaira) }).returning();
  return g;
}

export async function deleteGoal(db: Db, userId: string, goalId: string) {
  await db.delete(goals).where(and(eq(goals.id, goalId), eq(goals.userId, userId)));
}
