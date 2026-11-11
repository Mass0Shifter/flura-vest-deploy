// All money is integer kobo (1 NGN = 100 kobo). Never use floats for amounts.

export type Kobo = bigint;

export const KOBO_PER_NAIRA = 100n;

export function naira(amount: number | string): Kobo {
  const [whole, frac = ""] = String(amount).split(".");
  const fracKobo = (frac + "00").slice(0, 2);
  const sign = whole.startsWith("-") ? -1n : 1n;
  return sign * (BigInt(whole.replace("-", "") || "0") * KOBO_PER_NAIRA + BigInt(fracKobo));
}

/** Percentage of an amount in basis points, rounded half up to the nearest kobo. */
export function percentOf(amount: Kobo, basisPoints: number): Kobo {
  const bp = BigInt(basisPoints);
  return (amount * bp + 5000n) / 10000n;
}

export function formatNaira(amount: Kobo | string | number, opts: { decimals?: boolean } = {}): string {
  const k = typeof amount === "bigint" ? amount : BigInt(amount);
  const neg = k < 0n;
  const abs = neg ? -k : k;
  const whole = abs / KOBO_PER_NAIRA;
  const frac = abs % KOBO_PER_NAIRA;
  const wholeStr = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const showDecimals = opts.decimals ?? true;
  return `${neg ? "-" : ""}₦${wholeStr}${showDecimals ? "." + frac.toString().padStart(2, "0") : ""}`;
}

/** Amounts cross the wire as strings of kobo so JSON never loses precision. */
export const toWire = (k: Kobo): string => k.toString();
export const fromWire = (s: string | number | bigint): Kobo => BigInt(s);
