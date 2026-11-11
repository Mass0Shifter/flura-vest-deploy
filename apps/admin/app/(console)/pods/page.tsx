"use client";
import Link from "next/link";
import { useState } from "react";
import useSWR from "swr";
import { Plus } from "lucide-react";
import { Alert, Badge, Button, Field, Input, Money, POD_STATUS_LABEL, Select, Sheet } from "@fluravest/ui";
import { api, ApiError, fetcher } from "@fluravest/ui/api";
import { PageHeader, Table, Td } from "@/components/ui";

type PodRow = { id: string; code: string; status: string; parcelTitle: string; state: string; slotCount: number; claimed: number; slotPrice: string; acquisitionCost: string; syndicatedPrice: string; expiresAt: string | null };
type Parcel = { id: string; title: string; status: string; state: string };

export default function PodsPage() {
  const { data, mutate } = useSWR<PodRow[]>("/admin/pods", fetcher);
  const [open, setOpen] = useState(false);
  return (
    <div>
      <PageHeader title="Land pods" subtitle="Create pods from verified parcels. A different admin must publish them." action={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" aria-hidden />New pod</Button>} />
      <Table head={["Pod", "Parcel", "Status", "Slots", "Slot price", "Syndicated", "Margin", "Fill deadline"]}>
        {data?.map((p) => {
          const s = POD_STATUS_LABEL[p.status];
          return (
            <tr key={p.id} className="hover:bg-surface-sunken">
              <Td><Link href={`/pods/${p.id}`} className="font-semibold text-text-link">{p.code}</Link></Td>
              <Td>{p.parcelTitle}<span className="block text-caption text-text-muted">{p.state}</span></Td>
              <Td><Badge tone={s.tone}>{p.status === "draft" ? "Draft – needs publishing" : s.label}</Badge></Td>
              <Td>{p.claimed}/{p.slotCount}</Td>
              <Td><Money kobo={p.slotPrice} decimals={false} /></Td>
              <Td><Money kobo={p.syndicatedPrice} decimals={false} /></Td>
              <Td><Money kobo={(BigInt(p.syndicatedPrice) - BigInt(p.acquisitionCost)).toString()} decimals={false} /></Td>
              <Td>{p.expiresAt && p.status === "open" ? new Date(p.expiresAt).toLocaleDateString("en-NG", { dateStyle: "medium" }) : "—"}</Td>
            </tr>
          );
        })}
      </Table>
      <NewPod open={open} onClose={() => setOpen(false)} onDone={() => { setOpen(false); mutate(); }} />
    </div>
  );
}

function NewPod({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const { data: parcels } = useSWR<Parcel[]>(open ? "/admin/parcels" : null, fetcher);
  const [f, setF] = useState({ parcelId: "", acquisitionNaira: "", syndicatedNaira: "", slotCount: "6", legalFeeBp: "300" });
  const [err, setErr] = useState<string>();
  const [fields, setFields] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const verified = (parcels ?? []).filter((p) => p.status === "verified");
  const synd = Number(f.syndicatedNaira || 0);
  const slot = synd && Number(f.slotCount) ? synd / Number(f.slotCount) : 0;
  return (
    <Sheet open={open} onClose={onClose} title="New land pod">
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setLoading(true);
          setErr(undefined);
          setFields({});
          try {
            await api("/admin/pods", { body: f });
            onDone();
          } catch (x) {
            if (x instanceof ApiError) { setErr(x.message); setFields(x.fields ?? {}); }
          } finally {
            setLoading(false);
          }
        }}
      >
        {err && <Alert tone="negative">{err}</Alert>}
        <Field label="Verified parcel" htmlFor="parcel" error={fields.parcelId}>
          <Select id="parcel" value={f.parcelId} onChange={(e) => setF({ ...f, parcelId: e.target.value })}>
            <option value="">Choose a parcel</option>
            {verified.map((p) => <option key={p.id} value={p.id}>{p.title} ({p.state})</option>)}
          </Select>
        </Field>
        <Field label="Acquisition cost (₦)" htmlFor="acq" error={fields.acquisitionNaira} hint="What FluraVest pays the titleholder"><Input id="acq" inputMode="numeric" value={f.acquisitionNaira} onChange={(e) => setF({ ...f, acquisitionNaira: e.target.value.replace(/\D/g, "") })} /></Field>
        <Field label="Syndicated price (₦)" htmlFor="syn" error={fields.syndicatedNaira} hint="Total members pay; must divide evenly into slots"><Input id="syn" inputMode="numeric" value={f.syndicatedNaira} onChange={(e) => setF({ ...f, syndicatedNaira: e.target.value.replace(/\D/g, "") })} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Slots" htmlFor="slots"><Select id="slots" value={f.slotCount} onChange={(e) => setF({ ...f, slotCount: e.target.value })}><option value="5">5</option><option value="6">6</option></Select></Field>
          <Field label="Legal fee" htmlFor="fee"><Select id="fee" value={f.legalFeeBp} onChange={(e) => setF({ ...f, legalFeeBp: e.target.value })}>{[200, 300, 400, 500].map((b) => <option key={b} value={b}>{b / 100}%</option>)}</Select></Field>
        </div>
        {slot > 0 && <p className="text-body-sm text-text-secondary">Slot price ₦{slot.toLocaleString()} · margin ₦{(synd - Number(f.acquisitionNaira || 0)).toLocaleString()}</p>}
        <Button type="submit" block loading={loading}>Create draft pod</Button>
      </form>
    </Sheet>
  );
}
