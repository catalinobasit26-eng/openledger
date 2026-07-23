import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Menu, Moon, Sun, LogOut, Shield } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { BrandLogo } from "./brand-logo";
import { RouteProgressBar } from "./page-loader";
import { useTheme } from "@/lib/theme";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/", label: "Dashboard" },
  { to: "/explorer", label: "Explorer" },
  { to: "/tokens", label: "Tokens" },
  { to: "/stable", label: "OUSD" },
  { to: "/stake", label: "Stake" },
  { to: "/kyc", label: "KYC" },
  { to: "/nft", label: "NFTs" },
  { to: "/merchants", label: "Merchants" },
  { to: "/analytics", label: "Analytics" },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { theme, toggle } = useTheme();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isNavigating = useRouterState({ select: (s) => s.status === "pending" });
  const navigate = useNavigate();
  const [email, setEmail] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

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

  // Close drawer when the route changes (e.g. browser back).
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const isAuth = pathname === "/auth";

  const isActive = (to: string) => (to === "/" ? pathname === "/" : pathname.startsWith(to));

  return (
    <div className="min-h-screen bg-background">
      {isNavigating ? <RouteProgressBar /> : null}
      <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur supports-backdrop-filter:bg-background/70">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:gap-6 sm:px-6">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <button
                type="button"
                className="md:hidden rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition"
                aria-label="Open menu"
              >
                <Menu className="h-5 w-5" />
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[min(100%,20rem)] p-0 flex flex-col">
              <SheetHeader className="border-b border-border px-4 py-4 text-left">
                <SheetTitle className="text-base">
                  <BrandLogo />
                </SheetTitle>
              </SheetHeader>
              <nav className="flex-1 overflow-y-auto px-3 py-3">
                <ul className="space-y-1">
                  {navItems.map((n) => (
                    <li key={n.to}>
                      <Link
                        to={n.to}
                        onClick={() => setMobileOpen(false)}
                        className={cn(
                          "flex w-full items-center rounded-lg px-3 py-2.5 text-sm transition",
                          isActive(n.to)
                            ? "bg-primary/10 text-primary font-medium"
                            : "text-foreground hover:bg-muted",
                        )}
                      >
                        {n.label}
                      </Link>
                    </li>
                  ))}
                </ul>
                {email ? (
                  <div className="mt-4 border-t border-border pt-3 space-y-1">
                    <Link
                      to="/admin"
                      onClick={() => setMobileOpen(false)}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-foreground hover:bg-muted"
                    >
                      <Shield className="h-4 w-4 text-primary" /> Admin
                    </Link>
                    <button
                      type="button"
                      onClick={async () => {
                        setMobileOpen(false);
                        await supabase.auth.signOut();
                        navigate({ to: "/" });
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <LogOut className="h-4 w-4" /> Sign out
                    </button>
                  </div>
                ) : !isAuth ? (
                  <div className="mt-4 border-t border-border pt-3 px-1">
                    <a
                      href="https://www.openpy.space/"
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => setMobileOpen(false)}
                      className="flex w-full items-center justify-center rounded-lg bg-primary px-3 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90"
                    >
                      Sign in
                    </a>
                  </div>
                ) : null}
              </nav>
            </SheetContent>
          </Sheet>

          <Link to="/" className="shrink-0">
            <BrandLogo />
          </Link>
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm transition",
                  isActive(n.to)
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
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
                  type="button"
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
                className="hidden sm:inline-flex items-center rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
              >
                Sign in
              </a>
            ) : null}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 pb-10 min-w-0 overflow-x-clip">{children}</main>
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
