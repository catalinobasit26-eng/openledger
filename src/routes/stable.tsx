import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine } from "recharts";
import { Coins, ShieldCheck } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { StatCard } from "@/components/stat-card";
import { formatInt, formatNumber, formatUsd } from "@/lib/format";

export const Route = createFileRoute("/stable")({
  head: () => ({
    meta: [
      { title: "OUSD Stablecoin — OpenLedger" },
      { name: "description", content: "OUSD is the OpenPay stable asset — pegged 1:1 with 1 PI = 1 OUSD = $1. Live chart, supply and on-ledger volume." },
    ],
  }),
  component: StablePage,
});

const PEG = 1.0;

function StablePage() {
  // Build a 30-day flat peg series + real 24h ledger volume for context.
  const daily = useQuery({
    queryKey: ["stable-daily-30"],
    queryFn: async () => {
      const from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const { data } = await supabase.from("analytics_daily").select("date,volume,transactions").gte("date", from).order("date");
      const map = new Map((data ?? []).map((r: any) => [r.date, r]));
      const rows: { date: string; price: number; volume: number; tx: number }[] = [];
      for (let i = 29; i >= 0; i--) {
        const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        const r: any = map.get(d);
        rows.push({ date: d.slice(5), price: PEG, volume: Number(r?.volume ?? 0), tx: Number(r?.transactions ?? 0) });
      }
      return rows;
    },
    refetchInterval: 30_000,
  });

  const tokens = useQuery({
    queryKey: ["stable-tokens"],
    queryFn: async () => {
      const { data } = await supabase.from("tokens").select("*").in("symbol", ["OUSD", "PI", "OPEN"]);
      return data ?? [];
    },
    refetchInterval: 30_000,
  });

  const ousd = (tokens.data ?? []).find((t: any) => t.symbol === "OUSD");
  const pi = (tokens.data ?? []).find((t: any) => t.symbol === "PI");
  const supply24h = daily.data?.[daily.data.length - 1];

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          <Coins className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">OUSD Stablecoin</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            The OpenPay stable asset. Fixed peg: <span className="font-semibold text-foreground">1 OUSD = 1 PI = $1.00</span> — used for merchant settlement, NFT sales and swaps across the OpenPay ledger.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="OUSD Price" value={formatUsd(PEG)} sub="1:1 USD peg" icon={<ShieldCheck className="h-4 w-4" />} />
        <StatCard label="PI Price" value={formatUsd(PEG)} sub="1 PI = 1 OUSD" />
        <StatCard label="24h Volume" value={`${formatNumber(supply24h?.volume ?? 0)} OUSD`} sub={`${formatInt(supply24h?.tx ?? 0)} transactions`} />
        <StatCard label="Holders" value={formatInt(ousd?.holders ?? 0)} sub={`${formatInt(ousd?.transfers_count ?? 0)} transfers`} />
        {pi ? null : null}
      </div>

      <section className="rounded-xl border border-border bg-card p-4 sm:p-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Price · 30 days</div>
            <div className="mt-1 text-lg font-semibold">OUSD / USD</div>
          </div>
          <div className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-500">Stable · pegged</div>
        </div>
        <div className="mt-4 h-56 sm:h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={daily.data ?? []} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="peg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis domain={[0.9, 1.1]} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `$${Number(v).toFixed(2)}`} />
              <Tooltip
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                formatter={(v: number) => [formatUsd(v), "OUSD"]}
              />
              <ReferenceLine y={1} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" />
              <Area type="monotone" dataKey="price" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#peg)" isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-4 sm:p-5">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">On-ledger volume · 30 days</div>
        <div className="mt-4 h-56 sm:h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={daily.data ?? []} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="vol" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <Tooltip
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                formatter={(v: number) => [`${formatNumber(v)} OUSD`, "Volume"]}
              />
              <Area type="monotone" dataKey="volume" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#vol)" isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-4 sm:p-5 text-sm text-muted-foreground">
        <div className="font-semibold text-foreground">About the peg</div>
        <p className="mt-2">
          OUSD is the unit of account for the OpenPay ecosystem. Its value is fixed at 1 USD, and 1 Pi is treated as 1 OUSD across the ledger.
          Merchant payments, NFT sales and swaps are all recorded in OUSD-equivalent for a consistent audit trail.
        </p>
      </section>
    </div>
  );
}
