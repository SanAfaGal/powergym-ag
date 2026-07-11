-- supabase/tests/database/001_enums.test.sql
-- NOTE: document_type_enum, gender_type_enum, subscription_status_enum and
-- payment_method_enum were converted to catalog tables (document_types,
-- gender_types, subscription_statuses, payment_types) in migration 0012 --
-- see 012_catalog_tables_and_bank_accounts.test.sql for their coverage.
-- app_role and duration_type_enum stayed as enums (see 0012's header note
-- for why) and are still asserted here.
begin;
select plan(5);

select has_extension('pgcrypto');
select has_extension('pg_trgm');
select has_extension('pg_cron');

select ok(
  (select enum_range(null::app_role)::text = '{admin,employee}'),
  'app_role has expected values'
);
select ok(
  (select enum_range(null::duration_type_enum)::text = '{day,week,month,year}'),
  'duration_type_enum has expected values'
);

select * from finish();
rollback;
