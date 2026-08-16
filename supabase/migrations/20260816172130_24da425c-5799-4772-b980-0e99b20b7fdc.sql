CREATE INDEX IF NOT EXISTS ledger_tx_external_ref_idx ON public.ledger_transactions (external_ref);
CREATE INDEX IF NOT EXISTS ledger_tx_hash_idx ON public.ledger_transactions (hash);
CREATE INDEX IF NOT EXISTS ledger_tx_meta_event_id_idx ON public.ledger_transactions ((metadata->>'openpay_ledger_event_id'));
CREATE INDEX IF NOT EXISTS ledger_tx_meta_tx_id_idx ON public.ledger_transactions ((metadata->>'tx_id'));
CREATE INDEX IF NOT EXISTS ledger_tx_meta_tx_hash_idx ON public.ledger_transactions ((metadata->>'tx_hash'));