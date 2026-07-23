import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";
import { format } from "date-fns";
import { BadgeCheck, ExternalLink, ShieldCheck } from "lucide-react";

import { StatCard } from "@/components/stat-card";
import { ChartSkeleton, PieSkeleton } from "@/components/chart-skeleton";
import { PageLoader } from "@/components/page-loader";
import { formatInt } from "@/lib/format";
import { fetchKycMetrics, fetchKycTimeseries } from "@/lib/kyc-metrics";

export const Route = createFileRoute("/kyc")({
  head: () => ({
    meta: [
      { title: "KYC Metrics — OpenLedger" },
      {
        name: "description",
        content: "Live OpenPay KYC verification metrics — approvals, pending reviews, and daily trends.",
      },
    ],
  }),
  component: KycPage,
});

function changeLabel(pct: number | undefined) {
  if (pct == null || Number.isNaN(pct)) return null;
  const sign = pct > 0 ? "+" : "";
  const tone = pct > 0 ? "text-success" : pct < 0 ? "text-destructive" : "text-muted-foreground";
  return <span className={tone}>{sign}{pct.toFixed(1)}% vs prior</span>;
}

function KycPage() {
  const metrics = useQuery({
    queryKey: ["kyc-metrics"],
    queryFn: fetchKycMetrics,
    refetchInterval: 60_000,
  });

  const series = useQuery({
    queryKey: ["kyc-timeseries", 30],
    queryFn: () => fetchKycTimeseries(30),
    refetchInterval: 60_000,
  });

  if (metrics.isLoading) return <PageLoader label="Loading KYC metrics…" />;

  if (metrics.isError || !metrics.data) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        Failed to load KYC metrics. {(metrics.error as Error)?.message ?? "Unknown error"}
      </div>
    );
  }

  const m = metrics.data;
  const apps = m.applications;
  const users = m.users;
  const periods = m.periods ?? {};

  const statusPie = [
    { name: "Approved", value: apps.approved, fill: "var(--success)" },
    { name: "Pending", value: apps.pending, fill: "var(--warning)" },
    { name: "Rejected", value: apps.rejected, fill: "var(--destructive)" },
  ].filter((d) => d.value > 0);

  const chartData = (series.data?.series ?? []).map((row) => ({
    day: format(new Date(`${row.date}T00:00:00Z`), "MMM d"),
    Approved: row.approved,
  }));

  const approved30 = (series.data?.series ?? []).reduce((a, r) => a + Number(r.approved ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <BadgeCheck className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight">KYC Metrics</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Live verification stats from the OpenPay KYC Metrics API.
              {m.generated_at ? (
                <span className="ml-1 text-xs">Updated {format(new Date(m.generated_at), "MMM d, HH:mm")} UTC</span>
              ) : null}
            </p>
          </div>
        </div>
        <a
          href="https://openpy.space/admin-kyc-metrics"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          API docs <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Total Users" value={formatInt(users.total)} sub={`${formatInt(users.verified)} verified`} />
        <StatCard
          label="Verification Rate"
          value={`${Number(users.verification_rate_pct).toFixed(1)}%`}
          sub="Verified / total users"
          icon={<ShieldCheck className="h-4 w-4" />}
        />
        <StatCard label="Applications" value={formatInt(apps.total)} sub={`${formatInt(apps.pending)} pending`} />
        <StatCard
          label="Approval Rate"
          value={`${Number(apps.approval_rate_pct).toFixed(1)}%`}
          sub={`${formatInt(apps.approved)} approved · ${formatInt(apps.rejected)} rejected`}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          label="Approved Today"
          value={formatInt(periods.today?.approved ?? 0)}
          sub={changeLabel(periods.today?.change_pct)}
        />
        <StatCard
          label="Last 7 Days"
          value={formatInt(periods.last_7_days?.approved ?? approved30)}
          sub="Approvals"
        />
        <StatCard
          label={periods.month?.label ?? "This Month"}
          value={formatInt(periods.month?.approved ?? 0)}
          sub={changeLabel(periods.month?.change_pct)}
        />
        <StatCard
          label={periods.year?.label ?? "This Year"}
          value={formatInt(periods.year?.approved ?? 0)}
          sub={changeLabel(periods.year?.change_pct)}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="lg:col-span-2 rounded-xl border border-border bg-card p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold">Daily approvals (30d)</h2>
            <div className="text-xs text-muted-foreground">{formatInt(approved30)} total</div>
          </div>
          <div className="h-56 sm:h-72">
            {series.isLoading ? (
              <ChartSkeleton />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="kycApproved" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="day" stroke="var(--muted-foreground)" fontSize={11} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={11} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--popover)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="Approved"
                    stroke="var(--primary)"
                    fill="url(#kycApproved)"
                    strokeWidth={2}
                    isAnimationActive
                    animationDuration={800}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-4 sm:p-5">
          <h2 className="mb-4 text-sm font-semibold">Application status</h2>
          <div className="h-56 sm:h-72">
            {statusPie.length === 0 ? (
              <PieSkeleton />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusPie}
                    dataKey="value"
                    nameKey="name"
                    outerRadius={80}
                    innerRadius={45}
                    isAnimationActive
                    animationDuration={800}
                  >
                    {statusPie.map((d) => (
                      <Cell key={d.name} fill={d.fill} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "var(--popover)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>
      </div>

      <section className="rounded-xl border border-border bg-card p-4 sm:p-5 text-sm text-muted-foreground">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span>
            Source:{" "}
            <a
              href="https://openpy.space/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground font-medium hover:text-primary inline-flex items-center gap-1"
            >
              openpy.space <ExternalLink className="h-3 w-3" />
            </a>
          </span>
          <Link to="/analytics" className="text-primary hover:underline ml-auto">
            Network analytics →
          </Link>
        </div>
      </section>
    </div>
  );
}
