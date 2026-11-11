import { and, eq } from "drizzle-orm";
import type { KycTier2Input } from "@fluravest/domain";
import type { Db } from "../db/client";
import { bankAccounts, kycRecords, users } from "../db/schema";
import { blindIndex, encrypt } from "../crypto";
import { AppError, conflict, notFound } from "../errors";
import { providers } from "../providers";
import { audit } from "../audit";
import { notify } from "./notify";

/** Payout accounts added or changed later are held for this long before withdrawals can use them. */
export const BANK_CHANGE_COOLING_OFF_HOURS = 24;

export async function completeTier2(db: Db, userId: string, input: KycTier2Input) {
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user) throw notFound("User");
  if (user.kycTier >= 2) throw conflict("already_verified", "Your identity is already verified");

  const bvnHash = blindIndex(`bvn:${input.bvn}`);
  const dup = await db.select({ id: kycRecords.id }).from(kycRecords).where(eq(kycRecords.bvnHash, bvnHash));
  if (dup.length) throw conflict("bvn_in_use", "This BVN is already linked to another account");

  const bvn = await providers.kyc.verifyBvn(input.bvn);
  if (!bvn.ok) throw new AppError(422, "bvn_failed", "We couldn't verify this BVN. Check the number and try again.");

  const bank = providers.banks.banks().find((b) => b.code === input.bankCode);
  const resolved = await providers.banks.resolveAccount(input.bankCode, input.accountNumber, user.fullName);
  if (!bank || !resolved.ok || resolved.accountName?.toUpperCase() !== user.fullName.toUpperCase()) {
    throw new AppError(422, "account_name_mismatch", "The payout account name must match your verified legal name");
  }

  await db.transaction(async (tx) => {
    const now = new Date();
    await tx.insert(kycRecords).values({
      userId,
      bvnEnc: encrypt(input.bvn),
      bvnHash,
      bvnLast4: input.bvn.slice(-4),
      ninEnc: input.nin ? encrypt(input.nin) : null,
      ninLast4: input.nin ? input.nin.slice(-4) : null,
      addressEnc: encrypt(input.address),
      state: input.state,
      provider: providers.kyc.name,
      providerRef: bvn.ref,
      verifiedAt: now,
    });
    await tx.update(bankAccounts).set({ active: false }).where(and(eq(bankAccounts.userId, userId), eq(bankAccounts.active, true)));
    await tx.insert(bankAccounts).values({
      userId,
      bankCode: bank.code,
      bankName: bank.name,
      accountNumberEnc: encrypt(input.accountNumber),
      accountNumberLast4: input.accountNumber.slice(-4),
      accountName: resolved.accountName!,
      verifiedAt: now,
      // First account added at KYC is usable immediately; later changes get a cooling-off period.
      usableFrom: now,
    });
    await tx.update(users).set({ kycTier: 2 }).where(eq(users.id, userId));
    await notify(tx, userId, "Identity verified", "You're now Tier 2. You can fund your wallet, claim pod slots and withdraw.");
    await audit(tx, { actorType: "member", actorId: userId, action: "kyc.tier2.completed", entity: "user", entityId: userId, data: { bvnLast4: input.bvn.slice(-4), provider: providers.kyc.name } });
  });
}

export async function profile(db: Db, userId: string) {
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user) throw notFound("User");
  const [kyc] = await db.select({ bvnLast4: kycRecords.bvnLast4, ninLast4: kycRecords.ninLast4, state: kycRecords.state, verifiedAt: kycRecords.verifiedAt }).from(kycRecords).where(eq(kycRecords.userId, userId));
  const [bank] = await db
    .select({ bankName: bankAccounts.bankName, last4: bankAccounts.accountNumberLast4, accountName: bankAccounts.accountName, usableFrom: bankAccounts.usableFrom })
    .from(bankAccounts)
    .where(and(eq(bankAccounts.userId, userId), eq(bankAccounts.active, true)));
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    phone: user.phone,
    kycTier: user.kycTier,
    status: user.status,
    nextOfKinName: user.nextOfKinName,
    kyc: kyc ?? null,
    bank: bank ?? null,
  };
}
