-- Documents in the schema itself what migration 0034 changed: bank_account_id
-- is optional, only forbidden outright for payment methods that don't use one.
comment on column public.payments.bank_account_id is
  'Optional. Forbidden (rejected by enforce_payment_bank_account) when payment_types.requires_bank_account is false for this row''s payment_method. See migration 0034.';
