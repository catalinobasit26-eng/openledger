import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type StatCardStyle = CSSProperties & {
  ["--fade-delay"]?: string | number;
};

export function StatCard({
  label,
  value,
  sub,
  icon,
  loading = false,
  className,
  style,
  delayMs,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon?: ReactNode;
  loading?: boolean;
  className?: string;
  style?: StatCardStyle;
  delayMs?: number;
}) {
  // Apply enter animation only after mount to avoid SSR/client hydration mismatches
  // (fill-mode: both would force opacity:0 on the client before hydration finishes).
  const [animate, setAnimate] = useState(false);
  useEffect(() => {
    setAnimate(true);
  }, []);

  const fadeDelay =
    delayMs != null
      ? `${delayMs}ms`
      : style?.["--fade-delay"] != null
        ? String(style["--fade-delay"])
        : undefined;

  const { ["--fade-delay"]: _ignored, ...restStyle } = (style ?? {}) as StatCardStyle & Record<string, unknown>;

  return (
    <div
      style={{
        ...(restStyle as CSSProperties),
        ...(fadeDelay ? { animationDelay: fadeDelay } : null),
      }}
      className={cn(
        "group rounded-xl border border-border bg-card p-3 sm:p-5 min-w-0",
        "transition-all duration-300 ease-out",
        "hover:-translate-y-0.5 hover:border-primary/35 hover:bg-primary/3",
        animate && "animate-fade-up",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="text-[10px] sm:text-xs font-medium uppercase tracking-wider text-muted-foreground min-w-0 leading-snug">
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
          <div className="mt-2 text-base sm:text-2xl font-semibold tracking-tight tabular-nums wrap-break-word leading-tight transition-colors">
            {value ?? "—"}
          </div>
          {sub ? <div className="mt-1 text-[10px] sm:text-xs text-muted-foreground wrap-break-word">{sub}</div> : null}
        </>
      )}
    </div>
  );
}
