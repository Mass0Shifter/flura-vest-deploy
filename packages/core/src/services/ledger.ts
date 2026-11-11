import { and, eq, like, sql } from "drizzle-orm";
import type { DbLike } from "../db/client";
import { ledgerAccounts, ledgerEntries, ledgerTransactions } from "../db/schema";

type Kind = "asset" | "liability" | "revenue";

export const accounts = {
  bank: () => ({ code: "bank:settlement", kind: "asset" as Kind }),
  available: (userId: string) => ({ code: `member:${userId}:available`, kind: "liability" as Kind, userId }),
  escrow: (userId: string, podId: string) => ({ code: `member:${userId}:escrow:${podId}`, kind: "liability" as Kind, userId, podId }),
  acquisition: (podId: string) => ({ code: `pod:${podId}:acquisition`, kind: "liability" as Kind, podId }),
  withdrawalFees: () => ({ code: "platform:fees:withdrawal", kind: "revenue" as Kind }),
  legalFees: () => ({ code: "platform:fees:legal", kind: "revenue" as Kind }),
  landMargin: () => ({ code: "platform:margin:land", kind: "revenue" as Kind }),
};

export type AccountRef = { code: string; kind: Kind; userId?: string; podId?: string };

async function ensureAccount(tx: DbLike, ref: AccountRef): Promise<string> {
  await tx
    .insert(ledgerAccounts)
    .values({ code: ref.code, kind: ref.kind, userId: ref.userId ?? null, podId: ref.podId ?? null })
    .onConflictDoNothing({ target: ledgerAccounts.code });
  const [row] = await tx.select({ id: ledgerAccounts.id }).from(ledgerAccounts).where(eq(ledgerAccounts.code, ref.code));
  return row.id;
}

export interface PostingInput {
  kind: string;
  idempotencyKey: string;
  memo: string;
  userId?: string;
  podId?: string;
  /** Debits positive, credits negative. Must sum to zero. */
  entries: { account: AccountRef; amount: bigint }[];
}

/**
 * Posts a balanced transaction. Re-posting the same idempotency key returns the original
 * transaction id instead of moving money twice.
 */
export async function post(tx: DbLike, p: PostingInput): Promise<{ transactionId: string; duplicate: boolean }> {
  const sum = p.entries.reduce((a, e) => a + e.amount, 0n);
  if (sum !== 0n) throw new Error(`Unbalanced ledger transaction ${p.kind}: ${sum}`);
  if (p.entries.some((e) => e.amount === 0n)) throw new Error("Zero ledger entry");

  const inserted = await tx
    .insert(ledgerTransactions)
    .values({ kind: p.kind, idempotencyKey: p.idempotencyKey, memo: p.memo, userId: p.userId ?? null, podId: p.podId ?? null })
    .onConflictDoNothing({ target: ledgerTransactions.idempotencyKey })
    .returning({ id: ledgerTransactions.id });

  if (inserted.length === 0) {
    const [existing] = await tx.select({ id: ledgerTransactions.id }).from(ledgerTransactions).where(eq(ledgerTransactions.idempotencyKey, p.idempotencyKey));
    return { transactionId: existing.id, duplicate: true };
  }
  const transactionId = inserted[0].id;
  for (const e of p.entries) {
    const accountId = await ensureAccount(tx, e.account);
    await tx.insert(ledgerEntries).values({ transactionId, accountId, amount: e.amount });
  }
  return { transactionId, duplicate: false };
}

/** Natural balance: assets are debit-positive; liabilities and revenue are credit-positive. */
export async function balance(tx: DbLike, code: string): Promise<bigint> {
  const [row] = await tx
    .select({ kind: ledgerAccounts.kind, total: sql<string>`coalesce(sum(${ledgerEntries.amount}), 0)` })
    .from(ledgerAccounts)
    .leftJoin(ledgerEntries, eq(ledgerEntries.accountId, ledgerAccounts.id))
    .where(eq(ledgerAccounts.code, code))
    .groupBy(ledgerAccounts.kind);
  if (!row) return 0n;
  const total = BigInt(row.total);
  return row.kind === "asset" ? total : -total;
}

export async function balancesByPrefix(tx: DbLike, prefix: string): Promise<Map<string, bigint>> {
  const rows = await tx
    .select({ code: ledgerAccounts.code, kind: ledgerAccounts.kind, total: sql<string>`coalesce(sum(${ledgerEntries.amount}), 0)` })
    .from(ledgerAccounts)
    .leftJoin(ledgerEntries, eq(ledgerEntries.accountId, ledgerAccounts.id))
    .where(like(ledgerAccounts.code, `${prefix}%`))
    .groupBy(ledgerAccounts.code, ledgerAccounts.kind);
  return new Map(rows.map((r) => [r.code, r.kind === "asset" ? BigInt(r.total) : -BigInt(r.total)]));
}

export async function memberBalances(tx: DbLike, userId: string) {
  const all = await balancesByPrefix(tx, `member:${userId}:`);
  const available = all.get(accounts.available(userId).code) ?? 0n;
  let escrow = 0n;
  for (const [code, v] of all) if (code.includes(":escrow:")) escrow += v;
  return { available, escrow, total: available + escrow };
}

/** Member-facing activity: entries on the member's own accounts. */
export async function memberActivity(tx: DbLike, userId: string, limit = 20) {
  const accts = await tx.select({ id: ledgerAccounts.id, code: ledgerAccounts.code }).from(ledgerAccounts).where(eq(ledgerAccounts.userId, userId));
  if (accts.length === 0) return [];
  const availableId = accts.find((a) => a.code === accounts.available(userId).code)?.id;
  if (!availableId) return [];
  const rows = await tx
    .select({
      id: ledgerTransactions.id,
      kind: ledgerTransactions.kind,
      memo: ledgerTransactions.memo,
      createdAt: ledgerTransactions.createdAt,
      amount: ledgerEntries.amount,
    })
    .from(ledgerEntries)
    .innerJoin(ledgerTransactions, eq(ledgerTransactions.id, ledgerEntries.transactionId))
    .where(and(eq(ledgerEntries.accountId, availableId)))
    .orderBy(sql`${ledgerTransactions.createdAt} desc`)
    .limit(limit);
  // Credits to a liability (negative amount) increase the member's money.
  return rows.map((r) => ({ ...r, amount: -r.amount }));
}

/** Sanity check used by the admin reconciliation view: every transaction must net to zero. */
export async function unbalancedTransactions(tx: DbLike): Promise<number> {
  const rows = await tx.execute(sql`select transaction_id from ledger_entries group by transaction_id having sum(amount) <> 0`);
  return rows.length;
}

