import Image from "next/image";
import Link from "next/link";
import { BadgeCheck, Landmark, PiggyBank, Users } from "lucide-react";

const steps = [
  { icon: PiggyBank, title: "Save at your pace", body: "Top up daily, weekly or whenever you can. No deadlines. Free withdrawals every quarter." },
  { icon: Users, title: "Join a land pod", body: "Verified parcels are split into 5 or 6 equal slots. Claim one when your savings are ready." },
  { icon: Landmark, title: "Own it together", body: "When the pod fills, the land is bought and your co-ownership certificate lands in your Vault." },
];

export default function Landing() {
  return (
    <main className="min-h-dvh bg-surface-brand text-text-on-brand">
      <div className="mx-auto max-w-5xl px-5 py-6">
        <header className="flex items-center justify-between">
          <Image src="/brand/fluravest-horizontal-no-tagline-reversed.svg" alt="FluraVest" width={150} height={40} priority />
          <Link href="/signin" className="rounded-md px-3 py-2 text-label hover:bg-white/10">Sign in</Link>
        </header>
        <section className="py-14 sm:py-20">
          <p className="text-overline uppercase text-green-400">Property ownership, simplified</p>
          <h1 className="mt-3 max-w-2xl text-h1 sm:text-display">Turn steady savings into land you co-own.</h1>
          <p className="mt-4 max-w-xl text-body-lg text-navy-100">
            Save toward your goal, then team up with 4 or 5 others to buy a verified parcel, one slot each.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/signup" className="inline-flex h-12 items-center rounded-md bg-action-primary px-5 text-body font-semibold text-on-action-primary hover:bg-action-primary-hover">Create an account</Link>
            <Link href="/signin" className="inline-flex h-12 items-center rounded-md border border-white/30 px-5 text-body font-semibold hover:bg-white/10">I have an account</Link>
          </div>
        </section>
        <section className="grid gap-4 pb-16 sm:grid-cols-3">
          {steps.map((s, i) => (
            <div key={s.title} className="rounded-lg border border-white/10 bg-white/5 p-5">
              <s.icon className="h-6 w-6 text-green-400" aria-hidden />
              <p className="mt-3 text-caption text-navy-200">Step {i + 1}</p>
              <h2 className="text-title">{s.title}</h2>
              <p className="mt-1 text-body-sm text-navy-100">{s.body}</p>
            </div>
          ))}
        </section>
        <footer className="border-t border-white/10 py-6 text-caption text-navy-200">
          <p className="flex items-center gap-1.5"><BadgeCheck className="h-4 w-4 text-green-400" aria-hidden /> Every listed parcel is checked by two people before it goes live.</p>
          <p className="mt-2">Demo build. Payments and identity checks are simulated. FluraVest does not promise or project returns. Co-owned land is illiquid until it is sold or a slot is transferred.</p>
        </footer>
      </div>
    </main>
  );
}
