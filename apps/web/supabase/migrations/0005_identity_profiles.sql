-- ============================================================
--  0005 — Identität + Profile + Content-Grants (LIVE)
--  Additiv auf dem Content-Schema (0001–0004). Nutzt Supabase Auth
--  (auth.users). Rolle NUR aus dem JWT (app_metadata) — nie als Spalte.
--  Neue Tabellen sind RLS default-deny; Profile = own read/write.
--  Erste anon-Nutzung der Content-Ansicht → security_invoker + grants.
-- ============================================================

-- Rollen-Helfer (JWT-only) ----------------------------------
-- Rolle NUR aus dem signierten JWT (app_metadata), NIE aus user_metadata/Spalte.
create or replace function public.jwt_role()
returns text language sql stable as $$
  select coalesce(nullif(auth.jwt() -> 'app_metadata' ->> 'role', ''), 'student');
$$;

create or replace function public.is_teacher()
returns boolean language sql stable as $$ select public.jwt_role() = 'teacher'; $$;

create or replace function public.is_admin()
returns boolean language sql stable as $$ select public.jwt_role() = 'admin'; $$;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at := now(); return new; end $$;

-- Profile: 1:1 zu auth.users, KEINE Rollenspalte -------------
do $$ begin
  create type profile_theme as enum ('system','light','dark');
exception when duplicate_object then null; end $$;

create table if not exists profiles (
  id              uuid primary key references auth.users(id) on delete cascade,   -- = auth.uid()
  display_name    text check (display_name is null or char_length(display_name) <= 80),
  avatar_url      text,                                    -- Storage-Objektschlüssel; NUR serverseitig gesetzt
  level           cefr_level    not null default 'B1',     -- App erzwingt B1 in v1
  native_language text check (native_language is null or char_length(native_language) <= 8),  -- ISO 639-1
  exam_date       date,
  reminder_opt_in boolean       not null default false,
  reminder_time   text check (reminder_time is null or reminder_time ~ '^\d{2}:\d{2}$'),
  theme           profile_theme not null default 'system',
  onboarded_at    timestamptz,
  created_at      timestamptz   not null default now(),
  updated_at      timestamptz   not null default now()
);
comment on table profiles is 'Nutzerprofil 1:1 zu auth.users. KEINE Rollenspalte (Rolle = app_metadata).';

drop trigger if exists trg_profiles_updated on profiles;
create trigger trg_profiles_updated before update on profiles
  for each row execute function public.set_updated_at();

-- New-user-Trigger: Profil anlegen + Rolle 'student' stempeln (nie überschreiben).
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, left(coalesce(new.raw_user_meta_data ->> 'full_name',
                                new.raw_user_meta_data ->> 'name'), 80))
  on conflict (id) do nothing;
  update auth.users
     set raw_app_meta_data = coalesce(raw_app_meta_data,'{}'::jsonb)
         || jsonb_build_object('role', coalesce(raw_app_meta_data ->> 'role','student'))
   where id = new.id;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

alter table profiles enable row level security;
-- avatar_url ist niemals client-schreibbar (nur /api/profile/avatar setzt es):
revoke insert (avatar_url) on profiles from authenticated, anon;
revoke update (avatar_url) on profiles from authenticated, anon;

do $$ begin
  create policy "profiles select own" on profiles for select using (id = (select auth.uid()));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "profiles update own" on profiles for update
    using (id = (select auth.uid())) with check (id = (select auth.uid()));
exception when duplicate_object then null; end $$;
-- Kein insert-Policy (Zeile kommt aus dem Trigger). Kein delete-Policy (kaskadiert aus auth.users).
-- Teacher-read-Policy wird in 0008 ergänzt (braucht die Klassentabellen).

-- Feature-Flags / Config (öffentlich lesbar) ----------------
-- Ferngesteuertes Flag `class_enabled` (in v1 aus → 4-Tab-Leiste). Umlegen ohne App-Store-Release.
create table if not exists app_config (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);
alter table app_config enable row level security;
do $$ begin
  create policy "public read app_config" on app_config for select using (true);
exception when duplicate_object then null; end $$;
-- Kein Schreib-Policy → nur Service-Role setzt Flags.
insert into app_config (key, value) values ('class_enabled', 'false'::jsonb)
  on conflict (key) do nothing;

-- Content-Reads: Ansicht RLS-treu machen + SELECT gewähren ---
-- (Mobile ist der erste anon-Konsument über supabase-js.)
alter view redemittel_item set (security_invoker = on);            -- läuft als Aufrufer, respektiert Basis-RLS
grant select on redemittel_item to anon, authenticated;
grant select on redemittel, tasks, functions, skills to anon, authenticated;
grant select on exam_simulations, exam_tasks to anon, authenticated;

-- Avatare: privater Storage-Bucket + eigentümer-scoped Lesepolicy --
-- Schreibzugriff nur Service-Role (avatar-Route); Client liest per signierter URL.
-- Defensiv gekapselt: fehlen Storage-Rechte in einer Umgebung, bricht 0005 nicht ab.
do $$
begin
  insert into storage.buckets (id, name, public)
  values ('avatars', 'avatars', false)
  on conflict (id) do nothing;

  begin
    create policy "avatars owner read" on storage.objects for select
      using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
  exception when duplicate_object then null; end;
exception
  when insufficient_privilege then
    raise notice '0005: storage-Setup übersprungen (keine Rechte) — Bucket/Policy im Dashboard anlegen.';
  when undefined_table then
    raise notice '0005: storage-Schema nicht vorhanden — Bucket/Policy im Dashboard anlegen.';
end $$;
