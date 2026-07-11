-- supabase/tests/database/012_catalog_tables_and_bank_accounts.test.sql
--
-- Covers migration 0012: document_types/gender_types/subscription_statuses/
-- payment_types/banks/bank_account_types are seeded catalog tables now
-- (replacing the four dropped enums), bank_accounts + payments.bank_account_id
-- track payment destination, and the enforce_payment_bank_account trigger
-- keeps payment_type and bank_account_id consistent. Every assertion passes
-- an explicit description (see 003_clients.test.sql for why that matters
-- with pgtap 1.3.3 installed in this project).
begin;
select plan(14);

-- ------------------------------------------------------------
-- Catalog tables seeded with the same values the dropped enums had
-- ------------------------------------------------------------
select is((select count(*)::int from public.document_types), 4, 'document_types seeded with CC/TI/CE/PP');
select is((select count(*)::int from public.gender_types), 3, 'gender_types seeded with male/female/other');
select is((select count(*)::int from public.subscription_statuses), 5, 'subscription_statuses seeded with the 5 original statuses');
select is((select count(*)::int from public.payment_types), 3, 'payment_types seeded with cash/qr/transfer');
select is((select count(*)::int from public.banks), 1, 'banks seeded with BANCOLOMBIA');
select is((select count(*)::int from public.bank_account_types), 2, 'bank_account_types seeded with savings/checking');

-- ------------------------------------------------------------
-- Old enum-style validation now enforced via FK instead of a fixed type
-- ------------------------------------------------------------
select throws_ok(
  $$ insert into public.clients (dni_type, dni_number, first_name, last_name)
     values ('XX', 'CATALOG-CLIENT-1', 'Bad', 'DocType') $$,
  '23503',
  null,
  'an unknown dni_type code is rejected by the document_types FK'
);

-- ------------------------------------------------------------
-- enforce_payment_bank_account trigger: payment_type.requires_bank_account
-- must match whether bank_account_id is set, in either direction.
-- ------------------------------------------------------------
insert into public.clients (dni_type, dni_number, first_name, last_name)
values ('CC', 'CATALOG-CLIENT-2', 'Trigger', 'Client');
select tests.create_plan('Catalog Plan', 100000, 'month', 1);
insert into public.subscriptions (client_id, plan_id, start_date, end_date, status, base_price)
values (
  (select id from public.clients where dni_number = 'CATALOG-CLIENT-2'),
  (select id from public.plans where name = 'Catalog Plan'),
  current_date, current_date + 30, 'pending_payment', 100000
);
insert into public.bank_accounts (bank_code, account_type_code, account_number, account_holder_name)
values ('BANCOLOMBIA', 'savings', 'TRIGGER-TEST-ACCT', 'Test Holder');

select throws_ok(
  $$ insert into public.payments (subscription_id, amount, payment_method, bank_account_id)
     values (
       (select id from public.subscriptions where client_id = (select id from public.clients where dni_number = 'CATALOG-CLIENT-2')),
       50000, 'cash',
       (select id from public.bank_accounts where account_number = 'TRIGGER-TEST-ACCT')
     ) $$,
  'P0001',
  null,
  'cash payment with a bank_account_id is rejected (cash.requires_bank_account = false)'
);
select throws_ok(
  $$ insert into public.payments (subscription_id, amount, payment_method)
     values (
       (select id from public.subscriptions where client_id = (select id from public.clients where dni_number = 'CATALOG-CLIENT-2')),
       50000, 'qr'
     ) $$,
  'P0001',
  null,
  'qr payment without a bank_account_id is rejected (qr.requires_bank_account = true)'
);
select lives_ok(
  $$ insert into public.payments (subscription_id, amount, payment_method)
     values (
       (select id from public.subscriptions where client_id = (select id from public.clients where dni_number = 'CATALOG-CLIENT-2')),
       50000, 'cash'
     ) $$,
  'cash payment without a bank_account_id succeeds'
);
select lives_ok(
  $$ insert into public.payments (subscription_id, amount, payment_method, bank_account_id)
     values (
       (select id from public.subscriptions where client_id = (select id from public.clients where dni_number = 'CATALOG-CLIENT-2')),
       50000, 'qr',
       (select id from public.bank_accounts where account_number = 'TRIGGER-TEST-ACCT')
     ) $$,
  'qr payment with a bank_account_id succeeds'
);

-- ------------------------------------------------------------
-- RLS: staff can read catalogs/bank_accounts, only admins can write them
-- ------------------------------------------------------------
select tests.create_supabase_user('catalog-admin@example.test', 'catalog-admin@example.test');
select tests.create_supabase_user('catalog-employee@example.test', 'catalog-employee@example.test');
update public.profiles set role = 'admin' where id = tests.get_supabase_uid('catalog-admin@example.test');

select tests.authenticate_as('catalog-employee@example.test');
select isnt_empty(
  $$ select * from public.payment_types $$,
  'staff can read payment_types'
);
select throws_ok(
  $$ insert into public.banks (code, name) values ('DAVIVIENDA', 'Davivienda') $$,
  '42501',
  null,
  'staff insert into banks is rejected by RLS'
);

select tests.authenticate_as('catalog-admin@example.test');
select lives_ok(
  $$ insert into public.banks (code, name) values ('DAVIVIENDA', 'Davivienda') $$,
  'admin insert into banks succeeds'
);

select * from finish();
rollback;
