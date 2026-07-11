-- supabase/tests/database/001_enums.test.sql
begin;
select plan(7);

select has_extension('pgcrypto');
select has_extension('pg_trgm');
select has_extension('pg_cron');

select enum_range(null::app_role) = '{admin,employee}'::app_role[] as ok
  from (select 1) t;
select ok(
  (select enum_range(null::app_role)::text = '{admin,employee}'),
  'app_role has expected values'
);
select ok(
  (select enum_range(null::document_type_enum)::text = '{CC,TI,CE,PP}'),
  'document_type_enum has expected values'
);
select ok(
  (select enum_range(null::subscription_status_enum)::text = '{active,expired,pending_payment,scheduled,canceled}'),
  'subscription_status_enum has expected values'
);
select ok(
  (select enum_range(null::payment_method_enum)::text = '{cash,qr}'),
  'payment_method_enum has expected values'
);

select * from finish();
rollback;
