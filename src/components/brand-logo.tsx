export function BrandLogo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <svg width="28" height="28" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
        <rect width="32" height="32" rx="8" fill="var(--primary)" />
        <path d="M9 11.5C9 9.6 10.6 8 12.5 8H19a5 5 0 0 1 0 10h-3v6h-3.5A3.5 3.5 0 0 1 9 20.5v-9Z" fill="white" />
        <circle cx="19" cy="13" r="2" fill="var(--primary)" />
      </svg>
      <div className="leading-tight">
        <div className="text-sm font-semibold tracking-tight">OpenPay</div>
        <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground -mt-0.5">Ledger</div>
      </div>
    </div>
  );
}
