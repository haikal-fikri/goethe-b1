-- ============================================================
--  0024 — Compliance gates: teacher DPA acceptance + per-student guardian voice
--  consent. Two HARD launch blockers (06 §3): a version-stamped DPA gates onboarding
--  + invite; per-student guardian consent gates speaking submit/finalize. Both tables
--  service-role write. Canonical: teacher-lms/02 §14. Depends on: 0008, 0016.
-- ============================================================

set check_function_bodies = off;

-- Teacher DPA acceptance, version-stamped. One row per (teacher, version).
create table if not exists teacher_agreements (
  teacher_id  uuid not null references auth.users(id) on delete cascade,
  dpa_version text not null,
  accepted_at timestamptz not null default now(),
  ip_hash     text,                                -- hashed only; never a raw IP
  primary key (teacher_id, dpa_version)
);
alter table teacher_agreements enable row level security;
do $$ begin create policy "dpa select own"  on teacher_agreements for select using (teacher_id = (select auth.uid())); exception when duplicate_object then null; end $$;
do $$ begin create policy "dpa admin read"  on teacher_agreements for select using (public.is_admin()); exception when duplicate_object then null; end $$;
-- Acceptance is written by the onboarding route (service-role) after the teacher accepts; NO client insert.

-- Per-student guardian/parental consent for voice. Scope = the student (all their classes).
do $$ begin create type consent_status as enum ('granted','withdrawn'); exception when duplicate_object then null; end $$;
create table if not exists guardian_consents (
  student_id  uuid primary key references auth.users(id) on delete cascade,
  status      consent_status not null default 'granted',
  method      text,                                -- 'in_app' | 'email' | 'paper' (audit trail)
  recorded_at timestamptz not null default now(),
  recorded_by uuid references auth.users(id) on delete set null,
  updated_at  timestamptz not null default now()
);
alter table guardian_consents enable row level security;
do $$ begin create policy "consent select own"   on guardian_consents for select using (student_id = (select auth.uid())); exception when duplicate_object then null; end $$;
do $$ begin create policy "consent teacher read" on guardian_consents for select using (public.app_teacher_can_read(student_id)); exception when duplicate_object then null; end $$;
do $$ begin create policy "consent admin read"   on guardian_consents for select using (public.is_admin()); exception when duplicate_object then null; end $$;
-- Service-role write only (recorded via the consent-capture route).

-- Gate helpers (routes check these cheaply). CURRENT_DPA_VERSION is a route-config constant.
create or replace function public.teacher_dpa_ok(p_teacher uuid, p_version text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from teacher_agreements where teacher_id = p_teacher and dpa_version = p_version); $$;
create or replace function public.guardian_consent_ok(p_student uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from guardian_consents where student_id = p_student and status = 'granted'); $$;
revoke all on function public.teacher_dpa_ok(uuid,text), public.guardian_consent_ok(uuid) from public, anon;
grant execute on function public.teacher_dpa_ok(uuid,text), public.guardian_consent_ok(uuid) to authenticated;

notify pgrst, 'reload schema';
