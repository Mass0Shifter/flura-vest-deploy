import { desc, sql } from "drizzle-orm";
import type { DbLike } from "./db/client";
import { auditEvents } from "./db/schema";
import { sha256 } from "./crypto";

export interface AuditInput {
  actorType: "member" | "admin" | "system";
  actorId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  data?: Record<string, unknown>;
}

const json = (v: unknown) => JSON.stringify(v, (_k, x) => (typeof x === "bigint" ? x.toString() : x));

/** Appends a hash-chained audit event. Call inside the same transaction as the change it records. */
export async function audit(tx: DbLike, e: AuditInput) {
  await tx.execute(sql`select pg_advisory_xact_lock(7321001)`);
  const [last] = await tx.select({ hash: auditEvents.hash }).from(auditEvents).orderBy(desc(auditEvents.id)).limit(1);
  const prevHash = last?.hash ?? "genesis";
  const data = JSON.parse(json(e.data ?? {}));
  const hash = sha256(json({ prevHash, ...e, data }));
  await tx.insert(auditEvents).values({
    actorType: e.actorType,
    actorId: e.actorId ?? null,
    action: e.action,
    entity: e.entity,
    entityId: e.entityId ?? null,
    data,
    prevHash,
    hash,
  });
}
