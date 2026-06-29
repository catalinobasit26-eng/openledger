import { useNavigate } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useState } from "react";

export function SearchBar({ size = "md" }: { size?: "md" | "lg" }) {
  const [q, setQ] = useState("");
  const navigate = useNavigate();
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const v = q.trim();
    if (!v) return;
    navigate({ to: "/explorer", search: { q: v } });
  };
  return (
    <form onSubmit={submit} className="w-full">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by tx hash, wallet, merchant, token, NFT…"
          className={`w-full rounded-lg border border-input bg-background pl-10 pr-24 outline-none ring-0 transition focus:border-primary focus:ring-2 focus:ring-primary/20 ${
            size === "lg" ? "py-3.5 text-base" : "py-2.5 text-sm"
          }`}
        />
        <button
          type="submit"
          className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition hover:opacity-90"
        >
          Search
        </button>
      </div>
    </form>
  );
}
