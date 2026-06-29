import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { StatCard } from "@/components/stat-card";
import { formatInt, formatUsd } from "@/lib/format";
import { Pill } from "@/components/badges";

export const Route = createFileRoute("/merchants/")({
  head: () => ({
    meta: [
      { title: "Merchants — OpenLedger" },
      { name: "description", content: "Browse merchants accepting payments through OpenPay and OpenPay Pro." },
    ],
  }),
  component: MerchantsIndex,
});

function MerchantsIndex() {
  const { data } = useQuery({
    queryKey: ["merchants-all"],
    queryFn: async () => {
      const { data } = await supabase.from("merchants").select("*").order("total_volume", { ascending: false });
      return data ?? [];
    },
  });
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Merchants</h1>
        <p className="mt-1 text-sm text-muted-foreground">Businesses accepting payments through OpenPay.</p>
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatCard label="Total Merchants" value={formatInt(data?.length)} />
        <StatCard label="Verified" value={formatInt(data?.filter((m: any) => m.verified).length)} />
        <StatCard label="Total Volume" value={formatUsd(data?.reduce((a, m: any) => a + Number(m.total_volume), 0))} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(data ?? []).map((m: any) => (
          <Link key={m.id} to="/merchants/$id" params={{ id: m.id }} className="rounded-xl border border-border bg-card p-4 transition hover:border-primary/40">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-semibold">{m.name}</div>
                <div className="text-xs text-muted-foreground">{m.category}</div>
              </div>
              {m.verified && <Pill tone="primary">Verified</Pill>}
            </div>
            <p className="mt-2 text-xs text-muted-foreground line-clamp-2">{m.description}</p>
            <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border pt-3 text-xs">
              <div><div className="text-muted-foreground">Sales</div><div className="font-medium tabular-nums">{formatInt(m.total_sales)}</div></div>
              <div><div className="text-muted-foreground">Volume</div><div className="font-medium tabular-nums">{formatUsd(m.total_volume)}</div></div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
