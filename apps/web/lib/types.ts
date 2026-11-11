export type Profile = {
  id: string; email: string; fullName: string; phone: string; kycTier: number; status: string; nextOfKinName: string;
  kyc: { bvnLast4: string; ninLast4: string | null; state: string; verifiedAt: string } | null;
  bank: { bankName: string; last4: string; accountName: string; usableFrom: string } | null;
};
export type WindowStatus = { open: boolean; current?: { startsOn: string; endsOn: string; label?: string }; next?: { startsOn: string; endsOn: string; label?: string }; days?: number };
export type Wallet = {
  available: string; escrow: string; total: string;
  goals: { id: string; name: string; target: string }[];
  activity: { id: string; kind: string; memo: string; createdAt: string; amount: string }[];
  window: WindowStatus;
};
export type Pod = {
  id: string; code: string; status: string; slotCount: number; claimed: number; remaining: number;
  totalPrice: string; slotPrice: string; legalFeeBp: number; legalFeePerSlot: string; commitmentPerSlot: string; sharePercent: string;
  opensAt: string | null; expiresAt: string | null; filledAt: string | null; closedAt: string | null;
  parcel: { id: string; title: string; locationText: string; state: string; lga: string; latitude: number; longitude: number; sizeSqm: number; titleType: string; hasSurveyPlan: boolean; description: string; verified: boolean; verifiedAt: string | null };
  myClaim?: { id: string; slotNumber: number; status: string; amount: string } | null;
};
export type VaultItem = {
  certificateId: string; code: string; sharePercent: string; issuedAt: string; podCode: string; deedReference: string | null; slotCount: number;
  parcel: { title: string; locationText: string; state: string; latitude: number; longitude: number; sizeSqm: number; titleType: string };
};
export type Notification = { id: string; title: string; body: string; readAt: string | null; createdAt: string };
