"use client";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import useSWR, { SWRConfig } from "swr";
import { Bell, Home, Landmark, MapPinned, BookOpen, UserRound } from "lucide-react";
import { cx, Spinner } from "@fluravest/ui";
import { fetcher, ApiError } from "@fluravest/ui/api";
import type { Notification, Profile } from "@/lib/types";

const tabs = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/marketplace", label: "Marketplace", icon: MapPinned },
  { href: "/vault", label: "Vault", icon: Landmark },
  { href: "/learn", label: "Learn", icon: BookOpen },
];

function Shell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const path = usePathname();
  const { data: me, error } = useSWR<Profile>("/me", fetcher);
  const { data: notes } = useSWR<Notification[]>(me ? "/notifications" : null, fetcher, { refreshInterval: 30_000 });
  const unread = notes?.filter((n) => !n.readAt).length ?? 0;

  useEffect(() => {
    if (error instanceof ApiError && error.status === 401) router.replace("/signin");
  }, [error, router]);

  if (!me) return <div className="flex min-h-dvh items-center justify-center"><Spinner /></div>;

  return (
    <div className="mx-auto min-h-dvh max-w-lg pb-24">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-surface/95 px-4 py-3 backdrop-blur">
        <Link href="/home" aria-label="Home"><Image src="/brand/fluravest-horizontal-no-tagline-color.svg" alt="FluraVest" width={118} height={32} priority /></Link>
        <div className="flex items-center gap-1">
          <Link href="/notifications" className="relative rounded-md p-2 text-text hover:bg-surface-sunken" aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}>
            <Bell className="h-5 w-5" />
            {unread > 0 && <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-negative px-1 text-[10px] font-bold text-white">{unread}</span>}
          </Link>
          <Link href="/profile" className="rounded-md p-2 text-text hover:bg-surface-sunken" aria-label="Profile"><UserRound className="h-5 w-5" /></Link>
        </div>
      </header>
      <main className="px-4 pt-4">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)]" aria-label="Main">
        <ul className="mx-auto grid max-w-lg grid-cols-4">
          {tabs.map((t) => {
            const active = path.startsWith(t.href) || (t.href === "/marketplace" && path.startsWith("/pods"));
            return (
              <li key={t.href}>
                <Link href={t.href} aria-current={active ? "page" : undefined} className={cx("flex flex-col items-center gap-0.5 py-2.5 text-caption", active ? "text-text-positive" : "text-text-muted")}>
                  <t.icon className="h-5 w-5" aria-hidden />
                  {t.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig value={{ revalidateOnFocus: true, shouldRetryOnError: (e) => !(e instanceof ApiError && e.status < 500) }}>
      <Shell>{children}</Shell>
    </SWRConfig>
  );
}
