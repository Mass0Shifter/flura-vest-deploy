import { describe, expect, it } from "vitest";
import { formatNaira, naira, percentOf } from "./money";
import { defaultWindowsForYear, quoteWithdrawal, windowStatus } from "./withdrawal";
import { canTransition, slotCommitment, slotPrice } from "./pods";

describe("money", () => {
  it("converts naira to kobo exactly", () => {
    expect(naira(500000)).toBe(50_000_000n);
    expect(naira("12.5")).toBe(1250n);
  });
  it("formats", () => {
    expect(formatNaira(75_000_000n)).toBe("₦750,000.00");
  });
  it("rounds percentages half up", () => {
    expect(percentOf(naira(500000), 500)).toBe(naira(25000));
    expect(percentOf(1n, 5000)).toBe(1n);
  });
});

describe("withdrawal windows", () => {
  const w = defaultWindowsForYear(2026);
  it("is open inside a window in Lagos time", () => {
    // 2026-12-20T23:30Z is 2026-12-21 00:30 in Lagos
    const s = windowStatus(w, new Date("2026-12-20T23:30:00Z"));
    expect(s.open).toBe(true);
    expect(s.days).toBe(11);
  });
  it("is closed outside and points to the next window", () => {
    const s = windowStatus(w, new Date("2026-11-11T10:00:00Z"));
    expect(s.open).toBe(false);
    expect(s.next?.startsOn).toBe("2026-12-21");
    expect(s.days).toBe(40);
  });
  it("charges 5% outside the window only", () => {
    expect(quoteWithdrawal(naira(500000), false).fee).toBe(naira(25000));
    expect(quoteWithdrawal(naira(500000), true).fee).toBe(0n);
  });
});

describe("pods", () => {
  it("splits price into slots", () => {
    expect(slotPrice(naira(12_000_000), 6)).toBe(naira(2_000_000));
    expect(() => slotPrice(naira(100), 4)).toThrow();
  });
  it("adds the legal fee to the escrow commitment", () => {
    expect(slotCommitment(naira(2_000_000), 300).total).toBe(naira(2_060_000));
  });
  it("only allows defined transitions", () => {
    expect(canTransition("open", "filled")).toBe(true);
    expect(canTransition("filled", "open")).toBe(false);
  });
});
