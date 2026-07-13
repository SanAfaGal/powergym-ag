-- supabase/migrations/00000000000024_merge_qr_transfer_payment_types.sql
--
-- The payment method step in RecordPaymentDialog is becoming a first-choice
-- toggle between "Efectivo" and "Entidad bancaria" (with icons), collapsing
-- the previous three-way choice (cash/qr/transfer) -- staff no longer need
-- to distinguish QR from a plain transfer, only whether a bank account
-- received the money. The new row is inserted before existing payments are
-- repointed to it, so the payment_method FK is never left dangling.
insert into public.payment_types (code, name, requires_bank_account)
values ('bank', 'Entidad bancaria', true);

update public.payments set payment_method = 'bank' where payment_method in ('qr', 'transfer');

delete from public.payment_types where code in ('qr', 'transfer');
