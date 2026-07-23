-- Strip oversized inline images that make nft_collections SELECT * time out.
UPDATE public.nft_collections
SET image_url = NULL
WHERE image_url IS NOT NULL
  AND (
    image_url LIKE 'data:%'
    OR image_url LIKE '/9j/%'
    OR image_url LIKE 'iVBOR%'
    OR length(image_url) > 2048
  );

-- Safe public listing: never returns megabyte data-URLs.
CREATE OR REPLACE FUNCTION public.list_nft_collections()
RETURNS TABLE (
  id uuid,
  slug text,
  name text,
  description text,
  image_url text,
  total_supply bigint,
  owners bigint,
  floor_price numeric,
  volume numeric,
  creator_address text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id,
    c.slug,
    c.name,
    c.description,
    CASE
      WHEN c.image_url ~* '^https?://' THEN c.image_url
      ELSE NULL
    END AS image_url,
    c.total_supply,
    c.owners,
    c.floor_price,
    c.volume,
    c.creator_address
  FROM public.nft_collections c
  ORDER BY c.volume DESC NULLS LAST, c.name ASC;
$$;

REVOKE ALL ON FUNCTION public.list_nft_collections() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_nft_collections() TO anon, authenticated, service_role;
