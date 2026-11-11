"use client";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import useSWR, { SWRConfig } from "swr";
import { CalendarRange, LayoutDashboard, LogOut, MapPinned, ScrollText, Users, Boxes } from "lucide-react";
import { Badge, cx, Spinner } from "@fluravest/ui";
import { api, ApiError, fetcher } from "@fluravest/ui/api";
import type { Me } from "@/components/types";

const nav = [
  { href: "/overview", label: "Overview", icon: LayoutDashboard },
  { href: "/pods", label: "Land pods", icon: Boxes },
  { href: "/parcels", label: "Parcels & verification", icon: MapPinned },
  { href: "/members", label: "Members", icon: Users },
  { href: "/windows", label: "Withdrawal windows", icon: CalendarRange },
  { href: "/audit", label: "Audit log", icon: ScrollText },
];
const ROLE: Record<Me["role"], string> = { ops: "Operations", verifier: "Verifier", finance: "Finance", superadmin: "Superadmin" };

function Shell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const path = usePathname();
  const { data: me, error } = useSWR<Me>("/admin/me", fetcher);
  useEffect(() => {
    if (error instanceof ApiError && error.status === 401) router.replace("/signin");
  }, [error, router]);
  if (!me) return <div className="flex min-h-dvh items-center justify-center"><Spinner /></div>;
  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <aside className="border-b border-white/10 bg-surface-brand text-text-on-brand md:sticky md:top-0 md:h-dvh md:w-64 md:shrink-0 md:border-b-0">
        <div className="flex items-center justify-between p-4 md:block">
          <Image src="/brand/fluravest-horizontal-no-tagline-reversed.svg" alt="FluraVest" width={130} height={34} />
          <p className="text-caption text-navy-200 md:mt-1">Operations console</p>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-2 pb-2 md:flex-col md:pb-0" aria-label="Console">
          {nav.map((n) => {
            const active = path.startsWith(n.href);
            return (
              <Link key={n.href} href={n.href} aria-current={active ? "page" : undefined} className={cx("flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-label", active ? "bg-white/10 text-white" : "text-navy-100 hover:bg-white/5")}>
                <n.icon className="h-4 w-4" aria-hidden />
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="hidden p-4 md:absolute md:bottom-0 md:block md:w-64">
          <p className="text-label">{me.name}</p>
          <Badge tone="positive">{ROLE[me.role]}</Badge>
          <button
            className="mt-3 flex items-center gap-2 text-body-sm text-navy-100 hover:text-white"
            onClick={async () => {
              await api("/admin/auth/signout", { body: {} });
              router.replace("/signin");
            }}
          >
            <LogOut className="h-4 w-4" aria-hidden /> Sign out
          </button>
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-4 md:p-8">
        <div className="mb-4 flex items-center justify-between md:hidden">
          <p className="text-body-sm text-text-secondary">{me.name} · {ROLE[me.role]}</p>
          <button className="text-body-sm text-text-link" onClick={async () => { await api("/admin/auth/signout", { body: {} }); router.replace("/signin"); }}>Sign out</button>
        </div>
        {children}
      </main>
    </div>
  );
}

export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig value={{ shouldRetryOnError: (e) => !(e instanceof ApiError && e.status < 500) }}>
      <Shell>{children}</Shell>
    </SWRConfig>
  );
}
