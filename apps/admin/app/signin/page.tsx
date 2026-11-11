"use client";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, Button, Field, Input } from "@fluravest/ui";
import { api, ApiError } from "@fluravest/ui/api";

const demo = [
  { email: "ops@fluravest.demo", who: "Tolu · Operations (lists parcels & pods)" },
  { email: "verifier@fluravest.demo", who: "Chidi · Verifier (signs off titles, publishes)" },
  { email: "finance@fluravest.demo", who: "Amina · Finance (releases escrow)" },
];

export default function AdminSignIn() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string>();
  const [loading, setLoading] = useState(false);
  return (
    <main className="flex min-h-dvh items-center justify-center bg-surface-brand p-4">
      <div className="w-full max-w-sm rounded-xl bg-surface p-6 shadow-lg">
        <Image src="/brand/fluravest-horizontal-no-tagline-color.svg" alt="FluraVest" width={140} height={36} />
        <h1 className="mt-6 text-h3 text-text">Operations console</h1>
        <p className="text-body-sm text-text-secondary">Staff only. Every action is logged.</p>
        <form
          className="mt-5 space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setLoading(true);
            setErr(undefined);
            try {
              await api("/admin/auth/signin", { body: { email, password } });
              router.replace("/overview");
            } catch (x) {
              setErr(x instanceof ApiError ? x.message : "Couldn't sign in");
              setLoading(false);
            }
          }}
        >
          {err && <Alert tone="negative">{err}</Alert>}
          <Field label="Work email" htmlFor="email"><Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" /></Field>
          <Field label="Password" htmlFor="pw"><Input id="pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" /></Field>
          <Button type="submit" block loading={loading}>Sign in</Button>
        </form>
        <div className="mt-5 rounded-md bg-surface-sunken p-3 text-body-sm">
          <p className="mb-2 font-semibold text-text">Demo staff (password FluraDemo2026!)</p>
          <ul className="space-y-1.5">
            {demo.map((d) => (
              <li key={d.email}>
                <button type="button" className="text-left text-text-link hover:underline" onClick={() => { setEmail(d.email); setPassword("FluraDemo2026!"); }}>{d.email}</button>
                <span className="block text-caption text-text-muted">{d.who}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </main>
  );
}
