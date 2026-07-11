-- supabase/migrations/00000000000004_plans.sql
create table public.plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  description text,
  price numeric(10,2) not null check (price >= 0),
  currency char(3) not null default 'COP',
  duration_unit duration_type_enum not null,
  duration_count integer not null check (duration_count > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger plans_set_updated_at
  before update on public.plans
  for each row execute function public.set_updated_at();

alter table public.plans enable row level security;
