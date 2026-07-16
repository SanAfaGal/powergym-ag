-- enforce_payment_bank_account (migration 0012) required bank_account_id
-- whenever payment_types.requires_bank_account was true, and forbade it
-- otherwise. Staff don't always know which account received a bank
-- transfer at entry time, so drop the "must have one" side and keep only
-- the "must not have one" side -- a cash payment tagged with a bank
-- account is still nonsensical and stays rejected.
create or replace function public.enforce_payment_bank_account()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_requires boolean;
begin
  select requires_bank_account into v_requires
  from public.payment_types
  where code = new.payment_method;

  if not v_requires and new.bank_account_id is not null then
    raise exception 'payment_method % must not have a bank_account_id', new.payment_method;
  end if;

  return new;
end;
$$;
