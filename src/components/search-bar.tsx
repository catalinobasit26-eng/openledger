import { useNavigate } from "@tanstack/react-router";
import { Loader2, Search } from "lucide-react";
import { useState, useTransition } from "react";

export function SearchBar({ size = "md" }: { size?: "md" | "lg" }) {
  const [q, setQ] = useState("");
  const [pending, startTransition] = useTransition();
  const navigate = useNavigate();
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const v = q.trim();
    if (!v) return;
    startTransition(() => {
      navigate({ to: "/explorer", search: { q: v } });
    });
  };
  return (
    <form onSubmit={submit} className="w-full">
      <div className="relative group">
        <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by tx hash, wallet, merchant, token, NFT…"
          className={`w-full rounded-lg border border-input bg-background pl-10 pr-24 outline-none ring-0 transition-all duration-200 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:shadow-[0_0_0_4px] focus:shadow-primary/10 ${
            size === "lg" ? "py-3.5 text-base" : "py-2.5 text-sm"
          }`}
        />
        <button
          type="submit"
          disabled={pending || !q.trim()}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50 active:scale-[0.98]"
        >
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          Search
        </button>
      </div>
    </form>
  );
}
