import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";

import { supabase } from "@/integrations/supabase/client";
import { PageLoader } from "@/components/page-loader";

export const Route = createFileRoute("/tx/ref/$ref")({
  head: ({ params }) => ({
    meta: [
      { title: `Order ${params.ref} — OpenLedger` },
      { name: "description", content: "Resolve an OpenPay order reference to its OpenLedger transaction." },
      { property: "og:title", content: `Order ${params.ref} — OpenLedger` },
      { property: "og:description", content: "Public, hash-chained proof of an OpenPay transaction." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResolveRefPage,
});

function ResolveRefPage() {
  const { ref } = Route.useParams();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ["tx-by-ref", ref],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ledger_transactions")
        .select("hash")
        .eq("external_ref", ref)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (data?.hash) navigate({ to: "/tx/$hash", params: { hash: data.hash }, replace: true });
  }, [data, navigate]);

  if (isLoading || data?.hash) return <PageLoader label="Locating transaction…" />;
  return (
    <div className="ios-card p-6 text-sm text-muted-foreground">
      No OpenLedger transaction found for reference <span className="font-mono text-foreground">{ref}</span>. It may
      not have been synced yet — try again in a minute.
    </div>
  );
}
