-- ============================================================
-- Migration 003: UNIQUE constraint on bank_transactions.fintoc_transaction_id
-- Required for upsert with onConflict to work correctly.
-- Without this constraint, ALL manual import upserts fail silently,
-- leaving bank_connections/bank_accounts created but zero transactions stored.
-- ============================================================

ALTER TABLE public.bank_transactions
  ADD CONSTRAINT IF NOT EXISTS bank_transactions_fintoc_tx_id_unique
  UNIQUE (fintoc_transaction_id);
