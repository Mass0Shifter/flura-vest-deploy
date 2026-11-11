import Link from "next/link";
import { MapPin } from "lucide-react";
import { Badge, Card, Money, SlotDots, VerifiedBadge, daysUntil } from "@fluravest/ui";
import type { Pod } from "@/lib/types";

export function PodCard({ pod, compact }: { pod: Pod; compact?: boolean }) {
  const days = daysUntil(pod.expiresAt);
  return (
    <Card as="article" className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-caption text-text-muted">{pod.code}</p>
          <h3 className="text-title text-text">{pod.parcel.title}</h3>
          <p className="mt-0.5 flex items-center gap-1 text-body-sm text-text-secondary"><MapPin className="h-3.5 w-3.5" aria-hidden />{pod.parcel.locationText}, {pod.parcel.state}</p>
        </div>
        {pod.parcel.verified && <VerifiedBadge label={pod.parcel.titleType} />}
      </div>
      <SlotDots filled={pod.claimed} total={pod.slotCount} mine={pod.myClaim?.slotNumber} />
      <div className="flex items-center justify-between text-body-sm">
        <span className="font-semibold text-text">{pod.claimed}/{pod.slotCount} slots confirmed</span>
        {pod.status === "open" && days !== null && <Badge tone={days <= 5 ? "warning" : "neutral"}>{days}d left to fill</Badge>}
      </div>
      {!compact && (
        <dl className="grid grid-cols-2 gap-2 rounded-md bg-surface-sunken p-3 text-body-sm">
          <div><dt className="text-text-muted">Slot price</dt><dd className="font-semibold text-text"><Money kobo={pod.slotPrice} decimals={false} /></dd></div>
          <div><dt className="text-text-muted">Whole parcel</dt><dd className="font-semibold text-text"><Money kobo={pod.totalPrice} decimals={false} /></dd></div>
          <div><dt className="text-text-muted">Your share</dt><dd className="font-semibold text-text">{pod.sharePercent}%</dd></div>
          <div><dt className="text-text-muted">Plot size</dt><dd className="font-semibold text-text">{pod.parcel.sizeSqm.toLocaleString()} m²</dd></div>
        </dl>
      )}
      <Link href={`/pods/${pod.id}`} className="flex h-11 items-center justify-center rounded-md bg-action-secondary text-label font-semibold text-on-action-secondary hover:bg-action-secondary-hover">
        {pod.myClaim ? "View my slot" : pod.remaining === 1 ? "View deal · 1 slot left" : "View deal & claim slot"}
      </Link>
    </Card>
  );
}
