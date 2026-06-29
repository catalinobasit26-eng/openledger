import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { format, subDays } from "date-fns";

import { supabase } from "@/integrations/supabase/client";
import { StatCard } from "@/components/stat-card";
import { formatInt, formatUsd, shortAddress } from "@/lib/format";

export const Route = createFileRoute("/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics — OpenPay Ledger" },
      { name: "description", content: "Volume trends, transaction breakdown, top wallets, merchants and tokens on the OpenPay ledger." },
    ],
  }),
  component: AnalyticsPage,
});

function AnalyticsPage() {
  const daily = useQuery({
    queryKey: ["analytics-daily-30"],
    queryFn: async () => {
      const since = subDays(new Date(), 30).toISOString().slice(0, 10);
      const { data } = await supabase.from("analytics_daily").select("*").gte("day", since).order("day", { ascending: true });
      return (data ?? []).map((r: any) => ({
        day: format(new Date(r.day), "MMM d"),
        Transactions: r.transactions,
        Volume: Number(r.volume),
        NFTs: r.nft_sales,
        Swaps: r.swaps,
      }));
    },
  });

  const topWallets = useQuery({
    queryKey: ["top-wallets"],
    queryFn: async () => {
      const { data } = await supabase.from("wallets").select("*").order("tx_count", { ascending: false }).limit(10);
      return data ?? [];
    },
  });

  const topMerchants = useQuery({
    queryKey: ["top-merchants"],
    queryFn: async () => {
      const { data } = await supabase.from("merchants").select("*").order("total_volume", { ascending: false }).limit(10);
      return data ?? [];
    },
  });

  const topTokens = useQuery({
    queryKey: ["top-tokens"],
    queryFn: async () => {
      const { data } = await supabase.from("tokens").select("*").order("volume_24h", { ascending: false }).limit(10);
      return data ?? [];
    },
  });

  const totals = (daily.data ?? []).reduce(
    (a, r) => ({ tx: a.tx + r.Transactions, vol: a.vol + r.Volume, nft: a.nft + r.NFTs, swaps: a.swaps + r.Swaps }),
    { tx: 0, vol: 0, nft: 0, swaps: 0 },
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
        <p className="mt-1 text-sm text-muted-foreground">30-day rolling network analytics.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="30d Transactions" value={formatInt(totals.tx)} />
        <StatCard label="30d Volume" value={formatUsd(totals.vol)} />
        <StatCard label="30d NFT Sales" value={formatInt(totals.nft)} />
        <StatCard label="30d Swaps" value={formatInt(totals.swaps)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Daily Volume">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={daily.data ?? []}>
              <defs>
                <linearGradient id="av" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="day" stroke="var(--muted-foreground)" fontSize={11} />
              <YAxis stroke="var(--muted-foreground)" fontSize={11} />
              <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
              <Area type="monotone" dataKey="Volume" stroke="var(--primary)" fill="url(#av)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Daily Transactions">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={daily.data ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="day" stroke="var(--muted-foreground)" fontSize={11} />
              <YAxis stroke="var(--muted-foreground)" fontSize={11} />
              <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="Transactions" fill="var(--primary)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <ChartCard title="NFT sales & swaps trend">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={daily.data ?? []}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="day" stroke="var(--muted-foreground)" fontSize={11} />
            <YAxis stroke="var(--muted-foreground)" fontSize={11} />
            <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="NFTs" stroke="var(--chart-3)" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="Swaps" stroke="var(--chart-2)" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <div className="grid gap-4 lg:grid-cols-3">
        <TopList title="Top wallets" items={(topWallets.data ?? []).map((w: any) => ({ label: shortAddress(w.address), value: `${w.tx_count} tx`, href: `/wallet/${w.address}` }))} />
        <TopList title="Top merchants" items={(topMerchants.data ?? []).map((m: any) => ({ label: m.name, value: formatUsd(m.total_volume), href: `/merchants/${m.id}` }))} />
        <TopList title="Top tokens" items={(topTokens.data ?? []).map((t: any) => ({ label: t.symbol, value: formatUsd(t.volume_24h), href: `/tokens/${t.symbol}` }))} />
      </div>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h2 className="mb-4 text-sm font-semibold">{title}</h2>
      <div className="h-64">{children}</div>
    </div>
  );
}

function TopList({ title, items }: { title: string; items: { label: string; value: string; href: string }[] }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h2 className="mb-3 text-sm font-semibold">{title}</h2>
      <ul className="divide-y divide-border">
        {items.map((i, idx) => (
          <li key={idx} className="flex items-center justify-between py-2 text-sm">
            <a href={i.href} className="text-primary hover:underline font-mono text-xs">{i.label}</a>
            <span className="text-muted-foreground tabular-nums">{i.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
