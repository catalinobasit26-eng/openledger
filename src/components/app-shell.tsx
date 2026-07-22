import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Moon, Sun, LogOut, Shield } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { BrandLogo } from "./brand-logo";
import { useTheme } from "@/lib/theme";
import { supabase } from "@/integrations/supabase/client";

const navItems = [
  { to: "/", label: "Dashboard" },
  { to: "/explorer", label: "Explorer" },
  { to: "/tokens", label: "Tokens" },
  { to: "/stable", label: "OUSD" },
  { to: "/nft", label: "NFTs" },
  { to: "/merchants", label: "Merchants" },
  { to: "/analytics", label: "Analytics" },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { theme, toggle } = useTheme();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data }) => mounted && setEmail(data.user?.email ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setEmail(session?.user?.email ?? null);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const isAuth = pathname === "/auth";

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto flex max-w-7xl items-center gap-6 px-4 py-3 sm:px-6">
          <Link to="/" className="shrink-0"><BrandLogo /></Link>
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((n) => {
              const active = n.to === "/" ? pathname === "/" : pathname.startsWith(n.to);
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={`rounded-md px-3 py-1.5 text-sm transition ${
                    active ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  {n.label}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={toggle}
              aria-label="Toggle theme"
              className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            {email ? (
              <>
                <Link
                  to="/admin"
                  className="hidden sm:inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
                >
                  <Shield className="h-3.5 w-3.5" /> Admin
                </Link>
                <button
                  onClick={async () => {
                    await supabase.auth.signOut();
                    navigate({ to: "/" });
                  }}
                  className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition"
                  aria-label="Sign out"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </>
            ) : !isAuth ? (
              <a
                href="https://www.openpy.space/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
              >
                Sign in
              </a>
            ) : null}
          </div>
        </div>
        <nav className="md:hidden border-t border-border bg-background overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex items-center gap-1 px-3 py-2 w-max">
            {navItems.map((n) => {
              const active = n.to === "/" ? pathname === "/" : pathname.startsWith(n.to);
              return (
                <Link key={n.to} to={n.to} className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs ${active ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground"}`}>
                  {n.label}
                </Link>
              );
            })}
          </div>
        </nav>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
      <footer className="mt-16 border-t border-border">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <div className="mb-2 text-sm font-semibold text-foreground">OpenPay Ecosystem</div>
              <ul className="space-y-1.5 text-xs text-muted-foreground">
                <li><a href="https://openpy.space" target="_blank" rel="noopener noreferrer" className="hover:text-foreground">Pi Browser · openpy.space</a></li>
                <li><a href="https://t.me/openpayofficialbot" target="_blank" rel="noopener noreferrer" className="hover:text-foreground">Telegram Mini App</a></li>
                <li><a href="https://openpy.space/signin" target="_blank" rel="noopener noreferrer" className="hover:text-foreground">External Browser</a></li>
                <li><a href="https://openappdev.space" target="_blank" rel="noopener noreferrer" className="hover:text-foreground">OpenApp</a></li>
              </ul>
            </div>
            <div>
              <div className="mb-2 text-sm font-semibold text-foreground">Resources</div>
              <ul className="space-y-1.5 text-xs text-muted-foreground">
                <li><a href="https://www.openpy.space/blog" target="_blank" rel="noopener noreferrer" className="hover:text-foreground">Blog</a></li>
                <li><a href="https://openpy.space/whitepaper" target="_blank" rel="noopener noreferrer" className="hover:text-foreground">Whitepaper</a></li>
                <li><a href="https://openpy.space/pitch-deck" target="_blank" rel="noopener noreferrer" className="hover:text-foreground">Pitch Deck</a></li>
                <li><a href="https://openpy.space/web3/nft" target="_blank" rel="noopener noreferrer" className="hover:text-foreground">OpenNFT Marketplace</a></li>
              </ul>
            </div>
            <div>
              <div className="mb-2 text-sm font-semibold text-foreground">Community</div>
              <ul className="space-y-1.5 text-xs text-muted-foreground">
                <li><a href="https://droplinkpi.space/@openpay" target="_blank" rel="noopener noreferrer" className="hover:text-foreground">Follow Us · droplinkpi</a></li>
                <li><a href="https://openpy.space/ledger" target="_blank" rel="noopener noreferrer" className="hover:text-foreground">OpenLedger</a></li>
              </ul>
            </div>
            <div>
              <div className="mb-2 text-sm font-semibold text-foreground">About</div>
              <div className="text-xs text-muted-foreground">
                OpenLedger — the public transaction explorer and audit layer for the OpenPay ecosystem.
              </div>
              <div className="mt-2 font-mono text-[10px] text-muted-foreground">SHA-256 hash chain · Immutable audit</div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
