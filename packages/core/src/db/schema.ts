import { sql } from "drizzle-orm";
import {
  bigint,
  bigserial,
  boolean,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const id = () => uuid("id").primaryKey().defaultRandom();
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const kobo = (name: string) => bigint(name, { mode: "bigint" });

export const userStatus = pgEnum("user_status", ["active", "frozen", "closed"]);
export const adminRole = pgEnum("admin_role", ["ops", "verifier", "finance", "superadmin"]);
export const ledgerKind = pgEnum("ledger_kind", ["asset", "liability", "revenue"]);
export const podStatus = pgEnum("pod_status", ["draft", "open", "filled", "closing", "closed", "expired", "cancelled"]);
export const claimStatus = pgEnum("claim_status", ["held", "released", "converted"]);
export const parcelStatus = pgEnum("parcel_status", ["draft", "verified", "rejected"]);

// ── Identity ────────────────────────────────────────────────────────────────

export const users = pgTable("users", {
  id: id(),
  email: text("email").notNull().unique(),
  fullName: text("full_name").notNull(),
  phone: text("phone").notNull(),
  passwordHash: text("password_hash").notNull(),
  kycTier: integer("kyc_tier").notNull().default(1),
  status: userStatus("status").notNull().default("active"),
  nextOfKinName: text("next_of_kin_name").notNull(),
  nextOfKinPhone: text("next_of_kin_phone").notNull(),
  termsAcceptedAt: timestamp("terms_accepted_at", { withTimezone: true }).notNull(),
  createdAt: createdAt(),
});

export const admins = pgTable("admins", {
  id: id(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  role: adminRole("role").notNull(),
  passwordHash: text("password_hash").notNull(),
  createdAt: createdAt(),
});

/** Session id is the SHA-256 of the cookie token; the raw token is never stored. */
export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    adminId: uuid("admin_id").references(() => admins.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    userAgent: text("user_agent"),
    createdAt: createdAt(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const loginAttempts = pgTable(
  "login_attempts",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    key: text("key").notNull(),
    succeeded: boolean("succeeded").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("login_attempts_key_idx").on(t.key, t.createdAt)],
);

/** BVN/NIN/address are AES-256-GCM encrypted; *_hash is an HMAC used only for uniqueness. */
export const kycRecords = pgTable("kyc_records", {
  id: id(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }).unique(),
  bvnEnc: text("bvn_enc").notNull(),
  bvnHash: text("bvn_hash").notNull().unique(),
  bvnLast4: text("bvn_last4").notNull(),
  ninEnc: text("nin_enc"),
  ninLast4: text("nin_last4"),
  addressEnc: text("address_enc").notNull(),
  state: text("state").notNull(),
  provider: text("provider").notNull(),
  providerRef: text("provider_ref").notNull(),
  verifiedAt: timestamp("verified_at", { withTimezone: true }).notNull(),
  createdAt: createdAt(),
});

export const bankAccounts = pgTable("bank_accounts", {
  id: id(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  bankCode: text("bank_code").notNull(),
  bankName: text("bank_name").notNull(),
  accountNumberEnc: text("account_number_enc").notNull(),
  accountNumberLast4: text("account_number_last4").notNull(),
  accountName: text("account_name").notNull(),
  verifiedAt: timestamp("verified_at", { withTimezone: true }).notNull(),
  /** Withdrawals to this account are blocked until this time (cooling-off after a change). */
  usableFrom: timestamp("usable_from", { withTimezone: true }).notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: createdAt(),
});

// ── Ledger ──────────────────────────────────────────────────────────────────
// Double-entry: every transaction's entries sum to zero. Debits positive, credits negative.
// Liability and revenue balances are therefore -sum(amount).

export const ledgerAccounts = pgTable("ledger_accounts", {
  id: id(),
  code: text("code").notNull().unique(),
  kind: ledgerKind("kind").notNull(),
  userId: uuid("user_id").references(() => users.id),
  podId: uuid("pod_id"),
  createdAt: createdAt(),
});

export const ledgerTransactions = pgTable("ledger_transactions", {
  id: id(),
  kind: text("kind").notNull(),
  idempotencyKey: text("idempotency_key").notNull().unique(),
  userId: uuid("user_id").references(() => users.id),
  podId: uuid("pod_id"),
  memo: text("memo").notNull(),
  createdAt: createdAt(),
});

export const ledgerEntries = pgTable(
  "ledger_entries",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    transactionId: uuid("transaction_id").notNull().references(() => ledgerTransactions.id),
    accountId: uuid("account_id").notNull().references(() => ledgerAccounts.id),
    amount: kobo("amount").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("ledger_entries_account_idx").on(t.accountId), index("ledger_entries_tx_idx").on(t.transactionId)],
);

// ── Wallet ──────────────────────────────────────────────────────────────────

export const goals = pgTable("goals", {
  id: id(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  targetKobo: kobo("target_kobo").notNull(),
  createdAt: createdAt(),
});

export const deposits = pgTable("deposits", {
  id: id(),
  userId: uuid("user_id").notNull().references(() => users.id),
  amount: kobo("amount").notNull(),
  method: text("method").notNull(),
  status: text("status").notNull(),
  provider: text("provider").notNull(),
  providerRef: text("provider_ref").notNull().unique(),
  transactionId: uuid("transaction_id").references(() => ledgerTransactions.id),
  createdAt: createdAt(),
});

export const withdrawalWindows = pgTable("withdrawal_windows", {
  id: id(),
  startsOn: date("starts_on").notNull(),
  endsOn: date("ends_on").notNull(),
  label: text("label").notNull(),
  createdAt: createdAt(),
});

/** Server-issued quotes the member confirms; single use and short-lived. */
export const quotes = pgTable("quotes", {
  id: id(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  payload: jsonb("payload").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: createdAt(),
});

export const withdrawals = pgTable("withdrawals", {
  id: id(),
  userId: uuid("user_id").notNull().references(() => users.id),
  bankAccountId: uuid("bank_account_id").notNull().references(() => bankAccounts.id),
  gross: kobo("gross").notNull(),
  fee: kobo("fee").notNull(),
  net: kobo("net").notNull(),
  status: text("status").notNull(),
  providerRef: text("provider_ref").notNull(),
  transactionId: uuid("transaction_id").notNull().references(() => ledgerTransactions.id),
  createdAt: createdAt(),
});

// ── Land pods ───────────────────────────────────────────────────────────────

export const parcels = pgTable("parcels", {
  id: id(),
  title: text("title").notNull(),
  locationText: text("location_text").notNull(),
  state: text("state").notNull(),
  lga: text("lga").notNull(),
  latitude: doublePrecision("latitude").notNull(),
  longitude: doublePrecision("longitude").notNull(),
  sizeSqm: integer("size_sqm").notNull(),
  titleType: text("title_type").notNull(),
  hasSurveyPlan: boolean("has_survey_plan").notNull(),
  description: text("description").notNull().default(""),
  status: parcelStatus("status").notNull().default("draft"),
  createdBy: uuid("created_by").notNull().references(() => admins.id),
  verifiedBy: uuid("verified_by").references(() => admins.id),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  verificationNotes: text("verification_notes"),
  createdAt: createdAt(),
});

export const pods = pgTable("pods", {
  id: id(),
  code: text("code").notNull().unique(),
  parcelId: uuid("parcel_id").notNull().references(() => parcels.id),
  acquisitionCost: kobo("acquisition_cost").notNull(),
  syndicatedPrice: kobo("syndicated_price").notNull(),
  slotCount: integer("slot_count").notNull(),
  slotPrice: kobo("slot_price").notNull(),
  legalFeeBp: integer("legal_fee_bp").notNull(),
  status: podStatus("status").notNull().default("draft"),
  createdBy: uuid("created_by").notNull().references(() => admins.id),
  publishedBy: uuid("published_by").references(() => admins.id),
  opensAt: timestamp("opens_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  filledAt: timestamp("filled_at", { withTimezone: true }),
  closeRequestedBy: uuid("close_requested_by").references(() => admins.id),
  closeApprovedBy: uuid("close_approved_by").references(() => admins.id),
  deedReference: text("deed_reference"),
  closedAt: timestamp("closed_at", { withTimezone: true }),
  createdAt: createdAt(),
});

export const slotClaims = pgTable(
  "slot_claims",
  {
    id: id(),
    podId: uuid("pod_id").notNull().references(() => pods.id),
    userId: uuid("user_id").notNull().references(() => users.id),
    slotNumber: integer("slot_number").notNull(),
    slotAmount: kobo("slot_amount").notNull(),
    legalFee: kobo("legal_fee").notNull(),
    status: claimStatus("status").notNull().default("held"),
    releasedAt: timestamp("released_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    // Backstop against overselling: an active slot number can only be held once per pod.
    uniqueIndex("slot_claims_active_slot").on(t.podId, t.slotNumber).where(sql`status <> 'released'`),
    uniqueIndex("slot_claims_active_member").on(t.podId, t.userId).where(sql`status <> 'released'`),
  ],
);

export const certificates = pgTable("certificates", {
  id: id(),
  code: text("code").notNull().unique(),
  userId: uuid("user_id").notNull().references(() => users.id),
  podId: uuid("pod_id").notNull().references(() => pods.id),
  claimId: uuid("claim_id").notNull().references(() => slotClaims.id).unique(),
  sharePercent: text("share_percent").notNull(),
  payload: jsonb("payload").notNull(),
  sha256: text("sha256").notNull(),
  issuedAt: timestamp("issued_at", { withTimezone: true }).notNull().defaultNow(),
});

// ── Cross-cutting ───────────────────────────────────────────────────────────

export const notifications = pgTable(
  "notifications",
  {
    id: id(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    body: text("body").notNull(),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("notifications_user_idx").on(t.userId, t.createdAt)],
);

/** Append-only and hash-chained: each row's hash covers the previous row's hash. */
export const auditEvents = pgTable("audit_events", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  actorType: text("actor_type").notNull(),
  actorId: text("actor_id"),
  action: text("action").notNull(),
  entity: text("entity").notNull(),
  entityId: text("entity_id"),
  data: jsonb("data").notNull().default({}),
  prevHash: text("prev_hash").notNull(),
  hash: text("hash").notNull(),
  createdAt: createdAt(),
});
