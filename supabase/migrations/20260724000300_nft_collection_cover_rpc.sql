-- Speeds up cover lookups from NFT ledger events.
CREATE INDEX IF NOT EXISTS ledger_tx_nft_collection_id_idx
  ON public.ledger_transactions ((lower(metadata #>> '{item,collection_id}')))
  WHERE type IN ('nft_mint', 'nft_sale');

-- Return (and cache) a collection cover image, including data: URLs from source events.
CREATE OR REPLACE FUNCTION public.get_nft_collection_cover(_slug text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_slug text := lower(trim(_slug));
  v_img text;
BEGIN
  IF v_slug = '' THEN
    RETURN NULL;
  END IF;

  SELECT c.image_url INTO v_img
  FROM public.nft_collections c
  WHERE c.slug = v_slug;

  IF v_img IS NOT NULL AND length(v_img) > 0 THEN
    RETURN v_img;
  END IF;

  SELECT t.metadata #>> '{item,image_url}' INTO v_img
  FROM public.ledger_transactions t
  WHERE t.type IN ('nft_mint', 'nft_sale')
    AND lower(t.metadata #>> '{item,collection_id}') = v_slug
    AND coalesce(t.metadata #>> '{item,image_url}', '') <> ''
  ORDER BY t.ts DESC
  LIMIT 1;

  IF v_img IS NULL OR length(v_img) = 0 THEN
    SELECT t.metadata #>> '{item,cover_url}' INTO v_img
    FROM public.ledger_transactions t
    WHERE t.type IN ('nft_mint', 'nft_sale')
      AND lower(t.metadata #>> '{item,collection_id}') = v_slug
      AND coalesce(t.metadata #>> '{item,cover_url}', '') <> ''
    ORDER BY t.ts DESC
    LIMIT 1;
  END IF;

  IF v_img IS NOT NULL AND length(v_img) > 0 THEN
    UPDATE public.nft_collections
    SET image_url = v_img
    WHERE slug = v_slug
      AND (image_url IS NULL OR image_url = '');
  END IF;

  RETURN v_img;
END;
$$;

REVOKE ALL ON FUNCTION public.get_nft_collection_cover(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_nft_collection_cover(text) TO anon, authenticated, service_role;
