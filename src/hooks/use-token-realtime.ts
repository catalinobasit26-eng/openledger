import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Keeps a token detail page live: new ledger rows for this currency and
 * updates on the tokens row invalidate React Query caches immediately.
 */
export function useTokenRealtime(symbol: string) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!symbol) return;
    const channel = supabase
      .channel(`token-live-${symbol}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "ledger_transactions",
          filter: `currency=eq.${symbol}`,
        },
        () => {
          void qc.invalidateQueries({ queryKey: ["token-tx", symbol] });
          void qc.invalidateQueries({ queryKey: ["token", symbol] });
          void qc.invalidateQueries({ queryKey: ["tokens"] });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tokens",
          filter: `symbol=eq.${symbol}`,
        },
        () => {
          void qc.invalidateQueries({ queryKey: ["token", symbol] });
          void qc.invalidateQueries({ queryKey: ["tokens"] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc, symbol]);
}
