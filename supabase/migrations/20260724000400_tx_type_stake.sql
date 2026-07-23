-- Dedicated stake type for OpenPay staking events.
ALTER TYPE public.tx_type ADD VALUE IF NOT EXISTS 'stake';
