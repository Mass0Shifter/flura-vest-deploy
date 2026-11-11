import Link from "next/link";
import Image from "next/image";

export function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-5 py-8">
      <Link href="/" className="mb-8 inline-block" aria-label="FluraVest home">
        <Image src="/brand/fluravest-horizontal-no-tagline-color.svg" alt="FluraVest" width={150} height={40} priority />
      </Link>
      <h1 className="text-h2 text-text">{title}</h1>
      {subtitle && <p className="mt-1 text-body text-text-secondary">{subtitle}</p>}
      <div className="mt-6 flex-1">{children}</div>
      {footer && <div className="mt-6 text-center text-body-sm text-text-secondary">{footer}</div>}
    </main>
  );
}
