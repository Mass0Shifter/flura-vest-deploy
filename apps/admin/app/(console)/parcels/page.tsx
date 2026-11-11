"use client";
import { useState } from "react";
import useSWR from "swr";
import { BadgeCheck, Plus } from "lucide-react";
import { TITLE_TYPES } from "@fluravest/domain";
import { Alert, Badge, Button, Field, Input, Select, Sheet } from "@fluravest/ui";
import { api, ApiError, fetcher } from "@fluravest/ui/api";
import { PageHeader, Table, Td } from "@/components/ui";
import type { Me } from "@/components/types";

type Parcel = { id: string; title: string; locationText: string; state: string; lga: string; sizeSqm: number; titleType: string; hasSurveyPlan: boolean; status: string; createdBy: string; createdByName: string; verifiedByName: string | null; verificationNotes: string | null; createdAt: string };

export default function ParcelsPage() {
  const { data, mutate } = useSWR<Parcel[]>("/admin/parcels", fetcher);
  const { data: me } = useSWR<Me>("/admin/me", fetcher);
  const [creating, setCreating] = useState(false);
  const [reviewing, setReviewing] = useState<Parcel>();
  return (
    <div>
      <PageHeader title="Parcels & verification" subtitle="Operations adds parcels; a verifier who didn't add it signs off the title before it can be listed." action={<Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" aria-hidden />Add parcel</Button>} />
      <Table head={["Parcel", "Location", "Title", "Size", "Status", "Added by", "Verified by", ""]}>
        {data?.map((p) => (
          <tr key={p.id}>
            <Td className="font-semibold">{p.title}</Td>
            <Td>{p.lga}, {p.state}</Td>
            <Td>{p.titleType}{p.hasSurveyPlan && <span className="block text-caption text-text-muted">+ survey plan</span>}</Td>
            <Td>{p.sizeSqm.toLocaleString()} m²</Td>
            <Td>{p.status === "verified" ? <Badge tone="positive" icon={<BadgeCheck className="h-3.5 w-3.5" />}>Verified</Badge> : p.status === "rejected" ? <Badge tone="negative">Rejected</Badge> : <Badge tone="warning">Awaiting review</Badge>}</Td>
            <Td>{p.createdByName}</Td>
            <Td>{p.verifiedByName ?? "—"}</Td>
            <Td>{p.status === "draft" && <Button size="sm" variant="secondary" onClick={() => setReviewing(p)} disabled={me?.id === p.createdBy} title={me?.id === p.createdBy ? "You added this parcel, so another admin must review it" : undefined}>Review</Button>}</Td>
          </tr>
        ))}
      </Table>
      <NewParcel open={creating} onClose={() => setCreating(false)} onDone={() => { setCreating(false); mutate(); }} />
      <Review parcel={reviewing} onClose={() => setReviewing(undefined)} onDone={() => { setReviewing(undefined); mutate(); }} />
    </div>
  );
}

function NewParcel({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ title: "", locationText: "", state: "Lagos", lga: "", latitude: "6.5244", longitude: "3.3792", sizeSqm: "500", titleType: "C of O", hasSurveyPlan: true, description: "" });
  const [err, setErr] = useState<string>();
  const [fields, setFields] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const t = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <Sheet open={open} onClose={onClose} title="Add parcel">
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setLoading(true);
          setErr(undefined);
          setFields({});
          try {
            await api("/admin/parcels", { body: f });
            onDone();
          } catch (x) {
            if (x instanceof ApiError) { setErr(x.message); setFields(x.fields ?? {}); }
          } finally {
            setLoading(false);
          }
        }}
      >
        {err && <Alert tone="negative">{err}</Alert>}
        <Field label="Title" htmlFor="t" error={fields.title}><Input id="t" value={f.title} onChange={t("title")} /></Field>
        <Field label="Address / description of location" htmlFor="l" error={fields.locationText}><Input id="l" value={f.locationText} onChange={t("locationText")} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="State" htmlFor="s" error={fields.state}><Input id="s" value={f.state} onChange={t("state")} /></Field>
          <Field label="LGA" htmlFor="lga" error={fields.lga}><Input id="lga" value={f.lga} onChange={t("lga")} /></Field>
          <Field label="Latitude" htmlFor="lat" error={fields.latitude}><Input id="lat" value={f.latitude} onChange={t("latitude")} /></Field>
          <Field label="Longitude" htmlFor="lng" error={fields.longitude}><Input id="lng" value={f.longitude} onChange={t("longitude")} /></Field>
          <Field label="Size (m²)" htmlFor="sz" error={fields.sizeSqm}><Input id="sz" inputMode="numeric" value={f.sizeSqm} onChange={t("sizeSqm")} /></Field>
          <Field label="Title type" htmlFor="tt"><Select id="tt" value={f.titleType} onChange={t("titleType")}>{TITLE_TYPES.map((x) => <option key={x}>{x}</option>)}</Select></Field>
        </div>
        <label className="flex items-center gap-2 text-body-sm text-text"><input type="checkbox" className="h-4 w-4 accent-green-600" checked={f.hasSurveyPlan} onChange={(e) => setF({ ...f, hasSurveyPlan: e.target.checked })} />Survey plan on file</label>
        <Field label="Notes for members" htmlFor="d"><Input id="d" value={f.description} onChange={t("description")} /></Field>
        <Button type="submit" block loading={loading}>Add parcel for review</Button>
      </form>
    </Sheet>
  );
}

function Review({ parcel, onClose, onDone }: { parcel?: Parcel; onClose: () => void; onDone: () => void }) {
  const [notes, setNotes] = useState("Title, survey plan and land registry search reviewed.");
  const [err, setErr] = useState<string>();
  const [busy, setBusy] = useState<string>();
  async function decide(decision: "verified" | "rejected") {
    if (!parcel) return;
    setBusy(decision);
    setErr(undefined);
    try {
      await api(`/admin/parcels/${parcel.id}/verify`, { body: { decision, notes } });
      onDone();
    } catch (x) {
      setErr(x instanceof ApiError ? x.message : "Failed");
    } finally {
      setBusy(undefined);
    }
  }
  return (
    <Sheet open={!!parcel} onClose={onClose} title={`Review: ${parcel?.title ?? ""}`}>
      <div className="space-y-4">
        {err && <Alert tone="negative">{err}</Alert>}
        <p className="text-body-sm text-text-secondary">Added by {parcel?.createdByName}. Confirm the {parcel?.titleType}{parcel?.hasSurveyPlan ? " and survey plan" : ""} match the registry before signing off.</p>
        <Field label="Verification notes" htmlFor="n"><Input id="n" value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" loading={busy === "rejected"} onClick={() => decide("rejected")}>Reject</Button>
          <Button loading={busy === "verified"} onClick={() => decide("verified")}>Sign off as verified</Button>
        </div>
      </div>
    </Sheet>
  );
}
