import type { ReactNode } from "react";
import { ShieldCheck } from "lucide-react";

export function StatusBadge({ status }: { status: string | null | undefined }) {
  const s = (status ?? "").toLowerCase();
  const cls =
    s === "confirmed"
      ? "bg-success/10 text-success border-success/20"
      : s === "pending"
      ? "bg-warning/15 text-warning-foreground border-warning/30 dark:text-warning"
      : s === "failed" || s === "reversed"
      ? "bg-destructive/10 text-destructive border-destructive/20"
      : "bg-muted text-muted-foreground border-border";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize ${cls}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status ?? "unknown"}
    </span>
  );
}

export function SourceBadge({ source }: { source: string | null | undefined }) {
  const isPro = source === "openpay_pro";
  return (
    <span
      className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase ${
        isPro ? "border-primary/30 bg-primary/10 text-primary" : "border-border bg-muted text-muted-foreground"
      }`}
    >
      {isPro ? "OpenPay Pro" : "OpenPay"}
    </span>
  );
}

export function TypeBadge({ type }: { type: string | null | undefined }) {
  const t = (type ?? "").toLowerCase();
  const label = (type ?? "").replace(/_/g, " ");
  const cls =
    t === "stake" || t === "stake_claim"
      ? "border-primary/30 bg-primary/10 text-primary"
      : t === "topup" || t === "deposit"
        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
        : t === "swap"
          ? "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
          : "border-border bg-muted/60 text-muted-foreground";
  return (
    <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium capitalize ${cls}`}>
      {label}
    </span>
  );
}

export function VerifyBadge({ verified }: { verified: boolean }) {
  if (!verified) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
      <ShieldCheck className="h-3 w-3" /> Verified
    </span>
  );
}

export function Pill({ children, tone = "default" }: { children: ReactNode; tone?: "default" | "primary" }) {
  const cls =
    tone === "primary"
      ? "border-primary/30 bg-primary/10 text-primary"
      : "border-border bg-muted text-muted-foreground";
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${cls}`}>{children}</span>;
}
