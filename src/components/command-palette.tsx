import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  ArrowLeftRight,
  BadgeCheck,
  Coins,
  Image as ImageIcon,
  LayoutDashboard,
  Layers,
  Search,
  Store,
  Star,
  Wallet,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { supabase } from "@/integrations/supabase/client";
import { shortHash } from "@/lib/format";
import { useWatchlist } from "@/lib/watchlist";

const TX_HASH_RE = /^[0-9a-fA-F]{64}$/;

const PAGES: { to: string; label: string; icon: ReactNode }[] = [
  { to: "/", label: "Dashboard", icon: <LayoutDashboard className="h-4 w-4" /> },
  { to: "/explorer", label: "Explorer", icon: <Activity className="h-4 w-4" /> },
  { to: "/watchlist", label: "Watchlist", icon: <Star className="h-4 w-4" /> },
  { to: "/pi", label: "Pi Testnet", icon: <Zap className="h-4 w-4" /> },
  { to: "/pro", label: "OpenPay Pro", icon: <Layers className="h-4 w-4" /> },
  { to: "/tokens", label: "Tokens", icon: <Coins className="h-4 w-4" /> },
  { to: "/stable", label: "OUSD Stablecoin", icon: <ArrowLeftRight className="h-4 w-4" /> },
  { to: "/stake", label: "Stake", icon: <Layers className="h-4 w-4" /> },
  { to: "/kyc", label: "KYC", icon: <BadgeCheck className="h-4 w-4" /> },
  { to: "/nft", label: "NFTs", icon: <ImageIcon className="h-4 w-4" /> },
  { to: "/merchants", label: "Merchants", icon: <Store className="h-4 w-4" /> },
  { to: "/analytics", label: "Analytics", icon: <Activity className="h-4 w-4" /> },
];

export function useCommandPaletteHotkey(onOpen: () => void) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpen();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onOpen]);
}

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const { items: watched } = useWatchlist();
  const q = query.trim();

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const results = useQuery({
    enabled: open && q.length >= 2,
    queryKey: ["cmdk", q],
    queryFn: async () => {
      const [tx, wallets, tokens, merchants, collections] = await Promise.all([
        supabase
          .from("ledger_transactions")
          .select("hash,type,amount,currency,ts")
          .or(`hash.ilike.${q}%,from_address.ilike.${q}%,to_address.ilike.${q}%`)
          .order("ts", { ascending: false })
          .limit(6),
        supabase.from("wallets").select("address,tx_count").ilike("address", `${q}%`).limit(5),
        supabase.from("tokens").select("symbol,name").or(`symbol.ilike.%${q}%,name.ilike.%${q}%`).limit(5),
        supabase.from("merchants").select("id,name,category").or(`id.ilike.%${q}%,name.ilike.%${q}%`).limit(5),
        supabase.from("nft_collections").select("slug,name").ilike("name", `%${q}%`).limit(5),
      ]);
      return {
        tx: tx.data ?? [],
        wallets: wallets.data ?? [],
        tokens: tokens.data ?? [],
        merchants: merchants.data ?? [],
        collections: collections.data ?? [],
      };
    },
  });

  const go = (fn: () => void) => {
    onOpenChange(false);
    fn();
  };

  const pages = useMemo(
    () => PAGES.filter((p) => !q || p.label.toLowerCase().includes(q.toLowerCase())),
    [q],
  );

  const r = results.data;

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Search OpenLedger"
      description="Jump to any transaction, wallet, token, merchant or page"
      shouldFilter={false}
    >
      <CommandInput
        value={query}
        onValueChange={setQuery}
        placeholder="Search hash, wallet, token, merchant, NFT or page…"
      />
      <CommandList className="max-h-[65vh]">
        <CommandEmpty>
          {q.length < 2 ? "Type at least 2 characters…" : results.isFetching ? "Searching…" : "No results found."}
        </CommandEmpty>

        {TX_HASH_RE.test(q) ? (
          <CommandGroup heading="Exact match">
            <CommandItem
              value={`tx-${q}`}
              onSelect={() => go(() => navigate({ to: "/tx/$hash", params: { hash: q.toLowerCase() } }))}
            >
              <Search className="h-4 w-4" />
              <span className="font-mono text-xs">Open transaction {shortHash(q, 10, 8)}</span>
            </CommandItem>
          </CommandGroup>
        ) : null}

        {pages.length > 0 ? (
          <CommandGroup heading="Pages">
            {pages.map((p) => (
              <CommandItem key={p.to} value={`page-${p.label}`} onSelect={() => go(() => navigate({ to: p.to }))}>
                {p.icon}
                <span>{p.label}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}

        {!q && watched.length > 0 ? (
          <>
            <CommandSeparator />
            <CommandGroup heading="Watchlist">
              {watched.slice(0, 6).map((w) => (
                <CommandItem
                  key={`${w.kind}:${w.id}`}
                  value={`watch-${w.kind}-${w.id}`}
                  onSelect={() =>
                    go(() => {
                      if (w.kind === "wallet") navigate({ to: "/wallet/$address", params: { address: w.id } });
                      else if (w.kind === "token") navigate({ to: "/tokens/$symbol", params: { symbol: w.id } });
                      else if (w.kind === "merchant") navigate({ to: "/merchants/$id", params: { id: w.id } });
                      else navigate({ to: "/nft/$slug", params: { slug: w.id } });
                    })
                  }
                >
                  <Star className="h-4 w-4 fill-current text-warning" />
                  <span className="truncate">{w.label ?? w.id}</span>
                  <span className="ml-auto text-[10px] uppercase text-muted-foreground">{w.kind}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        ) : null}

        {r && r.tx.length > 0 ? (
          <CommandGroup heading="Transactions">
            {r.tx.map((t: any) => (
              <CommandItem
                key={t.hash}
                value={`tx-${t.hash}`}
                onSelect={() => go(() => navigate({ to: "/tx/$hash", params: { hash: t.hash } }))}
              >
                <Activity className="h-4 w-4" />
                <span className="font-mono text-xs">{shortHash(t.hash, 10, 6)}</span>
                <span className="ml-auto text-[10px] text-muted-foreground">
                  {Number(t.amount).toLocaleString()} {t.currency}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}

        {r && r.wallets.length > 0 ? (
          <CommandGroup heading="Wallets">
            {r.wallets.map((w: any) => (
              <CommandItem
                key={w.address}
                value={`wallet-${w.address}`}
                onSelect={() => go(() => navigate({ to: "/wallet/$address", params: { address: w.address } }))}
              >
                <Wallet className="h-4 w-4" />
                <span className="truncate font-mono text-xs">{w.address}</span>
                <span className="ml-auto text-[10px] text-muted-foreground">{w.tx_count} tx</span>
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}

        {r && r.tokens.length > 0 ? (
          <CommandGroup heading="Tokens">
            {r.tokens.map((t: any) => (
              <CommandItem
                key={t.symbol}
                value={`token-${t.symbol}`}
                onSelect={() => go(() => navigate({ to: "/tokens/$symbol", params: { symbol: t.symbol } }))}
              >
                <Coins className="h-4 w-4" />
                <span className="font-medium">{t.symbol}</span>
                <span className="ml-auto text-[10px] text-muted-foreground">{t.name}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}

        {r && r.merchants.length > 0 ? (
          <CommandGroup heading="Merchants">
            {r.merchants.map((m: any) => (
              <CommandItem
                key={m.id}
                value={`merchant-${m.id}`}
                onSelect={() => go(() => navigate({ to: "/merchants/$id", params: { id: m.id } }))}
              >
                <Store className="h-4 w-4" />
                <span className="truncate">{m.name}</span>
                <span className="ml-auto text-[10px] text-muted-foreground">{m.category}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}

        {r && r.collections.length > 0 ? (
          <CommandGroup heading="NFT collections">
            {r.collections.map((c: any) => (
              <CommandItem
                key={c.slug}
                value={`nft-${c.slug}`}
                onSelect={() => go(() => navigate({ to: "/nft/$slug", params: { slug: c.slug } }))}
              >
                <ImageIcon className="h-4 w-4" />
                <span className="truncate">{c.name}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}
      </CommandList>
    </CommandDialog>
  );
}
