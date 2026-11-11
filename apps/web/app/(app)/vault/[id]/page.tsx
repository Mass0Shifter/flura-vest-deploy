"use client";
import { use } from "react";
import Image from "next/image";
import useSWR from "swr";
import { Printer } from "lucide-react";
import { Alert, Button, Skeleton } from "@fluravest/ui";
import { fetcher } from "@fluravest/ui/api";
import { BackHeader } from "@/components/back";

type Cert = {
  id: string; code: string; sha256: string; issuedAt: string; holderName: string; sharePercent: string; podCode: string; deedReference: string | null;
  parcel: { title: string; locationText: string; state: string; lga: string; latitude: number; longitude: number; sizeSqm: number; titleType: string };
  payload: { slotNumber: number; slotCount: number }; verifyUrl: string; qrSvg: string;
};

export default function CertificatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: c, error } = useSWR<Cert>(`/vault/certificates/${id}`, fetcher);
  if (error) return <Alert tone="negative">{error.message}</Alert>;
  if (!c) return <Skeleton className="h-96" />;
  return (
    <div>
      <div className="print:hidden"><BackHeader href="/vault" title="Co-ownership certificate" /></div>
      <article className="rounded-lg border-2 border-navy-900 bg-white p-6 text-navy-900 shadow-md print:border-0 print:shadow-none">
        <div className="flex items-center justify-between">
          <Image src="/brand/fluravest-horizontal-no-tagline-color.svg" alt="FluraVest" width={120} height={32} />
          <span className="text-caption text-neutral-500">No. {c.code}</span>
        </div>
        <h2 className="mt-6 text-overline uppercase text-green-700">Fractional co-ownership certificate</h2>
        <p className="mt-2 text-body text-neutral-600">This certifies that</p>
        <p className="text-h3">{c.holderName}</p>
        <p className="mt-2 text-body text-neutral-600">holds a beneficial interest of</p>
        <p className="text-h2">{c.sharePercent}%</p>
        <p className="text-body text-neutral-600">(slot {c.payload.slotNumber} of {c.payload.slotCount}) in the parcel below, acquired through {c.podCode}.</p>
        <dl className="mt-5 grid grid-cols-2 gap-3 border-y border-neutral-100 py-4 text-body-sm">
          <div><dt className="text-neutral-500">Parcel</dt><dd className="font-semibold">{c.parcel.title}</dd></div>
          <div><dt className="text-neutral-500">Location</dt><dd className="font-semibold">{c.parcel.locationText}, {c.parcel.lga}, {c.parcel.state}</dd></div>
          <div><dt className="text-neutral-500">Size</dt><dd className="font-semibold">{c.parcel.sizeSqm.toLocaleString()} m²</dd></div>
          <div><dt className="text-neutral-500">Title</dt><dd className="font-semibold">{c.parcel.titleType}</dd></div>
          <div><dt className="text-neutral-500">Coordinates</dt><dd className="font-semibold tabular">{c.parcel.latitude.toFixed(5)}, {c.parcel.longitude.toFixed(5)}</dd></div>
          <div><dt className="text-neutral-500">Deed reference</dt><dd className="break-all font-semibold">{c.deedReference}</dd></div>
          <div><dt className="text-neutral-500">Issued</dt><dd className="font-semibold">{new Date(c.issuedAt).toLocaleString("en-NG", { dateStyle: "long", timeStyle: "short" })}</dd></div>
        </dl>
        <div className="mt-5 flex items-end justify-between gap-4">
          <div className="text-caption text-neutral-500">
            <p>Verify at</p>
            <p className="break-all font-semibold text-navy-900">{c.verifyUrl}</p>
            <p className="mt-2">Fingerprint (SHA-256)</p>
            <p className="break-all font-mono text-[10px]">{c.sha256}</p>
          </div>
          <div className="h-24 w-24 shrink-0" aria-label="Verification QR code" dangerouslySetInnerHTML={{ __html: c.qrSvg }} />
        </div>
        <p className="mt-5 text-[11px] leading-4 text-neutral-500">Demo certificate. In production, wording is set by counsel to match how title is held (individual names or trustee). This certificate records an interest in land; it is not a promise of any return.</p>
      </article>
      <Button variant="outline" block className="mt-4 print:hidden" onClick={() => window.print()}><Printer className="h-4 w-4" aria-hidden />Print or save as PDF</Button>
    </div>
  );
}
