-- supabase/migrations/00000000000006_payments.sql
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions(id) on delete cascade,
  amount numeric(10,2) not null check (amount > 0),
  payment_method payment_method_enum not null,
  payment_date timestamptz not null default now(),
  received_by uuid references public.profiles(id),
  notes text,
  created_at timestamptz not null default now()
);

create index payments_subscription_idx on public.payments (subscription_id);
create index payments_date_idx on public.payments (payment_date);

alter table public.payments enable row level security;
