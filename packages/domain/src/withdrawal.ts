import { percentOf, type Kobo } from "./money";

export const EARLY_WITHDRAWAL_FEE_BP = 500; // 5.00%
export const BUSINESS_TZ = "Africa/Lagos";

export interface WithdrawalWindow {
  /** Inclusive, as YYYY-MM-DD in Africa/Lagos. */
  startsOn: string;
  endsOn: string;
  label?: string;
}

/** The PRD's quarterly windows for a given year. */
export function defaultWindowsForYear(year: number): WithdrawalWindow[] {
  return [
    { startsOn: `${year}-03-21`, endsOn: `${year}-03-31`, label: `Q1 ${year}` },
    { startsOn: `${year}-06-21`, endsOn: `${year}-06-30`, label: `Q2 ${year}` },
    { startsOn: `${year}-09-21`, endsOn: `${year}-09-30`, label: `Q3 ${year}` },
    { startsOn: `${year}-12-21`, endsOn: `${year}-12-31`, label: `Q4 ${year}` },
  ];
}

/** Calendar date (YYYY-MM-DD) of an instant in Africa/Lagos. */
export function lagosDate(at: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: BUSINESS_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
}

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86_400_000);
}

export interface WindowStatus {
  open: boolean;
  current?: WithdrawalWindow;
  next?: WithdrawalWindow;
  /** Days left including today when open; days until it opens when closed. */
  days?: number;
}

export function windowStatus(windows: WithdrawalWindow[], at: Date): WindowStatus {
  const today = lagosDate(at);
  const sorted = [...windows].sort((x, y) => x.startsOn.localeCompare(y.startsOn));
  const current = sorted.find((w) => w.startsOn <= today && today <= w.endsOn);
  if (current) return { open: true, current, days: daysBetween(today, current.endsOn) + 1 };
  const next = sorted.find((w) => w.startsOn > today);
  return { open: false, next, days: next ? daysBetween(today, next.startsOn) : undefined };
}

export interface WithdrawalQuote {
  gross: Kobo;
  fee: Kobo;
  net: Kobo;
  feeApplies: boolean;
}

export function quoteWithdrawal(gross: Kobo, windowOpen: boolean): WithdrawalQuote {
  const fee = windowOpen ? 0n : percentOf(gross, EARLY_WITHDRAWAL_FEE_BP);
  return { gross, fee, net: gross - fee, feeApplies: !windowOpen };
}
