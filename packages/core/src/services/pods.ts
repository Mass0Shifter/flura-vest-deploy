import { and, asc, desc, eq, inArray, isNull, lt, sql } from "drizzle-orm";
import { sharePercent, slotCommitment, toWire } from "@fluravest/domain";
import type { Db, DbLike, Tx } from "../db/client";
import { certificates, parcels, pods, quotes, slotClaims, users } from "../db/schema";
import { AppError, conflict, notFound } from "../errors";
import { audit } from "../audit";
import { accounts, memberBalances, post } from "./ledger";
import { lockUser } from "./wallet";
import { notify } from "./notify";

const QUOTE_TTL_MS = 2 * 60_000;
const ACTIVE = ["held", "converted"] as const;

type PodRow = typeof pods.$inferSelect;
type ParcelRow = typeof parcels.$inferSelect;

function podView(p: PodRow, parcel: ParcelRow, claimed: number) {
  const c = slotCommitment(p.slotPrice, p.legalFeeBp);
  return {
    id: p.id,
    code: p.code,
    status: p.status,
    slotCount: p.slotCount,
    claimed,
    remaining: p.slotCount - claimed,
    totalPrice: toWire(p.syndicatedPrice),
    slotPrice: toWire(p.slotPrice),
    legalFeeBp: p.legalFeeBp,
    legalFeePerSlot: toWire(c.legalFee),
    commitmentPerSlot: toWire(c.total),
    sharePercent: sharePercent(p.slotCount),
    opensAt: p.opensAt,
    expiresAt: p.expiresAt,
    filledAt: p.filledAt,
    closedAt: p.closedAt,
    parcel: {
      id: parcel.id,
      title: parcel.title,
      locationText: parcel.locationText,
      state: parcel.state,
      lga: parcel.lga,
      latitude: parcel.latitude,
      longitude: parcel.longitude,
      sizeSqm: parcel.sizeSqm,
      titleType: parcel.titleType,
      hasSurveyPlan: parcel.hasSurveyPlan,
      description: parcel.description,
      // Only a parcel signed off by a second admin is ever shown as verified.
      verified: parcel.status === "verified" && !!parcel.verifiedBy,
      verifiedAt: parcel.verifiedAt,
    },
  };
}

export async function claimedCounts(db: DbLike, podIds: string[]) {
  if (podIds.length === 0) return new Map<string, number>();
  const rows = await db
    .select({ podId: slotClaims.podId, n: sql<number>`count(*)::int` })
    .from(slotClaims)
    .where(and(inArray(slotClaims.podId, podIds), inArray(slotClaims.status, [...ACTIVE])))
    .groupBy(slotClaims.podId);
  return new Map(rows.map((r) => [r.podId, r.n]));
}

export async function listPods(db: DbLike, statuses: PodRow["status"][] = ["open"], userId?: string) {
  const rows = await db
    .select({ pod: pods, parcel: parcels })
    .from(pods)
    .innerJoin(parcels, eq(parcels.id, pods.parcelId))
    .where(inArray(pods.status, statuses))
    .orderBy(asc(pods.expiresAt));
  const counts = await claimedCounts(db, rows.map((r) => r.pod.id));
  const mine = userId
    ? await db.select().from(slotClaims).where(and(eq(slotClaims.userId, userId), inArray(slotClaims.status, [...ACTIVE])))
    : [];
  return rows.map((r) => {
    const c = mine.find((m) => m.podId === r.pod.id);
    return { ...podView(r.pod, r.parcel, counts.get(r.pod.id) ?? 0), myClaim: c ? { id: c.id, slotNumber: c.slotNumber, status: c.status, amount: toWire(c.slotAmount + c.legalFee) } : null };
  });
}

export async function getPod(db: DbLike, podId: string, userId?: string) {
  const [row] = await db.select({ pod: pods, parcel: parcels }).from(pods).innerJoin(parcels, eq(parcels.id, pods.parcelId)).where(eq(pods.id, podId));
  if (!row || row.pod.status === "draft") throw notFound("Pod");
  const counts = await claimedCounts(db, [podId]);
  const view = podView(row.pod, row.parcel, counts.get(podId) ?? 0);
  let myClaim = null;
  if (userId) {
    const [c] = await db.select().from(slotClaims).where(and(eq(slotClaims.podId, podId), eq(slotClaims.userId, userId), inArray(slotClaims.status, [...ACTIVE])));
    if (c) myClaim = { id: c.id, slotNumber: c.slotNumber, status: c.status, amount: toWire(c.slotAmount + c.legalFee) };
  }
  return { ...view, myClaim };
}

export async function myPods(db: DbLike, userId: string) {
  const rows = await db
    .select({ claim: slotClaims, pod: pods, parcel: parcels })
    .from(slotClaims)
    .innerJoin(pods, eq(pods.id, slotClaims.podId))
    .innerJoin(parcels, eq(parcels.id, pods.parcelId))
    .where(and(eq(slotClaims.userId, userId), inArray(slotClaims.status, [...ACTIVE])))
    .orderBy(desc(slotClaims.createdAt));
  const counts = await claimedCounts(db, rows.map((r) => r.pod.id));
  return rows.map((r) => ({
    ...podView(r.pod, r.parcel, counts.get(r.pod.id) ?? 0),
    myClaim: { id: r.claim.id, slotNumber: r.claim.slotNumber, status: r.claim.status, amount: toWire(r.claim.slotAmount + r.claim.legalFee) },
  }));
}

export async function createClaimQuote(db: Db, userId: string, podId: string) {
  const [u] = await db.select({ kycTier: users.kycTier }).from(users).where(eq(users.id, userId));
  if (!u || u.kycTier < 2) throw new AppError(403, "kyc_required", "Verify your identity (Tier 2) to claim a slot");
  const pod = await getPod(db, podId, userId);
  if (pod.status !== "open") throw conflict("pod_not_open", "This pod is not open for claims");
  if (pod.myClaim) throw conflict("already_claimed", "You already hold a slot in this pod");
  if (pod.remaining <= 0) throw conflict("pod_full", "This pod is full");
  const { available } = await memberBalances(db, userId);
  const need = BigInt(pod.commitmentPerSlot);
  if (available < need) throw new AppError(422, "insufficient_funds", "Your available balance is below the slot commitment");
  const [q] = await db
    .insert(quotes)
    .values({ userId, kind: "claim", payload: { podId, slotPrice: pod.slotPrice, legalFee: pod.legalFeePerSlot, total: pod.commitmentPerSlot }, expiresAt: new Date(Date.now() + QUOTE_TTL_MS) })
    .returning();
  return { quoteId: q.id, expiresAt: q.expiresAt, slotPrice: pod.slotPrice, legalFee: pod.legalFeePerSlot, total: pod.commitmentPerSlot, available: toWire(available) };
}

/**
 * Claims a slot. The pod row is locked FOR UPDATE so concurrent claims for the last slot
 * serialise; the partial unique index on (pod_id, slot_number) is the backstop.
 */
export async function confirmClaim(db: Db, userId: string, quoteId: string) {
  return db.transaction(async (tx) => {
    await lockUser(tx, userId);
    const [q] = await tx.select().from(quotes).where(and(eq(quotes.id, quoteId), eq(quotes.userId, userId), eq(quotes.kind, "claim"), isNull(quotes.usedAt))).for("update");
    if (!q) throw new AppError(410, "quote_invalid", "This quote has already been used or doesn't exist");
    if (q.expiresAt.getTime() < Date.now()) throw new AppError(410, "quote_expired", "This quote expired. Please start again.");
    const p = q.payload as { podId: string; slotPrice: string; legalFee: string; total: string };

    const [pod] = await tx.select().from(pods).where(eq(pods.id, p.podId)).for("update");
    if (!pod || pod.status !== "open") throw conflict("pod_not_open", "This pod is no longer open");
    if (pod.expiresAt && pod.expiresAt.getTime() < Date.now()) throw conflict("pod_expired", "This pod's fill period has ended");

    const active = await tx.select().from(slotClaims).where(and(eq(slotClaims.podId, pod.id), inArray(slotClaims.status, [...ACTIVE])));
    if (active.some((c) => c.userId === userId)) throw conflict("already_claimed", "You already hold a slot in this pod");
    if (active.length >= pod.slotCount) throw conflict("pod_full", "Someone just claimed the last slot");

    const slotAmount = BigInt(p.slotPrice), legalFee = BigInt(p.legalFee), total = slotAmount + legalFee;
    if (slotAmount !== pod.slotPrice) throw conflict("price_changed", "The slot price changed. Please start again.");
    const { available } = await memberBalances(tx, userId);
    if (available < total) throw new AppError(422, "insufficient_funds", "Your available balance is below the slot commitment");

    const taken = new Set(active.map((c) => c.slotNumber));
    let slotNumber = 1;
    while (taken.has(slotNumber)) slotNumber++;

    await tx.update(quotes).set({ usedAt: new Date() }).where(eq(quotes.id, q.id));
    const [claim] = await tx.insert(slotClaims).values({ podId: pod.id, userId, slotNumber, slotAmount, legalFee }).returning();
    await post(tx, {
      kind: "slot_claim",
      idempotencyKey: `claim:${claim.id}`,
      memo: `Slot ${slotNumber} locked in ${pod.code}`,
      userId,
      podId: pod.id,
      entries: [
        { account: accounts.available(userId), amount: total },
        { account: accounts.escrow(userId, pod.id), amount: -total },
      ],
    });
    await audit(tx, { actorType: "member", actorId: userId, action: "pod.claim", entity: "slot_claim", entityId: claim.id, data: { podId: pod.id, slotNumber, total } });

    const nowFilled = active.length + 1 === pod.slotCount;
    if (nowFilled) {
      await tx.update(pods).set({ status: "filled", filledAt: new Date() }).where(eq(pods.id, pod.id));
      await audit(tx, { actorType: "system", action: "pod.filled", entity: "pod", entityId: pod.id });
      const members = [...active.map((c) => c.userId), userId];
      for (const m of members) await notify(tx, m, `${pod.code} is full`, "All slots are confirmed. Funds are locked while the land purchase closes. We'll update you at each step.");
    } else {
      await notify(tx, userId, `Slot confirmed in ${pod.code}`, `You hold slot ${slotNumber} of ${pod.slotCount}. You can cancel at no cost until the pod fills.`);
    }
    return { claimId: claim.id, slotNumber, podFilled: nowFilled };
  });
}

async function releaseClaim(tx: Tx, claim: typeof slotClaims.$inferSelect, podCode: string, reason: string) {
  const total = claim.slotAmount + claim.legalFee;
  await tx.update(slotClaims).set({ status: "released", releasedAt: new Date() }).where(eq(slotClaims.id, claim.id));
  await post(tx, {
    kind: "slot_release",
    idempotencyKey: `release:${claim.id}`,
    memo: `${podCode} slot released (${reason})`,
    userId: claim.userId,
    podId: claim.podId,
    entries: [
      { account: accounts.escrow(claim.userId, claim.podId), amount: total },
      { account: accounts.available(claim.userId), amount: -total },
    ],
  });
}

/** Members can leave a pod at no cost while it is still open. */
export async function cancelClaim(db: Db, userId: string, podId: string) {
  return db.transaction(async (tx) => {
    await lockUser(tx, userId);
    const [pod] = await tx.select().from(pods).where(eq(pods.id, podId)).for("update");
    if (!pod) throw notFound("Pod");
    if (pod.status !== "open") throw conflict("pod_locked", "Funds are locked once a pod is full");
    const [claim] = await tx.select().from(slotClaims).where(and(eq(slotClaims.podId, podId), eq(slotClaims.userId, userId), eq(slotClaims.status, "held")));
    if (!claim) throw notFound("Your slot");
    await releaseClaim(tx, claim, pod.code, "cancelled by you");
    await notify(tx, userId, `Left ${pod.code}`, "Your locked funds are back in your available balance. No fee was charged.");
    await audit(tx, { actorType: "member", actorId: userId, action: "pod.claim.cancel", entity: "slot_claim", entityId: claim.id });
  });
}

/** Ends pods whose fill period has passed and refunds every holder in full. Safe to run repeatedly. */
export async function expireDuePods(db: Db) {
  const due = await db.select({ id: pods.id }).from(pods).where(and(eq(pods.status, "open"), lt(pods.expiresAt, new Date())));
  for (const { id } of due) await endPod(db, id, "expired", { actorType: "system" });
  return due.length;
}

export async function endPod(db: Db, podId: string, to: "expired" | "cancelled", actor: { actorType: "system" | "admin"; actorId?: string; reason?: string }) {
  await db.transaction(async (tx) => {
    const [pod] = await tx.select().from(pods).where(eq(pods.id, podId)).for("update");
    if (!pod) throw notFound("Pod");
    if (pod.status !== "open" && !(to === "cancelled" && pod.status === "draft")) throw conflict("invalid_transition", `Can't ${to === "expired" ? "expire" : "cancel"} a ${pod.status} pod`);
    const held = await tx.select().from(slotClaims).where(and(eq(slotClaims.podId, podId), eq(slotClaims.status, "held")));
    for (const c of held) {
      await releaseClaim(tx, c, pod.code, to);
      await notify(tx, c.userId, `${pod.code} ${to === "expired" ? "didn't fill in time" : "was withdrawn"}`, "Your locked funds are back in your available balance in full. No fee was charged.");
    }
    await tx.update(pods).set({ status: to }).where(eq(pods.id, podId));
    await audit(tx, { actorType: actor.actorType, actorId: actor.actorId, action: `pod.${to}`, entity: "pod", entityId: podId, data: { refunded: held.length, reason: actor.reason } });
  });
}

export async function vault(db: DbLike, userId: string) {
  const rows = await db
    .select({ cert: certificates, pod: pods, parcel: parcels })
    .from(certificates)
    .innerJoin(pods, eq(pods.id, certificates.podId))
    .innerJoin(parcels, eq(parcels.id, pods.parcelId))
    .where(eq(certificates.userId, userId))
    .orderBy(desc(certificates.issuedAt));
  return rows.map((r) => ({
    certificateId: r.cert.id,
    code: r.cert.code,
    sharePercent: r.cert.sharePercent,
    issuedAt: r.cert.issuedAt,
    podCode: r.pod.code,
    deedReference: r.pod.deedReference,
    slotCount: r.pod.slotCount,
    parcel: { title: r.parcel.title, locationText: r.parcel.locationText, state: r.parcel.state, latitude: r.parcel.latitude, longitude: r.parcel.longitude, sizeSqm: r.parcel.sizeSqm, titleType: r.parcel.titleType },
  }));
}

