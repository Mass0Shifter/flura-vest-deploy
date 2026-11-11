import { cx } from "@fluravest/ui";

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-h2 text-text">{title}</h1>
        {subtitle && <p className="mt-1 text-body text-text-secondary">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-surface">
      <table className="w-full text-left text-body-sm">
        <thead className="bg-surface-sunken text-caption uppercase text-text-muted">
          <tr>{head.map((h) => <th key={h} className="whitespace-nowrap px-4 py-2.5 font-semibold">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-border">{children}</tbody>
      </table>
    </div>
  );
}

export function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={cx("whitespace-nowrap px-4 py-3 text-text", className)}>{children}</td>;
}

export function Stat({ label, value, hint, tone }: { label: string; value: React.ReactNode; hint?: string; tone?: "positive" | "negative" }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <p className="text-caption uppercase text-text-muted">{label}</p>
      <p className={cx("mt-1 text-amount tabular", tone === "positive" ? "text-text-positive" : tone === "negative" ? "text-text-negative" : "text-text")}>{value}</p>
      {hint && <p className="mt-0.5 text-caption text-text-muted">{hint}</p>}
    </div>
  );
}
