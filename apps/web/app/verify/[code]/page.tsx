import Image from "next/image";
import { BadgeCheck, XCircle } from "lucide-react";

export const dynamic = "force-dynamic";

type Result = { code: string; valid: boolean; issuedAt: string; podCode: string; parcelTitle: string; state: string; sharePercent: string; fingerprint: string };

async function lookup(code: string): Promise<Result | null> {
  const base = process.env.API_URL ?? "http://localhost:4000";
  const res = await fetch(`${base}/api/public/certificates/${encodeURIComponent(code)}`, { cache: "no-store" }).catch(() => null);
  return res?.ok ? res.json() : null;
}

export default async function VerifyCertificate({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const r = await lookup(code);
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-5 py-8">
      <Image src="/brand/fluravest-horizontal-no-tagline-color.svg" alt="FluraVest" width={140} height={36} />
      <h1 className="mt-8 text-h3 text-text">Certificate check</h1>
      {r ? (
        <div className="mt-4 rounded-lg border border-positive/40 bg-positive-subtle p-5">
          <p className="flex items-center gap-2 text-title text-text-positive"><BadgeCheck className="h-6 w-6" aria-hidden />Valid certificate</p>
          <dl className="mt-4 space-y-2 text-body-sm text-text">
            <div className="flex justify-between"><dt className="text-text-secondary">Number</dt><dd className="font-semibold">{r.code}</dd></div>
            <div className="flex justify-between"><dt className="text-text-secondary">Parcel</dt><dd className="font-semibold">{r.parcelTitle}, {r.state}</dd></div>
            <div className="flex justify-between"><dt className="text-text-secondary">Pod</dt><dd className="font-semibold">{r.podCode}</dd></div>
            <div className="flex justify-between"><dt className="text-text-secondary">Share</dt><dd className="font-semibold">{r.sharePercent}%</dd></div>
            <div className="flex justify-between"><dt className="text-text-secondary">Issued</dt><dd className="font-semibold">{new Date(r.issuedAt).toLocaleDateString("en-NG", { dateStyle: "long" })}</dd></div>
            <div className="flex justify-between"><dt className="text-text-secondary">Fingerprint</dt><dd className="font-mono">{r.fingerprint}…</dd></div>
          </dl>
          <p className="mt-4 text-caption text-text-muted">For privacy, the holder&apos;s name isn&apos;t shown here.</p>
        </div>
      ) : (
        <div className="mt-4 rounded-lg border border-negative/40 bg-negative-subtle p-5">
          <p className="flex items-center gap-2 text-title text-text-negative"><XCircle className="h-6 w-6" aria-hidden />No certificate found</p>
          <p className="mt-2 text-body-sm text-text">Check the number and try again. If you were given this certificate, contact FluraVest support.</p>
        </div>
      )}
    </main>
  );
}
