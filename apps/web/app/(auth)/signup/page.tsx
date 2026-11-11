"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, Button, Field, Input } from "@fluravest/ui";
import { api, ApiError } from "@fluravest/ui/api";
import { AuthShell } from "@/components/auth-shell";

const empty = { fullName: "", email: "", phone: "", password: "", nextOfKinName: "", nextOfKinPhone: "" };

export default function SignUp() {
  const router = useRouter();
  const [f, setF] = useState(empty);
  const [accept, setAccept] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const set = (k: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(undefined);
    setErrors({});
    try {
      await api("/auth/signup", { body: { ...f, acceptTerms: accept } });
      router.replace("/verify-identity?welcome=1");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        setErrors(err.fields ?? {});
      } else setError("Couldn't create your account");
      setLoading(false);
    }
  }

  return (
    <AuthShell title="Create your account" subtitle="Tier 1 takes a minute. You can verify your identity next." footer={<>Already have an account? <Link className="font-semibold text-text-link" href="/signin">Sign in</Link></>}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        {error && <Alert tone="negative">{error}</Alert>}
        <Field label="Full legal name" htmlFor="fullName" error={errors.fullName} hint="As it appears on your BVN"><Input id="fullName" autoComplete="name" value={f.fullName} onChange={set("fullName")} invalid={!!errors.fullName} /></Field>
        <Field label="Email" htmlFor="email" error={errors.email}><Input id="email" type="email" autoComplete="email" value={f.email} onChange={set("email")} invalid={!!errors.email} /></Field>
        <Field label="WhatsApp / phone number" htmlFor="phone" error={errors.phone}><Input id="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="08012345678" value={f.phone} onChange={set("phone")} invalid={!!errors.phone} /></Field>
        <Field label="Password" htmlFor="password" error={errors.password} hint="At least 10 characters with a letter and a number"><Input id="password" type="password" autoComplete="new-password" value={f.password} onChange={set("password")} invalid={!!errors.password} /></Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Next of kin" htmlFor="nok" error={errors.nextOfKinName}><Input id="nok" value={f.nextOfKinName} onChange={set("nextOfKinName")} invalid={!!errors.nextOfKinName} /></Field>
          <Field label="Next of kin phone" htmlFor="nokp" error={errors.nextOfKinPhone}><Input id="nokp" type="tel" inputMode="tel" value={f.nextOfKinPhone} onChange={set("nextOfKinPhone")} invalid={!!errors.nextOfKinPhone} /></Field>
        </div>
        <label className="flex items-start gap-3 text-body-sm text-text-secondary">
          <input type="checkbox" className="mt-0.5 h-5 w-5 accent-green-600" checked={accept} onChange={(e) => setAccept(e.target.checked)} />
          <span>I agree to the Terms and Privacy Notice, and understand that land co-ownership is illiquid until the land is sold or my slot is transferred.</span>
        </label>
        {errors.acceptTerms && <p className="text-body-sm text-text-negative">{errors.acceptTerms}</p>}
        <Button type="submit" block size="lg" loading={loading}>Create account</Button>
      </form>
    </AuthShell>
  );
}
