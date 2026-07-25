-- OpenPay Pro public ledger lives on the published mainnet host.
-- Preview / lovableproject URLs return HTTP 406 (auth bridge) and break Admin sync.
UPDATE public.integrations
SET
  base_url = 'https://openpaypromainnet.lovable.app',
  last_sync_at = NULL,
  last_sync_status = NULL,
  last_sync_error = NULL,
  last_sync_count = 0,
  updated_at = now()
WHERE slug = 'openpay_pro'
  AND (
    base_url IS DISTINCT FROM 'https://openpaypromainnet.lovable.app'
    OR coalesce(last_sync_status, '') = 'error'
  );
