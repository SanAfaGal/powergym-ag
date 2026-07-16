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
  ('30000000-0000-0000-0000-000000000001', 40000, 'bank', '40000000-0000-0000-0000-000000000001')
on conflict do nothing;

-- Partial payment on Carlos Ramirez's subscription -- final_price (100000)
-- minus this leaves a 50000 balance, making it a debtor row too.
insert into public.payments (subscription_id, amount, payment_method)
values
  ('30000000-0000-0000-0000-000000000002', 50000, 'cash')
on conflict do nothing;

-- Additional seed data for local visual/manual testing of the unified
-- /clients list (indicators, filters, sort, days-remaining, pagination at
-- PAGE_SIZE = 20). Spans every subscription status, a range of
-- days_remaining (including negative/overdue), paid/partial/unpaid
-- balances, both seeded plans, an inactive client, and clients with no
-- subscription at all.

insert into public.clients (id, dni_type, dni_number, first_name, last_name, phone, alias, email)
values
  ('20000000-0000-0000-0000-000000000004', 'CC', '1000000004', 'Ana', 'Torres', '3001111004', null, 'ana.torres@example.test'),
  ('20000000-0000-0000-0000-000000000005', 'CC', '1000000005', 'Luis', 'Rodriguez', '3001111005', null, null),
  ('20000000-0000-0000-0000-000000000006', 'CC', '1000000006', 'Sofia', 'Martinez', '3001111006', 'Sofi', null),
  ('20000000-0000-0000-0000-000000000007', 'CC', '1000000007', 'Diego', 'Castro', '3001111007', null, null),
  ('20000000-0000-0000-0000-000000000008', 'CC', '1000000008', 'Valentina', 'Ruiz', '3001111008', null, null),
  ('20000000-0000-0000-0000-000000000009', 'CC', '1000000009', 'Andres', 'Lopez', '3001111009', null, null),
  ('20000000-0000-0000-0000-000000000010', 'CC', '1000000010', 'Camila', 'Herrera', '3001111010', null, null),
  ('20000000-0000-0000-0000-000000000011', 'CC', '1000000011', 'Santiago', 'Vargas', '3001111011', null, null),
  ('20000000-0000-0000-0000-000000000012', 'CC', '1000000012', 'Isabella', 'Morales', '3001111012', null, null),
  ('20000000-0000-0000-0000-000000000013', 'CC', '1000000013', 'Mateo', 'Jimenez', '3001111013', null, null),
  ('20000000-0000-0000-0000-000000000014', 'CC', '1000000014', 'Valeria', 'Ortiz', '3001111014', null, null),
  ('20000000-0000-0000-0000-000000000015', 'CC', '1000000015', 'Sebastian', 'Diaz', '3001111015', null, null),
  ('20000000-0000-0000-0000-000000000016', 'CC', '1000000016', 'Gabriela', 'Reyes', '3001111016', null, null),
  ('20000000-0000-0000-0000-000000000017', 'CC', '1000000017', 'Nicolas', 'Silva', '3001111017', null, null),
  ('20000000-0000-0000-0000-000000000018', 'CC', '1000000018', 'Daniela', 'Cruz', '3001111018', null, null),
  ('20000000-0000-0000-0000-000000000019', 'CC', '1000000019', 'Alejandro', 'Mendez', '3001111019', null, null),
  ('20000000-0000-0000-0000-000000000020', 'CC', '1000000020', 'Paula', 'Rojas', '3001111020', null, null),
  ('20000000-0000-0000-0000-000000000021', 'CC', '1000000021', 'Javier', 'Nunez', '3001111021', null, null),
  ('20000000-0000-0000-0000-000000000022', 'CC', '1000000022', 'Camilo', 'Pena', '3001111022', null, null),
  ('20000000-0000-0000-0000-000000000023', 'CC', '1000000023', 'Laura', 'Gutierrez', '3001111023', null, null)
on conflict (id) do nothing;

-- Laura Gutierrez (23) is an inactive client -- exercises the client
-- active/inactive filter alongside an expired subscription.
update public.clients set is_active = false
where id = '20000000-0000-0000-0000-000000000023';

-- Valeria Ortiz (14) and Sebastian Diaz (15) intentionally get no
-- subscription row at all -- exercises "Sin suscripción" everywhere.

insert into public.subscriptions (id, client_id, plan_id, start_date, end_date, status, base_price)
values
  ('30000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', current_date - 5,  current_date + 25, 'active', 100000),
  ('30000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000001', current_date - 28, current_date + 2,  'active', 100000),
  ('30000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000002', current_date - 45, current_date + 45, 'active', 270000),
  ('30000000-0000-0000-0000-000000000007', '20000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000001', current_date,       current_date + 30, 'pending_payment', 100000),
  ('30000000-0000-0000-0000-000000000008', '20000000-0000-0000-0000-000000000008', '10000000-0000-0000-0000-000000000001', current_date + 5,   current_date + 35, 'scheduled', 100000),
  ('30000000-0000-0000-0000-000000000009', '20000000-0000-0000-0000-000000000009', '10000000-0000-0000-0000-000000000001', current_date - 40, current_date - 10, 'expired', 100000),
  ('30000000-0000-0000-0000-000000000010', '20000000-0000-0000-0000-000000000010', '10000000-0000-0000-0000-000000000001', current_date - 70, current_date - 40, 'expired', 100000),
  ('30000000-0000-0000-0000-000000000011', '20000000-0000-0000-0000-000000000011', '10000000-0000-0000-0000-000000000001', current_date - 20, current_date + 10, 'canceled', 100000),
  ('30000000-0000-0000-0000-000000000012', '20000000-0000-0000-0000-000000000012', '10000000-0000-0000-0000-000000000001', current_date - 29, current_date + 1,  'active', 100000),
  ('30000000-0000-0000-0000-000000000013', '20000000-0000-0000-0000-000000000013', '10000000-0000-0000-0000-000000000002', current_date - 30, current_date + 60, 'active', 270000),
  ('30000000-0000-0000-0000-000000000016', '20000000-0000-0000-0000-000000000016', '10000000-0000-0000-0000-000000000001', current_date - 15, current_date + 15, 'active', 100000),
  ('30000000-0000-0000-0000-000000000017', '20000000-0000-0000-0000-000000000017', '10000000-0000-0000-0000-000000000001', current_date,       current_date + 30, 'pending_payment', 100000),
  ('30000000-0000-0000-0000-000000000018', '20000000-0000-0000-0000-000000000018', '10000000-0000-0000-0000-000000000001', current_date - 33, current_date - 3,  'expired', 100000),
  ('30000000-0000-0000-0000-000000000019', '20000000-0000-0000-0000-000000000019', '10000000-0000-0000-0000-000000000001', current_date - 23, current_date + 7,  'active', 100000),
  ('30000000-0000-0000-0000-000000000020', '20000000-0000-0000-0000-000000000020', '10000000-0000-0000-0000-000000000001', current_date - 15, current_date + 15, 'canceled', 100000),
  ('30000000-0000-0000-0000-000000000021', '20000000-0000-0000-0000-000000000021', '10000000-0000-0000-0000-000000000002', current_date - 10, current_date + 80, 'active', 270000),
  ('30000000-0000-0000-0000-000000000022', '20000000-0000-0000-0000-000000000022', '10000000-0000-0000-0000-000000000001', current_date + 10, current_date + 40, 'scheduled', 100000),
  ('30000000-0000-0000-0000-000000000023', '20000000-0000-0000-0000-000000000023', '10000000-0000-0000-0000-000000000001', current_date - 60, current_date - 30, 'expired', 100000)
on conflict (id) do nothing;

insert into public.payments (subscription_id, amount, payment_method)
values
  ('30000000-0000-0000-0000-000000000004', 100000, 'cash'), -- Ana: fully paid
  ('30000000-0000-0000-0000-000000000005', 60000,  'cash'), -- Luis: partial, owes 40000, expiring in 2 days
  ('30000000-0000-0000-0000-000000000006', 270000, 'cash'), -- Sofia: fully paid
  -- Diego (7, pending_payment) and Valentina (8, scheduled): unpaid, no rows
  ('30000000-0000-0000-0000-000000000009', 30000,  'cash'), -- Andres: expired, still owes 70000
  ('30000000-0000-0000-0000-000000000010', 100000, 'cash'), -- Camila: expired, fully paid
  ('30000000-0000-0000-0000-000000000011', 40000,  'cash'), -- Santiago: canceled, partial
  -- Isabella (12, active, 1 day left): unpaid, urgent debtor, no rows
  ('30000000-0000-0000-0000-000000000013', 270000, 'cash'), -- Mateo: fully paid
  ('30000000-0000-0000-0000-000000000016', 50000,  'cash'), -- Gabriela: partial
  -- Nicolas (17, pending_payment): unpaid, no rows
  -- Daniela (18, expired 3 days ago): unpaid, big debtor, no rows
  ('30000000-0000-0000-0000-000000000019', 100000, 'cash'), -- Alejandro: fully paid, expires in exactly 7 days
  -- Paula (20, canceled): no payments
  ('30000000-0000-0000-0000-000000000021', 150000, 'cash'), -- Javier: partial, owes 120000
  -- Camilo (22, scheduled): unpaid, no rows
  ('30000000-0000-0000-0000-000000000023', 20000,  'cash')  -- Laura: inactive client, expired, partial
on conflict do nothing;
