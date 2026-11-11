"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { BadgeCheck, Building2, LogOut, ShieldAlert, UserRound } from "lucide-react";
import { Badge, Button, Card } from "@fluravest/ui";
import { api, fetcher } from "@fluravest/ui/api";
import type { Profile } from "@/lib/types";

export default function ProfilePage() {
  const router = useRouter();
  const { data: me } = useSWR<Profile>("/me", fetcher);
  if (!me) return null;
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-navy-900 text-white"><UserRound className="h-6 w-6" aria-hidden /></div>
        <div>
          <h1 className="text-title text-text">{me.fullName}</h1>
          <p className="text-body-sm text-text-secondary">{me.email} · {me.phone}</p>
        </div>
      </div>
      <Card className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-label text-text">Identity</p>
          {me.kycTier >= 2 ? <Badge tone="positive" icon={<BadgeCheck className="h-3.5 w-3.5" />}>Tier 2 verified</Badge> : <Badge tone="warning" icon={<ShieldAlert className="h-3.5 w-3.5" />}>Tier 1</Badge>}
        </div>
        {me.kyc ? (
          <p className="text-body-sm text-text-secondary">BVN •••••••{me.kyc.bvnLast4}{me.kyc.ninLast4 ? ` · NIN •••••••${me.kyc.ninLast4}` : ""} · {me.kyc.state}</p>
        ) : (
          <Link href="/verify-identity" className="text-label text-text-link">Verify your identity</Link>
        )}
      </Card>
      <Card className="space-y-1">
        <p className="flex items-center gap-2 text-label text-text"><Building2 className="h-4 w-4" aria-hidden />Payout account</p>
        {me.bank ? <p className="text-body-sm text-text-secondary">{me.bank.accountName} · {me.bank.bankName} ••••{me.bank.last4}</p> : <p className="text-body-sm text-text-muted">Added during identity verification.</p>}
        <p className="text-caption text-text-muted">For your security, withdrawals pause for 24 hours after a payout account change.</p>
      </Card>
      <Card>
        <p className="text-label text-text">Next of kin</p>
        <p className="text-body-sm text-text-secondary">{me.nextOfKinName}</p>
      </Card>
      <Button
        variant="outline"
        block
        onClick={async () => {
          await api("/auth/signout", { body: {} });
          router.replace("/signin");
        }}
      >
        <LogOut className="h-4 w-4" aria-hidden />Sign out
      </Button>
    </div>
  );
}
