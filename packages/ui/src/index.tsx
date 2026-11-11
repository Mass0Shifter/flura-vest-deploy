"use client";
import { forwardRef, useEffect, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from "react";
import { BadgeCheck, Loader2, X } from "lucide-react";
import { formatNaira } from "@fluravest/domain";

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

// ── Button ──────────────────────────────────────────────────────────────────
// Primary = Bright Green fill with a navy label (white on green fails contrast; Brand Kit v2).
type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "outline" | "ghost" | "danger"; size?: "sm" | "md" | "lg"; loading?: boolean; block?: boolean };
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({ variant = "primary", size = "md", loading, block, className, children, disabled, ...rest }, ref) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-md font-semibold transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed",
        size === "sm" && "h-9 px-3 text-body-sm",
        size === "md" && "h-11 px-4 text-label",
        size === "lg" && "h-12 px-5 text-body",
        variant === "primary" && "bg-action-primary text-on-action-primary hover:bg-action-primary-hover active:bg-action-primary-pressed",
        variant === "secondary" && "bg-action-secondary text-on-action-secondary hover:bg-action-secondary-hover",
        variant === "outline" && "border border-border-strong bg-surface text-text hover:bg-surface-sunken",
        variant === "ghost" && "text-text hover:bg-surface-sunken",
        variant === "danger" && "bg-negative text-white hover:opacity-90",
        block && "w-full",
        className,
      )}
      {...rest}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
});

// ── Surfaces ────────────────────────────────────────────────────────────────
export function Card({ className, children, as: As = "div" }: { className?: string; children: ReactNode; as?: "div" | "section" | "article" }) {
  return <As className={cx("rounded-lg border border-border bg-surface p-4 shadow-sm", className)}>{children}</As>;
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-overline uppercase text-text-muted">{children}</h2>
      {action}
    </div>
  );
}

type Tone = "neutral" | "positive" | "warning" | "negative" | "info" | "brand";
export function Badge({ tone = "neutral", children, icon }: { tone?: Tone; children: ReactNode; icon?: ReactNode }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-caption font-semibold",
        tone === "neutral" && "bg-surface-sunken text-text-secondary",
        tone === "positive" && "bg-positive-subtle text-text-positive",
        tone === "warning" && "bg-warning-subtle text-text-warning",
        tone === "negative" && "bg-negative-subtle text-text-negative",
        tone === "info" && "bg-info-subtle text-info",
        tone === "brand" && "bg-navy-900 text-white",
      )}
    >
      {icon}
      {children}
    </span>
  );
}

/** Status colours are always paired with an icon or word (Brand Kit v2). */
export function VerifiedBadge({ label = "Verified title" }: { label?: string }) {
  return <Badge tone="positive" icon={<BadgeCheck className="h-3.5 w-3.5" aria-hidden />}>{label}</Badge>;
}

export function Progress({ value, max, label }: { value: number; max: number; label?: string }) {
  const pct = Math.min(100, Math.round((value / Math.max(1, max)) * 100));
  return (
    <div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-progress-track" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max} aria-label={label}>
        <div className="h-full rounded-full bg-progress-fill transition-[width] duration-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** Slot dots: one per co-buyer slot. */
export function SlotDots({ filled, total, mine }: { filled: number; total: number; mine?: number | null }) {
  return (
    <div className="flex gap-1.5" aria-label={`${filled} of ${total} slots confirmed`}>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={cx("h-2.5 flex-1 rounded-full", i < filled ? (mine === i + 1 ? "bg-navy-900" : "bg-progress-fill") : "bg-progress-track")} />
      ))}
    </div>
  );
}

export function Money({ kobo, className, decimals }: { kobo: string | bigint; className?: string; decimals?: boolean }) {
  return <span className={cx("tabular", className)}>{formatNaira(typeof kobo === "bigint" ? kobo : BigInt(kobo), { decimals })}</span>;
}

// ── Forms ───────────────────────────────────────────────────────────────────
export function Field({ label, error, hint, children, htmlFor }: { label: string; error?: string; hint?: string; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-label text-text">{label}</label>
      {children}
      {error ? <p className="text-body-sm text-text-negative" role="alert">{error}</p> : hint ? <p className="text-body-sm text-text-muted">{hint}</p> : null}
    </div>
  );
}

const inputCls = "h-11 w-full rounded-md border border-border-strong bg-surface px-3 text-body text-text placeholder:text-text-muted focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-focus-ring/30";
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(function Input({ className, invalid, ...rest }, ref) {
  return <input ref={ref} aria-invalid={invalid || undefined} className={cx(inputCls, invalid && "border-negative", className)} {...rest} />;
});
export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cx(inputCls, "appearance-none", className)} {...rest}>{children}</select>;
}

export function Alert({ tone = "info", title, children }: { tone?: "info" | "warning" | "negative" | "positive"; title?: string; children?: ReactNode }) {
  return (
    <div
      role={tone === "negative" ? "alert" : "status"}
      className={cx(
        "rounded-md border p-3 text-body-sm",
        tone === "info" && "border-info/30 bg-info-subtle text-text",
        tone === "warning" && "border-warning/40 bg-warning-subtle text-text",
        tone === "negative" && "border-negative/30 bg-negative-subtle text-text",
        tone === "positive" && "border-positive/30 bg-positive-subtle text-text",
      )}
    >
      {title && <p className="mb-0.5 font-semibold">{title}</p>}
      {children}
    </div>
  );
}

// ── Modal / sheet ───────────────────────────────────────────────────────────
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy-950/50 sm:items-center" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-xl bg-surface p-5 shadow-lg sm:rounded-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-title text-text">{title}</h2>
          <button onClick={onClose} className="rounded-md p-1 text-text-muted hover:bg-surface-sunken" aria-label="Close"><X className="h-5 w-5" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Empty({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-lg border border-dashed border-border-strong p-6 text-center">
      {icon && <div className="mb-2 text-text-muted">{icon}</div>}
      <p className="text-label text-text">{title}</p>
      {children && <div className="mt-1 text-body-sm text-text-muted">{children}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("animate-pulse rounded-md bg-surface-sunken", className)} />;
}

export function Spinner() {
  return <Loader2 className="h-5 w-5 animate-spin text-text-muted" aria-label="Loading" />;
}

export const POD_STATUS_LABEL: Record<string, { label: string; tone: Tone }> = {
  draft: { label: "Draft", tone: "neutral" },
  open: { label: "Open", tone: "info" },
  filled: { label: "Full – closing soon", tone: "warning" },
  closing: { label: "Purchase in progress", tone: "warning" },
  closed: { label: "Owned", tone: "positive" },
  expired: { label: "Expired – refunded", tone: "neutral" },
  cancelled: { label: "Withdrawn – refunded", tone: "neutral" },
};

export function daysUntil(d: string | Date | null | undefined) {
  if (!d) return null;
  return Math.max(0, Math.ceil((new Date(d).getTime() - Date.now()) / 86_400_000));
}
