import { Hono, type Context, type Next } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { ZodError, z, type ZodTypeAny } from "zod";
import QRCode from "qrcode";
import {
  AppError,
  admin,
  auth,
  certificatesService,
  getDb,
  kyc,
  notifications,
  podsService,
  providers,
  wallet,
  withdrawals,
  type AdminActor,
} from "@fluravest/core";
import {
  claimConfirmSchema,
  depositSchema,
  goalSchema,
  kycTier2Schema,
  parcelSchema,
  podSchema,
  signInSchema,
  signUpSchema,
  withdrawalConfirmSchema,
  withdrawalQuoteSchema,
} from "@fluravest/domain";

// Amounts are bigint kobo; serialise as strings so JSON never loses precision.
(BigInt.prototype as unknown as { toJSON: () => string }).toJSON = function (this: bigint) {
  return this.toString();
};

type Vars = { userId: string; admin: AdminActor };
export const app = new Hono<{ Variables: Vars }>().basePath("/api");

const MEMBER_COOKIE = "fv_session";
const ADMIN_COOKIE = "fv_admin";
const secure = process.env.NODE_ENV === "production";

// ── Errors ──────────────────────────────────────────────────────────────────
app.onError((err, c) => {
  if (err instanceof AppError) return c.json({ error: { code: err.code, message: err.message } }, err.status as 400);
  if (err instanceof ZodError) {
    const fields = Object.fromEntries(err.issues.map((i) => [i.path.join("."), i.message]));
    return c.json({ error: { code: "invalid_input", message: "Please check the highlighted fields", fields } }, 400);
  }
  console.error("Unhandled API error", err);
  return c.json({ error: { code: "server_error", message: "Something went wrong. Please try again." } }, 500);
});
app.notFound((c) => c.json({ error: { code: "not_found", message: "Not found" } }, 404));

// ── CSRF: state-changing requests must carry our header (cross-site forms can't set it, and no CORS is allowed) ──
const allowedOrigins = (process.env.FV_ALLOWED_ORIGINS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
app.use("*", async (c, next) => {
  if (!["GET", "HEAD", "OPTIONS"].includes(c.req.method) && !c.req.path.startsWith("/api/cron/")) {
    if (c.req.header("x-fv-client") !== "1") throw new AppError(403, "csrf", "Request blocked");
    const origin = c.req.header("origin");
    if (origin && allowedOrigins.length && !allowedOrigins.includes(origin)) throw new AppError(403, "csrf", "Request blocked");
  }
  await next();
});

async function body<T extends ZodTypeAny>(c: Context, s: T): Promise<z.infer<T>> {
  const json = await c.req.json().catch(() => ({}));
  return s.parse(json);
}
const ua = (c: Context) => c.req.header("user-agent");
const uuidParam = (c: Context, name: string) => z.string().uuid().parse(c.req.param(name));

function setSession(c: Context, name: string, token: string, maxAge: number) {
  setCookie(c, name, token, { httpOnly: true, secure, sameSite: "Lax", path: "/", maxAge });
}

// ── Auth guards ─────────────────────────────────────────────────────────────
async function member(c: Context<{ Variables: Vars }>, next: Next) {
  const s = await auth.resolveSession(getDb(), getCookie(c, MEMBER_COOKIE));
  if (!s?.userId) throw new AppError(401, "unauthenticated", "Please sign in");
  c.set("userId", s.userId);
  await next();
}
async function staff(c: Context<{ Variables: Vars }>, next: Next) {
  const s = await auth.resolveSession(getDb(), getCookie(c, ADMIN_COOKIE));
  if (!s?.adminId) throw new AppError(401, "unauthenticated", "Please sign in");
  const a = await auth.getAdmin(getDb(), s.adminId);
  if (!a) throw new AppError(401, "unauthenticated", "Please sign in");
  c.set("admin", a);
  await next();
}

app.get("/health", (c) => c.json({ ok: true, service: "fluravest-api", time: new Date().toISOString() }));

// ── Member auth ─────────────────────────────────────────────────────────────
app.post("/auth/signup", async (c) => {
  const input = await body(c, signUpSchema);
  const { user, session } = await auth.signUp(getDb(), input, ua(c));
  setSession(c, MEMBER_COOKIE, session.token, session.maxAgeSeconds);
  return c.json({ id: user.id }, 201);
});
app.post("/auth/signin", async (c) => {
  const input = await body(c, signInSchema);
  const { user, session } = await auth.signIn(getDb(), input.email, input.password, ua(c));
  setSession(c, MEMBER_COOKIE, session.token, session.maxAgeSeconds);
  return c.json({ id: user.id });
});
app.post("/auth/signout", async (c) => {
  await auth.signOut(getDb(), getCookie(c, MEMBER_COOKIE));
  deleteCookie(c, MEMBER_COOKIE, { path: "/" });
  return c.json({ ok: true });
});
app.get("/me", member, async (c) => c.json(await kyc.profile(getDb(), c.get("userId"))));

// ── KYC ─────────────────────────────────────────────────────────────────────
app.get("/kyc/banks", (c) => c.json(providers.banks.banks()));
app.post("/kyc/tier2", member, async (c) => {
  await kyc.completeTier2(getDb(), c.get("userId"), await body(c, kycTier2Schema));
  return c.json({ ok: true });
});

// ── Wallet ──────────────────────────────────────────────────────────────────
app.get("/wallet", member, async (c) => {
  const db = getDb();
  const [summary, window] = await Promise.all([wallet.walletSummary(db, c.get("userId")), withdrawals.currentWindow(db)]);
  return c.json({ ...summary, window });
});
app.post("/wallet/deposits", member, async (c) => {
  const key = z.string().min(8).max(100).parse(c.req.header("idempotency-key"));
  const input = await body(c, depositSchema);
  return c.json(await wallet.deposit(getDb(), c.get("userId"), input.amountNaira, input.method, key), 201);
});
app.get("/wallet/funding-account", member, async (c) => {
  // Mock dedicated virtual account; a real one comes from the partner bank per member.
  const id = c.get("userId").replace(/-/g, "");
  return c.json({ bankName: "Partner MFB (demo)", accountNumber: `99${parseInt(id.slice(0, 8), 16).toString().padStart(8, "0").slice(-8)}`, accountName: "FluraVest / Members' Trust" });
});
app.post("/wallet/goals", member, async (c) => {
  const input = await body(c, goalSchema);
  return c.json(await wallet.createGoal(getDb(), c.get("userId"), input.name, input.targetNaira), 201);
});
app.delete("/wallet/goals/:id", member, async (c) => {
  await wallet.deleteGoal(getDb(), c.get("userId"), uuidParam(c, "id"));
  return c.json({ ok: true });
});

// ── Withdrawals ─────────────────────────────────────────────────────────────
app.get("/withdrawals/window", member, async (c) => c.json(await withdrawals.currentWindow(getDb())));
app.post("/withdrawals/quote", member, async (c) => {
  const input = await body(c, withdrawalQuoteSchema);
  return c.json(await withdrawals.createWithdrawalQuote(getDb(), c.get("userId"), input.amountNaira));
});
app.post("/withdrawals/confirm", member, async (c) => {
  const input = await body(c, withdrawalConfirmSchema);
  return c.json(await withdrawals.confirmWithdrawal(getDb(), c.get("userId"), input.quoteId, input.password));
});

// ── Pods ────────────────────────────────────────────────────────────────────
app.get("/pods", member, async (c) => {
  const db = getDb();
  await podsService.expireDuePods(db); // lazy expiry in addition to the daily cron
  return c.json(await podsService.listPods(db, ["open"], c.get("userId")));
});
app.get("/pods/mine", member, async (c) => c.json(await podsService.myPods(getDb(), c.get("userId"))));
app.get("/pods/:id", member, async (c) => c.json(await podsService.getPod(getDb(), uuidParam(c, "id"), c.get("userId"))));
app.post("/pods/:id/claim-quote", member, async (c) => c.json(await podsService.createClaimQuote(getDb(), c.get("userId"), uuidParam(c, "id"))));
app.post("/pods/claim-confirm", member, async (c) => {
  const input = await body(c, claimConfirmSchema);
  return c.json(await podsService.confirmClaim(getDb(), c.get("userId"), input.quoteId));
});
app.post("/pods/:id/cancel", member, async (c) => {
  await podsService.cancelClaim(getDb(), c.get("userId"), uuidParam(c, "id"));
  return c.json({ ok: true });
});

// ── Vault & certificates ────────────────────────────────────────────────────
app.get("/vault", member, async (c) => c.json(await podsService.vault(getDb(), c.get("userId"))));
app.get("/vault/certificates/:id", member, async (c) => {
  const cert = await certificatesService.getCertificate(getDb(), uuidParam(c, "id"), c.get("userId"));
  const fwdHost = c.req.header("x-forwarded-host");
  const webUrl = process.env.FV_WEB_URL ?? (fwdHost ? `${c.req.header("x-forwarded-proto")?.split(",")[0] ?? "https"}://${fwdHost}` : new URL(c.req.url).origin);
  const verifyUrl = `${webUrl}/verify/${cert.code}`;
  const qrSvg = await QRCode.toString(verifyUrl, { type: "svg", margin: 0, color: { dark: "#0A2A4A", light: "#FFFFFF" } });
  return c.json({ ...cert, verifyUrl, qrSvg });
});
app.get("/public/certificates/:code", async (c) => c.json(await certificatesService.verifyCertificate(getDb(), c.req.param("code").toUpperCase())));

// ── Notifications ───────────────────────────────────────────────────────────
app.get("/notifications", member, async (c) => c.json(await notifications.listNotifications(getDb(), c.get("userId"))));
app.post("/notifications/read", member, async (c) => {
  await notifications.markAllRead(getDb(), c.get("userId"));
  return c.json({ ok: true });
});

// ── Cron ────────────────────────────────────────────────────────────────────
app.get("/cron/expire-pods", async (c) => {
  const secret = process.env.CRON_SECRET;
  if (!secret || c.req.header("authorization") !== `Bearer ${secret}`) throw new AppError(401, "unauthenticated", "Unauthorized");
  return c.json({ expired: await podsService.expireDuePods(getDb()) });
});

// ── Admin ───────────────────────────────────────────────────────────────────
const adm = new Hono<{ Variables: Vars }>();
adm.post("/auth/signin", async (c) => {
  const input = await body(c, signInSchema);
  const { admin: a, session } = await auth.adminSignIn(getDb(), input.email, input.password, ua(c));
  setSession(c, ADMIN_COOKIE, session.token, session.maxAgeSeconds);
  return c.json({ id: a.id, name: a.name, role: a.role });
});
adm.post("/auth/signout", async (c) => {
  await auth.signOut(getDb(), getCookie(c, ADMIN_COOKIE));
  deleteCookie(c, ADMIN_COOKIE, { path: "/" });
  return c.json({ ok: true });
});
adm.use("*", async (c, next) => (c.req.path.endsWith("/auth/signin") || c.req.path.endsWith("/auth/signout") ? next() : staff(c, next)));
adm.get("/me", (c) => c.json(c.get("admin")));
adm.get("/overview", async (c) => c.json(await admin.overview(getDb())));
adm.get("/members", async (c) => c.json(await admin.listMembers(getDb())));
adm.post("/members/:id/status", async (c) => {
  const input = await body(c, z.object({ status: z.enum(["active", "frozen"]), reason: z.string().trim().min(3).max(300) }));
  await admin.setMemberStatus(getDb(), c.get("admin"), uuidParam(c, "id"), input.status, input.reason);
  return c.json({ ok: true });
});
adm.get("/parcels", async (c) => c.json(await admin.listParcels(getDb())));
adm.post("/parcels", async (c) => c.json(await admin.createParcel(getDb(), c.get("admin"), await body(c, parcelSchema)), 201));
adm.post("/parcels/:id/verify", async (c) => {
  const input = await body(c, z.object({ decision: z.enum(["verified", "rejected"]), notes: z.string().trim().min(5).max(1000) }));
  await admin.verifyParcel(getDb(), c.get("admin"), uuidParam(c, "id"), input.decision, input.notes);
  return c.json({ ok: true });
});
adm.get("/pods", async (c) => c.json(await admin.listPodsAdmin(getDb())));
adm.post("/pods", async (c) => c.json(await admin.createPod(getDb(), c.get("admin"), await body(c, podSchema)), 201));
adm.get("/pods/:id", async (c) => c.json(await admin.podDetailAdmin(getDb(), uuidParam(c, "id"))));
adm.post("/pods/:id/publish", async (c) => (await admin.publishPod(getDb(), c.get("admin"), uuidParam(c, "id")), c.json({ ok: true })));
adm.post("/pods/:id/request-close", async (c) => (await admin.requestClose(getDb(), c.get("admin"), uuidParam(c, "id")), c.json({ ok: true })));
adm.post("/pods/:id/approve-close", async (c) => (await admin.approveClose(getDb(), c.get("admin"), uuidParam(c, "id")), c.json({ ok: true })));
adm.post("/pods/:id/complete-close", async (c) => {
  const input = await body(c, z.object({ deedReference: z.string().trim().min(5).max(80) }));
  await admin.completeClose(getDb(), c.get("admin"), uuidParam(c, "id"), input.deedReference);
  return c.json({ ok: true });
});
adm.post("/pods/:id/cancel", async (c) => {
  const input = await body(c, z.object({ reason: z.string().trim().min(5).max(300) }));
  await admin.cancelPodAdmin(getDb(), c.get("admin"), uuidParam(c, "id"), input.reason);
  return c.json({ ok: true });
});
adm.get("/windows", async (c) => c.json(await admin.listWindows(getDb())));
adm.post("/windows", async (c) => {
  const d = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
  const input = await body(c, z.object({ startsOn: d, endsOn: d, label: z.string().trim().min(2).max(60) }).refine((v) => v.startsOn <= v.endsOn, "End must be after start"));
  await admin.addWindow(getDb(), c.get("admin"), input.startsOn, input.endsOn, input.label);
  return c.json({ ok: true }, 201);
});
adm.delete("/windows/:id", async (c) => (await admin.removeWindow(getDb(), c.get("admin"), uuidParam(c, "id")), c.json({ ok: true })));
adm.get("/audit", async (c) => c.json(await admin.recentAudit(getDb(), 100)));

app.route("/admin", adm);
