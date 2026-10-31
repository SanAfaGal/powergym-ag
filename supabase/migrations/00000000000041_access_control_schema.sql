-- supabase/migrations/00000000000041_access_control_schema.sql
--
-- Schema for the facial access-control prototype. Biometric data is
-- sensitive (Ley 1581 de 2012), so the two tables that hold it --
-- biometric_consents and face_templates -- get RLS enabled with NO policies
-- and NO grants to `authenticated`: only the SECURITY DEFINER RPCs added in
-- later migrations (0043+), which carry their own role guards, may read or
-- write them. access_events is readable by staff but written only by
-- register_access_attempt (migration 0044), never directly.
--
-- Embeddings live in `extensions` (Supabase's default extension schema, on
-- the search_path via config.toml's extra_search_path). No vector index on
-- purpose: at gym scale (thousands of rows) an exact scan is fast, and an
-- HNSW index would only cost memory.

create extension if not exists vector with schema extensions;

create table public.biometric_consents (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  purpose text not null default 'access_control',
  consent_text_version text not null,
  granted_at timestamptz not null default now(),
  granted_by uuid references public.profiles (id),
  revoked_at timestamptz,
  revoked_by uuid references public.profiles (id)
);

-- at most one live consent per client
create unique index biometric_consents_one_live_per_client
  on public.biometric_consents (client_id)
  where revoked_at is null;

create table public.face_templates (
  client_id uuid primary key references public.clients (id) on delete cascade,
  embedding extensions.vector(512) not null,
  model_id text not null,
  model_version text not null,
  quality_score real,
  consent_id uuid not null references public.biometric_consents (id),
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

-- Holds only the outcome of an attempt, never an embedding or an image.
create table public.access_events (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  client_id uuid references public.clients (id) on delete set null,
  decision text not null check (decision in ('granted', 'denied')),
  reason_code text not null,
  method text not null default 'face_webcam',
  match_score real,
  threshold_used real,
  liveness_passed boolean,
  device_label text,
  user_agent text,
  operator_id uuid references public.profiles (id),
  model_version text
);

create index access_events_occurred_at_idx on public.access_events (occurred_at desc);
create index access_events_client_idx on public.access_events (client_id);

-- Single-row settings table: `id boolean primary key check (id)` allows
-- exactly one row (true).
create table public.access_settings (
  id boolean primary key default true check (id),
  match_threshold real not null default 0.5 check (match_threshold between 0 and 1),
  liveness_required boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into public.access_settings (id) values (true);

alter table public.biometric_consents enable row level security;
alter table public.face_templates enable row level security;
alter table public.access_events enable row level security;
alter table public.access_settings enable row level security;

grant select on public.access_events to authenticated;
grant select on public.access_settings to authenticated;

create policy access_events_select on public.access_events
  for select to authenticated
  using (public.is_active_staff());

create policy access_settings_select on public.access_settings
  for select to authenticated
  using (public.is_active_staff());
