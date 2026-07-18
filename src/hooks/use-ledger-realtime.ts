import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Subscribes to realtime INSERTs on public.ledger_transactions and invalidates
 * all React Query caches so any dashboard / explorer view refreshes instantly
 * when new transactions arrive (from webhooks, admin sync, or auto-cron).
 */
export function useLedgerRealtime() {
  const qc = useQueryClient();
  useEffect(() => {
    const channel = supabase
      .channel("ledger-tx-stream")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "ledger_transactions" },
        () => {
          qc.invalidateQueries();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);
}
