"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import useSWR from "swr";
import { CalendarCheck, CalendarClock } from "lucide-react";
import { Alert, Button, Card, Field, Input, Money, Sheet } from "@fluravest/ui";
import { api, ApiError, fetcher } from "@fluravest/ui/api";
import { BackHeader } from "@/components/back";
import type { Profile, Wallet } from "@/lib/types";

type Quote = { quoteId: string; gross: string; fee: string; net: string; feeApplies: boolean; expiresAt: string };

const fmtDate = (d?: string) => (d ? new Date(d + "T12:00:00").toLocaleDateString("en-NG", { day: "numeric", month: "long" }) : "");

export default function WithdrawPage() {
  const router = useRouter();
  const { data: me } = useSWR<Profile>("/me", fetcher);
  const { data: w } = useSWR<Wallet>("/wallet", fetcher);
  const [amount, setAmount] = useState("");
  const [quote, setQuote] = useState<Quote>();
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string>();
  const [confirmErr, setConfirmErr] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState<{ net: string }>();

  if (me && me.kycTier < 2) {
    return (
      <div>
        <BackHeader href="/home" title="Withdraw" />
        <Alert tone="warning" title="Verify your identity first">Withdrawals go only to a payout account in your verified name. <Link className="font-semibold text-text-link underline" href="/verify-identity">Verify now</Link></Alert>
      </div>
    );
  }

  async function getQuote(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErr(undefined);
    try {
      setQuote(await api<Quote>("/withdrawals/quote", { body: { amountNaira: Number(amount) } }));
      setPassword("");
      setConfirmErr(undefined);
    } catch (x) {
      setErr(x instanceof ApiError ? x.message : "Couldn't get a quote");
    } finally {
      setLoading(false);
    }
  }

  async function confirm() {
    if (!quote) return;
    setLoading(true);
    setConfirmErr(undefined);
    try {
      const r = await api<{ net: string }>("/withdrawals/confirm", { body: { quoteId: quote.quoteId, password } });
      setQuote(undefined);
      setDone(r);
    } catch (x) {
      setConfirmErr(x instanceof ApiError ? x.message : "Withdrawal failed");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="space-y-4 pt-6 text-center">
        <CalendarCheck className="mx-auto h-10 w-10 text-text-positive" aria-hidden />
        <h1 className="text-h3 text-text">Withdrawal on its way</h1>
        <p className="text-body text-text-secondary"><Money kobo={done.net} /> is being sent to {me?.bank?.bankName} ••••{me?.bank?.last4}.</p>
        <Button block onClick={() => router.replace("/home")}>Back to home</Button>
      </div>
    );
  }

  return (
    <div>
      <BackHeader href="/home" title="Withdraw" subtitle="Funds go to your verified payout account." />
      {w && (
        w.window.open ? (
          <Alert tone="positive" title="Free withdrawal window is open">No fee until {fmtDate(w.window.current?.endsOn)}. {w.window.days} day{w.window.days === 1 ? "" : "s"} left.</Alert>
        ) : (
          <Alert tone="warning" title="Outside the free withdrawal window">
            Withdrawing now carries a 5% early-withdrawal fee to protect your savings habit. The next free window opens on {fmtDate(w.window.next?.startsOn)} ({w.window.days} days).
          </Alert>
        )
      )}
      <Card className="mt-4 flex items-center justify-between">
        <span className="text-body-sm text-text-secondary">Available to withdraw</span>
        {w && <Money kobo={w.available} className="text-label text-text" />}
      </Card>
      <form onSubmit={getQuote} className="mt-4 space-y-4">
        {err && <Alert tone="negative">{err}</Alert>}
        <Field label="Amount (₦)" htmlFor="amt"><Input id="amt" inputMode="numeric" className="text-amount" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))} placeholder="0" /></Field>
        {me?.bank && <p className="text-body-sm text-text-secondary">To: {me.bank.accountName} · {me.bank.bankName} ••••{me.bank.last4}</p>}
        <Button type="submit" block size="lg" loading={loading && !quote} disabled={!amount}>Review withdrawal</Button>
      </form>

      <Sheet open={!!quote} onClose={() => setQuote(undefined)} title="Confirm withdrawal">
        {quote && (
          <div className="space-y-4">
            {quote.feeApplies && (
              <Alert tone="warning" title="Early withdrawal fee">
                A 5% fee (<Money kobo={quote.fee} />) will be deducted to preserve savings discipline.
              </Alert>
            )}
            <dl className="space-y-2 rounded-md bg-surface-sunken p-3 text-body">
              <div className="flex justify-between"><dt className="text-text-secondary">Amount</dt><dd><Money kobo={quote.gross} /></dd></div>
              <div className="flex justify-between"><dt className="text-text-secondary">Fee</dt><dd className={quote.feeApplies ? "text-text-negative" : ""}>{quote.feeApplies ? "−" : ""}<Money kobo={quote.fee} /></dd></div>
              <div className="flex justify-between border-t border-border pt-2 font-bold"><dt>You receive</dt><dd><Money kobo={quote.net} /></dd></div>
            </dl>
            <p className="flex items-center gap-1.5 text-caption text-text-muted"><CalendarClock className="h-4 w-4" aria-hidden />This quote is valid for 2 minutes.</p>
            {confirmErr && <Alert tone="negative">{confirmErr}</Alert>}
            <Field label="Enter your password to confirm" htmlFor="pw"><Input id="pw" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
            <Button block size="lg" loading={loading} disabled={!password} onClick={confirm}>Withdraw <Money kobo={quote.net} /></Button>
          </div>
        )}
      </Sheet>
    </div>
  );
}
