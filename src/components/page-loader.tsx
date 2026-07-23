import { cn } from "@/lib/utils";

export function PageLoader({
  label = "Loading ledger…",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-[50vh] flex-col items-center justify-center gap-5 animate-fade-up",
        className,
      )}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="relative h-12 w-12">
        <span className="absolute inset-0 rounded-full border-2 border-primary/15" />
        <span className="absolute inset-0 rounded-full border-2 border-transparent border-t-primary animate-spin" />
        <span className="absolute inset-2 rounded-full border-2 border-transparent border-b-primary/50 animate-spin direction-[reverse] animation-duration-[0.85s]" />
        <span className="absolute inset-4.5 rounded-full bg-primary/80 animate-pulse" />
      </div>
      <div className="text-center">
        <div className="text-sm font-medium text-foreground">{label}</div>
        <div className="mt-1 flex items-center justify-center gap-1 text-xs text-muted-foreground">
          <span className="loader-dot" />
          <span className="loader-dot [animation-delay:150ms]" />
          <span className="loader-dot [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  );
}

export function RouteProgressBar() {
  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5 overflow-hidden bg-transparent"
      aria-hidden
    >
      <div className="route-progress h-full w-1/3 rounded-full bg-primary" />
    </div>
  );
}
