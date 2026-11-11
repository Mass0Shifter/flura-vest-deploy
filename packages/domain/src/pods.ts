import { percentOf, type Kobo } from "./money";

export const POD_STATUSES = ["draft", "open", "filled", "closing", "closed", "expired", "cancelled"] as const;
export type PodStatus = (typeof POD_STATUSES)[number];

export const POD_FILL_DAYS = 30;
export const ALLOWED_SLOT_COUNTS = [5, 6] as const;

/** Legal transitions. Anything else is rejected by the API. */
export const POD_TRANSITIONS: Record<PodStatus, PodStatus[]> = {
  draft: ["open", "cancelled"],
  open: ["filled", "expired", "cancelled"],
  filled: ["closing"],
  closing: ["closed"],
  closed: [],
  expired: [],
  cancelled: [],
};

export function canTransition(from: PodStatus, to: PodStatus): boolean {
  return POD_TRANSITIONS[from].includes(to);
}

export function slotPrice(syndicatedPrice: Kobo, slotCount: number): Kobo {
  if (!ALLOWED_SLOT_COUNTS.includes(slotCount as 5 | 6)) throw new Error("Pods have 5 or 6 slots");
  if (syndicatedPrice % BigInt(slotCount) !== 0n) throw new Error("Price must divide evenly into slots");
  return syndicatedPrice / BigInt(slotCount);
}

/** Amount held in escrow for one slot: the slot price plus the legal/admin fee for that slot. */
export function slotCommitment(slot: Kobo, legalFeeBp: number): { slot: Kobo; legalFee: Kobo; total: Kobo } {
  const legalFee = percentOf(slot, legalFeeBp);
  return { slot, legalFee, total: slot + legalFee };
}

/** Share of the parcel one slot represents, e.g. 1/6 → "16.67". */
export function sharePercent(slotCount: number): string {
  return (100 / slotCount).toFixed(2);
}

export const TITLE_TYPES = ["C of O", "Governor's Consent", "Gazette", "Deed of Assignment", "Registered Survey"] as const;
export type TitleType = (typeof TITLE_TYPES)[number];
