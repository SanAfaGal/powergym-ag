-- supabase/migrations/00000000000007_rls_policies.sql
create or replace function public.is_active_staff()
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and is_active
  )
$$;

create or replace function public.is_active_admin()
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and is_active and role = 'admin'
  )
$$;

-- NOTE: RLS policies only restrict which rows are visible/writable within an
-- operation that the role is already permitted to perform; they do not grant
-- the operation itself. None of the earlier per-table migrations (0002-0006)
-- granted base DML privileges to `authenticated`, so without the GRANTs
-- below every query below would fail with "permission denied for table ..."
-- before RLS is ever evaluated. Grants are scoped to exactly the operations
-- each table has a policy for.
grant select on public.profiles to authenticated;
grant select, insert, update on public.clients to authenticated;
grant select, insert, update on public.plans to authenticated;
grant select, insert, update on public.subscriptions to authenticated;
grant select, insert on public.payments to authenticated;

-- profiles
create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = auth.uid());

create policy profiles_select_all_admin on public.profiles
  for select to authenticated
  using (public.is_active_admin());

-- clients
create policy clients_select on public.clients
  for select to authenticated
  using (public.is_active_staff());

create policy clients_insert on public.clients
  for insert to authenticated
  with check (public.is_active_staff());

create policy clients_update on public.clients
  for update to authenticated
  using (public.is_active_staff())
  with check (public.is_active_staff());

-- plans
create policy plans_select on public.plans
  for select to authenticated
  using (public.is_active_staff());

create policy plans_insert on public.plans
  for insert to authenticated
  with check (public.is_active_admin());

create policy plans_update on public.plans
  for update to authenticated
  using (public.is_active_admin())
  with check (public.is_active_admin());

-- subscriptions
create policy subscriptions_select on public.subscriptions
  for select to authenticated
  using (public.is_active_staff());

create policy subscriptions_insert on public.subscriptions
  for insert to authenticated
  with check (public.is_active_staff());

create policy subscriptions_update on public.subscriptions
  for update to authenticated
  using (public.is_active_staff())
  with check (public.is_active_staff());

-- payments
create policy payments_select on public.payments
  for select to authenticated
  using (public.is_active_staff());

create policy payments_insert on public.payments
  for insert to authenticated
  with check (public.is_active_staff());
