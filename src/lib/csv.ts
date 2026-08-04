/** Client-side CSV export helpers for any ledger table. */

function cell(value: unknown): string {
  if (value == null) return "";
  const s = typeof value === "object" ? JSON.stringify(value) : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv<T extends Record<string, unknown>>(
  rows: T[],
  columns?: { key: keyof T & string; label?: string }[],
): string {
  if (rows.length === 0) return "";
  const cols =
    columns ?? Object.keys(rows[0] as Record<string, unknown>).map((key) => ({ key, label: key }));
  const head = cols.map((c) => cell(c.label ?? c.key)).join(",");
  const body = rows.map((r) => cols.map((c) => cell(r[c.key])).join(",")).join("\n");
  return `${head}\n${body}`;
}

export function downloadCsv(filename: string, csv: string) {
  if (typeof window === "undefined" || !csv) return;
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportRows<T extends Record<string, unknown>>(
  filename: string,
  rows: T[],
  columns?: { key: keyof T & string; label?: string }[],
) {
  downloadCsv(filename, toCsv(rows, columns));
}
