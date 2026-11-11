"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import useSWR, { mutate } from "swr";
import { Lock } from "lucide-react";
import { Alert, Button, Field, Input, Select } from "@fluravest/ui";
import { api, ApiError, fetcher } from "@fluravest/ui/api";
import { BackHeader } from "@/components/back";
import type { Profile } from "@/lib/types";

const STATES = ["Abia","Adamawa","Akwa Ibom","Anambra","Bauchi","Bayelsa","Benue","Borno","Cross River","Delta","Ebonyi","Edo","Ekiti","Enugu","FCT","Gombe","Imo","Jigawa","Kaduna","Kano","Katsina","Kebbi","Kogi","Kwara","Lagos","Nasarawa","Niger","Ogun","Ondo","Osun","Oyo","Plateau","Rivers","Sokoto","Taraba","Yobe","Zamfara"];

function VerifyForm() {
  const router = useRouter();
  const welcome = useSearchParams().get("welcome");
  const { data: me } = useSWR<Profile>("/me", fetcher);
  const { data: banks } = useSWR<{ code: string; name: string }[]>("/kyc/banks", fetcher);
  const [f, setF] = useState({ bvn: "", nin: "", address: "", state: "Lagos", bankCode: "", accountNumber: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string>();
  const [loading, setLoading] = useState(false);
  const digits = (k: "bvn" | "nin" | "accountNumber", n: number) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value.replace(/\D/g, "").slice(0, n) });

  if (me && me.kycTier >= 2) {
    return <><BackHeader href="/profile" title="Identity verified" /><Alert tone="positive">You&apos;re Tier 2. Nothing more to do here.</Alert></>;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErr(undefined);
    setErrors({});
    try {
      await api("/kyc/tier2", { body: f });
      await mutate("/me");
      router.replace("/home");
    } catch (x) {
      if (x instanceof ApiError) {
        setErr(x.message);
        setErrors(x.fields ?? {});
      }
      setLoading(false);
    }
  }

  return (
    <div>
      <BackHeader href={welcome ? "/home" : "/profile"} title="Verify your identity" subtitle="Tier 2 unlocks larger deposits, slot claims and withdrawals." />
      {welcome && <div className="mb-4"><Alert tone="positive" title="Account created">You can explore now and verify later, or finish it in a minute.</Alert></div>}
      <form onSubmit={submit} className="space-y-4" noValidate>
        {err && <Alert tone="negative">{err}</Alert>}
        <Field label="BVN" htmlFor="bvn" error={errors.bvn} hint="11 digits. Dial *565*0# to check yours."><Input id="bvn" inputMode="numeric" autoComplete="off" value={f.bvn} onChange={digits("bvn", 11)} invalid={!!errors.bvn} /></Field>
        <Field label="NIN (optional)" htmlFor="nin" error={errors.nin}><Input id="nin" inputMode="numeric" autoComplete="off" value={f.nin} onChange={digits("nin", 11)} /></Field>
        <Field label="Residential address" htmlFor="addr" error={errors.address}><Input id="addr" autoComplete="street-address" value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} invalid={!!errors.address} /></Field>
        <Field label="State" htmlFor="state"><Select id="state" value={f.state} onChange={(e) => setF({ ...f, state: e.target.value })}>{STATES.map((s) => <option key={s}>{s}</option>)}</Select></Field>
        <div className="rounded-md border border-border p-3">
          <p className="mb-3 text-label text-text">Payout account</p>
          <div className="space-y-3">
            <Field label="Bank" htmlFor="bank" error={errors.bankCode}><Select id="bank" value={f.bankCode} onChange={(e) => setF({ ...f, bankCode: e.target.value })}><option value="">Choose your bank</option>{banks?.map((b) => <option key={b.code} value={b.code}>{b.name}</option>)}</Select></Field>
            <Field label="Account number" htmlFor="acct" error={errors.accountNumber} hint="Must be in your name exactly as on your BVN"><Input id="acct" inputMode="numeric" value={f.accountNumber} onChange={digits("accountNumber", 10)} invalid={!!errors.accountNumber} /></Field>
          </div>
        </div>
        <p className="flex items-start gap-2 text-caption text-text-muted"><Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />Your BVN, NIN and address are encrypted before storage and only the last 4 digits are ever shown. Demo mode: any 11-digit BVN passes except 00000000000.</p>
        <Button type="submit" block size="lg" loading={loading}>Verify identity</Button>
      </form>
    </div>
  );
}

export default function VerifyIdentityPage() {
  return <Suspense><VerifyForm /></Suspense>;
}
