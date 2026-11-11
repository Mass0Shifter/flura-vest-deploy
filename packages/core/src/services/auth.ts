import { scrypt as scryptCb, timingSafeEqual, randomBytes } from "node:crypto";
import { promisify } from "node:util";
import { and, eq, gt, sql } from "drizzle-orm";
import type { SignUpInput } from "@fluravest/domain";
import type { Db } from "../db/client";
import { admins, loginAttempts, sessions, users } from "../db/schema";
import { randomToken, sha256 } from "../crypto";
import { AppError, conflict } from "../errors";
import { audit } from "../audit";
import { notify } from "./notify";

// scrypt (OWASP-recommended parameters, N=2^17, r=8, p=1). Built into Node, so no native
// module is needed on serverless hosts. Format: scrypt$N$r$p$salt$hash (base64).
const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number, opts: { N: number; r: number; p: number; maxmem: number }) => Promise<Buffer>;
const SCRYPT = { N: 2 ** 17, r: 8, p: 1, maxmem: 256 * 1024 * 1024 };

export async function hashPassword(pw: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(pw, salt, 32, SCRYPT);
  return ["scrypt", SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString("base64"), key.toString("base64")].join("$");
}

export async function verifyPassword(stored: string, pw: string): Promise<boolean> {
  const [alg, N, r, p, salt, hash] = stored.split("$");
  if (alg !== "scrypt") return false;
  const expected = Buffer.from(hash, "base64");
  const key = await scrypt(pw, Buffer.from(salt, "base64"), expected.length, { N: +N, r: +r, p: +p, maxmem: SCRYPT.maxmem });
  return timingSafeEqual(key, expected);
}

// A real hash of a random string so unknown-email logins cost the same as wrong-password ones.
let dummyHash: Promise<string> | undefined;
const getDummy = () => (dummyHash ??= hashPassword(randomToken()));

export const MEMBER_SESSION_HOURS = 12;
export const ADMIN_SESSION_HOURS = 8;
const IDLE_MINUTES = 30;
const MAX_FAILURES = 5;
const LOCKOUT_MINUTES = 15;

async function assertNotLocked(db: Db, key: string) {
  const since = new Date(Date.now() - LOCKOUT_MINUTES * 60_000);
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(loginAttempts)
    .where(and(eq(loginAttempts.key, key), eq(loginAttempts.succeeded, false), gt(loginAttempts.createdAt, since)));
  if ((row?.n ?? 0) >= MAX_FAILURES) {
    throw new AppError(429, "locked", `Too many attempts. Try again in ${LOCKOUT_MINUTES} minutes.`);
  }
}

async function createSession(db: Db, who: { userId?: string; adminId?: string }, hours: number, userAgent?: string) {
  const token = randomToken();
  await db.insert(sessions).values({
    id: sha256(token),
    userId: who.userId ?? null,
    adminId: who.adminId ?? null,
    expiresAt: new Date(Date.now() + hours * 3600_000),
    userAgent: userAgent?.slice(0, 300) ?? null,
  });
  return { token, maxAgeSeconds: hours * 3600 };
}

export async function signUp(db: Db, input: SignUpInput, userAgent?: string) {
  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, input.email));
  if (existing.length) throw conflict("email_taken", "An account with this email already exists");
  const passwordHash = await hashPassword(input.password);
  const user = await db.transaction(async (tx) => {
    const [u] = await tx
      .insert(users)
      .values({
        email: input.email,
        fullName: input.fullName,
        phone: input.phone,
        passwordHash,
        nextOfKinName: input.nextOfKinName,
        nextOfKinPhone: input.nextOfKinPhone,
        termsAcceptedAt: new Date(),
      })
      .returning();
    await notify(tx, u.id, "Welcome to FluraVest", "Verify your identity (Tier 2) to fund your wallet and join land pods.");
    await audit(tx, { actorType: "member", actorId: u.id, action: "member.signup", entity: "user", entityId: u.id });
    return u;
  });
  return { user, session: await createSession(db, { userId: user.id }, MEMBER_SESSION_HOURS, userAgent) };
}

export async function signIn(db: Db, email: string, password: string, userAgent?: string) {
  const key = `member:${email}`;
  await assertNotLocked(db, key);
  const [user] = await db.select().from(users).where(eq(users.email, email));
  const ok = user ? await verifyPassword(user.passwordHash, password) : (await verifyPassword(await getDummy(), password), false);
  await db.insert(loginAttempts).values({ key, succeeded: !!ok });
  if (!user || !ok) throw new AppError(401, "invalid_credentials", "Email or password is incorrect");
  if (user.status !== "active") throw new AppError(403, "account_frozen", "This account is frozen. Contact support.");
  return { user, session: await createSession(db, { userId: user.id }, MEMBER_SESSION_HOURS, userAgent) };
}

export async function adminSignIn(db: Db, email: string, password: string, userAgent?: string) {
  const key = `admin:${email}`;
  await assertNotLocked(db, key);
  const [admin] = await db.select().from(admins).where(eq(admins.email, email));
  const ok = admin ? await verifyPassword(admin.passwordHash, password) : (await verifyPassword(await getDummy(), password), false);
  await db.insert(loginAttempts).values({ key, succeeded: !!ok });
  if (!admin || !ok) throw new AppError(401, "invalid_credentials", "Email or password is incorrect");
  await db.transaction((tx) => audit(tx, { actorType: "admin", actorId: admin.id, action: "admin.signin", entity: "admin", entityId: admin.id }));
  return { admin, session: await createSession(db, { adminId: admin.id }, ADMIN_SESSION_HOURS, userAgent) };
}

/** Resolves a cookie token to a live session, enforcing absolute and idle expiry. */
export async function resolveSession(db: Db, token: string | undefined) {
  if (!token || token.length > 100) return null;
  const id = sha256(token);
  const [s] = await db.select().from(sessions).where(eq(sessions.id, id));
  if (!s) return null;
  const now = Date.now();
  if (s.expiresAt.getTime() < now || s.lastSeenAt.getTime() < now - IDLE_MINUTES * 60_000) {
    await db.delete(sessions).where(eq(sessions.id, id));
    return null;
  }
  if (now - s.lastSeenAt.getTime() > 60_000) {
    await db.update(sessions).set({ lastSeenAt: new Date() }).where(eq(sessions.id, id));
  }
  return s;
}

export async function signOut(db: Db, token: string | undefined) {
  if (token) await db.delete(sessions).where(eq(sessions.id, sha256(token)));
}

export async function getAdmin(db: Db, adminId: string) {
  const [a] = await db.select({ id: admins.id, name: admins.name, role: admins.role }).from(admins).where(eq(admins.id, adminId));
  return a ?? null;
}
