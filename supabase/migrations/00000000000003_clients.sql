-- supabase/migrations/00000000000003_clients.sql
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  dni_type document_type_enum not null,
  dni_number text not null unique,
  first_name text not null,
  middle_name text,
  last_name text not null,
  second_last_name text,
  phone text,
  alternative_phone text,
  birth_date date,
  gender gender_type_enum,
  address text,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index clients_name_trgm_idx
  on public.clients using gin ((first_name || ' ' || last_name) gin_trgm_ops);
create index clients_dni_trgm_idx
  on public.clients using gin (dni_number gin_trgm_ops);

create trigger clients_set_updated_at
  before update on public.clients
  for each row execute function public.set_updated_at();

alter table public.clients enable row level security;
