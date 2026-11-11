import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export function BackHeader({ href, title, subtitle }: { href: string; title: string; subtitle?: string }) {
  return (
    <div className="mb-5">
      <Link href={href} className="-ml-1 mb-2 inline-flex items-center text-label text-text-secondary hover:text-text"><ChevronLeft className="h-4 w-4" aria-hidden />Back</Link>
      <h1 className="text-h3 text-text">{title}</h1>
      {subtitle && <p className="mt-1 text-body-sm text-text-secondary">{subtitle}</p>}
    </div>
  );
}
