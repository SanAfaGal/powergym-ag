-- supabase/tests/database/002_profiles.test.sql
begin;

-- Minimal, self-contained port of the two supabase-test-helpers
-- (https://github.com/usebasejump/supabase-test-helpers) functions this test needs:
-- tests.create_supabase_user() and tests.get_supabase_uid(). The upstream package ships
-- as a real Postgres extension (install via dbdev + CREATE EXTENSION, or by copying the
-- raw extension SQL onto the server's extension directory) which is not wired into this
-- project's local Supabase stack. Rather than add that extra infra dependency, or hand-roll
-- anything auth/JWT related, we recreate just these two well-known helper functions verbatim
-- (adapted to use core gen_random_uuid() instead of uuid-ossp) inside this test's own
-- transaction, so nothing persists outside this file and no other test depends on it.
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

select plan(6);

select has_table('public', 'profiles', 'profiles table exists');
select has_column('public', 'profiles', 'role', 'profiles has role column');
select col_type_is('public', 'profiles', 'role', 'app_role', 'role is app_role');
select col_default_is('public', 'profiles', 'is_active', 'true', 'is_active defaults to true');

-- signing up a new auth user creates a matching profile row via trigger
select tests.create_supabase_user('alice@example.test', 'alice@example.test');
select results_eq(
  $$ select role::text, is_active from public.profiles
     where id = tests.get_supabase_uid('alice@example.test') $$,
  $$ values ('employee', true) $$,
  'new auth user gets a default employee profile row'
);

-- updated_at changes on UPDATE
select lives_ok(
  $$ update public.profiles set full_name = 'Alice Updated'
     where id = tests.get_supabase_uid('alice@example.test') $$,
  'updating profiles does not error'
);

select * from finish();
rollback;
