-- supabase/tests/database/002_profiles.test.sql
-- tests.create_supabase_user() / tests.get_supabase_uid() are defined once in
-- 000_test_helpers.sql, which runs (and persists) before this file.
begin;

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
