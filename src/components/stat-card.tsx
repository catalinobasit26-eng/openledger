import type { CSSProperties, ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  sub,
  icon,
  loading = false,
  className,
  style,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon?: ReactNode;
  loading?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      style={style}
      className={cn(
        "group rounded-xl border border-border bg-card p-3 sm:p-5 min-w-0",
        "transition-all duration-300 ease-out",
        "hover:-translate-y-0.5 hover:border-primary/35 hover:bg-primary/[0.03]",
        "animate-fade-up",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="text-[10px] sm:text-xs font-medium uppercase tracking-wider text-muted-foreground min-w-0 truncate">
          {label}
        </div>
        {icon ? (
          <div className="text-primary/80 shrink-0 transition-transform duration-300 group-hover:scale-110 group-hover:text-primary">
            {icon}
          </div>
        ) : null}
      </div>
      {loading ? (
        <div className="mt-2 space-y-2">
          <Skeleton className="h-7 w-24 sm:h-8" />
          {sub ? <Skeleton className="h-3 w-16" /> : null}
        </div>
      ) : (
        <>
          <div className="mt-2 text-lg sm:text-2xl font-semibold tracking-tight tabular-nums truncate transition-colors">
            {value}
          </div>
          {sub ? <div className="mt-1 text-[10px] sm:text-xs text-muted-foreground truncate">{sub}</div> : null}
        </>
      )}
    </div>
  );
}
