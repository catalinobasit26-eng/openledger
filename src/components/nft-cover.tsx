import { useEffect, useRef, useState } from "react";
import { ImageOff, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

function CoverSkeleton({ label = "Loading image…" }: { label?: string }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-muted" aria-hidden>
      <div className="absolute inset-0 animate-shimmer bg-primary/10" />
      <Loader2 className="relative h-6 w-6 animate-spin text-primary/70" />
      <span className="relative text-[10px] font-medium tracking-wide text-muted-foreground">{label}</span>
    </div>
  );
}

/** Stable cover URL — server streams binary so the browser never holds multi‑MB base64. */
export function nftCoverSrc(slug: string) {
  return `/api/public/nft/${encodeURIComponent(slug)}/cover`;
}

export function NftCover({
  slug,
  name,
  className,
}: {
  slug: string;
  collectionId?: string;
  name: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [errored, setErrored] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: "280px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    setErrored(false);
    setImgLoaded(false);
  }, [slug]);

  const src = visible ? nftCoverSrc(slug) : null;
  const showLoader = !visible || (!!src && !errored && !imgLoaded);
  const showEmpty = visible && errored;

  return (
    <div ref={ref} className={cn("relative overflow-hidden bg-muted", className)}>
      {showLoader ? <CoverSkeleton /> : null}

      {src && !errored ? (
        <img
          src={src}
          alt={name}
          loading="lazy"
          decoding="async"
          onLoad={() => setImgLoaded(true)}
          onError={() => {
            setErrored(true);
            setImgLoaded(false);
          }}
          className={cn(
            "h-full w-full object-cover transition-opacity duration-500 ease-out",
            imgLoaded ? "opacity-100" : "opacity-0",
          )}
        />
      ) : null}

      {showEmpty ? (
        <div className="absolute inset-0 grid place-items-center text-muted-foreground animate-fade-up">
          <div className="flex flex-col items-center gap-1.5">
            <ImageOff className="h-6 w-6 opacity-40" />
            <span className="text-[10px] text-muted-foreground/80">No cover</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
