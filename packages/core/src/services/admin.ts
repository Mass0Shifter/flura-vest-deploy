import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { canTransition, naira, POD_FILL_DAYS, sharePercent, slotPrice, toWire, type ParcelInput, type PodInput, type PodStatus } from "@fluravest/domain";
import type { Db, Tx } from "../db/client";
import { admins, auditEvents, certificates, ledgerTransactions, parcels, pods, slotClaims, users, withdrawalWindows } from "../db/schema";
import { AppError, conflict, forbidden, notFound } from "../errors";
import { sha256, shortCode } from "../crypto";
import { audit } from "../audit";
import { accounts, balance, balancesByPrefix, post, unbalancedTransactions } from "./ledger";
import { claimedCounts } from "./pods";
import { notify } from "./notify";

export type AdminActor = { id: string; role: "ops" | "verifier" | "finance" | "superadmin"; name: string };

const can = {
  editDeals: (a: AdminActor) => ["ops", "superadmin"].includes(a.role),
  verify: (a: AdminActor) => ["verifier", "superadmin"].includes(a.role),
  money: (a: AdminActor) => ["finance", "superadmin"].includes(a.role),
};
function require(ok: boolean, msg: string) {
  if (!ok) throw forbidden(msg);
}
/** Maker-checker: the person approving must not be the person who prepared it. */
function fourEyes(maker: string | null | undefined, checker: AdminActor, what: string) {
  if (maker && maker === checker.id) throw forbidden(`A different admin must ${what}`);
}

/** Staff screens show masked contact details by default. */
const maskEmail = (email: string) => {
  const [local, domain] = email.split("@");
  return `${local.slice(0, 2)}•••@${domain}`;
};

export async function listParcels(db: Db) {
  const rows = await db
    .select({ parcel: parcels, creator: admins.name })
    .from(parcels)
    .innerJoin(admins, eq(admins.id, parcels.createdBy))
    .orderBy(desc(parcels.createdAt));
  const verifierIds = rows.map((r) => r.parcel.verifiedBy).filter(Boolean) as string[];
  const verifiers = verifierIds.length ? await db.select({ id: admins.id, name: admins.name }).from(admins).where(inArray(admins.id, verifierIds)) : [];
  return rows.map((r) => ({ ...r.parcel, createdByName: r.creator, verifiedByName: verifiers.find((v) => v.id === r.parcel.verifiedBy)?.name ?? null }));
}

export async function createParcel(db: Db, actor: AdminActor, input: ParcelInput) {
  require(can.editDeals(actor), "Only operations staff can add parcels");
  return db.transaction(async (tx) => {
    const [p] = await tx.insert(parcels).values({ ...input, createdBy: actor.id }).returning();
    await audit(tx, { actorType: "admin", actorId: actor.id, action: "parcel.create", entity: "parcel", entityId: p.id, data: { title: p.title } });
    return p;
  });
}

export async function verifyParcel(db: Db, actor: AdminActor, parcelId: string, decision: "verified" | "rejected", notes: string) {
  require(can.verify(actor), "Only verifiers can sign off parcels");
  return db.transaction(async (tx) => {
    const [p] = await tx.select().from(parcels).where(eq(parcels.id, parcelId)).for("update");
    if (!p) throw notFound("Parcel");
    if (p.status !== "draft") throw conflict("already_reviewed", "This parcel has already been reviewed");
    fourEyes(p.createdBy, actor, "verify this parcel");
    await tx.update(parcels).set({ status: decision, verifiedBy: actor.id, verifiedAt: new Date(), verificationNotes: notes }).where(eq(parcels.id, parcelId));
    await audit(tx, { actorType: "admin", actorId: actor.id, action: `parcel.${decision}`, entity: "parcel", entityId: parcelId, data: { notes } });
  });
}

export async function listPodsAdmin(db: Db) {
  const rows = await db.select({ pod: pods, parcel: parcels }).from(pods).innerJoin(parcels, eq(parcels.id, pods.parcelId)).orderBy(desc(pods.createdAt));
  const counts = await claimedCounts(db, rows.map((r) => r.pod.id));
  return rows.map((r) => ({
    id: r.pod.id,
    code: r.pod.code,
    status: r.pod.status,
    parcelTitle: r.parcel.title,
    state: r.parcel.state,
    slotCount: r.pod.slotCount,
    claimed: counts.get(r.pod.id) ?? 0,
    slotPrice: toWire(r.pod.slotPrice),
    acquisitionCost: toWire(r.pod.acquisitionCost),
    syndicatedPrice: toWire(r.pod.syndicatedPrice),
    expiresAt: r.pod.expiresAt,
    createdBy: r.pod.createdBy,
    closeRequestedBy: r.pod.closeRequestedBy,
  }));
}

export async function podDetailAdmin(db: Db, podId: string) {
  const [row] = await db.select({ pod: pods, parcel: parcels }).from(pods).innerJoin(parcels, eq(parcels.id, pods.parcelId)).where(eq(pods.id, podId));
  if (!row) throw notFound("Pod");
  const claims = await db
    .select({ id: slotClaims.id, slotNumber: slotClaims.slotNumber, status: slotClaims.status, slotAmount: slotClaims.slotAmount, legalFee: slotClaims.legalFee, createdAt: slotClaims.createdAt, memberName: users.fullName, memberEmail: users.email })
    .from(slotClaims)
    .innerJoin(users, eq(users.id, slotClaims.userId))
    .where(eq(slotClaims.podId, podId))
    .orderBy(slotClaims.slotNumber);
  const escrow = await balancesByPrefix(db, "member:");
  let escrowTotal = 0n;
  for (const [code, v] of escrow) if (code.endsWith(`:escrow:${podId}`)) escrowTotal += v;
  const acquisition = await balance(db, accounts.acquisition(podId).code);
  const names = await db.select({ id: admins.id, name: admins.name }).from(admins);
  const nameOf = (id: string | null) => names.find((n) => n.id === id)?.name ?? null;
  return {
    ...row.pod,
    acquisitionCost: toWire(row.pod.acquisitionCost),
    syndicatedPrice: toWire(row.pod.syndicatedPrice),
    slotPrice: toWire(row.pod.slotPrice),
    margin: toWire(row.pod.syndicatedPrice - row.pod.acquisitionCost),
    createdByName: nameOf(row.pod.createdBy),
    publishedByName: nameOf(row.pod.publishedBy),
    closeRequestedByName: nameOf(row.pod.closeRequestedBy),
    closeApprovedByName: nameOf(row.pod.closeApprovedBy),
    parcel: row.parcel,
    claims: claims.map((c) => ({ ...c, memberEmail: maskEmail(c.memberEmail), slotAmount: toWire(c.slotAmount), legalFee: toWire(c.legalFee) })),
    escrowHeld: toWire(escrowTotal),
    acquisitionBalance: toWire(acquisition),
  };
}

export async function createPod(db: Db, actor: AdminActor, input: PodInput) {
  require(can.editDeals(actor), "Only operations staff can create pods");
  const syndicated = naira(input.syndicatedNaira);
  const slot = (() => {
    try {
      return slotPrice(syndicated, input.slotCount);
    } catch (e) {
      throw new AppError(422, "invalid_price", (e as Error).message);
    }
  })();
  return db.transaction(async (tx) => {
    const [parcel] = await tx.select().from(parcels).where(eq(parcels.id, input.parcelId));
    if (!parcel) throw notFound("Parcel");
    if (parcel.status !== "verified") throw conflict("parcel_unverified", "Only verified parcels can be listed");
    const [{ n }] = await tx.select({ n: sql<number>`count(*)::int` }).from(pods);
    const code = `Pod #${String(n + 1).padStart(2, "0")}`;
    const [pod] = await tx
      .insert(pods)
      .values({ code, parcelId: parcel.id, acquisitionCost: naira(input.acquisitionNaira), syndicatedPrice: syndicated, slotCount: input.slotCount, slotPrice: slot, legalFeeBp: input.legalFeeBp, createdBy: actor.id })
      .returning();
    await audit(tx, { actorType: "admin", actorId: actor.id, action: "pod.create", entity: "pod", entityId: pod.id, data: { code, syndicated, slot } });
    return pod;
  });
}

async function transition(db: Db, podId: string, to: PodStatus, fn: (pod: typeof pods.$inferSelect, tx: Tx) => Promise<void>) {
  return db.transaction(async (tx) => {
    const [pod] = await tx.select().from(pods).where(eq(pods.id, podId)).for("update");
    if (!pod) throw notFound("Pod");
    if (!canTransition(pod.status, to)) throw conflict("invalid_transition", `A ${pod.status} pod can't move to ${to}`);
    await fn(pod, tx);
  });
}

export async function publishPod(db: Db, actor: AdminActor, podId: string) {
  require(can.verify(actor) || can.money(actor), "Publishing needs a verifier or finance approver");
  return transition(db, podId, "open", async (pod, tx) => {
    fourEyes(pod.createdBy, actor, "publish this pod");
    const now = new Date();
    await tx.update(pods).set({ status: "open", publishedBy: actor.id, opensAt: now, expiresAt: new Date(now.getTime() + POD_FILL_DAYS * 86_400_000) }).where(eq(pods.id, podId));
    await audit(tx, { actorType: "admin", actorId: actor.id, action: "pod.publish", entity: "pod", entityId: podId });
  });
}

/** Step 1 of closing (maker): request release of escrow for a filled pod. */
export async function requestClose(db: Db, actor: AdminActor, podId: string) {
  require(can.editDeals(actor) || can.money(actor), "Not allowed");
  return db.transaction(async (tx) => {
    const [pod] = await tx.select().from(pods).where(eq(pods.id, podId)).for("update");
    if (!pod) throw notFound("Pod");
    if (pod.status !== "filled") throw conflict("not_filled", "Only a full pod can be closed");
    if (pod.closeRequestedBy) throw conflict("already_requested", "Closing has already been requested");
    await tx.update(pods).set({ closeRequestedBy: actor.id }).where(eq(pods.id, podId));
    await audit(tx, { actorType: "admin", actorId: actor.id, action: "pod.close.request", entity: "pod", entityId: podId });
  });
}

/** Step 2 (checker, finance): release escrow to acquisition and record the purchase. */
export async function approveClose(db: Db, actor: AdminActor, podId: string) {
  require(can.money(actor), "Only finance approvers can release escrow");
  return transition(db, podId, "closing", async (pod, tx) => {
    if (!pod.closeRequestedBy) throw conflict("not_requested", "Closing must be requested first");
    fourEyes(pod.closeRequestedBy, actor, "approve the escrow release");
    const claims = await tx.select().from(slotClaims).where(and(eq(slotClaims.podId, podId), eq(slotClaims.status, "held")));
    if (claims.length !== pod.slotCount) throw conflict("claims_mismatch", "Held claims don't match the slot count");

    let legalTotal = 0n;
    for (const c of claims) {
      legalTotal += c.legalFee;
      await post(tx, {
        kind: "escrow_release",
        idempotencyKey: `escrow-release:${c.id}`,
        memo: `${pod.code} escrow released for purchase`,
        userId: c.userId,
        podId,
        entries: [
          { account: accounts.escrow(c.userId, podId), amount: c.slotAmount + c.legalFee },
          { account: accounts.acquisition(podId), amount: -c.slotAmount },
          { account: accounts.legalFees(), amount: -c.legalFee },
        ],
      });
      await tx.update(slotClaims).set({ status: "converted" }).where(eq(slotClaims.id, c.id));
    }
    // Seller is paid the acquisition cost; the difference is the platform's land margin.
    const margin = pod.syndicatedPrice - pod.acquisitionCost;
    const entries = [
      { account: accounts.acquisition(podId), amount: pod.syndicatedPrice },
      { account: accounts.bank(), amount: -pod.acquisitionCost },
    ];
    if (margin > 0n) entries.push({ account: accounts.landMargin(), amount: -margin });
    await post(tx, { kind: "land_purchase", idempotencyKey: `purchase:${podId}`, memo: `${pod.code} land purchase`, podId, entries });

    await tx.update(pods).set({ status: "closing", closeApprovedBy: actor.id }).where(eq(pods.id, podId));
    for (const c of claims) await notify(tx, c.userId, `${pod.code}: purchase under way`, "Escrow has been released to buy the parcel. Your co-ownership certificate follows when the deed is executed.");
    await audit(tx, { actorType: "admin", actorId: actor.id, action: "pod.close.approve", entity: "pod", entityId: podId, data: { legalTotal, margin } });
  });
}

/** Step 3: deed executed; issue a certificate to each co-owner. */
export async function completeClose(db: Db, actor: AdminActor, podId: string, deedReference: string) {
  require(can.editDeals(actor) || can.verify(actor) || can.money(actor), "Not allowed");
  return transition(db, podId, "closed", async (pod, tx) => {
    const [parcel] = await tx.select().from(parcels).where(eq(parcels.id, pod.parcelId));
    const claims = await tx.select({ claim: slotClaims, name: users.fullName }).from(slotClaims).innerJoin(users, eq(users.id, slotClaims.userId)).where(and(eq(slotClaims.podId, podId), eq(slotClaims.status, "converted")));
    const issuedAt = new Date();
    const share = sharePercent(pod.slotCount);
    for (const { claim, name } of claims) {
      const code = `FV-${shortCode(8)}`;
      const payload = {
        version: 1,
        code,
        holder: name,
        podCode: pod.code,
        slotNumber: claim.slotNumber,
        slotCount: pod.slotCount,
        sharePercent: share,
        parcel: { title: parcel.title, location: parcel.locationText, state: parcel.state, lga: parcel.lga, latitude: parcel.latitude, longitude: parcel.longitude, sizeSqm: parcel.sizeSqm, titleType: parcel.titleType },
        deedReference,
        issuedAt: issuedAt.toISOString(),
      };
      await tx.insert(certificates).values({ code, userId: claim.userId, podId, claimId: claim.id, sharePercent: share, payload, sha256: sha256(JSON.stringify(payload)), issuedAt });
      await notify(tx, claim.userId, "Your co-ownership certificate is ready", `${pod.code} has closed. Your certificate for ${share}% of ${parcel.title} is in your Vault.`);
    }
    await tx.update(pods).set({ status: "closed", deedReference, closedAt: issuedAt }).where(eq(pods.id, podId));
    await audit(tx, { actorType: "admin", actorId: actor.id, action: "pod.close.complete", entity: "pod", entityId: podId, data: { deedReference, certificates: claims.length } });
  });
}

export async function overview(db: Db) {
  const [{ members }] = await db.select({ members: sql<number>`count(*)::int` }).from(users);
  const [{ tier2 }] = await db.select({ tier2: sql<number>`count(*)::int` }).from(users).where(eq(users.kycTier, 2));
  const platform = await balancesByPrefix(db, "platform:");
  const memberBalances = await balancesByPrefix(db, "member:");
  let available = 0n, escrow = 0n;
  for (const [code, v] of memberBalances) code.includes(":escrow:") ? (escrow += v) : (available += v);
  const bank = await balance(db, accounts.bank().code);
  const acquisitions = await balancesByPrefix(db, "pod:");
  let inAcquisition = 0n;
  for (const v of acquisitions.values()) inAcquisition += v;
  const unbalanced = await unbalancedTransactions(db);
  const podCounts = await db.select({ status: pods.status, n: sql<number>`count(*)::int` }).from(pods).groupBy(pods.status);
  const [{ txCount }] = await db.select({ txCount: sql<number>`count(*)::int` }).from(ledgerTransactions);
  return {
    members,
    tier2,
    pods: Object.fromEntries(podCounts.map((p) => [p.status, p.n])),
    ledger: {
      bankSettlement: toWire(bank),
      memberAvailable: toWire(available),
      memberEscrow: toWire(escrow),
      inAcquisition: toWire(inAcquisition),
      withdrawalFees: toWire(platform.get(accounts.withdrawalFees().code) ?? 0n),
      legalFees: toWire(platform.get(accounts.legalFees().code) ?? 0n),
      landMargin: toWire(platform.get(accounts.landMargin().code) ?? 0n),
      transactions: txCount,
      unbalancedTransactions: unbalanced,
      // Bank should equal everything owed to members + pods + platform revenue.
      reconciled: bank === available + escrow + inAcquisition + [...platform.values()].reduce((a, b) => a + b, 0n),
    },
  };
}

export async function recentAudit(db: Db, limit = 50) {
  return db.select().from(auditEvents).orderBy(desc(auditEvents.id)).limit(limit);
}

export async function listMembers(db: Db) {
  const rows = await db.select({ id: users.id, fullName: users.fullName, email: users.email, kycTier: users.kycTier, status: users.status, createdAt: users.createdAt }).from(users).orderBy(desc(users.createdAt)).limit(200);
  const bal = await balancesByPrefix(db, "member:");
  return rows.map((u) => {
    let available = 0n, escrow = 0n;
    for (const [code, v] of bal) if (code.startsWith(`member:${u.id}:`)) code.includes(":escrow:") ? (escrow += v) : (available += v);
    return { ...u, email: maskEmail(u.email), available: toWire(available), escrow: toWire(escrow) };
  });
}

export async function setMemberStatus(db: Db, actor: AdminActor, userId: string, status: "active" | "frozen", reason: string) {
  require(can.money(actor) || actor.role === "superadmin", "Only finance or superadmins can freeze accounts");
  await db.transaction(async (tx) => {
    await tx.update(users).set({ status }).where(eq(users.id, userId));
    await audit(tx, { actorType: "admin", actorId: actor.id, action: `member.${status}`, entity: "user", entityId: userId, data: { reason } });
  });
}

export async function listWindows(db: Db) {
  return db.select().from(withdrawalWindows).orderBy(withdrawalWindows.startsOn);
}

/** Demo helper: open a free withdrawal window starting today for N days. */
export async function addWindow(db: Db, actor: AdminActor, startsOn: string, endsOn: string, label: string) {
  require(can.money(actor), "Only finance approvers can change withdrawal windows");
  await db.transaction(async (tx) => {
    const [w] = await tx.insert(withdrawalWindows).values({ startsOn, endsOn, label }).returning();
    await audit(tx, { actorType: "admin", actorId: actor.id, action: "window.add", entity: "withdrawal_window", entityId: w.id, data: { startsOn, endsOn, label } });
  });
}

export async function removeWindow(db: Db, actor: AdminActor, id: string) {
  require(can.money(actor), "Only finance approvers can change withdrawal windows");
  await db.transaction(async (tx) => {
    await tx.delete(withdrawalWindows).where(eq(withdrawalWindows.id, id));
    await audit(tx, { actorType: "admin", actorId: actor.id, action: "window.remove", entity: "withdrawal_window", entityId: id });
  });
}

export async function cancelPodAdmin(db: Db, actor: AdminActor, podId: string, reason: string) {
  require(can.editDeals(actor) || can.money(actor), "Not allowed");
  const { endPod } = await import("./pods");
  await endPod(db, podId, "cancelled", { actorType: "admin", actorId: actor.id, reason });
}

