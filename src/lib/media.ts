/** Detect data: / raw base64 image payloads that bloat ledger metadata. */
export function isDataImageUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.length < 32) return false;
  if (/^data:image\//i.test(value)) return true;
  // Some feeds send bare base64 JPEG/PNG without the data: prefix
  if (/^\/9j\//.test(value) || /^iVBOR/.test(value)) return true;
  return false;
}

export function toImageSrc(value: string): string {
  if (/^data:image\//i.test(value) || /^https?:\/\//i.test(value)) return value;
  if (/^\/9j\//.test(value)) return `data:image/jpeg;base64,${value}`;
  if (/^iVBOR/.test(value)) return `data:image/png;base64,${value}`;
  return value;
}

/** Drop oversized inline images from objects before writing to ledger metadata. */
export function sanitizeMetadataImages<T>(input: T, placeholder = "[inline image omitted]"): T {
  if (input === null || input === undefined) return input;
  if (typeof input === "string") {
    return (isDataImageUrl(input) ? placeholder : input) as T;
  }
  if (Array.isArray(input)) {
    return input.map((v) => sanitizeMetadataImages(v, placeholder)) as T;
  }
  if (typeof input === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      if (/image_url|cover_url|banner_url|thumbnail_url|image$/i.test(k) && isDataImageUrl(v)) {
        out[k] = placeholder;
      } else {
        out[k] = sanitizeMetadataImages(v, placeholder);
      }
    }
    return out as T;
  }
  return input;
}

/** Prefer http(s); otherwise keep a data:/base64 cover for NFT display. */
export function pickCollectionImageUrl(...candidates: Array<string | null | undefined>): string | null {
  for (const c of candidates) {
    if (!c) continue;
    if (/^https?:\/\//i.test(c) && c.length <= 2048) return c;
  }
  for (const c of candidates) {
    if (c && isDataImageUrl(c)) return toImageSrc(c);
  }
  return null;
}

/** Prefer http(s) image URLs only — for places that must stay small (API payloads, etc.). */
export function pickRemoteImageUrl(...candidates: Array<string | null | undefined>): string | null {
  for (const c of candidates) {
    if (!c) continue;
    if (/^https?:\/\//i.test(c) && c.length <= 2048) return c;
  }
  return null;
}
