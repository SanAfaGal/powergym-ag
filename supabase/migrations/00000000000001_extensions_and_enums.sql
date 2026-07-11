-- supabase/migrations/00000000000001_extensions_and_enums.sql
create extension if not exists pgcrypto;
create extension if not exists pg_trgm;
create extension if not exists pg_cron;

create type app_role as enum ('admin', 'employee');
create type document_type_enum as enum ('CC', 'TI', 'CE', 'PP');
create type gender_type_enum as enum ('male', 'female', 'other');
create type duration_type_enum as enum ('day', 'week', 'month', 'year');
create type subscription_status_enum as enum ('active', 'expired', 'pending_payment', 'scheduled', 'canceled');
create type payment_method_enum as enum ('cash', 'qr');
