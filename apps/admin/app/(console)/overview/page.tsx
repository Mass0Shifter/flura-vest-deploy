"use client";
import useSWR from "swr";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import { Card, Money, Skeleton } from "@fluravest/ui";
import { fetcher } from "@fluravest/ui/api";
import { PageHeader, Stat } from "@/components/ui";

type Overview = {
  members: number; tier2: number; pods: Record<string, number>;
  ledger: { bankSettlement: string; memberAvailable: string; memberEscrow: string; inAcquisition: string; withdrawalFees: string; legalFees: string; landMargin: string; transactions: number; unbalancedTransactions: number; reconciled: boolean };
};

export default function OverviewPage() {
  const { data } = useSWR<Overview>("/admin/overview", fetcher, { refreshInterval: 15_000 });
  if (!data) return <Skeleton className="h-96" />;
  const l = data.ledger;
  return (
    <div className="space-y-6">
      <PageHeader title="Overview" subtitle="Live position from the double-entry ledger." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Members" value={data.members} hint={`${data.tier2} Tier 2 verified`} />
        <Stat label="Open pods" value={data.pods.open ?? 0} hint={`${data.pods.filled ?? 0} full, awaiting closing`} />
        <Stat label="Closed pods" value={data.pods.closed ?? 0} />
        <Stat label="Ledger transactions" value={l.transactions} />
      </div>
      <Card>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-title text-text">Reconciliation</h2>
          {l.reconciled && l.unbalancedTransactions === 0 ? (
            <span className="flex items-center gap-1.5 text-label text-text-positive"><CheckCircle2 className="h-5 w-5" aria-hidden />Balanced</span>
          ) : (
            <span className="flex items-center gap-1.5 text-label text-text-negative"><AlertTriangle className="h-5 w-5" aria-hidden />Mismatch: investigate</span>
          )}
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-md bg-surface-sunken p-4">
            <p className="text-caption uppercase text-text-muted">Held at partner bank (settlement)</p>
            <p className="text-amount-xl tabular text-text"><Money kobo={l.bankSettlement} /></p>
            <p className="mt-1 text-caption text-text-muted">In production this is matched daily against the bank statement.</p>
          </div>
          <dl className="space-y-2 text-body">
            <div className="flex justify-between"><dt className="text-text-secondary">Members&apos; available savings</dt><dd><Money kobo={l.memberAvailable} /></dd></div>
            <div className="flex justify-between"><dt className="text-text-secondary">Members&apos; pod escrow</dt><dd><Money kobo={l.memberEscrow} /></dd></div>
            <div className="flex justify-between"><dt className="text-text-secondary">Pods in acquisition</dt><dd><Money kobo={l.inAcquisition} /></dd></div>
            <div className="flex justify-between"><dt className="text-text-secondary">Revenue · land margin</dt><dd><Money kobo={l.landMargin} /></dd></div>
            <div className="flex justify-between"><dt className="text-text-secondary">Revenue · legal fees</dt><dd><Money kobo={l.legalFees} /></dd></div>
            <div className="flex justify-between"><dt className="text-text-secondary">Revenue · early-withdrawal fees</dt><dd><Money kobo={l.withdrawalFees} /></dd></div>
            <div className="flex justify-between border-t border-border pt-2 text-caption text-text-muted"><dt>Unbalanced transactions</dt><dd>{l.unbalancedTransactions}</dd></div>
          </dl>
        </div>
      </Card>
    </div>
  );
}
