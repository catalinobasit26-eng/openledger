export function BrandLogo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center ${className}`}>
      <span className="text-base font-semibold tracking-tight">
        Open<span className="text-primary">Ledger</span>
      </span>
    </div>
  );
}
