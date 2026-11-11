import { eq } from "drizzle-orm";
import { defaultWindowsForYear, naira } from "@fluravest/domain";
import type { Db } from "./db/client";
import { admins, goals, pods, users, withdrawalWindows } from "./db/schema";
import { hashPassword } from "./services/auth";
import * as kyc from "./services/kyc";
import * as wallet from "./services/wallet";
import * as podsSvc from "./services/pods";
import * as adminSvc from "./services/admin";
import type { AdminActor } from "./services/admin";

export const DEMO_PASSWORD = "FluraDemo2026!";

const MEMBERS = [
  { fullName: "Ada Okafor", email: "ada@fluravest.demo", phone: "08031234567" },
  { fullName: "Tunde Bakare", email: "tunde@fluravest.demo", phone: "08032345678" },
  { fullName: "Ngozi Eze", email: "ngozi@fluravest.demo", phone: "08033456789" },
  { fullName: "Ibrahim Musa", email: "ibrahim@fluravest.demo", phone: "08034567890" },
  { fullName: "Funke Adeyemi", email: "funke@fluravest.demo", phone: "08035678901" },
  { fullName: "Emeka Nwosu", email: "emeka@fluravest.demo", phone: "08036789012" },
  { fullName: "Zainab Lawal", email: "zainab@fluravest.demo", phone: "08037890123" },
  { fullName: "Segun Ojo", email: "segun@fluravest.demo", phone: "08038901234" },
  { fullName: "Halima Yusuf", email: "halima@fluravest.demo", phone: "08039012345" },
];

const PARCELS = [
  { key: "kuje", title: "Kuje Garden Estate, Plot 42", locationText: "Kuje Road, off Airport Road", state: "FCT", lga: "Kuje", latitude: 8.8794, longitude: 7.2276, sizeSqm: 600, titleType: "C of O" as const, hasSurveyPlan: true, description: "Dry, level residential plot in an approved layout with road access and nearby electricity." },
  { key: "epe", title: "Epe Prime Parcel", locationText: "Itoikin Road, Epe", state: "Lagos", lga: "Epe", latitude: 6.5841, longitude: 3.9834, sizeSqm: 500, titleType: "Gazette" as const, hasSurveyPlan: true, description: "Gazetted land close to the Epe–Lekki corridor. Excision and survey documents reviewed." },
  { key: "minna", title: "Minna Suburban Layout", locationText: "Maitumbi, Minna", state: "Niger", lga: "Bosso", latitude: 9.6139, longitude: 6.5569, sizeSqm: 900, titleType: "Registered Survey" as const, hasSurveyPlan: true, description: "Corner plot in a growing suburban layout, 10 minutes from the city centre." },
  { key: "ibeju", title: "Ibeju Residential Zone", locationText: "Akodo, Ibeju-Lekki", state: "Lagos", lga: "Ibeju-Lekki", latitude: 6.4467, longitude: 4.0569, sizeSqm: 648, titleType: "C of O" as const, hasSurveyPlan: true, description: "Residential plot in a fenced estate with a perimeter road." },
  { key: "akobo", title: "Akobo Extension Plot 7", locationText: "Akobo, Ibadan", state: "Oyo", lga: "Lagelu", latitude: 7.4363, longitude: 3.9470, sizeSqm: 450, titleType: "Deed of Assignment" as const, hasSurveyPlan: true, description: "Starter plot in a quiet residential extension. Good first pod for new members." },
  { key: "ekiti", title: "Ado-Ekiti GRA Plots", locationText: "GRA Extension, Ado-Ekiti", state: "Ekiti", lga: "Ado", latitude: 7.6219, longitude: 5.2210, sizeSqm: 700, titleType: "Governor's Consent" as const, hasSurveyPlan: true, description: "Government Reserved Area extension plot with an approved layout plan." },
  { key: "mowe", title: "Mowe Gateway Plot", locationText: "Lagos–Ibadan Expressway, Mowe", state: "Ogun", lga: "Obafemi Owode", latitude: 6.8106, longitude: 3.4369, sizeSqm: 500, titleType: "Registered Survey" as const, hasSurveyPlan: true, description: "Awaiting title verification by a second admin." },
];

/** Seeds a coherent demo world through the real services, so every balance comes from the ledger. */
export async function seedDemo(db: Db) {
  const existing = await db.select({ id: admins.id }).from(admins).limit(1);
  if (existing.length) return { seeded: false, reason: "Database already has data" };

  const pw = await hashPassword(DEMO_PASSWORD);
  const [ops, verifier, finance] = await db
    .insert(admins)
    .values([
      { email: "ops@fluravest.demo", name: "Tolu Adebayo", role: "ops", passwordHash: pw },
      { email: "verifier@fluravest.demo", name: "Chidi Okeke", role: "verifier", passwordHash: pw },
      { email: "finance@fluravest.demo", name: "Amina Bello", role: "finance", passwordHash: pw },
    ])
    .returning();
  const actor = (a: typeof ops): AdminActor => ({ id: a.id, role: a.role, name: a.name });

  const year = new Date().getUTCFullYear();
  await db.insert(withdrawalWindows).values([...defaultWindowsForYear(year), ...defaultWindowsForYear(year + 1)].map((w) => ({ ...w, label: w.label! })));

  const m: Record<string, string> = {};
  let i = 0;
  for (const mem of MEMBERS) {
    i++;
    const [u] = await db
      .insert(users)
      .values({ ...mem, passwordHash: pw, nextOfKinName: "Next Of Kin", nextOfKinPhone: "08020000000", termsAcceptedAt: new Date() })
      .returning();
    m[mem.email.split("@")[0]] = u.id;
    await kyc.completeTier2(db, u.id, { bvn: `2222222220${i}`.slice(-11), nin: "", address: `${i} Demo Street, Victoria Island`, state: "Lagos", bankCode: "058", accountNumber: `01234567${String(i).padStart(2, "0")}` });
  }

  const parcelIds: Record<string, string> = {};
  for (const { key, ...p } of PARCELS) {
    const parcel = await adminSvc.createParcel(db, actor(ops), p);
    parcelIds[key] = parcel.id;
    if (key !== "mowe") await adminSvc.verifyParcel(db, actor(verifier), parcel.id, "verified", "Title, survey plan and search report reviewed. Matches the land registry.");
  }

  const mkPod = async (key: string, acq: number, synd: number, slots: number) => {
    const pod = await adminSvc.createPod(db, actor(ops), { parcelId: parcelIds[key], acquisitionNaira: acq, syndicatedNaira: synd, slotCount: slots as 5 | 6, legalFeeBp: 300 });
    await adminSvc.publishPod(db, actor(verifier), pod.id);
    return pod.id;
  };
  const fund = (who: string, amount: number) => wallet.deposit(db, m[who], amount, "transfer", `seed-${who}-${amount}-${Math.random()}`);
  const claim = async (who: string, podId: string) => {
    const q = await podsSvc.createClaimQuote(db, m[who], podId);
    await podsSvc.confirmClaim(db, m[who], q.quoteId);
  };

  // Everyone gets enough to take part.
  for (const who of Object.keys(m)) await fund(who, who === "ada" ? 1_780_000 : 5_000_000);

  // Pod #01 — closed, Ada is a co-owner with a certificate.
  const kuje = await mkPod("kuje", 2_700_000, 3_000_000, 6);
  for (const who of ["ada", "tunde", "ngozi", "ibrahim", "funke", "emeka"]) await claim(who, kuje);
  await adminSvc.requestClose(db, actor(ops), kuje);
  await adminSvc.approveClose(db, actor(finance), kuje);
  await adminSvc.completeClose(db, actor(ops), kuje, "FCT/LR/2026/DEED/004213");

  // Pod #02 — Epe, 4 of 6, Ada holds a slot (matches the PRD home screen).
  const epe = await mkPod("epe", 2_700_000, 3_000_000, 6);
  for (const who of ["ada", "zainab", "segun", "halima"]) await claim(who, epe);

  // Pod #03 — Minna, 4 of 6.
  const minna = await mkPod("minna", 5_400_000, 6_000_000, 6);
  for (const who of ["tunde", "ngozi", "ibrahim", "funke"]) await claim(who, minna);

  // Pod #04 — Ibeju, 4 of 5.
  const ibeju = await mkPod("ibeju", 13_500_000, 15_000_000, 5);
  for (const who of ["emeka", "zainab", "segun", "halima"]) await claim(who, ibeju);

  // Pod #05 — Akobo starter pod, 3 of 6: Ada can join live in the demo.
  const akobo = await mkPod("akobo", 1_080_000, 1_200_000, 6);
  for (const who of ["tunde", "ngozi", "ibrahim"]) await claim(who, akobo);

  // Pod #06 — Ekiti, full and waiting for the admin closing flow.
  const ekiti = await mkPod("ekiti", 4_500_000, 5_000_000, 5);
  for (const who of ["funke", "emeka", "zainab", "segun", "halima"]) await claim(who, ekiti);

  // Vary deadlines so the marketplace looks real.
  const days = (n: number) => new Date(Date.now() + n * 86_400_000);
  await db.update(pods).set({ expiresAt: days(18) }).where(eq(pods.id, epe));
  await db.update(pods).set({ expiresAt: days(9) }).where(eq(pods.id, minna));
  await db.update(pods).set({ expiresAt: days(4) }).where(eq(pods.id, ibeju));
  await db.update(pods).set({ expiresAt: days(26) }).where(eq(pods.id, akobo));

  await db.insert(goals).values({ userId: m.ada, name: "Land Seed Fund", targetKobo: naira(2_000_000) });

  return { seeded: true, members: MEMBERS.length, admins: 3, pods: 6, password: "see README" };
}
