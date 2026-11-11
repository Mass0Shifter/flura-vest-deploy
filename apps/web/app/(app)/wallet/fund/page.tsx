"use client";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import useSWR from "swr";
import { Building2, CreditCard, Hash } from "lucide-react";
import { Alert, Button, Card, Field, Input, cx } from "@fluravest/ui";
import { api, ApiError, fetcher, idempotencyKey } from "@fluravest/ui/api";
import { BackHeader } from "@/components/back";
import type { Profile } from "@/lib/types";

const methods = [
  { id: "card", label: "Debit card", icon: CreditCard },
  { id: "transfer", label: "Bank transfer", icon: Building2 },
  { id: "ussd", label: "USSD", icon: Hash },
] as const;

export default function FundPage() {
  const router = useRouter();
  const { data: me } = useSWR<Profile>("/me", fetcher);
  const { data: va } = useSWR<{ bankName: string; accountNumber: string; accountName: string }>("/wallet/funding-account", fetcher);
  const [method, setMethod] = useState<(typeof methods)[number]["id"]>("card");
  const [amount, setAmount] = useState("50000");
  const [err, setErr] = useState<string>();
  const [loading, setLoading] = useState(false);
  // One key per attempt: a double tap or network retry can't credit twice.
  const key = useRef(idempotencyKey());

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErr(undefined);
    try {
      await api("/wallet/deposits", { body: { amountNaira: Number(amount), method }, headers: { "idempotency-key": key.current } });
      router.replace("/home");
    } catch (x) {
      setErr(x instanceof ApiError ? x.message : "Deposit failed");
      key.current = idempotencyKey();
      setLoading(false);
    }
  }

  return (
    <div>
      <BackHeader href="/home" title="Fund your wallet" subtitle="Top up any amount, any time. There are no deadlines." />
      <form onSubmit={submit} className="space-y-5">
        {err && <Alert tone="negative">{err}</Alert>}
        <Field label="Amount (₦)" htmlFor="amt" hint={me && me.kycTier < 2 ? "Tier 1 limit: ₦50,000 per deposit" : undefined}>
          <Input id="amt" inputMode="numeric" className="text-amount" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))} />
        </Field>
        <div className="flex flex-wrap gap-2">
          {[10000, 50000, 100000, 250000].map((v) => (
            <button type="button" key={v} onClick={() => setAmount(String(v))} className="rounded-full border border-border-strong px-3 py-1 text-body-sm text-text hover:bg-surface-sunken">₦{v.toLocaleString()}</button>
          ))}
        </div>
        <fieldset>
          <legend className="mb-2 text-label text-text">Pay with</legend>
          <div className="grid grid-cols-3 gap-2">
            {methods.map((m) => (
              <button type="button" key={m.id} onClick={() => setMethod(m.id)} aria-pressed={method === m.id} className={cx("flex flex-col items-center gap-1 rounded-md border p-3 text-body-sm", method === m.id ? "border-green-600 bg-positive-subtle text-text" : "border-border-strong text-text-secondary")}>
                <m.icon className="h-5 w-5" aria-hidden />
                {m.label}
              </button>
            ))}
          </div>
        </fieldset>
        {method === "transfer" && va && (
          <Card className="bg-surface-sunken">
            <p className="text-caption text-text-muted">Your dedicated account</p>
            <p className="mt-1 text-amount tabular text-text">{va.accountNumber}</p>
            <p className="text-body-sm text-text-secondary">{va.bankName} · {va.accountName}</p>
          </Card>
        )}
        {method === "ussd" && <Alert tone="info">Dial *737*000*{amount || "amount"}# from your registered line (simulated).</Alert>}
        <Alert tone="info" title="Demo mode">The payment is simulated and confirms instantly. In production, card payments use the gateway&apos;s secure checkout and FluraVest never sees your card number.</Alert>
        <Button type="submit" block size="lg" loading={loading} disabled={!amount}>Add ₦{Number(amount || 0).toLocaleString()}</Button>
      </form>
    </div>
  );
}
