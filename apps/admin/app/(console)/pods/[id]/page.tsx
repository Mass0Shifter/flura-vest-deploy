"use client";
import { use, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { ChevronLeft, ShieldCheck } from "lucide-react";
import { Alert, Badge, Button, Card, Field, Input, Money, POD_STATUS_LABEL, Sheet, Skeleton, cx } from "@fluravest/ui";
import { api, ApiError, fetcher } from "@fluravest/ui/api";
import { PageHeader, Table, Td } from "@/components/ui";
import type { Me } from "@/components/types";

type Detail = {
  id: string; code: string; status: string; slotCount: number; legalFeeBp: number; acquisitionCost: string; syndicatedPrice: string; slotPrice: string; margin: string;
  createdBy: string; publishedBy: string | null; closeRequestedBy: string | null; closeApprovedBy: string | null; deedReference: string | null;
  createdByName: string | null; publishedByName: string | null; closeRequestedByName: string | null; closeApprovedByName: string | null;
  opensAt: string | null; expiresAt: string | null; filledAt: string | null; closedAt: string | null;
  parcel: { title: string; locationText: string; state: string; titleType: string };
  claims: { id: string; slotNumber: number; status: string; slotAmount: string; legalFee: string; createdAt: string; memberName: string; memberEmail: string }[];
  escrowHeld: string; acquisitionBalance: string;
};

export default function PodDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: p, mutate } = useSWR<Detail>(`/admin/pods/${id}`, fetcher);
  const { data: me } = useSWR<Me>("/admin/me", fetcher);
  const [err, setErr] = useState<string>();
  const [ok, setOk] = useState<string>();
  const [busy, setBusy] = useState<string>();
  const [deedOpen, setDeedOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [deed, setDeed] = useState("LAG/LR/2026/DEED/");
  const [reason, setReason] = useState("");

  if (!p || !me) return <Skeleton className="h-96" />;

  async function act(action: string, msg: string, body: unknown = {}) {
    setBusy(action);
    setErr(undefined);
    setOk(undefined);
    try {
      await api(`/admin/pods/${id}/${action}`, { body });
      setOk(msg);
      setDeedOpen(false);
      setCancelOpen(false);
      await mutate();
    } catch (x) {
      setErr(x instanceof ApiError ? x.message : "Action failed");
    } finally {
      setBusy(undefined);
    }
  }

  const s = POD_STATUS_LABEL[p.status];
  const steps = [
    { label: "Created", by: p.createdByName, done: true },
    { label: "Published (checker)", by: p.publishedByName, done: !!p.publishedBy },
    { label: "Filled", by: p.filledAt ? new Date(p.filledAt).toLocaleDateString("en-NG") : null, done: !!p.filledAt },
    { label: "Closing requested (maker)", by: p.closeRequestedByName, done: !!p.closeRequestedBy },
    { label: "Escrow released (finance checker)", by: p.closeApprovedByName, done: !!p.closeApprovedBy },
    { label: "Deed executed · certificates issued", by: p.deedReference, done: p.status === "closed" },
  ];

  return (
    <div className="space-y-6">
      <Link href="/pods" className="inline-flex items-center text-label text-text-secondary"><ChevronLeft className="h-4 w-4" aria-hidden />All pods</Link>
      <PageHeader title={`${p.code} · ${p.parcel.title}`} subtitle={`${p.parcel.locationText}, ${p.parcel.state} · ${p.parcel.titleType}`} action={<Badge tone={s.tone}>{p.status === "draft" ? "Draft" : s.label}</Badge>} />
      {ok && <Alert tone="positive">{ok}</Alert>}
      {err && <Alert tone="negative">{err}</Alert>}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <h2 className="mb-3 text-title text-text">Economics</h2>
          <dl className="grid grid-cols-2 gap-4 text-body-sm md:grid-cols-3">
            <div><dt className="text-text-muted">Acquisition cost</dt><dd className="text-label"><Money kobo={p.acquisitionCost} /></dd></div>
            <div><dt className="text-text-muted">Syndicated price</dt><dd className="text-label"><Money kobo={p.syndicatedPrice} /></dd></div>
            <div><dt className="text-text-muted">Land margin</dt><dd className="text-label"><Money kobo={p.margin} /></dd></div>
            <div><dt className="text-text-muted">Slot price</dt><dd className="text-label"><Money kobo={p.slotPrice} /></dd></div>
            <div><dt className="text-text-muted">Legal fee</dt><dd className="text-label">{p.legalFeeBp / 100}% per slot</dd></div>
            <div><dt className="text-text-muted">Slots</dt><dd className="text-label">{p.claims.filter((c) => c.status !== "released").length}/{p.slotCount}</dd></div>
            <div><dt className="text-text-muted">Held in escrow</dt><dd className="text-label"><Money kobo={p.escrowHeld} /></dd></div>
            <div><dt className="text-text-muted">Acquisition account</dt><dd className="text-label"><Money kobo={p.acquisitionBalance} /></dd></div>
          </dl>
        </Card>
        <Card>
          <h2 className="mb-3 flex items-center gap-2 text-title text-text"><ShieldCheck className="h-5 w-5 text-text-positive" aria-hidden />Approvals</h2>
          <ol className="space-y-2">
            {steps.map((st) => (
              <li key={st.label} className="flex items-start gap-2 text-body-sm">
                <span className={cx("mt-1 h-2.5 w-2.5 shrink-0 rounded-full", st.done ? "bg-positive" : "bg-progress-track")} />
                <span><span className={st.done ? "text-text" : "text-text-muted"}>{st.label}</span>{st.by && <span className="block text-caption text-text-muted">{st.by}</span>}</span>
              </li>
            ))}
          </ol>
        </Card>
      </div>

      <Card>
        <h2 className="mb-3 text-title text-text">Actions</h2>
        <div className="flex flex-wrap gap-2">
          {p.status === "draft" && <Button loading={busy === "publish"} onClick={() => act("publish", "Pod published. It's now live in the marketplace with a 30-day fill window.")}>Publish pod</Button>}
          {p.status === "filled" && !p.closeRequestedBy && <Button loading={busy === "request-close"} onClick={() => act("request-close", "Closing requested. A finance approver must now release escrow.")}>Request closing</Button>}
          {p.status === "filled" && p.closeRequestedBy && <Button loading={busy === "approve-close"} onClick={() => act("approve-close", "Escrow released to acquisition. Seller payment and margin are posted.")}>Approve escrow release</Button>}
          {p.status === "closing" && <Button onClick={() => setDeedOpen(true)}>Record deed & issue certificates</Button>}
          {(p.status === "open" || p.status === "draft") && <Button variant="outline" onClick={() => setCancelOpen(true)}>Withdraw pod & refund</Button>}
          {["closed", "expired", "cancelled"].includes(p.status) && <p className="text-body-sm text-text-muted">No further actions.</p>}
        </div>
        <p className="mt-3 text-caption text-text-muted">
          Maker-checker is enforced by the API: the admin who creates a pod can&apos;t publish it, and whoever requests closing can&apos;t approve the escrow release. You&apos;re signed in as {me.name} ({me.role}).
        </p>
      </Card>

      <div>
        <h2 className="mb-3 text-title text-text">Slot holders</h2>
        <Table head={["Slot", "Member", "Status", "Slot amount", "Legal fee", "Claimed"]}>
          {p.claims.map((c) => (
            <tr key={c.id}>
              <Td>#{c.slotNumber}</Td>
              <Td>{c.memberName}<span className="block text-caption text-text-muted">{c.memberEmail}</span></Td>
              <Td><Badge tone={c.status === "held" ? "info" : c.status === "converted" ? "positive" : "neutral"}>{c.status === "held" ? "In escrow" : c.status === "converted" ? "Converted to land" : "Released"}</Badge></Td>
              <Td><Money kobo={c.slotAmount} /></Td>
              <Td><Money kobo={c.legalFee} /></Td>
              <Td>{new Date(c.createdAt).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" })}</Td>
            </tr>
          ))}
        </Table>
        {p.claims.length === 0 && <p className="mt-2 text-body-sm text-text-muted">No claims yet.</p>}
      </div>

      <Sheet open={deedOpen} onClose={() => setDeedOpen(false)} title="Record executed deed">
        <div className="space-y-4">
          <Field label="Deed / registry reference" htmlFor="deed"><Input id="deed" value={deed} onChange={(e) => setDeed(e.target.value)} /></Field>
          <p className="text-body-sm text-text-secondary">A certificate will be generated for each of the {p.slotCount} co-owners, fingerprinted (SHA-256) and placed in their Vault.</p>
          <Button block loading={busy === "complete-close"} onClick={() => act("complete-close", "Pod closed. Certificates issued to every co-owner.", { deedReference: deed })}>Issue certificates</Button>
        </div>
      </Sheet>
      <Sheet open={cancelOpen} onClose={() => setCancelOpen(false)} title="Withdraw this pod?">
        <div className="space-y-4">
          <p className="text-body-sm text-text-secondary">All slot holders are refunded in full to their available balance and notified.</p>
          <Field label="Reason (recorded in the audit log)" htmlFor="reason"><Input id="reason" value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
          <Button variant="danger" block disabled={reason.trim().length < 5} loading={busy === "cancel"} onClick={() => act("cancel", "Pod withdrawn and all holders refunded.", { reason })}>Withdraw and refund</Button>
        </div>
      </Sheet>
    </div>
  );
}
