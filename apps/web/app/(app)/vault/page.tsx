"use client";
import Link from "next/link";
import useSWR from "swr";
import { Award, Landmark, MapPin } from "lucide-react";
import { Badge, Card, Empty, Skeleton } from "@fluravest/ui";
import { fetcher } from "@fluravest/ui/api";
import type { Pod, VaultItem } from "@/lib/types";

export default function VaultPage() {
  const { data } = useSWR<VaultItem[]>("/vault", fetcher);
  const { data: mine } = useSWR<Pod[]>("/pods/mine", fetcher);
  const pending = (mine ?? []).filter((p) => p.status === "filled" || p.status === "closing");
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-h3 text-text">Your Vault</h1>
        <p className="text-body-sm text-text-secondary">Land you co-own, with your certificates and title details.</p>
      </div>
      {!data && <Skeleton className="h-40" />}
      {data?.length === 0 && pending.length === 0 && <Empty icon={<Landmark className="h-6 w-6" />} title="Nothing here yet">When a pod you&apos;re in closes, your co-ownership certificate appears here.</Empty>}
      {pending.map((p) => (
        <Card key={p.id} className="border-dashed">
          <Badge tone="warning">Purchase in progress</Badge>
          <p className="mt-2 text-title text-text">{p.parcel.title}</p>
          <p className="text-body-sm text-text-secondary">{p.code} · your certificate is issued once the deed is executed.</p>
        </Card>
      ))}
      {data?.map((v) => (
        <Card key={v.certificateId} className="space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-caption text-text-muted">{v.podCode} · Certificate {v.code}</p>
              <p className="text-title text-text">{v.parcel.title}</p>
              <p className="flex items-center gap-1 text-body-sm text-text-secondary"><MapPin className="h-3.5 w-3.5" aria-hidden />{v.parcel.locationText}, {v.parcel.state}</p>
            </div>
            <Badge tone="positive">Owned</Badge>
          </div>
          <div className="flex items-center gap-4 rounded-md bg-surface-sunken p-3">
            <Award className="h-8 w-8 text-text-positive" aria-hidden />
            <div>
              <p className="text-amount text-text">{v.sharePercent}% co-owner</p>
              <p className="text-body-sm text-text-secondary">1 of {v.slotCount} slots · {v.parcel.sizeSqm.toLocaleString()} m² · {v.parcel.titleType}</p>
            </div>
          </div>
          <Link href={`/vault/${v.certificateId}`} className="flex h-11 items-center justify-center rounded-md bg-action-secondary text-label font-semibold text-on-action-secondary">View certificate</Link>
        </Card>
      ))}
    </div>
  );
}
