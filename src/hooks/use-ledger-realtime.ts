import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Subscribes to realtime INSERTs on public.ledger_transactions and refreshes
 * the visible queries. Invalidation is throttled: the sync engine can insert
 * hundreds of rows a minute, and invalidating on every row caused a refetch
 * storm that overloaded the database.
 */
export function useLedgerRealtime() {
  const qc = useQueryClient();
  useEffect(() => {
    let pending = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const flush = () => {
      timer = undefined;
      if (!pending) return;
      pending = false;
      qc.invalidateQueries({ refetchType: "active" });
      timer = setTimeout(flush, 15_000);
    };

    const channel = supabase
      .channel("ledger-tx-stream")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "ledger_transactions" },
        () => {
          pending = true;
          if (!timer) timer = setTimeout(flush, 3_000);
        },
      )
      .subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [qc]);
}
