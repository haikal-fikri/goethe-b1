-- ============================================================
--  CI/lokaler SHADOW-Bootstrap — NICHT für Produktion.
--  Legt ein minimales Supabase-kompatibles auth/storage-Schema an,
--  damit 0005-0009 auf einer leeren Postgres-Instanz (ohne Supabase)
--  anwendbar sind und RLS wie live evaluiert. Auf echtem Supabase
--  existiert all das bereits — dort NICHT anwenden.
-- ============================================================
-- Minimal Supabase-compatible shim so the additive migrations 0005-0009 apply
-- and RLS evaluates the same way as on a real Supabase project.
-- Mirrors auth.uid()/auth.jwt(), auth.users, the anon/authenticated/service_role
-- roles, and a storage schema. NOT for production — local shadow validation only.

create extension if not exists "pgcrypto";

-- Roles PostgREST/Supabase expose ---------------------------------
do $$ begin create role anon          nologin noinherit; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated nologin noinherit; exception when duplicate_object then null; end $$;
do $$ begin create role service_role  nologin noinherit bypassrls; exception when duplicate_object then null; end $$;
do $$ begin create role authenticator noinherit login password 'authpw'; exception when duplicate_object then null; end $$;
grant anon, authenticated, service_role to authenticator;

-- auth schema + users + uid()/jwt() -------------------------------
create schema if not exists auth;

create table if not exists auth.users (
  id                 uuid primary key default gen_random_uuid(),
  email              text,
  aud                text default 'authenticated',
  role               text default 'authenticated',
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  raw_app_meta_data  jsonb not null default '{}'::jsonb,
  created_at         timestamptz not null default now()
);

-- Read identity from the request.jwt.claims GUC (what tests_as() sets).
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(
    coalesce(
      nullif(current_setting('request.jwt.claim.sub', true), ''),
      (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
    ), '')::uuid;
$$;

create or replace function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')
  )::jsonb;
$$;

create or replace function auth.role() returns text language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  );
$$;

-- storage schema (avatars bucket + object policies target these) --
create schema if not exists storage;
create table if not exists storage.buckets (
  id     text primary key,
  name   text not null,
  public boolean not null default false
);
create table if not exists storage.objects (
  id         uuid primary key default gen_random_uuid(),
  bucket_id  text references storage.buckets(id),
  name       text,
  owner      uuid,
  created_at timestamptz default now()
);
alter table storage.objects enable row level security;
create or replace function storage.foldername(name text) returns text[]
  language sql immutable as $$ select string_to_array(name, '/'); $$;
grant usage on schema storage to anon, authenticated, service_role;

-- Schema usage the migrations assume PostgREST already granted ----
grant usage on schema public to anon, authenticated, service_role;
grant usage on schema auth   to anon, authenticated, service_role;
-- Supabase-Modell: breit granten, mit RLS gaten. ALL auf künftige public-Tabellen
-- (die Migrationen widerrufen dann gezielt, z.B. auf den Fortschrittstabellen).
alter default privileges in schema public grant all on tables    to anon, authenticated;
alter default privileges in schema public grant all on sequences  to anon, authenticated;
alter default privileges in schema public grant execute on functions to anon, authenticated;
