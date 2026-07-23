import { cn } from "@/lib/utils";

export function ChartSkeleton({ className, bars = 8 }: { className?: string; bars?: number }) {
  const heights = [42, 68, 55, 80, 48, 72, 60, 88, 50, 65];
  return (
    <div className={cn("flex h-full items-end gap-2 px-1 pb-1", className)} aria-hidden>
      {Array.from({ length: bars }).map((_, i) => (
        <div
          key={i}
          className="animate-shimmer flex-1 rounded-t-md rounded-b-sm bg-primary/10"
          style={{ height: `${heights[i % heights.length]}%` }}
        />
      ))}
    </div>
  );
}

export function PieSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("grid h-full place-items-center", className)} aria-hidden>
      <div className="relative h-40 w-40">
        <div className="animate-shimmer absolute inset-0 rounded-full bg-primary/10" />
        <div className="absolute inset-[28%] rounded-full bg-card" />
      </div>
    </div>
  );
}
