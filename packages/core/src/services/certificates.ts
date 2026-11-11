import { eq } from "drizzle-orm";
import type { DbLike } from "../db/client";
import { certificates, parcels, pods, users } from "../db/schema";
import { notFound, forbidden } from "../errors";

export async function getCertificate(db: DbLike, certificateId: string, userId: string) {
  const [row] = await db
    .select({ cert: certificates, pod: pods, parcel: parcels, user: { fullName: users.fullName } })
    .from(certificates)
    .innerJoin(pods, eq(pods.id, certificates.podId))
    .innerJoin(parcels, eq(parcels.id, pods.parcelId))
    .innerJoin(users, eq(users.id, certificates.userId))
    .where(eq(certificates.id, certificateId));
  if (!row) throw notFound("Certificate");
  if (row.cert.userId !== userId) throw forbidden();
  return {
    id: row.cert.id,
    code: row.cert.code,
    sha256: row.cert.sha256,
    issuedAt: row.cert.issuedAt,
    holderName: row.user.fullName,
    sharePercent: row.cert.sharePercent,
    payload: row.cert.payload,
    podCode: row.pod.code,
    deedReference: row.pod.deedReference,
    parcel: { title: row.parcel.title, locationText: row.parcel.locationText, state: row.parcel.state, lga: row.parcel.lga, latitude: row.parcel.latitude, longitude: row.parcel.longitude, sizeSqm: row.parcel.sizeSqm, titleType: row.parcel.titleType },
  };
}

/** Public verification by code. Returns no personal data. */
export async function verifyCertificate(db: DbLike, code: string) {
  if (!/^[A-Z0-9-]{6,32}$/.test(code)) throw notFound("Certificate");
  const [row] = await db
    .select({ cert: certificates, pod: pods, parcel: parcels })
    .from(certificates)
    .innerJoin(pods, eq(pods.id, certificates.podId))
    .innerJoin(parcels, eq(parcels.id, pods.parcelId))
    .where(eq(certificates.code, code));
  if (!row) throw notFound("Certificate");
  return {
    code: row.cert.code,
    valid: true,
    issuedAt: row.cert.issuedAt,
    podCode: row.pod.code,
    parcelTitle: row.parcel.title,
    state: row.parcel.state,
    sharePercent: row.cert.sharePercent,
    fingerprint: row.cert.sha256.slice(0, 16),
  };
}
