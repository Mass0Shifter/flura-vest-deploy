# FluraVest

Save with discipline, then co-buy verified land in pods of 5–6 people. This repository holds the
MVP demo: one backend and two separate frontends.

```
apps/
  api/      Backend. Hono API inside a Next.js shell (deploys to Vercel as serverless functions)
  web/      Member PWA: sign-up, KYC, wallet, withdrawals, land pod marketplace, Vault, Learn
  admin/    Operations console: parcels & title verification, pods, escrow release, closing, audit
packages/
  core/     Database schema (Drizzle + Postgres), migrations, ledger and business services, demo seed
  domain/   Pure rules shared by everything: money in kobo, withdrawal windows, fees, pod states, Zod schemas
  ui/       Shared React components built on the brand tokens
  tokens/   Copy of Branding/Brand Kit v2/tokens (re-sync from the brand kit; don't edit by hand)
docs/
  architecture/ARCHITECTURE.md
```

Architecture notes and the decisions behind them are in [docs/architecture/ARCHITECTURE.md](docs/architecture/ARCHITECTURE.md).
For the Vercel demo, the API is a Hono app mounted in a Next.js route instead of NestJS, so it deploys as
serverless functions with no extra infrastructure. The Hono app is framework-independent and can move
to a long-running Node server later without code changes.

## Run locally

Requirements: Node 20+, pnpm 10, PostgreSQL 14+.

```bash
pnpm install
cp .env.example .env            # set DATABASE_URL
export $(cat .env | xargs)
pnpm db:migrate && pnpm db:seed

pnpm --filter @fluravest/api dev     # http://localhost:4000
pnpm --filter @fluravest/web dev     # http://localhost:3000
pnpm --filter @fluravest/admin dev   # http://localhost:3001
```

`pnpm db:reset` drops everything and re-seeds (refuses in production).

## Demo accounts

Password for every demo account: `FluraDemo2026!`

| App | Email | Role |
|---|---|---|
| Member | `ada@fluravest.demo` | Tier 2 member with ₦750,000 available, a slot in Pod #02 and a closed pod with a certificate |
| Admin | `ops@fluravest.demo` | Operations: adds parcels, creates pods, requests closing |
| Admin | `verifier@fluravest.demo` | Verifier: signs off titles, publishes pods |
| Admin | `finance@fluravest.demo` | Finance: approves escrow release, manages withdrawal windows |

Other seeded members: tunde, ngozi, ibrahim, funke, emeka, zainab, segun, halima `@fluravest.demo`.

### Suggested demo script

1. **Member** (ada): Home shows ₦750,000 available, ₦515,000 locked in Pod #02, the next free withdrawal window and the Land Seed Fund goal.
2. Marketplace → *Akobo Extension Plot 7* → claim a slot (₦200,000 + 3% legal fee moves to escrow). Leave the pod again to show the no-fee exit.
3. Withdraw ₦20,000 → the quote shows the 5% early fee and the net payout; confirm with the password.
4. Vault → certificate for Kuje Garden Estate → the QR code opens the public verification page.
5. **Admin** (ops): Pods → *Pod #06* (full) → Request closing. Try *Approve escrow release* as ops: it's refused (maker-checker).
6. Sign in as finance → approve the release → record the deed → certificates are issued to all five members.
7. Parcels → *Mowe Gateway Plot* is awaiting review: ops can't review it, the verifier can. Then ops creates a pod from it and the verifier publishes it.
8. Withdrawal windows (finance) → add a window for today: members' withdrawals become free immediately.
9. Overview shows the ledger reconciling to the naira; Audit log shows every action, hash-chained.

## Deploy to Vercel

Three Vercel projects from this one repository, plus a Postgres database.

### 1. Database
Create a Postgres database (Vercel Marketplace → Neon or Supabase). Copy its **pooled** connection string.

### 2. API project
- New Project → import this repo → **Root Directory: `apps/api`** (framework: Next.js). Build settings come from `apps/api/vercel.json`.
- Environment variables:

| Name | Value |
|---|---|
| `DATABASE_URL` | pooled Postgres URL |
| `FV_ENCRYPTION_KEY` | `openssl rand -base64 32` |
| `FV_HASH_KEY` | `openssl rand -base64 32` (a different value) |
| `CRON_SECRET` | any long random string |
| `AUTO_MIGRATE` | `true` (applies migrations on every deploy) |
| `SEED_DEMO` | `true` for the first deploy (seeds once; it skips if data exists) |
| `FV_WEB_URL` | the member app URL, e.g. `https://fluravest.vercel.app` (used in certificate QR codes) |
| `FV_ALLOWED_ORIGINS` | comma-separated member and admin URLs |

### 3. Member app project
- New Project → same repo → **Root Directory: `apps/web`**.
- `API_URL` = the API project's URL, e.g. `https://fluravest-api.vercel.app` (no trailing slash).

### 4. Admin project
- New Project → same repo → **Root Directory: `apps/admin`**.
- `API_URL` = the API project's URL.
- Recommended: turn on Vercel Deployment Protection (password or Vercel auth) for the admin project.

The two frontends proxy `/api/*` to the API, so session cookies are first-party and `httpOnly`. If
you change `API_URL`, redeploy that frontend (rewrites are fixed at build time).

## Security in this build

- Sessions: random 256-bit tokens in `httpOnly`, `Secure`, `SameSite=Lax` cookies; only the SHA-256 is stored. 12 h absolute / 30 min idle for members, 8 h for staff. Sign-in lockout after 5 failures.
- Passwords: scrypt (N=2^17), constant-time comparison, same cost for unknown emails.
- CSRF: every state-changing request needs the `x-fv-client` header (cross-site forms can't send it) and an allow-listed `Origin`.
- BVN, NIN, address and account numbers are AES-256-GCM encrypted; BVN uniqueness uses an HMAC blind index. Only last-4 digits are ever returned.
- Money: integer kobo, double-entry ledger with idempotency keys, server-signed quotes for withdrawals and slot claims, password step-up for withdrawals, row locks so the last slot can't be sold twice.
- Admin: role checks plus maker-checker on parcel verification, pod publishing and escrow release; masked member contact details; hash-chained audit log.
- Headers: CSP, HSTS, `nosniff`, `frame-ancestors 'none'`, no-store on the API.

### Not production-ready yet (by design for the demo)

- Payments, BVN checks, bank name enquiry and payouts are **mocks** (`packages/core/src/providers`). Real adapters (Paystack/partner bank, Smile ID/Dojah, Termii) go behind the same interfaces.
- No MFA/passkeys, SMS/email delivery or bank reconciliation import yet.
- The legal questions in the architecture doc (SEC classification of pods, licensed custodian, how title is held) must be settled before real money is taken.
