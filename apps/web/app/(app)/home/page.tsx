"use client";
import Link from "next/link";
import useSWR from "swr";
import { useState } from "react";
import { ArrowDownToLine, CalendarClock, Plus, ShieldCheck, Target, Trash2 } from "lucide-react";
import { Alert, Badge, Button, Card, Empty, Field, Input, Money, Progress, SectionTitle, Sheet, Skeleton } from "@fluravest/ui";
import { api, ApiError, fetcher } from "@fluravest/ui/api";
import { formatNaira } from "@fluravest/domain";
import { PodCard } from "@/components/pod-card";
import type { Pod, Profile, Wallet } from "@/lib/types";

export default function HomePage() {
  const { data: me } = useSWR<Profile>("/me", fetcher);
  const { data: w, mutate } = useSWR<Wallet>("/wallet", fetcher);
  const { data: mine } = useSWR<Pod[]>("/pods/mine", fetcher);
  const { data: pods } = useSWR<Pod[]>("/pods", fetcher);
  const [goalOpen, setGoalOpen] = useState(false);
  const featured = (pods ?? []).filter((p) => !p.myClaim).slice(0, 3);
  const active = (mine ?? []).filter((p) => p.status !== "closed");

  return (
    <div className="space-y-6">
      <p className="text-body text-text-secondary">Hello, <span className="font-semibold text-text">{me?.fullName.split(" ")[0]}</span></p>

      {me && me.kycTier < 2 && (
        <Alert tone="warning" title="Verify your identity to get started">
          Tier 2 (BVN + payout account) unlocks deposits above ₦50,000, slot claims and withdrawals.{" "}
          <Link href="/verify-identity" className="font-semibold text-text-link underline">Verify now</Link>
        </Alert>
      )}

      <section className="rounded-xl bg-surface-brand p-5 text-text-on-brand shadow-md">
        <p className="text-overline uppercase text-navy-200">Available balance</p>
        {w ? <p className="mt-1 text-amount-xl"><Money kobo={w.available} /></p> : <Skeleton className="mt-2 h-10 w-48 bg-white/10" />}
        {w && BigInt(w.escrow) > 0n && <p className="mt-1 text-body-sm text-navy-100">+ <Money kobo={w.escrow} /> locked in pods</p>}
        <div className="mt-5 grid grid-cols-2 gap-3">
          <Link href="/wallet/fund" className="flex h-11 items-center justify-center gap-2 rounded-md bg-action-primary text-label font-semibold text-on-action-primary hover:bg-action-primary-hover"><Plus className="h-4 w-4" aria-hidden />Fund wallet</Link>
          <Link href="/wallet/withdraw" className="flex h-11 items-center justify-center gap-2 rounded-md border border-white/30 text-label font-semibold hover:bg-white/10"><ArrowDownToLine className="h-4 w-4" aria-hidden />Withdraw</Link>
        </div>
        {w && (
          <p className="mt-3 flex items-center gap-1.5 text-caption text-navy-100">
            <CalendarClock className="h-4 w-4" aria-hidden />
            {w.window.open ? `Free withdrawal window open · ${w.window.days} day${w.window.days === 1 ? "" : "s"} left` : w.window.next ? `Next free withdrawal window in ${w.window.days} days (${new Date(w.window.next.startsOn).toLocaleDateString("en-NG", { day: "numeric", month: "short" })})` : "No free window scheduled"}
          </p>
        )}
      </section>

      <section>
        <SectionTitle action={<button onClick={() => setGoalOpen(true)} className="text-label text-text-link">+ Add goal</button>}>Goals</SectionTitle>
        {w && w.goals.length === 0 && <Empty icon={<Target className="h-6 w-6" />} title="No goals yet">Set a target like “₦500,000 Land Seed Fund”.</Empty>}
        <div className="space-y-3">
          {w?.goals.map((g) => {
            const total = BigInt(w.total);
            const target = BigInt(g.target);
            const reached = total >= target;
            return (
              <Card key={g.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-label text-text">{g.name}</p>
                  <button aria-label={`Delete goal ${g.name}`} className="text-text-muted hover:text-text-negative" onClick={async () => { await api(`/wallet/goals/${g.id}`, { method: "DELETE" }); mutate(); }}><Trash2 className="h-4 w-4" /></button>
                </div>
                <Progress value={Number(total > target ? target : total)} max={Number(target)} label={`${g.name} progress`} />
                <p className="text-body-sm text-text-secondary">{reached ? "Target reached" : <><Money kobo={w.total} decimals={false} /> of <Money kobo={g.target} decimals={false} /></>}</p>
              </Card>
            );
          })}
        </div>
      </section>

      <section>
        <SectionTitle>Active participation</SectionTitle>
        {mine && active.length === 0 && <Empty title="You're not in a pod yet">Browse the marketplace and claim a slot when you're ready.</Empty>}
        <div className="space-y-3">
          {active.map((p) => (
            <Card key={p.id} className="space-y-2">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-caption text-text-muted">{p.code}</p>
                  <p className="text-title text-text">{p.parcel.title}</p>
                </div>
                <Badge tone={p.status === "open" ? "info" : "warning"}>{p.status === "open" ? "Filling" : p.status === "filled" ? "Full · closing" : "Purchasing"}</Badge>
              </div>
              <Progress value={p.claimed} max={p.slotCount} label="Slots confirmed" />
              <p className="text-body-sm text-text-secondary">{p.claimed}/{p.slotCount} slots committed · Your share: slot {p.myClaim?.slotNumber} (<Money kobo={p.myClaim!.amount} decimals={false} /> locked)</p>
              <Link href={`/pods/${p.id}`} className="text-label text-text-link">View pod</Link>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <SectionTitle action={<Link href="/marketplace" className="text-label text-text-link">See all</Link>}>Featured land pods</SectionTitle>
        <div className="space-y-3">{featured.map((p) => <PodCard key={p.id} pod={p} />)}</div>
      </section>

      <section>
        <SectionTitle>Recent activity</SectionTitle>
        <Card className="divide-y divide-border p-0">
          {w?.activity.length === 0 && <p className="p-4 text-body-sm text-text-muted">No activity yet.</p>}
          {w?.activity.map((a) => {
            const amt = BigInt(a.amount);
            return (
              <div key={a.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-body-sm font-semibold text-text">{a.memo}</p>
                  <p className="text-caption text-text-muted">{new Date(a.createdAt).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" })}</p>
                </div>
                <span className={amt >= 0n ? "tabular text-label text-text-positive" : "tabular text-label text-text"}>{amt >= 0n ? "+" : "−"}{formatNaira(amt < 0n ? -amt : amt)}</span>
              </div>
            );
          })}
        </Card>
        <p className="mt-3 flex items-center gap-1.5 text-caption text-text-muted"><ShieldCheck className="h-4 w-4" aria-hidden /> Savings and pod funds are held with a licensed partner bank (simulated in this demo).</p>
      </section>

      <GoalSheet open={goalOpen} onClose={() => setGoalOpen(false)} onSaved={() => { setGoalOpen(false); mutate(); }} />
    </div>
  );
}

function GoalSheet({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState("Land Seed Fund");
  const [target, setTarget] = useState("500000");
  const [err, setErr] = useState<string>();
  const [loading, setLoading] = useState(false);
  return (
    <Sheet open={open} onClose={onClose} title="New goal">
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setLoading(true);
          try {
            await api("/wallet/goals", { body: { name, targetNaira: Number(target) } });
            onSaved();
          } catch (x) {
            setErr(x instanceof ApiError ? x.message : "Couldn't save");
          } finally {
            setLoading(false);
          }
        }}
      >
        {err && <Alert tone="negative">{err}</Alert>}
        <Field label="Goal name" htmlFor="gname"><Input id="gname" value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Target (₦)" htmlFor="gtarget" hint="Goals are labels on your one wallet. Nothing is moved or locked."><Input id="gtarget" inputMode="numeric" value={target} onChange={(e) => setTarget(e.target.value.replace(/[^\d]/g, ""))} /></Field>
        <Button type="submit" block loading={loading}>Save goal</Button>
      </form>
    </Sheet>
  );
}
