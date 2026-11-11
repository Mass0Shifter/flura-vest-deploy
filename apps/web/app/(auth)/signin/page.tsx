"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, Button, Field, Input } from "@fluravest/ui";
import { api, ApiError } from "@fluravest/ui/api";
import { AuthShell } from "@/components/auth-shell";

export default function SignIn() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(undefined);
    try {
      await api("/auth/signin", { body: { email, password } });
      router.replace("/home");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't sign in");
      setLoading(false);
    }
  }

  return (
    <AuthShell title="Welcome back" subtitle="Sign in to your FluraVest account." footer={<>New here? <Link className="font-semibold text-text-link" href="/signup">Create an account</Link></>}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        {error && <Alert tone="negative">{error}</Alert>}
        <Field label="Email" htmlFor="email"><Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></Field>
        <Field label="Password" htmlFor="password"><Input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></Field>
        <Button type="submit" block size="lg" loading={loading}>Sign in</Button>
        <Alert tone="info" title="Demo account">
          ada@fluravest.demo · FluraDemo2026!
        </Alert>
      </form>
    </AuthShell>
  );
}
