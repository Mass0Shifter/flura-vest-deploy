"use client";
import { useMemo, useState } from "react";
import useSWR from "swr";
import { SlidersHorizontal } from "lucide-react";
import { Empty, Select, Skeleton } from "@fluravest/ui";
import { fetcher } from "@fluravest/ui/api";
import { PodCard } from "@/components/pod-card";
import type { Pod } from "@/lib/types";

const PRICE_BANDS = [
  { id: "any", label: "Any slot price", max: Infinity },
  { id: "500k", label: "Up to ₦500k", max: 500_000_00 },
  { id: "1m", label: "Up to ₦1m", max: 1_000_000_00 },
  { id: "3m", label: "Up to ₦3m", max: 3_000_000_00 },
];

export default function Marketplace() {
  const { data } = useSWR<Pod[]>("/pods", fetcher);
  const [state, setState] = useState("all");
  const [band, setBand] = useState("any");
  const [slots, setSlots] = useState("all");
  const states = useMemo(() => [...new Set((data ?? []).map((p) => p.parcel.state))].sort(), [data]);
  const max = PRICE_BANDS.find((b) => b.id === band)!.max;
  const list = (data ?? []).filter((p) => (state === "all" || p.parcel.state === state) && Number(p.slotPrice) <= max && (slots === "all" || String(p.slotCount) === slots));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-h3 text-text">Land pod marketplace</h1>
        <p className="text-body-sm text-text-secondary">Verified parcels, split into 5 or 6 equal slots. Join one when your savings are ready.</p>
      </div>
      <div className="grid grid-cols-3 gap-2" aria-label="Filters">
        <Select aria-label="State" value={state} onChange={(e) => setState(e.target.value)}>
          <option value="all">All states</option>
          {states.map((s) => <option key={s}>{s}</option>)}
        </Select>
        <Select aria-label="Slot price" value={band} onChange={(e) => setBand(e.target.value)}>
          {PRICE_BANDS.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
        </Select>
        <Select aria-label="Pod size" value={slots} onChange={(e) => setSlots(e.target.value)}>
          <option value="all">5 or 6 slots</option>
          <option value="5">5 slots</option>
          <option value="6">6 slots</option>
        </Select>
      </div>
      {!data && <><Skeleton className="h-64" /><Skeleton className="h-64" /></>}
      {data && list.length === 0 && <Empty icon={<SlidersHorizontal className="h-6 w-6" />} title="No pods match">Try a different state or price.</Empty>}
      <div className="space-y-4">{list.map((p) => <PodCard key={p.id} pod={p} />)}</div>
    </div>
  );
}
