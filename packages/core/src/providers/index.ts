// Provider adapters. The demo ships mock implementations; real adapters (Paystack, the partner
// bank, Smile ID / Dojah, Termii) implement the same interfaces and are selected by env.
import { randomToken } from "../crypto";

export interface PaymentProvider {
  name: string;
  /** In production this returns a checkout URL and the deposit is confirmed by a signed webhook. */
  collect(input: { amount: bigint; method: "card" | "transfer" | "ussd"; reference: string }): Promise<{ providerRef: string; status: "succeeded" | "pending" }>;
  payout(input: { amount: bigint; bankCode: string; accountNumber: string; reference: string }): Promise<{ providerRef: string; status: "succeeded" | "pending" }>;
}

export interface KycProvider {
  name: string;
  verifyBvn(bvn: string): Promise<{ ok: boolean; firstName?: string; lastName?: string; ref: string }>;
}

export interface BankDirectory {
  banks(): { code: string; name: string }[];
  resolveAccount(bankCode: string, accountNumber: string, expectedName: string): Promise<{ ok: boolean; accountName?: string }>;
}

export const mockPayments: PaymentProvider = {
  name: "mock-pay",
  async collect() {
    return { providerRef: `MOCKPAY-${randomToken(9)}`, status: "succeeded" };
  },
  async payout() {
    return { providerRef: `MOCKOUT-${randomToken(9)}`, status: "succeeded" };
  },
};

/** Demo rule: any 11-digit BVN passes except 00000000000. */
export const mockKyc: KycProvider = {
  name: "mock-kyc",
  async verifyBvn(bvn) {
    return { ok: bvn !== "00000000000", ref: `MOCKKYC-${randomToken(9)}` };
  },
};

const BANKS = [
  { code: "044", name: "Access Bank" },
  { code: "058", name: "GTBank" },
  { code: "011", name: "First Bank" },
  { code: "033", name: "UBA" },
  { code: "057", name: "Zenith Bank" },
  { code: "035", name: "Wema Bank" },
  { code: "50211", name: "Kuda MFB" },
  { code: "999992", name: "OPay" },
  { code: "50515", name: "Moniepoint MFB" },
];

/** Demo rule: name enquiry returns the member's verified name, so the match always passes. */
export const mockBanks: BankDirectory = {
  banks: () => BANKS,
  async resolveAccount(bankCode, _acct, expectedName) {
    if (!BANKS.some((b) => b.code === bankCode)) return { ok: false };
    return { ok: true, accountName: expectedName.toUpperCase() };
  },
};

export const providers = { payments: mockPayments, kyc: mockKyc, banks: mockBanks };
