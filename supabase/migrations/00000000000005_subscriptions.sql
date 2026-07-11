-- supabase/migrations/00000000000005_subscriptions.sql
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  plan_id uuid not null references public.plans(id) on delete restrict,
  start_date date not null,
  end_date date not null,
  status subscription_status_enum not null default 'pending_payment',
  base_price numeric(10,2) not null,
  discount_percentage numeric(5,2) check (discount_percentage between 0 and 100),
  final_price numeric(10,2) generated always as (
    round(base_price * (1 - coalesce(discount_percentage, 0) / 100), 2)
  ) stored,
  cancellation_date date,
  cancellation_reason text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date)
);

create unique index one_active_subscription_per_client
  on public.subscriptions (client_id)
  where (status = 'active');

create index subscriptions_status_end_date_idx
  on public.subscriptions (status, end_date);
create index subscriptions_client_idx
  on public.subscriptions (client_id);

create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

alter table public.subscriptions enable row level security;
