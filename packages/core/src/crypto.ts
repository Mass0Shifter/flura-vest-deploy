import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "node:crypto";

// Stand-in for KMS envelope encryption: a 32-byte key from the environment.
// In production both keys must be set; the dev fallback is only for local work.
function key(name: "FV_ENCRYPTION_KEY" | "FV_HASH_KEY"): Buffer {
  const raw = process.env[name];
  if (raw) {
    const buf = Buffer.from(raw, "base64");
    if (buf.length !== 32) throw new Error(`${name} must be 32 bytes, base64-encoded`);
    return buf;
  }
  if (process.env.NODE_ENV === "production" && process.env.FV_ALLOW_DEV_KEYS !== "true") {
    throw new Error(`${name} is required in production`);
  }
  return createHash("sha256").update(`fluravest-dev-only-${name}`).digest();
}

export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key("FV_ENCRYPTION_KEY"), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64"), cipher.getAuthTag().toString("base64"), data.toString("base64")].join(".");
}

export function decrypt(token: string): string {
  const [v, iv, tag, data] = token.split(".");
  if (v !== "v1") throw new Error("Unknown ciphertext version");
  const decipher = createDecipheriv("aes-256-gcm", key("FV_ENCRYPTION_KEY"), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8");
}

/** Keyed hash for uniqueness checks on identifiers (BVN) without storing them in clear. */
export function blindIndex(value: string): string {
  return createHmac("sha256", key("FV_HASH_KEY")).update(value).digest("hex");
}

export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
export const randomToken = (bytes = 32) => randomBytes(bytes).toString("base64url");

export function shortCode(len = 10): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(len);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}
