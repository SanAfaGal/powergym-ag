-- supabase/migrations/00000000000030_payments_bank_account_id_index.sql
--
-- listRevenueByBankAccount (dashboard/queries.ts) filters
-- payments.bank_account_id IS NOT NULL combined with a payment_date range.
-- Only payments_date_idx (migration 0006) exists; bank_account_id (added in
-- migration 0012) has never had one, forcing a seq scan as payments grows.
-- Partial: cash payments (bank_account_id is null) are the majority of rows
-- and never queried through this filter.

create index payments_bank_account_id_idx
  on public.payments (bank_account_id)
  where bank_account_id is not null;
