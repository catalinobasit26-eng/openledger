import { useCallback, useEffect, useState } from "react";

export type WatchKind = "wallet" | "token" | "merchant" | "collection";

export type WatchItem = {
  kind: WatchKind;
  id: string;
  label?: string;
  addedAt: string;
};

const KEY = "openledger.watchlist.v1";
const EVENT = "openledger:watchlist";

function read(): WatchItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as WatchItem[]) : [];
  } catch {
    return [];
  }
}

function write(items: WatchItem[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function watchKey(kind: WatchKind, id: string) {
  return `${kind}:${id}`;
}

/** Reactive watchlist backed by localStorage, synced across tabs and components. */
export function useWatchlist() {
  const [items, setItems] = useState<WatchItem[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const sync = () => setItems(read());
    sync();
    setReady(true);
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const isWatched = useCallback(
    (kind: WatchKind, id: string) => items.some((i) => i.kind === kind && i.id === id),
    [items],
  );

  const toggle = useCallback((kind: WatchKind, id: string, label?: string) => {
    const current = read();
    const exists = current.some((i) => i.kind === kind && i.id === id);
    write(
      exists
        ? current.filter((i) => !(i.kind === kind && i.id === id))
        : [{ kind, id, label, addedAt: new Date().toISOString() }, ...current].slice(0, 200),
    );
  }, []);

  const remove = useCallback((kind: WatchKind, id: string) => {
    write(read().filter((i) => !(i.kind === kind && i.id === id)));
  }, []);

  const clear = useCallback(() => write([]), []);

  return { items, ready, isWatched, toggle, remove, clear };
}
