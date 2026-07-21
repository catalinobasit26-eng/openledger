
-- Wipe existing NFT data so re-sync populates with correct slug=collection_id mapping
TRUNCATE TABLE public.nft_transactions RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.nft_collections RESTART IDENTITY CASCADE;

-- Function to recompute per-collection stats from nft_transactions
CREATE OR REPLACE FUNCTION public.refresh_nft_collection_stats()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.nft_collections c SET
    total_supply = COALESCE((
      SELECT COUNT(DISTINCT token_id) FROM public.nft_transactions
      WHERE collection_id = c.id AND event_type ILIKE '%mint%'
    ), 0),
    owners = COALESCE((
      SELECT COUNT(DISTINCT to_address) FROM public.nft_transactions
      WHERE collection_id = c.id AND to_address IS NOT NULL
    ), 0),
    floor_price = COALESCE((
      SELECT MIN(price) FROM public.nft_transactions
      WHERE collection_id = c.id AND event_type ILIKE '%sale%' AND price > 0
    ), 0),
    volume = COALESCE((
      SELECT SUM(price) FROM public.nft_transactions
      WHERE collection_id = c.id AND event_type ILIKE '%sale%'
    ), 0);
$$;

REVOKE ALL ON FUNCTION public.refresh_nft_collection_stats() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_nft_collection_stats() TO service_role;
