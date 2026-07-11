-- supabase/tests/database/007_rls_policies.test.sql
begin;
select plan(6);

select tests.create_supabase_user('admin@example.test', 'admin@example.test');
select tests.create_supabase_user('employee@example.test', 'employee@example.test');
update public.profiles set role = 'admin' where id = tests.get_supabase_uid('admin@example.test');

insert into public.plans (name, price, duration_unit, duration_count)
values ('RLS Test Plan', 50000, 'month', 1);

-- employee can read plans
select tests.authenticate_as('employee@example.test');
select isnt_empty(
  $$ select * from public.plans where name = 'RLS Test Plan' $$,
  'employee can read plans'
);

-- employee cannot insert plans
select throws_ok(
  $$ insert into public.plans (name, price, duration_unit, duration_count)
     values ('Employee Plan', 10000, 'month', 1) $$,
  '42501',
  null,
  'employee insert into plans is rejected by RLS'
);

-- admin can insert plans
select tests.authenticate_as('admin@example.test');
select lives_ok(
  $$ insert into public.plans (name, price, duration_unit, duration_count)
     values ('Admin Plan', 10000, 'month', 1) $$,
  'admin insert into plans succeeds'
);

-- employee can read/write clients
select tests.authenticate_as('employee@example.test');
select lives_ok(
  $$ insert into public.clients (dni_type, dni_number, first_name, last_name)
     values ('CC', 'RLS-CLIENT-1', 'RLS', 'Client') $$,
  'employee insert into clients succeeds'
);

-- profiles: employee can only see their own row, not admin's
select is(
  (select count(*)::int from public.profiles),
  1,
  'employee sees only their own profiles row'
);

select tests.authenticate_as('admin@example.test');
select ok(
  (select count(*)::int from public.profiles) >= 2,
  'admin sees all profiles rows'
);

select * from finish();
rollback;
