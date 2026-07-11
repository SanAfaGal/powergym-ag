-- supabase/tests/database/008_subscription_rpcs.test.sql
--
-- NOTE: every pgTAP assertion below passes an explicit description as the
-- final argument (see 003_clients.test.sql for the full explanation of why
-- this is required with pgtap 1.3.3 installed in this project).
--
-- NOTE: the brief's literal SQL put the throws_ok "refuses a second active
-- subscription" check LAST, after cancel_subscription had already run.
-- cancel_subscription never leaves the client with an 'active' row again
-- (the cascade only promotes a due 'scheduled' sibling to 'pending_payment',
-- never to 'active'), so by the time that throws_ok ran, the client had NO
-- active subscription and create_subscription would have succeeded instead
-- of raising P0001 -- the assertion would fail for a reason unrelated to
-- what it claims to test. Moved it to immediately after record_payment
-- activates the subscription (assertion 5 below), which is the earliest
-- point at which the guard is genuinely exercised, and where it remains
-- true up through renew_subscription (renew never changes the OLD row's
-- status). This is a pure reordering; no assertion was added or removed.
--
-- NOTE (post-review): two negative-case assertions were added after initial
-- review of this file, on top of the original 8: (1) confirming the
-- future-dated 'scheduled' row from renew_subscription is left untouched
-- ('scheduled') by cancel_subscription's cascade -- without this, a cascade
-- bug that promoted every 'scheduled' sibling regardless of start_date would
-- still pass the original suite, since only the due row's outcome was
-- checked; and (2) confirming a partial payment (amount < final_price) does
-- NOT activate a 'pending_payment' subscription, reusing the already-due
-- row from the cascade as its target. plan(8) was bumped to plan(10)
-- accordingly.
--
-- NOTE: the brief's literal SQL for the cascade-promotion check relied on
-- renew_subscription's own output row to later be "due" for
-- cancel_subscription's cascade. That is structurally impossible within a
-- single pgTAP transaction: renew_subscription sets the new row's status to
-- 'scheduled' only when new_start > current_date, and the cascade only
-- promotes rows where start_date <= current_date -- the same current_date,
-- evaluated moments apart with no calendar day passing in between. So the
-- renewal row can never satisfy both "scheduled at creation" and "due at
-- cancellation" in the same test run; cancel_subscription's cascade would
-- never fire, and the closing `order by start_date desc limit 1` query
-- would instead resolve to the renewal row (the only non-canceled one),
-- which stays 'scheduled', not 'pending_payment' -- so the assertion would
-- fail. Fixed by inserting a second, already-due 'scheduled' sibling
-- directly (simulating a scheduled renewal whose start date has already
-- arrived, e.g. because a nightly promotion job hasn't run yet -- a
-- realistic state cancel_subscription's cascade is meant to handle), and by
-- asserting on that specific row (matched by its distinctive start_date)
-- instead of "whichever non-canceled row sorts last", which would
-- otherwise resolve to the untouched future-dated renewal and defeat the
-- point of the check. This also makes the test strictly stronger: it now
-- proves the cascade is gated by "due" (start_date <= current_date) rather
-- than blindly promoting every 'scheduled' sibling, since the future-dated
-- renewal from renew_subscription coexists and must NOT be promoted.
begin;
select plan(10);

-- NOTE: the brief's literal SQL authenticated as a plain staff user before
-- inserting the 'RPC Plan' plan row. public.plans' insert policy (migration
-- 0007) requires public.is_active_admin(), not just is_active_staff(), so
-- that insert would fail RLS ("new row violates row-level security policy
-- for table plans") once RLS is actually being enforced (unlike a
-- non-authenticated psql superuser session, which bypasses RLS entirely).
-- Promoted the test user to 'admin' before authenticating, following the
-- same tests.create_supabase_user + direct `update public.profiles`
-- pattern already used in 007_rls_policies.test.sql -- the profiles update
-- runs while still connected as the superuser session, before
-- tests.authenticate_as() switches to the `authenticated` role.
select tests.create_supabase_user('staff1@example.test', 'staff1@example.test');
update public.profiles set role = 'admin' where id = tests.get_supabase_uid('staff1@example.test');
select tests.authenticate_as('staff1@example.test');

select is(
  public.calculate_end_date('2026-01-15'::date, 'month', 1),
  '2026-02-15'::date,
  'calculate_end_date adds one month'
);
select is(
  public.calculate_end_date('2026-01-15'::date, 'day', 10),
  '2026-01-25'::date,
  'calculate_end_date adds ten days'
);

insert into public.clients (dni_type, dni_number, first_name, last_name)
values ('CC', 'RPC-CLIENT-1', 'Rpc', 'Client');
insert into public.plans (name, price, duration_unit, duration_count)
values ('RPC Plan', 100000, 'month', 1);

select is(
  (select status from public.create_subscription(
    (select id from public.clients where dni_number = 'RPC-CLIENT-1'),
    (select id from public.plans where name = 'RPC Plan'),
    current_date,
    0
  )),
  'pending_payment'::subscription_status_enum,
  'create_subscription with start_date=today yields pending_payment'
);

-- NOTE: the brief's literal SQL called record_payment(...) and joined its
-- returned row against `public.subscriptions s` for the status check inside
-- the SAME top-level statement. That cannot work: a single Postgres command
-- runs on one fixed snapshot, so the `s` table scan does not see the
-- subscriptions UPDATE that record_payment performs internally moments
-- earlier in that very statement -- confirmed empirically (it deterministically
-- read back the pre-payment 'pending_payment' status, not 'active', even
-- though the migration's activation logic is correct and a follow-up SELECT
-- in a new statement does see 'active'). Split into two top-level
-- statements: the payment call runs to completion as its own command, then
-- a fresh SELECT in the next command observes its committed effect.
select public.record_payment(
  (select id from public.subscriptions
     where client_id = (select id from public.clients where dni_number = 'RPC-CLIENT-1')),
  100000,
  'cash',
  'full payment'
);

select is(
  (select status from public.subscriptions
     where client_id = (select id from public.clients where dni_number = 'RPC-CLIENT-1')),
  'active'::subscription_status_enum,
  'record_payment activates the subscription once fully paid'
);

-- the client now has exactly one active subscription; a second one must be refused
select throws_ok(
  $$ select public.create_subscription(
       (select id from public.clients where dni_number = 'RPC-CLIENT-1'),
       (select id from public.plans where name = 'RPC Plan'),
       current_date, 0
     ) $$,
  'P0001',
  null,
  'create_subscription refuses a second active subscription for a client that already has one'
);

-- renew_subscription creates a new row starting the day after the old end_date
select is(
  (select start_date from public.renew_subscription(
    (select id from public.subscriptions
       where client_id = (select id from public.clients where dni_number = 'RPC-CLIENT-1')
       and status = 'active')
  )),
  (select end_date + 1 from public.subscriptions
     where client_id = (select id from public.clients where dni_number = 'RPC-CLIENT-1')
     and status = 'active'),
  'renew_subscription starts the day after the previous end_date'
);

-- simulate a scheduled renewal whose start date has already arrived (setup only, not an assertion)
insert into public.subscriptions (
  client_id, plan_id, start_date, end_date, status, base_price, discount_percentage, created_by
) values (
  (select id from public.clients where dni_number = 'RPC-CLIENT-1'),
  (select id from public.plans where name = 'RPC Plan'),
  current_date - 1,
  current_date + 29,
  'scheduled',
  100000,
  0,
  auth.uid()
);

-- cancel_subscription cascades a scheduled renewal to pending_payment when due
select is(
  (select status from public.cancel_subscription(
    (select id from public.subscriptions
       where client_id = (select id from public.clients where dni_number = 'RPC-CLIENT-1')
       and status = 'active'),
    'test cancellation'
  )),
  'canceled'::subscription_status_enum,
  'cancel_subscription cancels the active subscription'
);

select is(
  (select status from public.subscriptions
     where client_id = (select id from public.clients where dni_number = 'RPC-CLIENT-1')
     and start_date = current_date - 1),
  'pending_payment'::subscription_status_enum,
  'cancel_subscription promotes the due scheduled renewal to pending_payment'
);

-- selectivity: the future-dated renew_subscription row must NOT be swept up
-- by the cascade just because it also has status = 'scheduled'
select is(
  (select status from public.subscriptions
     where client_id = (select id from public.clients where dni_number = 'RPC-CLIENT-1')
     and start_date > current_date),
  'scheduled'::subscription_status_enum,
  'cancel_subscription cascade leaves a not-yet-due scheduled renewal untouched'
);

-- a partial payment must not activate the subscription; reuses the row the
-- cascade just promoted to pending_payment as its target
select public.record_payment(
  (select id from public.subscriptions
     where client_id = (select id from public.clients where dni_number = 'RPC-CLIENT-1')
     and start_date = current_date - 1),
  50000,
  'cash',
  'partial payment'
);

select is(
  (select status from public.subscriptions
     where client_id = (select id from public.clients where dni_number = 'RPC-CLIENT-1')
     and start_date = current_date - 1),
  'pending_payment'::subscription_status_enum,
  'record_payment does not activate a subscription when amount paid is less than final_price'
);

select * from finish();
rollback;
