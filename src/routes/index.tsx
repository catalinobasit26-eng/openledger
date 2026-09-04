import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Activity, ArrowLeftRight, BadgeCheck, DollarSign, ExternalLink, Image, Layers, LayoutDashboard, ListTree, MessageCircle, Users, Zap } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell, Pie, PieChart } from "recharts";
import { format, subDays } from "date-fns";
import { useState, type CSSProperties, type ReactNode } from "react";

import { supabase } from "@/integrations/supabase/client";
import { StatCard } from "@/components/stat-card";
import { SearchBar } from "@/components/search-bar";
import { TxTable } from "@/components/tx-table";
import { LiveTicker } from "@/components/live-ticker";
import { ExportButton } from "@/components/export-button";
import { useLedgerRealtime } from "@/hooks/use-ledger-realtime";
import { ChartSkeleton, PieSkeleton } from "@/components/chart-skeleton";
import { formatInt, formatUsd } from "@/lib/format";
import { fetchKycMetrics } from "@/lib/kyc-metrics";
import { DenseExplorerMode } from "@/components/dense-explorer-mode";
import { Button } from "@/components/ui/button";

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
  useLedgerRealtime();
  const [viewMode, setViewMode] = useState<"overview" | "explorer">("overview");

  const stats = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      // Single aggregate RPC — scanning 300k+ rows client-side timed out the API.
      const [{ data, error }, kyc] = await Promise.all([
        supabase.rpc("get_dashboard_stats" as any),
        fetchKycMetrics().catch(() => null),
      ]);
      if (error) throw error;
      const d: any = data ?? {};
      return {
        totalTx: Number(d.total_tx ?? 0),
        totalVolume: Number(d.total_volume ?? 0),
        totalWallets: Number(d.total_wallets ?? 0),
        nftSales: Number(d.nft_sales ?? 0),
        swaps: Number(d.swaps ?? 0),
        openpay: Number(d.openpay ?? 0),
        stakes: Number(d.stakes ?? 0),
        typeBreakdown: (Array.isArray(d.type_breakdown) ? d.type_breakdown : [])
          .map((r: any) => ({ name: String(r.name).replace("_", " "), value: Number(r.value) }))
          .filter((r: any) => r.value > 0),
        kycVerified: kyc?.users?.verified ?? 0,
        kycRate: kyc?.users?.verification_rate_pct ?? 0,
      };
    },
    staleTime: 30_000,
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
    staleTime: 30_000,
  });

  const typeBreakdown = {
    data: stats.data?.typeBreakdown,
    isLoading: stats.isLoading,
  };


  const recent = useQuery({
    queryKey: ["recent-tx-dashboard"],
    queryFn: async () => {
      const { data } = await supabase
        .from("ledger_transactions")
        .select("hash,ts,source,type,from_address,to_address,amount,currency,status,block_number")
        .order("ts", { ascending: false })
        .limit(14);
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
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase text-muted-foreground">Display mode</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Choose visual analytics or a dense live ledger.</p>
        </div>
        <div className="inline-flex rounded-md border border-border bg-muted/50 p-1" role="group" aria-label="Dashboard display mode">
          <Button
            type="button"
            size="sm"
            variant={viewMode === "overview" ? "default" : "ghost"}
            onClick={() => setViewMode("overview")}
            aria-pressed={viewMode === "overview"}
          >
            <LayoutDashboard /> <span className="hidden sm:inline">Overview</span>
          </Button>
          <Button
            type="button"
            size="sm"
            variant={viewMode === "explorer" ? "default" : "ghost"}
            onClick={() => setViewMode("explorer")}
            aria-pressed={viewMode === "explorer"}
          >
            <ListTree /> <span className="hidden sm:inline">Explorer mode</span>
          </Button>
        </div>
      </div>

      {viewMode === "explorer" ? (
        <DenseExplorerMode
          stats={s ? { totalTx: s.totalTx, totalVolume: s.totalVolume, totalWallets: s.totalWallets } : undefined}
          rows={(recent.data ?? []) as any}
          loading={statsLoading || recent.isLoading}
        />
      ) : (
        <>
      <section
        className="ios-card relative overflow-hidden bg-linear-to-br from-primary/12 via-card to-card p-6 sm:p-10 animate-fade-up"
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

      {/* Bento: volume + live stream + type mix + source split */}
      <section className="grid gap-4 lg:grid-cols-3">
        <div
          className="panel panel-hover lg:col-span-2 p-5 animate-fade-up"
          style={{ "--fade-delay": "640ms" } as CSSProperties}
        >
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">Daily Volume (14d)</h2>
            <ExportButton rows={(daily.data ?? []) as any} filename="openledger-daily-14d" label="CSV" />
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

        <div className="animate-fade-up lg:row-span-2" style={{ "--fade-delay": "700ms" } as CSSProperties}>
          <LiveTicker limit={14} className="h-full max-h-[34rem]" />
        </div>

        <div
          className="panel panel-hover p-5 animate-fade-up"
          style={{ "--fade-delay": "760ms" } as CSSProperties}
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
                    {(typeBreakdown.data ?? []).map((entry: { name: string; value: number }, i: number) => (
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

        <div
          className="panel panel-hover p-5 animate-fade-up"
          style={{ "--fade-delay": "800ms" } as CSSProperties}
        >
          <h2 className="mb-4 text-sm font-semibold">OpenPay vs Pro — daily transactions</h2>
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
        </div>
      </section>

      <section className="animate-fade-up" style={{ "--fade-delay": "880ms" } as CSSProperties}>
        <div className="mb-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <h2 className="truncate text-sm font-semibold">Latest Transactions</h2>
          <div className="flex shrink-0 items-center gap-2">
            <ExportButton rows={(recent.data ?? []) as any} filename="openledger-latest-tx" label="CSV" />
            <Link to="/explorer" className="text-xs font-medium text-primary transition hover:underline">
              View all →
            </Link>
          </div>
        </div>
        <TxTable rows={(recent.data ?? []) as any} dense loading={recent.isLoading} />
      </section>


      <section
        className="ios-card p-5 animate-fade-up"
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

        <div className="mt-6 mb-4 flex items-center gap-2 border-t border-border pt-5">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-primary">
            <ExternalLink className="h-3.5 w-3.5" />
          </span>
          <h3 className="text-sm font-semibold">Get Started — OpenPay Pro</h3>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { href: "https://openpaypro4378.pinet.com", label: "OpenPay Pro", sub: "Launch in Pi Browser" },
            { href: "https://openpaypro.space/website", label: "Website", sub: "openpaypro.space" },
            { href: "https://openpaypro.space/openusd", label: "OpenUSD ($OUSD)", sub: "Stablecoin overview" },
            { href: "https://openpaypro.space/about", label: "About OpenPay Pro", sub: "What we build" },
            { href: "https://openpaypro.space/blog", label: "Blog", sub: "Product updates" },
            { href: "https://openpaypro.space/wiki", label: "Wiki", sub: "Docs & guides" },
          ].map((card, i) => (
            <EcosystemCard
              key={card.href}
              href={card.href}
              label={card.label}
              sub={card.sub}
              icon={<ExternalLink className="h-4 w-4" />}
              style={{ "--fade-delay": `${1440 + i * 40}ms` } as CSSProperties}
            />
          ))}
        </div>

      </section>
        </>
      )}
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
