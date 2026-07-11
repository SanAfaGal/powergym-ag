-- Shared pgTAP test helpers (schema `tests`), persisted for the duration of one
-- `supabase test db` run so every NNN_*.test.sql file can call them without
-- redefining them. Not a real migration — lives only in supabase/tests/database/.

create schema if not exists tests;

create or replace function tests.create_supabase_user(
  identifier text, email text default null, phone text default null, metadata jsonb default null
)
returns uuid
security definer
set search_path = auth, pg_temp
language plpgsql
as $$
declare
  user_id uuid;
begin
  user_id := gen_random_uuid();
  insert into auth.users (id, email, phone, raw_user_meta_data, raw_app_meta_data, created_at, updated_at, aud, role)
  values (
    user_id,
    coalesce(email, concat(user_id, '@test.com')),
    phone,
    jsonb_build_object('test_identifier', identifier) || coalesce(metadata, '{}'::jsonb),
    '{}'::jsonb,
    now(), now(),
    'authenticated', 'authenticated'
  )
  returning id into user_id;
  return user_id;
end;
$$;

create or replace function tests.get_supabase_uid(identifier text)
returns uuid
security definer
set search_path = auth, pg_temp
language plpgsql
as $$
declare
  supabase_user uuid;
begin
  select id into supabase_user from auth.users where raw_user_meta_data ->> 'test_identifier' = identifier limit 1;
  if supabase_user is null then
    raise exception 'User with identifier % not found', identifier;
  end if;
  return supabase_user;
end;
$$;

create or replace function tests.authenticate_as(identifier text)
returns void
security definer
set search_path = auth, pg_temp
language plpgsql
as $$
declare
  user_id uuid;
  user_email text;
begin
  select id, email into user_id, user_email
  from auth.users
  where raw_user_meta_data ->> 'test_identifier' = identifier
  limit 1;

  if user_id is null then
    raise exception 'User with identifier % not found', identifier;
  end if;

  perform set_config('request.jwt.claims', json_build_object(
    'sub', user_id,
    'email', user_email,
    'role', 'authenticated'
  )::text, true);
  set local role authenticated;
end;
$$;

-- pg_prove requires every file it processes to emit a TAP plan, even a
-- setup-only file with no assertions of its own (see Supabase's documented
-- `000-setup-tests-hooks.sql` convention). This block just confirms the three
-- helper functions above were created successfully.
begin;
select plan(3);
select has_function('tests', 'create_supabase_user', 'tests.create_supabase_user() exists');
select has_function('tests', 'get_supabase_uid', 'tests.get_supabase_uid() exists');
select has_function('tests', 'authenticate_as', 'tests.authenticate_as() exists');
select * from finish();
rollback;
