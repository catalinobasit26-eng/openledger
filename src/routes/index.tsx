import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Activity, ArrowLeftRight, BadgeCheck, DollarSign, ExternalLink, Image, Layers, MessageCircle, Users, Zap } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell, Pie, PieChart } from "recharts";
import { format, subDays } from "date-fns";
import type { CSSProperties, ReactNode } from "react";

import { supabase } from "@/integrations/supabase/client";
import { StatCard } from "@/components/stat-card";
import { SearchBar } from "@/components/search-bar";
import { TxTable } from "@/components/tx-table";
import { ChartSkeleton, PieSkeleton } from "@/components/chart-skeleton";
import { formatInt, formatUsd } from "@/lib/format";
import { isCurrencySwapNote, isStakeTx } from "@/lib/tx-classify";
import { fetchKycMetrics } from "@/lib/kyc-metrics";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "OpenLedger — Dashboard" },
      { name: "description", content: "Live transparent ledger for the OpenPay ecosystem: volume, transactions, merchants, NFTs and swaps across OpenPay and OpenPay Pro." },
      { property: "og:title", content: "OpenLedger — Dashboard" },
      { property: "og:description", content: "Live transparent ledger for the OpenPay ecosystem: volume, transactions, merchants, NFTs and swaps across OpenPay and OpenPay Pro." },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const stats = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      // Prefer select("id") for counts — select("*", { head: true }) times out on this table (PostgREST 57014).
      const [tx, vol, wallets, nft, openpay, stakeTyped, typed, payments, transfers, kyc] = await Promise.all([
        supabase.from("ledger_transactions").select("id", { count: "exact", head: true }),
        supabase.from("ledger_transactions").select("amount"),
        supabase.from("wallets").select("address", { count: "exact", head: true }),
        supabase.from("ledger_transactions").select("id", { count: "exact", head: true }).eq("type", "nft_sale"),
        supabase.from("ledger_transactions").select("id", { count: "exact", head: true }).eq("source", "openpay"),
        supabase.from("ledger_transactions").select("id", { count: "exact", head: true }).eq("type", "stake"),
        supabase.from("ledger_transactions").select("id", { count: "exact", head: true }).eq("type", "swap"),
        // OpenPay labels conversions as category "other"/type payment; detect via note.
        // Only scan payments — selecting metadata->>note across NFT rows times out (huge base64).
        supabase.from("ledger_transactions").select("type,metadata").eq("type", "payment").limit(5000),
        // Legacy staking rows were stored as transfers before the stake enum landed.
        supabase.from("ledger_transactions").select("type,metadata").eq("type", "transfer").limit(2000),
        fetchKycMetrics().catch(() => null),
      ]);
      const totalVolume = (vol.data ?? []).reduce((acc, r: any) => acc + Number(r.amount ?? 0), 0);
      const noteSwaps = (payments.data ?? []).filter((r: any) => isCurrencySwapNote(r.metadata?.note)).length;
      const swaps = (typed.count ?? 0) + noteSwaps;
      const legacyStakes =
        (payments.data ?? []).filter((r: any) => isStakeTx(r)).length +
        (transfers.data ?? []).filter((r: any) => isStakeTx(r)).length;
      // stakeTyped.error is fine if the enum isn't migrated yet — fall back to legacy only.
      const stakes = (stakeTyped.error ? 0 : (stakeTyped.count ?? 0)) + legacyStakes;
      return {
        totalTx: tx.count ?? 0,
        totalVolume,
        totalWallets: wallets.count ?? 0,
        nftSales: nft.count ?? 0,
        swaps,
        openpay: openpay.count ?? 0,
        stakes,
        kycVerified: kyc?.users?.verified ?? 0,
        kycRate: kyc?.users?.verification_rate_pct ?? 0,
      };
    },
  });

  const daily = useQuery({
    queryKey: ["analytics-daily-14"],
    queryFn: async () => {
      const since = subDays(new Date(), 14).toISOString().slice(0, 10);
      const { data } = await supabase.from("analytics_daily").select("*").gte("day", since).order("day", { ascending: true });
      return (data ?? []).map((r: any) => ({
        day: format(new Date(r.day), "MMM d"),
        Transactions: r.transactions,
        Volume: Number(r.volume),
        OpenPay: r.openpay_tx,
        Pro: r.openpaypro_tx,
      }));
    },
  });

  const typeBreakdown = useQuery({
    queryKey: ["type-breakdown"],
    queryFn: async () => {
      // Avoid metadata->>note over NFT rows (statement timeout). Reclassify payments/transfers client-side.
      const [{ data: types }, { data: payments }, { data: transfers }] = await Promise.all([
        supabase.from("ledger_transactions").select("type").limit(5000),
        supabase.from("ledger_transactions").select("type,metadata").eq("type", "payment").limit(5000),
        supabase.from("ledger_transactions").select("type,metadata").eq("type", "transfer").limit(2000),
      ]);
      const counts: Record<string, number> = {};
      (types ?? []).forEach((r: any) => {
        counts[r.type] = (counts[r.type] ?? 0) + 1;
      });
      const noteSwaps = (payments ?? []).filter((r: any) => isCurrencySwapNote(r.metadata?.note)).length;
      if (noteSwaps > 0) {
        counts.payment = Math.max(0, (counts.payment ?? 0) - noteSwaps);
        counts.swap = (counts.swap ?? 0) + noteSwaps;
      }
      const paymentStakes = (payments ?? []).filter((r: any) => isStakeTx(r)).length;
      const transferStakes = (transfers ?? []).filter((r: any) => isStakeTx(r)).length;
      if (paymentStakes > 0) {
        counts.payment = Math.max(0, (counts.payment ?? 0) - paymentStakes);
        counts.stake = (counts.stake ?? 0) + paymentStakes;
      }
      if (transferStakes > 0) {
        counts.transfer = Math.max(0, (counts.transfer ?? 0) - transferStakes);
        counts.stake = (counts.stake ?? 0) + transferStakes;
      }
      return Object.entries(counts)
        .filter(([, value]) => value > 0)
        .map(([name, value]) => ({ name: name.replace("_", " "), value }));
    },
  });

  const recent = useQuery({
    queryKey: ["recent-tx-dashboard"],
    queryFn: async () => {
      const { data } = await supabase
        .from("ledger_transactions")
        .select("hash,ts,source,type,from_address,to_address,amount,currency,status,block_number")
        .order("ts", { ascending: false })
        .limit(10);
      return data ?? [];
    },
    refetchInterval: 8000,
  });

  const s = stats.data;
  const statsLoading = stats.isLoading;
  const pieColorByType: Record<string, string> = {
    payment: "var(--chart-1)",
    "nft mint": "var(--chart-2)",
    "nft sale": "var(--chart-3)",
    deposit: "var(--chart-4)",
    transfer: "var(--chart-5)",
    swap: "var(--success)",
    stake: "#ec4899",
    withdrawal: "var(--warning)",
    refund: "var(--destructive)",
  };
  const pieFallback = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "var(--primary)", "var(--success)"];
  const pieFill = (name: string, i: number) =>
    pieColorByType[name.toLowerCase()] ?? pieFallback[i % pieFallback.length];

  const statItems = [
    { label: "Total Transactions", value: formatInt(s?.totalTx), icon: <Activity className="h-4 w-4" /> },
    { label: "Total Volume", value: formatUsd(s?.totalVolume), sub: "All currencies normalized", icon: <DollarSign className="h-4 w-4" /> },
    { label: "Total Wallets", value: formatInt(s?.totalWallets), icon: <Users className="h-4 w-4" /> },
    { label: "KYC Verified", value: formatInt(s?.kycVerified), sub: s?.kycRate != null ? `${Number(s.kycRate).toFixed(1)}% of users` : undefined, icon: <BadgeCheck className="h-4 w-4" /> },
    { label: "NFT Sales", value: formatInt(s?.nftSales), icon: <Image className="h-4 w-4" /> },
    { label: "Swaps", value: formatInt(s?.swaps), icon: <ArrowLeftRight className="h-4 w-4" /> },
    { label: "OpenPay Tx", value: formatInt(s?.openpay), icon: <Zap className="h-4 w-4" /> },
    { label: "Stake", value: formatInt(s?.stakes), icon: <Layers className="h-4 w-4" /> },
  ];

  return (
    <div className="space-y-8">
      <section
        className="relative overflow-hidden rounded-2xl border border-border bg-linear-to-br from-primary/10 via-card to-card p-5 sm:p-10 animate-fade-up"
        style={{ "--fade-delay": "0ms" } as CSSProperties}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-primary/15 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-24 left-1/3 h-48 w-48 rounded-full bg-primary/10 blur-3xl"
        />
        <div className="relative max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] sm:text-xs font-medium text-primary animate-fade-up" style={{ "--fade-delay": "60ms" } as CSSProperties}>
            <span className="live-dot relative flex h-1.5 w-1.5">
              <span className="absolute inset-0 rounded-full bg-primary" />
            </span>
            Live ledger · SHA-256 hash chain
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight sm:text-4xl animate-fade-up" style={{ "--fade-delay": "120ms" } as CSSProperties}>
            The public explorer for the OpenPay ecosystem
          </h1>
          <p className="mt-3 text-sm sm:text-base text-muted-foreground animate-fade-up" style={{ "--fade-delay": "180ms" } as CSSProperties}>
            Search and verify every transaction from OpenPay and OpenPay Pro. Track wallets, merchants, tokens, NFTs, and the daily pulse of the network.
          </p>
          <div className="mt-6 animate-fade-up" style={{ "--fade-delay": "240ms" } as CSSProperties}>
            <SearchBar size="lg" />
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {statItems.map((item, i) => (
          <StatCard
            key={item.label}
            label={item.label}
            value={item.value}
            sub={"sub" in item ? item.sub : undefined}
            icon={item.icon}
            loading={statsLoading}
            delayMs={280 + i * 45}
          />
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div
          className="lg:col-span-2 rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/20 animate-fade-up"
          style={{ "--fade-delay": "640ms" } as CSSProperties}
        >
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Daily Volume (14d)</h2>
            <div className="text-xs text-muted-foreground">All sources</div>
          </div>
          <div className="h-64">
            {daily.isLoading ? (
              <ChartSkeleton />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={daily.data ?? []}>
                  <defs>
                    <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="day" stroke="var(--muted-foreground)" fontSize={11} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={11} />
                  <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                  <Area type="monotone" dataKey="Volume" stroke="var(--primary)" fill="url(#g1)" strokeWidth={2} isAnimationActive animationDuration={900} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
        <div
          className="rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/20 animate-fade-up"
          style={{ "--fade-delay": "720ms" } as CSSProperties}
        >
          <h2 className="mb-4 text-sm font-semibold">Transaction Types</h2>
          <div className="h-64">
            {typeBreakdown.isLoading ? (
              <PieSkeleton />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={typeBreakdown.data ?? []}
                    dataKey="value"
                    nameKey="name"
                    outerRadius={80}
                    innerRadius={45}
                    isAnimationActive
                    animationDuration={800}
                  >
                    {(typeBreakdown.data ?? []).map((entry, i) => (
                      <Cell key={entry.name} fill={pieFill(entry.name, i)} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </section>

      <section
        className="rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/20 animate-fade-up"
        style={{ "--fade-delay": "800ms" } as CSSProperties}
      >
        <h2 className="mb-4 text-sm font-semibold">OpenPay vs OpenPay Pro — daily transactions</h2>
        <div className="h-64">
          {daily.isLoading ? (
            <ChartSkeleton bars={10} />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={daily.data ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="day" stroke="var(--muted-foreground)" fontSize={11} />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} />
                <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="OpenPay" stackId="a" fill="var(--primary)" isAnimationActive animationDuration={850} />
                <Bar dataKey="Pro" stackId="a" fill="var(--chart-2)" isAnimationActive animationDuration={850} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      <section className="animate-fade-up" style={{ "--fade-delay": "880ms" } as CSSProperties}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Latest Transactions</h2>
          <Link to="/explorer" className="text-xs font-medium text-primary transition hover:underline">
            View all →
          </Link>
        </div>
        <TxTable rows={(recent.data ?? []) as any} dense loading={recent.isLoading} />
      </section>

      <section
        className="rounded-xl border border-border bg-card p-5 animate-fade-up"
        style={{ "--fade-delay": "960ms" } as CSSProperties}
      >
        <div className="mb-4 flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-primary">
            <ExternalLink className="h-3.5 w-3.5" />
          </span>
          <h2 className="text-sm font-semibold">OpenPay Ecosystem</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { href: "https://openpy.space", label: "Try it today", sub: "Pi Browser", icon: <ExternalLink className="h-4 w-4" /> },
            { href: "https://openpy.space/ledger", label: "OpenLedger", sub: "Public explorer", icon: <ExternalLink className="h-4 w-4" /> },
            { href: "https://openappdev.space", label: "OpenApp", sub: "Mobile app", icon: <ExternalLink className="h-4 w-4" /> },
            { href: "https://www.openpy.space/blog", label: "Read Our Blogs", sub: "News & updates", icon: <ExternalLink className="h-4 w-4" /> },
            { href: "https://t.me/openpayofficialbot", label: "Telegram Mini App", sub: "@openpayofficialbot", icon: <MessageCircle className="h-4 w-4" /> },
            { href: "https://openpy.space/signin", label: "External Browser", sub: "Web sign-in", icon: <ExternalLink className="h-4 w-4" /> },
            { href: "https://droplinkpi.space/@openpay", label: "Follow Us", sub: "droplinkpi.space", icon: <ExternalLink className="h-4 w-4" /> },
            { href: "https://openpy.space/whitepaper", label: "Whitepaper", sub: "OpenPay docs", icon: <ExternalLink className="h-4 w-4" /> },
            { href: "https://openpy.space/pitch-deck", label: "Pitch Deck", sub: "Investor deck", icon: <ExternalLink className="h-4 w-4" /> },
            { href: "https://openpy.space/web3/nft", label: "OpenNFT Marketplace", sub: "NFTs & collectibles", icon: <ExternalLink className="h-4 w-4" /> },
          ].map((card, i) => (
            <EcosystemCard
              key={card.href + card.label}
              href={card.href}
              label={card.label}
              sub={card.sub}
              icon={card.icon}
              style={{ "--fade-delay": `${1000 + i * 40}ms` } as CSSProperties}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function EcosystemCard({
  href,
  label,
  sub,
  icon,
  style,
}: {
  href: string;
  label: string;
  sub: string;
  icon: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={style}
      className="group flex items-center gap-3 rounded-lg border border-border bg-background p-3 animate-fade-up transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/35 hover:bg-primary/5"
    >
      <span className="shrink-0 text-muted-foreground transition-colors duration-300 group-hover:text-primary">{icon}</span>
      <div className="min-w-0">
        <div className="truncate text-sm font-medium text-foreground">{label}</div>
        <div className="truncate text-xs text-muted-foreground">{sub}</div>
      </div>
    </a>
  );
}
