"use client";
import { use, useState } from "react";
import Link from "next/link";
import useSWR, { mutate as globalMutate } from "swr";
import { BadgeCheck, FileCheck2, MapPin, Ruler, ScrollText, Timer, Users } from "lucide-react";
import { Alert, Badge, Button, Card, Money, POD_STATUS_LABEL, Sheet, SlotDots, Skeleton, VerifiedBadge, daysUntil } from "@fluravest/ui";
import { api, ApiError, fetcher } from "@fluravest/ui/api";
import { BackHeader } from "@/components/back";
import type { Pod, Profile, Wallet } from "@/lib/types";

type ClaimQuote = { quoteId: string; slotPrice: string; legalFee: string; total: string; available: string; expiresAt: string };

export default function PodPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: pod, mutate, error } = useSWR<Pod>(`/pods/${id}`, fetcher);
  const { data: me } = useSWR<Profile>("/me", fetcher);
  const { data: w } = useSWR<Wallet>("/wallet", fetcher);
  const [quote, setQuote] = useState<ClaimQuote>();
  const [accept, setAccept] = useState(false);
  const [err, setErr] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string>();
  const [confirmCancel, setConfirmCancel] = useState(false);

  if (error) return <Alert tone="negative">{error.message}</Alert>;
  if (!pod) return <div className="space-y-3"><Skeleton className="h-8 w-40" /><Skeleton className="h-48" /><Skeleton className="h-32" /></div>;

  const days = daysUntil(pod.expiresAt);
  const status = POD_STATUS_LABEL[pod.status];
  const enough = w ? BigInt(w.available) >= BigInt(pod.commitmentPerSlot) : false;
  const { latitude: lat, longitude: lng } = pod.parcel;
  const bbox = `${lng - 0.01},${lat - 0.006},${lng + 0.01},${lat + 0.006}`;

  const refresh = () => Promise.all([mutate(), globalMutate("/wallet"), globalMutate("/pods/mine"), globalMutate("/pods"), globalMutate("/notifications")]);

  async function startClaim() {
    setErr(undefined);
    setBusy(true);
    try {
      setQuote(await api<ClaimQuote>(`/pods/${id}/claim-quote`, { body: {} }));
      setAccept(false);
    } catch (x) {
      setErr(x instanceof ApiError ? x.message : "Couldn't start the claim");
    } finally {
      setBusy(false);
    }
  }
  async function confirmClaim() {
    if (!quote) return;
    setBusy(true);
    try {
      const r = await api<{ slotNumber: number; podFilled: boolean }>("/pods/claim-confirm", { body: { quoteId: quote.quoteId, acceptTerms: true } });
      setQuote(undefined);
      setToast(r.podFilled ? "You took the last slot. The pod is full and funds are now locked for the purchase." : `Slot ${r.slotNumber} is yours. Funds are held in escrow until the pod fills.`);
      await refresh();
    } catch (x) {
      setErr(x instanceof ApiError ? x.message : "Claim failed");
      setQuote(undefined);
    } finally {
      setBusy(false);
    }
  }
  async function cancel() {
    setBusy(true);
    try {
      await api(`/pods/${id}/cancel`, { body: {} });
      setConfirmCancel(false);
      setToast("You've left the pod. Your funds are back in your available balance, with no fee.");
      await refresh();
    } catch (x) {
      setErr(x instanceof ApiError ? x.message : "Couldn't cancel");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <BackHeader href="/marketplace" title={pod.parcel.title} subtitle={`${pod.code} · ${pod.parcel.locationText}, ${pod.parcel.lga}, ${pod.parcel.state}`} />
      {toast && <Alert tone="positive">{toast}</Alert>}
      {err && <Alert tone="negative">{err}</Alert>}

      <div className="overflow-hidden rounded-lg border border-border">
        <iframe title={`Map of ${pod.parcel.title}`} className="h-48 w-full" loading="lazy" src={`https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lng}`} />
      </div>

      <Card className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={status.tone}>{status.label}</Badge>
          {pod.parcel.verified && <VerifiedBadge />}
          {pod.parcel.hasSurveyPlan && <Badge tone="neutral" icon={<FileCheck2 className="h-3.5 w-3.5" aria-hidden />}>Survey plan</Badge>}
        </div>
        <SlotDots filled={pod.claimed} total={pod.slotCount} mine={pod.myClaim?.slotNumber} />
        <div className="flex justify-between text-body-sm">
          <span className="font-semibold text-text">{pod.claimed}/{pod.slotCount} co-buyers confirmed</span>
          {pod.status === "open" && days !== null && <span className="flex items-center gap-1 text-text-secondary"><Timer className="h-4 w-4" aria-hidden />{days} days left to fill</span>}
        </div>
      </Card>

      <Card>
        <dl className="grid grid-cols-2 gap-4 text-body-sm">
          <div><dt className="text-text-muted">Whole parcel</dt><dd className="text-label text-text"><Money kobo={pod.totalPrice} decimals={false} /></dd></div>
          <div><dt className="text-text-muted">Slot price</dt><dd className="text-label text-text"><Money kobo={pod.slotPrice} decimals={false} /></dd></div>
          <div><dt className="text-text-muted">Legal & title fee ({(pod.legalFeeBp / 100).toFixed(1)}%)</dt><dd className="text-label text-text"><Money kobo={pod.legalFeePerSlot} decimals={false} /></dd></div>
          <div><dt className="text-text-muted">Held in escrow per slot</dt><dd className="text-label text-text"><Money kobo={pod.commitmentPerSlot} decimals={false} /></dd></div>
          <div className="flex items-start gap-2"><Users className="mt-0.5 h-4 w-4 text-text-muted" aria-hidden /><div><dt className="text-text-muted">Your share</dt><dd className="text-label text-text">{pod.sharePercent}% (1 of {pod.slotCount})</dd></div></div>
          <div className="flex items-start gap-2"><Ruler className="mt-0.5 h-4 w-4 text-text-muted" aria-hidden /><div><dt className="text-text-muted">Plot size</dt><dd className="text-label text-text">{pod.parcel.sizeSqm.toLocaleString()} m²</dd></div></div>
          <div className="flex items-start gap-2"><ScrollText className="mt-0.5 h-4 w-4 text-text-muted" aria-hidden /><div><dt className="text-text-muted">Title</dt><dd className="text-label text-text">{pod.parcel.titleType}</dd></div></div>
          <div className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 text-text-muted" aria-hidden /><div><dt className="text-text-muted">Coordinates</dt><dd className="text-label tabular text-text">{lat.toFixed(4)}, {lng.toFixed(4)}</dd></div></div>
        </dl>
        {pod.parcel.description && <p className="mt-4 text-body-sm text-text-secondary">{pod.parcel.description}</p>}
        {pod.parcel.verified && pod.parcel.verifiedAt && <p className="mt-3 flex items-center gap-1.5 text-caption text-text-positive"><BadgeCheck className="h-4 w-4" aria-hidden />Title documents reviewed and signed off by a second verifier on {new Date(pod.parcel.verifiedAt).toLocaleDateString("en-NG", { dateStyle: "medium" })}.</p>}
      </Card>

      <Card className="space-y-2 bg-surface-sunken text-body-sm text-text-secondary">
        <p className="text-label text-text">How this pod works</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Claiming moves the slot price plus the legal fee from your wallet into escrow.</li>
          <li>Until the pod fills you can leave at any time with no fee.</li>
          <li>If it doesn&apos;t fill within 30 days, everyone is refunded in full automatically.</li>
          <li>Once full, funds are locked and used to buy the parcel. Your co-ownership certificate is issued to your Vault.</li>
          <li>After purchase your share is illiquid until the land is sold or your slot is transferred.</li>
        </ul>
      </Card>

      <div className="sticky bottom-20 z-20 rounded-lg border border-border bg-surface p-3 shadow-lg">
        {pod.myClaim ? (
          <div className="space-y-2">
            <p className="text-body-sm text-text">You hold <b>slot {pod.myClaim.slotNumber}</b> · <Money kobo={pod.myClaim.amount} decimals={false} /> {pod.status === "open" ? "in escrow" : "committed"}</p>
            {pod.status === "open" && <Button variant="outline" block onClick={() => setConfirmCancel(true)}>Leave pod (no fee)</Button>}
          </div>
        ) : pod.status !== "open" ? (
          <p className="text-center text-body-sm text-text-secondary">This pod is no longer taking claims.</p>
        ) : me && me.kycTier < 2 ? (
          <Link href="/verify-identity" className="flex h-12 items-center justify-center rounded-md bg-action-primary text-body font-semibold text-on-action-primary">Verify identity to join</Link>
        ) : !enough ? (
          <div className="space-y-2 text-center">
            <p className="text-body-sm text-text-secondary">You need <Money kobo={pod.commitmentPerSlot} decimals={false} /> available. You have {w && <Money kobo={w.available} decimals={false} />}.</p>
            <Link href="/wallet/fund" className="flex h-11 items-center justify-center rounded-md bg-action-secondary text-label font-semibold text-on-action-secondary">Fund wallet</Link>
          </div>
        ) : (
          <Button block size="lg" loading={busy} onClick={startClaim}>Join purchase party · claim a slot</Button>
        )}
      </div>

      <Sheet open={!!quote} onClose={() => setQuote(undefined)} title="Lock your slot">
        {quote && (
          <div className="space-y-4">
            <dl className="space-y-2 rounded-md bg-surface-sunken p-3 text-body">
              <div className="flex justify-between"><dt className="text-text-secondary">Slot price</dt><dd><Money kobo={quote.slotPrice} /></dd></div>
              <div className="flex justify-between"><dt className="text-text-secondary">Legal & title fee</dt><dd><Money kobo={quote.legalFee} /></dd></div>
              <div className="flex justify-between border-t border-border pt-2 font-bold"><dt>Moved to escrow</dt><dd><Money kobo={quote.total} /></dd></div>
            </dl>
            <p className="text-body-sm text-text-secondary">Available after this: <Money kobo={(BigInt(quote.available) - BigInt(quote.total)).toString()} /></p>
            <label className="flex items-start gap-3 text-body-sm text-text-secondary">
              <input type="checkbox" className="mt-0.5 h-5 w-5 accent-green-600" checked={accept} onChange={(e) => setAccept(e.target.checked)} />
              <span>I&apos;ve read the pod terms. I understand funds lock when the pod fills, and that co-owned land is illiquid. FluraVest does not promise any return.</span>
            </label>
            <Button block size="lg" disabled={!accept} loading={busy} onClick={confirmClaim}>Confirm and lock <Money kobo={quote.total} decimals={false} /></Button>
          </div>
        )}
      </Sheet>

      <Sheet open={confirmCancel} onClose={() => setConfirmCancel(false)} title="Leave this pod?">
        <p className="mb-4 text-body text-text-secondary">Your slot will be released and your funds returned to your available balance. No fee applies.</p>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={() => setConfirmCancel(false)}>Stay in pod</Button>
          <Button variant="danger" loading={busy} onClick={cancel}>Leave pod</Button>
        </div>
      </Sheet>
    </div>
  );
}
