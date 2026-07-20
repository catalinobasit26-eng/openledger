import type { ReactNode } from "react";

export function StatCard({
  label,
  value,
  sub,
  icon,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-3 sm:p-5 transition hover:border-primary/30 min-w-0">
      <div className="flex items-start justify-between gap-2">
        <div className="text-[10px] sm:text-xs font-medium uppercase tracking-wider text-muted-foreground min-w-0 truncate">{label}</div>
        {icon ? <div className="text-primary opacity-80 shrink-0">{icon}</div> : null}
      </div>
      <div className="mt-2 text-lg sm:text-2xl font-semibold tracking-tight tabular-nums truncate">{value}</div>
      {sub ? <div className="mt-1 text-[10px] sm:text-xs text-muted-foreground truncate">{sub}</div> : null}
    </div>
  );
}
