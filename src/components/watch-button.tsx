import { Star } from "lucide-react";

import { useWatchlist, type WatchKind } from "@/lib/watchlist";
import { cn } from "@/lib/utils";

export function WatchButton({
  kind,
  id,
  label,
  className,
  showLabel = true,
}: {
  kind: WatchKind;
  id: string;
  label?: string;
  className?: string;
  showLabel?: boolean;
}) {
  const { isWatched, toggle, ready } = useWatchlist();
  const active = ready && isWatched(kind, id);

  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={() => toggle(kind, id, label)}
      title={active ? "Remove from watchlist" : "Add to watchlist"}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition",
        active
          ? "border-warning/50 bg-warning/10 text-warning"
          : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
        className,
      )}
    >
      <Star className={cn("h-3.5 w-3.5", active && "fill-current")} />
      {showLabel ? (active ? "Watching" : "Watch") : null}
    </button>
  );
}
