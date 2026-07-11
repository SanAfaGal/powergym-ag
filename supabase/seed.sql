-- supabase/seed.sql
-- Local-only seed data. Never run against staging/production (supabase db reset is local-only).

insert into auth.users (id, email, encrypted_password, email_confirmed_at, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-000000000001', 'admin@powergym.local', crypt('devpassword123', gen_salt('bf')), now(), '{"full_name": "Admin Seed", "role": "admin"}'),
  ('00000000-0000-0000-0000-000000000002', 'employee@powergym.local', crypt('devpassword123', gen_salt('bf')), now(), '{"full_name": "Employee Seed", "role": "employee"}')
on conflict (id) do nothing;

insert into public.plans (id, name, duration_unit, duration_count)
values
  ('10000000-0000-0000-0000-000000000001', 'Plan Mensual', 'month', 1),
  ('10000000-0000-0000-0000-000000000002', 'Plan Trimestral', 'month', 3)
on conflict (id) do nothing;

insert into public.plan_prices (plan_id, price)
values
  ('10000000-0000-0000-0000-000000000001', 100000),
  ('10000000-0000-0000-0000-000000000002', 270000)
on conflict do nothing;

insert into public.clients (id, dni_type, dni_number, first_name, last_name, phone)
values
  ('20000000-0000-0000-0000-000000000001', 'CC', '1000000001', 'Juan', 'Perez', '3001234567'),
  ('20000000-0000-0000-0000-000000000002', 'CC', '1000000002', 'Maria', 'Gomez', null)
on conflict (id) do nothing;

insert into public.subscriptions (id, client_id, plan_id, start_date, end_date, status, base_price)
values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', current_date - 10, current_date + 20, 'active', 100000)
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
