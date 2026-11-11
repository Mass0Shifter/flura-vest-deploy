# FluraVest — App Architecture (Draft v0.1)

**Status:** Draft for review. No code has been scaffolded. Sections marked **[ASSUMPTION]** are my default choice and will change if you answer the open questions in §2 differently.
**Prepared:** 28 Oct 2026
**Inputs:** `docs/Flura-vest Updated MVP Product Requirements Document.pdf` (PRD v2.0), `docs/FluraVest_Current_Brand_Identity_and_Rationale.pdf`, `Branding/Brand Kit v2/` (tokens, logo, master document v2).

---

## 1. Summary

FluraVest MVP is a mobile-first Progressive Web App with two phases:

1. **Accumulation** — an open-ended savings wallet with optional goals, a quarterly 10-day free withdrawal window, and a 5% fee on withdrawals outside it.
2. **Land Pods** — verified land parcels split into 5–6 equal slots. Members lock a slot amount into escrow; when the pod fills, funds move to acquisition, the land is bought, and each member gets a digital co-ownership certificate in their Vault.

Plus an internal **Admin / Deal Operations console** for listing deals, verifying titles, watching escrow and issuing certificates.

The recommended shape is a **TypeScript monorepo**: a Next.js PWA for members, a separate Next.js admin console, and a dedicated API service backed by PostgreSQL with a **double-entry ledger**. Money never sits with FluraVest: it sits with a licensed bank/MFB partner, and FluraVest's ledger mirrors and reconciles against that partner every day.

```
                 ┌──────────────────────┐      ┌──────────────────────┐
  Members ──────▶│  apps/web  (PWA)     │      │ apps/admin (Ops)     │◀── Staff (SSO + MFA,
  (phone browser)│  Next.js + Tailwind  │      │ Next.js, IP-allowed  │     maker-checker)
                 └─────────┬────────────┘      └─────────┬────────────┘
                           │ HTTPS (BFF, httpOnly cookie) │
                           ▼                              ▼
                 ┌─────────────────────────────────────────────────────┐
                 │                 apps/api  (NestJS)                   │
                 │  Identity · Wallet · Ledger · Withdrawals · Pods ·   │
                 │  Escrow · Closing · Certificates · Notifications ·   │
                 │  Admin · Audit · Compliance                          │
                 └───┬─────────────┬───────────────┬───────────────┬───┘
                     │             │               │               │
              PostgreSQL       Redis/BullMQ     S3 (KMS,        Outbox → workers
              (ledger, RLS)    (jobs, limits)   object lock)    (webhooks, PDFs, SMS)
                     │
     ┌───────────────┼───────────────────────┬──────────────────────┬────────────────┐
     ▼               ▼                       ▼                      ▼                ▼
 Custodian bank / MFB   Payment gateway        KYC provider        SMS / WhatsApp     Email
 (wallets, virtual      (card, USSD, transfer  (BVN, NIN, liveness, (OTP, pod alerts) (receipts)
  accounts, escrow,      collections; payouts) address)
  payouts)
```

---

## 2. Open questions (please answer before build)

The first two decide whether the product can legally launch as written; the rest shape the build.

| # | Question | Why it matters | My default if you don't decide |
|---|---|---|---|
| **Q1** | **Who holds the licences?** Which CBN-licensed bank or MFB will hold savings and escrow, and has a lawyer confirmed how the Land Pods are classed under SEC rules (the Investments and Securities Act 2025, crowdfunding / collective investment scheme rules)? | PRD v2 has FluraVest pooling member money, buying land and selling slots at a 10–15% markup. That looks like a collective investment scheme, and holding savings looks like deposit-taking. The brand document (§11–12) says FluraVest must *partner* for regulated functions and set up the licensed structure first. The architecture assumes a partner holds all funds, but the go-live gate is legal, not technical. | Build against a partner-bank abstraction; launch behind a "pilot / waitlist" flag until legal sign-off. |
| **Q2** | **How is title held after closing?** Each member's name on the deed, or a trustee / SPV holding the land for the pod? | Decides what the "Fractional Property Certificate" legally is, what the closing workflow records, and how resale of a slot (PRD §6.2) can ever work. | Trustee/SPV model; the certificate is evidence of beneficial interest, not the title itself. |
| **Q3** | **Platforms.** PWA only for MVP, or native iOS/Android too? When? | iOS only delivers web push to PWAs added to the home screen, so SMS/WhatsApp must carry critical alerts. A native app later can reuse the tokens (`tokens.ts`) and domain packages if we stay on TypeScript. | PWA now; React Native (Expo) later, sharing `packages/domain` and tokens. |
| **Q4** | **Team and stack.** Who builds and maintains this after MVP? Any language or cloud preference, and a rough monthly infra budget? | I'm recommending full TypeScript (Next.js + NestJS + Postgres). If your team is Laravel, Django or Flutter, I'll re-plan. | TypeScript end to end, hosted on AWS. |
| **Q5** | **Providers.** Already chosen a payment gateway (Paystack / Flutterwave / Monnify), a KYC provider (Smile ID / Dojah / Prembly / VerifyMe) or an SMS provider (Termii)? | Each has different virtual-account, webhook and payout models. | Adapters for Paystack (collections), partner bank (wallet/escrow/payouts), Smile ID or Dojah (KYC), Termii (SMS/WhatsApp). |
| **Q6** | **Data residency.** Must data be hosted in Nigeria, or is AWS Cape Town / Europe acceptable to your partner bank and under your NDPA assessment? | Banks often require it contractually. | AWS `af-south-1` (Cape Town); revisit if the bank requires in-country hosting. |
| **Q7** | **MVP scope.** The brand document also describes the Earn-First Engine, Ownership Passport and Partner Portal. Are those out of the MVP? | PRD v2 doesn't include them; leaving them out keeps the first release small. | Out of MVP. Schema leaves room for a Passport (activity/milestone records) later. |
| **Q8** | **Fee rules.** Has the 5% early-withdrawal fee been reviewed for consumer-protection (FCCPC) and partner-bank rules? Is the 30-day pod refund automatic or member-initiated? Are legal/admin fees (2–5%) charged at slot claim or at closing? | Changes ledger postings and the copy in the withdrawal and claim flows. | Fee is shown and confirmed before every withdrawal; refund is automatic at expiry; legal fee is collected at closing. |
| **Q9** | **Launch scale and date.** Expected members in the first 6 months, and target launch date? | Sizing, and whether a pilot cohort comes first. | < 10,000 members, invite-only pilot first. |

---

## 3. Brand and product-copy alignment

The Brand Kit v2 (in `Branding/Brand Kit v2/`) is the source of truth for the UI. Conflicts found in the PRD:

| PRD v2 says | Brand Kit v2 / guardrails say | Architecture decision |
|---|---|---|
| §7 prompt: charcoal `#111827`, gold `#CA8A04`, Inter | Navy `#0A2A4A`, greens `#16A34A` / `#22C55E`, text-safe green `#15803D`, Soft White `#F4F8F7`, **Plus Jakarta Sans only**, no gradients in UI | Use Brand Kit v2 tokens only. The §7 AI-builder prompt should not be used as-is. |
| "Total Portfolio", "co-investors", "inflation-hedged land assets" | Never present a goal balance as an investment product; no guaranteed returns | Copy lives in one content file and goes through a review step. Use "wallet balance", "co-buyers", "slot". No return, yield or appreciation figures in the UI. |
| Primary buttons (implied green + white) | Primary button = Bright Green fill + **navy label** (white on green fails WCAG) | Enforced in the shared `Button` component. |
| "Verified Location", title badges | Never show unverified assets as verified | A "Verified" badge only renders when the deal has a completed, signed-off verification record (§7.4). |

Tokens are consumed, never copied by hand: `packages/tokens` imports `tailwind.preset.js`, `fluravest-tokens.css` and `tokens.ts` from the brand kit, so a brand update is one sync.

---

## 4. Tech stack [ASSUMPTION — see Q4]

| Layer | Choice | Why |
|---|---|---|
| Monorepo | pnpm workspaces + Turborepo | One repo, shared types and tokens, cached builds. |
| Member app | **Next.js (App Router) + React + TypeScript**, Tailwind with brand preset, Lucide icons, Serwist for the service worker / PWA | Matches the PRD (PWA, React, Tailwind, Lucide); server rendering helps low-end phones and slow networks. |
| Admin console | Separate Next.js app, same UI package | Separate deploy, separate domain, stricter access. Never shipped to members. |
| API | **NestJS** (TypeScript) | Modules map cleanly to the domains below; guards for auth/RBAC; mature for fintech-style services. |
| Database | **PostgreSQL 16** (AWS RDS, Multi-AZ, encrypted) | Transactions and row locks for the ledger and slot claims. |
| ORM / migrations | Drizzle ORM + SQL migrations | Explicit SQL; easy to write locking queries. |
| Jobs | Redis + BullMQ | Webhook processing, pod expiry, reconciliation, PDFs, notifications. |
| Files | S3 with SSE-KMS; Object Lock for issued certificates | Tamper-evident documents. |
| Validation | Zod schemas in `packages/domain`, shared by web, admin and API | One definition of every request. |
| Infra | AWS (ECS Fargate or App Runner), CloudFront + WAF, Secrets Manager, KMS; Terraform | Managed, auditable, reproducible. |
| Observability | OpenTelemetry → Grafana Cloud or Datadog; Sentry for errors (PII scrubbing on) | Traces across webhook → ledger → notification. |
| CI/CD | GitHub Actions: lint, typecheck, tests, SAST (CodeQL/Semgrep), dependency + secret scanning, container scan, migration check | Every merge is gated. |

### Repository layout (to be created only after approval)

```
flura-vest/
  apps/
    web/            member PWA
    admin/          deal-operations console
    api/            NestJS service + workers
  packages/
    domain/         money type, Zod schemas, state machines, shared enums
    ui/             components built on brand tokens (Button, Card, PodProgress, ...)
    tokens/         re-exports Branding/Brand Kit v2/tokens
    config/         eslint, tsconfig, prettier
  infra/            Terraform
  docs/             PRD, brand identity, this document, ADRs
  Branding/         owned by the brand thread, read-only here
```

---

## 5. Domain model

Money is always **integer kobo** (`bigint`), currency `NGN`, never floats. All timestamps UTC; business rules (withdrawal windows, pod deadlines) evaluate in `Africa/Lagos`.

Core entities:

- **User** — profile, contact, next of kin, KYC tier, status (active / frozen / closed).
- **KycRecord** — provider, check type (BVN, NIN, liveness, address), result, reference. BVN/NIN stored encrypted (§8.3).
- **BankAccount** — payout account; name must match the verified legal name; changes trigger a cooling-off period.
- **Wallet** — one per user, backed by a partner-bank sub-account or virtual account.
- **Goal** — optional label + target amount; purely a view over the wallet, never a separate balance.
- **LedgerAccount / LedgerEntry / LedgerTransaction** — double-entry (§6).
- **Deposit / Withdrawal** — each with provider reference, idempotency key, status.
- **Parcel** — location (coordinates, LGA, state), size, title type (C of O, Gazette, Deed of Assignment), survey plan, documents.
- **Verification** — who checked what document, when, with sign-off by a second admin.
- **Pod** — parcel, acquisition cost, syndicated price, slot count (5 or 6), slot price, opens_at, expires_at (opens + 30 days), status.
- **SlotClaim** — user, pod, amount, status (held / released / converted).
- **Closing** — escrow release, purchase evidence, legal fee postings, deed reference.
- **Certificate** — per member per pod: share %, parcel details, PDF hash, QR verification ID, issued_at.
- **Notification**, **AuditEvent**, **Consent**.

### Pod state machine

```
draft ──(maker-checker publish)──▶ open ──(claims)──▶ open
                                    │  last slot claimed (atomic)
                                    ▼
                                  filled ── funds locked, no cancellations
                                    │ escrow released to acquisition account
                                    ▼
                                  closing ── purchase + deed in progress
                                    │ deed executed, docs uploaded, 2nd admin signs off
                                    ▼
                                  closed ── certificates issued to each Vault

open ──(30 days pass, not full)──▶ expired ── all claims released, zero fee
open ──(admin, with reason)──────▶ cancelled ── all claims released, zero fee
filled/closing ──(purchase fails)─▶ unwinding ── funds returned per policy (needs legal definition)
```

Members can cancel a claim only while the pod is `open` (PRD §6.1). Once `filled`, cancellation is closed.

---

## 6. Money movement and the ledger

### 6.1 Principles

1. **The partner bank holds the money; FluraVest holds the record.** Every balance shown in the app is computed from FluraVest's ledger, which is reconciled daily against the partner's statements. A mismatch freezes the affected flows and alerts operations.
2. **Double-entry, append-only.** Every movement is a transaction whose entries sum to zero. No balance column is ever updated directly; corrections are reversing entries.
3. **Idempotent everywhere.** Every client request that moves money carries an idempotency key; every provider webhook is de-duplicated by provider event ID.
4. **Quotes before commitments.** Withdrawals and slot claims first return a server-signed quote (amount, fee, net, expiry ~2 minutes) which the member confirms.

### 6.2 Ledger accounts

| Account | Type | Meaning |
|---|---|---|
| `member:{id}:available` | liability | Money the member can withdraw or use |
| `member:{id}:escrow:{pod}` | liability | Money held against a slot claim |
| `pod:{id}:acquisition` | liability → cleared at purchase | Funds released for buying the parcel |
| `platform:fees:withdrawal` | revenue | 5% early-withdrawal fees |
| `platform:fees:legal` | revenue | Deed / survey / title fees |
| `platform:margin:land` | revenue | Difference between syndicated and acquisition price |
| `bank:settlement` | asset | Mirror of funds at the partner bank |

### 6.3 Key postings

- **Deposit confirmed** (verified webhook): `bank:settlement` Dr / `member:available` Cr.
- **Slot claim**: `member:available` Dr / `member:escrow:{pod}` Cr (plus the partner-bank hold or transfer to the pod escrow sub-account).
- **Claim released** (cancel / expiry): reverse of the above.
- **Pod closes**: each `member:escrow:{pod}` Dr / `pod:acquisition` Cr; at purchase, `pod:acquisition` Dr / `bank:settlement` Cr (seller paid) and `platform:margin:land` Cr for the markup.
- **Withdrawal outside window**: `member:available` Dr gross; `bank:settlement` Cr net payout; `platform:fees:withdrawal` Cr fee.

### 6.4 Withdrawal window engine

- Windows are stored as data (`withdrawal_windows` table) seeded with Mar 21–31, Jun 21–30, Sep 21–30, Dec 21–31, so ops can adjust them without a release.
- "Is the window open?" is decided **only on the server**, in `Africa/Lagos`, at quote time and again at confirmation.
- The quote shows gross, fee and net in naira before any confirmation. The fee is never a surprise.
- Withdrawals need step-up auth (§8.2) and go only to the verified payout account.

### 6.5 Slot claims under concurrency

The last slot is the race. A claim runs in one database transaction that takes `SELECT … FOR UPDATE` on the pod row, checks `claimed_slots < slot_count`, checks the member's available balance (also locked), writes the claim and ledger entries, and moves the pod to `filled` if that was the last slot. Overselling is impossible by construction, and a unique constraint on `(pod_id, slot_number)` backs it up. One slot per member per pod unless you decide otherwise.

### 6.6 Reconciliation

A nightly job (and on-demand from admin) pulls partner statements, matches every line to a ledger transaction by reference, and reports unmatched items. Pods cannot move to `closing` while their escrow is unreconciled.

---

## 7. Modules and flows

### 7.1 Onboarding and KYC (PRD Module 1)

- **Tier 1:** full name, email (verified link), phone (OTP), next of kin. Can browse pods and set goals; deposit limits per CBN tier rules.
- **Tier 2:** BVN or NIN check + liveness/selfie match, address verification, payout account name-matched to the verified name. Required before claiming a slot or withdrawing.
- Sanctions and PEP screening at Tier 2 and on a schedule.
- Limits per tier are configuration, not code.

### 7.2 Savings wallet (Module 2)

- Funding by card (gateway's hosted/inline checkout, FluraVest never sees card numbers), dedicated virtual account transfer, or USSD.
- Recurring contributions (daily / weekly / monthly) via card tokenisation or direct debit mandate from the gateway; members can pause or cancel at any time.
- Goals are labels and progress bars over the single wallet balance.

### 7.3 Land Pod marketplace (Module 3)

- Filter by location, slot price, slots (5 or 6), title type.
- Deal page shows total price, slot price, plot size, title type, survey plan, verification status, remaining slots, deadline, and the fees that will apply at closing.
- "Claim slot" checks Tier 2, balance ≥ slot price, shows a quote and the terms, requires step-up auth and explicit acceptance of the pod terms (stored as a consent record with document version).

### 7.4 Deal operations (admin)

- Create parcel → upload title, survey, search report → **verification by a second admin** → publish pod (maker-checker).
- Escrow dashboard per pod with reconciliation status.
- Closing checklist: escrow released (two approvers), seller paid, deed executed, documents uploaded, certificates generated.
- Every admin action is audited with before/after values and a reason.

### 7.5 Closing and certificates (Module 4)

- On `filled`, all members get push + SMS/WhatsApp + email.
- Certificates are generated server-side as PDFs from a versioned template, stored with Object Lock, hashed (SHA-256), and carry a QR code that resolves to a public verification page showing only the certificate ID, parcel reference, issue date and validity (no personal data).
- Certificate wording is set by your lawyer (depends on Q2) and must not overstate what the member legally holds.

### 7.6 Vault

- Closed pods, share % (e.g. 1/6 = 16.67%), parcel coordinates and map, documents, certificate download via short-lived signed URL.
- No valuation, appreciation or return figures in MVP (brand guardrail).

### 7.7 Learn

- Static, reviewed content (MDX in the repo or a headless CMS). Compliance-reviewed before publishing.

### 7.8 Notifications

- Channels: web push (installed PWA), SMS / WhatsApp (Termii or similar), email. Critical events (pod filled, withdrawal sent, login from new device, bank account changed) always go by SMS or email, never push alone.
- Sent through an outbox table so a notification is never lost or duplicated when a transaction rolls back.

---

## 8. Security

Target: **OWASP ASVS Level 2** for the member app and API, Level 3 controls for admin and money movement.

### 8.1 Authentication

- Sign-in with email or phone + password (Argon2id) **plus** a second factor. Passkeys (WebAuthn) offered and encouraged; TOTP supported; SMS OTP only as a fallback because of SIM-swap risk.
- Sessions: server-side, opaque IDs in `httpOnly`, `Secure`, `SameSite=Lax` cookies through a backend-for-frontend; no tokens in `localStorage`. Idle timeout 15 min, absolute 12 h; re-auth for money actions.
- Device registry; new-device sign-in notifies the member.
- Rate limits and lockouts on login, OTP and KYC endpoints; bot protection (Turnstile) on sign-up.

### 8.2 Step-up and cooling-off

- Step-up (passkey / TOTP) required for: withdrawals, slot claims, payout account changes, password/MFA changes.
- After a payout account or phone change: **24–48 h hold** on withdrawals, with SMS + email alerts to the old contact details.

### 8.3 Data protection (NDPA 2023)

- BVN, NIN, date of birth, address: **field-level envelope encryption** with AWS KMS; a keyed hash (HMAC) stored separately for uniqueness checks; UIs show only masked values.
- Raw KYC images stay with the KYC provider where possible; anything stored goes to a private, KMS-encrypted bucket with short retention.
- Data minimisation, documented retention periods, consent records, a Data Protection Impact Assessment before launch, a named DPO, and a breach-response plan that meets the 72-hour NDPC notification rule.
- Logs and error reports scrub PII and secrets by default.

### 8.4 Application and infrastructure

- All input validated with shared Zod schemas; parameterised queries only.
- Strict Content-Security-Policy, HSTS, no third-party scripts in the money flows except the payment gateway's checkout.
- Webhooks: signature verification (HMAC), IP allow-listing where the provider supports it, replay protection, processing via queue.
- PostgreSQL row-level security as a second fence on member-owned tables; the API connects with a least-privilege role; migrations run with a separate role.
- Secrets only in Secrets Manager; nothing in env files committed to git. Separate AWS accounts for dev, staging and production.
- WAF on CloudFront; private subnets for DB and Redis; no public DB access; encrypted backups with point-in-time recovery, restore tested quarterly.
- PCI DSS scope kept to SAQ A by never handling card data.

### 8.5 Admin

- Separate domain, SSO (Google Workspace or Microsoft Entra) with hardware-key or passkey MFA, IP allow-list or VPN.
- Role-based access: `ops_viewer`, `deal_editor`, `deal_verifier`, `finance_approver`, `support`, `admin`. **Maker-checker** on publishing pods, releasing escrow, issuing certificates, manual ledger adjustments and unfreezing accounts.
- Support staff see masked PII; unmasking is logged with a reason.
- Append-only audit log (hash-chained), exported to separate storage that admins cannot delete.

### 8.6 Fraud and AML

- Transaction monitoring rules (velocity, deposit-then-withdraw patterns, many accounts per device/BVN, payout account sharing).
- Automatic freeze + case queue for suspicious activity; suspicious-transaction reporting goes through the licensed partner's compliance process.

### 8.7 Assurance

- Threat model (STRIDE) for money flows before build; external penetration test before launch and yearly; dependency and secret scanning in CI; a responsible-disclosure page.

---

## 9. PWA specifics

- Installable manifest using the Brand Kit v2 app icons and favicons; offline shell and cached read-only screens (Home, Vault, Learn). **Money actions always need a live connection**; nothing financial is queued offline.
- Built for low-end Android and slow networks: performance budget (≤ 170 KB JS on first load, LCP < 2.5 s on a mid-range phone over 4G).
- Accessibility: WCAG 2.2 AA, which Brand Kit v2's contrast fixes already support.
- Web push where available; SMS/WhatsApp fallback because iOS push needs the PWA installed.

---

## 10. Environments and delivery

- **dev** (sandbox providers) → **staging** (provider sandboxes, production-like data shape, no real PII) → **production**.
- Trunk-based development, PRs with required review and green CI, preview deploys for web and admin.
- Database migrations are forward-only and reviewed; ledger tables are never altered destructively.
- Feature flags for pilot cohorts and for turning off money flows instantly (a "kill switch" per flow).

---

## 11. Testing

- Unit tests on the domain package (fee calculation, window logic, state machines, money arithmetic), including property-based tests that ledger transactions always balance.
- Integration tests against a real Postgres: concurrent slot claims (many members racing for the last slot), webhook replays, partial failures.
- Contract tests against provider sandboxes.
- End-to-end tests (Playwright) for sign-up, deposit, claim, cancel, withdrawal in and out of window, closing.

---

## 12. Delivery plan (after approval)

| Milestone | Scope |
|---|---|
| **M0 — Foundations** | Monorepo, CI/CD, infra (Terraform), auth with MFA, tokens + UI package, audit log |
| **M1 — Wallet** | Tier 1/2 KYC, ledger, deposits (card / virtual account / USSD), goals, withdrawals with window engine and fee quotes, reconciliation |
| **M2 — Pods** | Admin parcel/pod workflow with verification, marketplace, slot claims, cancel, expiry refunds, notifications |
| **M3 — Closing & Vault** | Closing checklist, escrow release, certificates with QR verification, Vault, Learn |
| **M4 — Launch readiness** | Pen test, DPIA, load test, runbooks, pilot cohort |

---

## 13. Architecture decisions to record (ADRs)

1. Partner bank holds funds; FluraVest ledger is a reconciled mirror.
2. Integer kobo, double-entry, append-only ledger.
3. TypeScript monorepo (Next.js PWA + NestJS API + Postgres).
4. Server-only business rules for fees, windows and slot allocation.
5. Brand Kit v2 tokens are the only source of UI styling.
6. Maker-checker on every irreversible operation.
