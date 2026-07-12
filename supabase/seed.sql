-- supabase/seed.sql
-- Local-only seed data. Never run against staging/production (supabase db reset is local-only).

-- NOTE: role must be set via raw_app_meta_data, not raw_user_meta_data --
-- handle_new_user() (migration 0011) only reads the former, since the
-- latter is client-writable (privilege-escalation hardening).
--
-- NOTE: instance_id/aud/role are required for GoTrue's password grant to
-- accept these rows -- without them it returns a generic "Invalid login
-- credentials" (indistinguishable from a wrong password) even though the
-- bcrypt hash matches. instance_id is GoTrue's well-known all-zero UUID.
-- The token columns must be '' rather than NULL -- GoTrue's Go client
-- scans them into plain strings and errors ("converting NULL to string is
-- unsupported") on a NULL, which surfaces as a 500 on every login attempt,
-- not just these seeded users'.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_user_meta_data, raw_app_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  email_change_token_current, phone_change, phone_change_token, reauthentication_token
)
values
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'admin@powergym.local', crypt('devpassword123', gen_salt('bf')), now(), '{"full_name": "Admin Seed"}', '{"role": "admin"}', now(), now(), '', '', '', '', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'employee@powergym.local', crypt('devpassword123', gen_salt('bf')), now(), '{"full_name": "Employee Seed"}', '{"role": "employee"}', now(), now(), '', '', '', '', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'inactive@powergym.local', crypt('devpassword123', gen_salt('bf')), now(), '{"full_name": "Inactive Seed"}', '{"role": "employee"}', now(), now(), '', '', '', '', '', '', '', '')
on conflict (id) do nothing;

-- deactivated staff account, used by the login e2e test to confirm a
-- deactivated user is signed out and blocked rather than let through with
-- silently empty RLS results
update public.profiles set is_active = false
where id = '00000000-0000-0000-0000-000000000003';

insert into public.plans (id, name, duration_unit, duration_count)
values
  ('10000000-0000-0000-0000-000000000001', 'Plan Mensual', 'month', 1),
  ('10000000-0000-0000-0000-000000000002', 'Plan Trimestral', 'month', 3)
on conflict (id) do nothing;

-- valid_from is explicit (rather than relying on the column's
-- `default current_date`) because that default resolves against the DB
-- session's timezone (UTC), not the app's America/Bogota "business today"
-- (today_bogota(), migration 00000000000011). Near/after 19:00 Bogota
-- time, UTC's current_date has already rolled to tomorrow, which would
-- leave these prices not yet effective for a subscription started "today"
-- in Bogota and create_subscription would fail with "plan % has no price
-- effective on %".
insert into public.plan_prices (plan_id, price, valid_from)
values
  ('10000000-0000-0000-0000-000000000001', 100000, '2020-01-01'),
  ('10000000-0000-0000-0000-000000000002', 270000, '2020-01-01')
on conflict do nothing;

insert into public.clients (id, dni_type, dni_number, first_name, last_name, phone)
values
  ('20000000-0000-0000-0000-000000000001', 'CC', '1000000001', 'Juan', 'Perez', '3001234567'),
  ('20000000-0000-0000-0000-000000000002', 'CC', '1000000002', 'Maria', 'Gomez', null),
  -- Used by the dashboard e2e test: an active subscription that's both a
  -- debtor (partial payment below leaves a positive balance) and expiring
  -- soon (end_date within the dashboard's 7-day window), so the dashboard's
  -- debtors/expiring-soon lists have a row to assert on instead of only
  -- ever exercising their empty states.
  ('20000000-0000-0000-0000-000000000003', 'CC', '1000000003', 'Carlos', 'Ramirez', null)
on conflict (id) do nothing;

insert into public.subscriptions (id, client_id, plan_id, start_date, end_date, status, base_price)
values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', current_date - 10, current_date + 20, 'active', 100000),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', current_date - 20, current_date + 5, 'active', 100000)
on conflict (id) do nothing;

insert into public.bank_accounts (id, bank_code, account_type_code, account_number, account_holder_name, transfer_key)
values
  ('40000000-0000-0000-0000-000000000001', 'BANCOLOMBIA', 'savings', '21800002796', 'PowerGym AG', '@powergym')
on conflict (id) do nothing;

insert into public.payments (subscription_id, amount, payment_method)
values
  ('30000000-0000-0000-0000-000000000001', 60000, 'cash')
on conflict do nothing;

insert into public.payments (subscription_id, amount, payment_method, bank_account_id)
values
  ('30000000-0000-0000-0000-000000000001', 40000, 'qr', '40000000-0000-0000-0000-000000000001')
on conflict do nothing;

-- Partial payment on Carlos Ramirez's subscription -- final_price (100000)
-- minus this leaves a 50000 balance, making it a debtor row too.
insert into public.payments (subscription_id, amount, payment_method)
values
  ('30000000-0000-0000-0000-000000000002', 50000, 'cash')
on conflict do nothing;
