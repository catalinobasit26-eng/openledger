import { Download } from "lucide-react";
import { toast } from "sonner";

import { exportRows } from "@/lib/csv";
import { cn } from "@/lib/utils";

export function ExportButton<T extends Record<string, unknown>>({
  rows,
  filename,
  columns,
  label = "Export CSV",
  className,
}: {
  rows: T[];
  filename: string;
  columns?: { key: keyof T & string; label?: string }[];
  label?: string;
  className?: string;
}) {
  const count = rows?.length ?? 0;
  return (
    <button
      type="button"
      disabled={count === 0}
      onClick={() => {
        exportRows(filename, rows, columns);
        toast.success(`Exported ${count.toLocaleString()} rows`);
      }}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition",
        "hover:border-primary/40 hover:text-foreground disabled:opacity-40",
        className,
      )}
    >
      <Download className="h-3.5 w-3.5" />
      {label}
      {count > 0 ? <span className="text-[10px] opacity-70">({count.toLocaleString()})</span> : null}
    </button>
  );
}
