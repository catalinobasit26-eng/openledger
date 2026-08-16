import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
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
      // 1) exact external_ref (the id OpenLedger stores for every synced order)
      const exact = await supabase
        .from("ledger_transactions")
        .select("hash")
        .eq("external_ref", ref)
        .limit(1)
        .maybeSingle();
      if (exact.error) throw exact.error;
      if (exact.data) return exact.data;

      // 2) fall back to aliases: some OpenPay links carry the internal
      //    transaction id / tx hash instead of the ledger event id.
      const safe = ref.replace(/[,()*]/g, "");
      const alias = await supabase
        .from("ledger_transactions")
        .select("hash")
        .or(
          [
            `hash.eq.${safe}`,
            `metadata->>openpay_ledger_event_id.eq.${safe}`,
            `metadata->>tx_id.eq.${safe}`,
            `metadata->>tx_hash.eq.${safe}`,
          ].join(","),
        )
        .limit(1)
        .maybeSingle();
      if (alias.error) throw alias.error;
      return alias.data;
    },
  });

  useEffect(() => {
    if (data?.hash) navigate({ to: "/tx/$hash", params: { hash: data.hash }, replace: true });
  }, [data, navigate]);

  if (isLoading || data?.hash) return <PageLoader label="Locating transaction…" />;
  return (
    <div className="ios-card space-y-3 p-6 text-sm text-muted-foreground">
      <p>
        No OpenLedger transaction found for reference{" "}
        <span className="font-mono text-foreground">{ref}</span>.
      </p>
      <p>
        Either it has not been synced yet (sync runs every minute), or the link was built with an id
        that OpenPay does not publish on its public ledger feed. Deep links must use the ledger event
        id returned by the OpenPay feed (the value sent as <code>external_ref</code>).
      </p>
      <Link to="/explorer" search={{ q: ref, page: 1 }} className="inline-block font-medium text-primary">
        Search the explorer for this reference →
      </Link>
    </div>
  );
}

