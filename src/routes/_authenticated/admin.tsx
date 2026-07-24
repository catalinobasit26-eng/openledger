import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Database, FileText, ShieldAlert, Activity } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { StatCard } from "@/components/stat-card";
import { TxTable } from "@/components/tx-table";
import { StatusBadge } from "@/components/badges";
import { IntegrationsPanel } from "@/components/integrations-panel";
import { formatInt, shortHash, timeAgo } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [{ title: "Admin — OpenLedger" }],
  }),
  component: AdminPage,
});

function AdminPage() {
  const roles = useQuery({
    queryKey: ["my-roles"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return [];
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", u.user.id);
      return data ?? [];
    },
  });
  const roleNames = (roles.data ?? []).map((r: any) => r.role);
  const isStaff = roleNames.length > 0;
  const isSuperAdmin = roleNames.includes("super_admin");

  const recent = useQuery({
    queryKey: ["admin-recent-tx"],
    queryFn: async () => {
      const { data } = await supabase
        .from("ledger_transactions")
        .select("hash,ts,source,type,from_address,to_address,amount,currency,status,block_number")
        .order("ts", { ascending: false })
        .limit(50);
      return data ?? [];
    },
    refetchInterval: 5000,
  });

  const fraud = useQuery({
    enabled: isStaff,
    queryKey: ["fraud-alerts"],
    queryFn: async () => {
      const { data } = await supabase.from("fraud_alerts").select("*").order("created_at", { ascending: false }).limit(50);
      return data ?? [];
    },
  });

  const apiLogs = useQuery({
    enabled: isStaff,
    queryKey: ["api-logs"],
    queryFn: async () => {
      const { data } = await supabase.from("api_logs").select("*").order("created_at", { ascending: false }).limit(50);
      return data ?? [];
    },
  });

  const auditLogs = useQuery({
    enabled: isStaff,
    queryKey: ["audit-logs"],
    queryFn: async () => {
      const { data } = await supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(50);
      return data ?? [];
    },
  });

  const exportCsv = (rows: any[], filename: string) => {
    if (!rows.length) return;
    const keys = Object.keys(rows[0]);
    const csv = [
      keys.join(","),
      ...rows.map((r) => keys.map((k) => JSON.stringify(r[k] ?? "")).join(",")),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Admin Panel</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Monitor ingestion, audit the ledger, manage alerts and exports.
            {roles.data && roles.data.length > 0 && (
              <span className="ml-2 inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                Role: {roles.data.map((r: any) => r.role).join(", ")}
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => exportCsv(recent.data ?? [], "transactions.csv")} className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted">Export Tx CSV</button>
          <button onClick={() => exportCsv(fraud.data ?? [], "fraud-alerts.csv")} className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted">Export Alerts</button>
        </div>
      </div>

      {!isStaff && (
        <div className="rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm text-warning-foreground">
          You are signed in but do not yet have a staff role. Audit, API and fraud logs are hidden until a Super Admin grants you a role.
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Active Alerts" value={formatInt(fraud.data?.filter((f: any) => !f.resolved).length ?? 0)} icon={<AlertTriangle className="h-4 w-4" />} />
        <StatCard label="API Logs (50)" value={formatInt(apiLogs.data?.length ?? 0)} icon={<Activity className="h-4 w-4" />} />
        <StatCard label="Audit Events" value={formatInt(auditLogs.data?.length ?? 0)} icon={<FileText className="h-4 w-4" />} />
        <StatCard label="Recent Tx (50)" value={formatInt(recent.data?.length ?? 0)} icon={<Database className="h-4 w-4" />} />
      </div>

      <IntegrationsPanel isSuperAdmin={isSuperAdmin} />

      <section>
        <h2 className="mb-3 text-sm font-semibold">Live ledger feed</h2>
        <TxTable rows={(recent.data ?? []) as any} dense />
      </section>

      {isStaff && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold"><ShieldAlert className="h-4 w-4 text-warning" /> Fraud alerts</h2>
          <div className="rounded-xl border border-border bg-card">
            <div className="table-scroll">
              <table className="w-full min-w-140 text-sm">
                <thead className="bg-muted/50 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Severity</th>
                    <th className="px-4 py-3">Reason</th>
                    <th className="px-4 py-3">Tx</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">When</th>
                  </tr>
                </thead>
                <tbody>
                  {(fraud.data ?? []).map((a: any) => (
                    <tr key={a.id} className="border-t border-border">
                      <td className="px-4 py-3"><StatusBadge status={a.severity} /></td>
                      <td className="px-4 py-3 text-sm wrap-break-word">{a.reason}</td>
                      <td className="px-4 py-3 font-mono text-xs whitespace-nowrap">
                        {a.transaction_hash ? (
                          <Link
                            to="/tx/$hash"
                            params={{ hash: a.transaction_hash }}
                            className="text-primary hover:underline"
                          >
                            {shortHash(a.transaction_hash, 8, 6)}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs">{a.resolved ? "Resolved" : "Open"}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{timeAgo(a.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {isStaff && (
        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-3 text-sm font-semibold">Recent API calls</h2>
            <ul className="divide-y divide-border text-xs">
              {(apiLogs.data ?? []).map((l: any) => (
                <li key={l.id} className="flex items-center justify-between py-2">
                  <div>
                    <span className="font-mono">{l.method}</span> <span className="text-muted-foreground">{l.endpoint}</span>
                  </div>
                  <div className={`font-mono ${l.status >= 400 ? "text-destructive" : "text-success"}`}>{l.status}</div>
                </li>
              ))}
              {!apiLogs.data?.length && <li className="py-4 text-center text-muted-foreground">No API calls logged yet.</li>}
            </ul>
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-3 text-sm font-semibold">Audit log</h2>
            <ul className="divide-y divide-border text-xs">
              {(auditLogs.data ?? []).map((l: any) => (
                <li key={l.id} className="py-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{l.action}</span>
                    <span className="text-muted-foreground">{timeAgo(l.created_at)}</span>
                  </div>
                  <div className="text-muted-foreground">{l.actor_email ?? "system"} · {l.target ?? ""}</div>
                </li>
              ))}
              {!auditLogs.data?.length && <li className="py-4 text-center text-muted-foreground">No audit events yet.</li>}
            </ul>
          </div>
        </section>
      )}
    </div>
  );
}
