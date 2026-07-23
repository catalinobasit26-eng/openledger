-- Backfill historical staking rows now that tx_type includes 'stake'.
UPDATE public.ledger_transactions
SET type = 'stake'
WHERE type IS DISTINCT FROM 'stake'
  AND (
    lower(coalesce(metadata->>'category', '')) = 'staking'
    OR coalesce(metadata->>'note', '') ~* '^stake(\s|$|[:(])'
    OR coalesce(metadata->>'note', '') ~* '\bunstake\b'
    OR coalesce(metadata->>'event_type', '') ~* 'stake'
  );
