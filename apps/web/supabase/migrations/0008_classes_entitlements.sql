-- ============================================================
--  0008 — Klassen / Einschreibungen / Aufgaben / Entitlements (DEFERRED)
--  RLS ist ab Tag eins korrekt; Runtime kommt in der Lehrkraft-Phase.
--  Reihenfolge: enums → entitlements+has_active_teacher_sub → geteilte
--  Klassen-Helfer+app_teacher_can_read → gen_join_code → classes →
--  class_enrollments → assignments → assignment_submissions →
--  class_join_attempts+RPCs → Teacher-read-Policies (zuletzt, nach den Tabellen).
-- ============================================================

-- Die geteilten Klassen-Helfer (language sql) referenzieren classes/
-- class_enrollments, die weiter unten in DERSELBEN Datei entstehen. Postgres
-- prüft SQL-Funktionskörper sonst eifrig bei create → Body-Check abschalten
-- (Supabase-Idiom; wirkt nur für diese Sitzung/Datei).
set check_function_bodies = off;

do $$ begin create type enrollment_status  as enum ('active','removed','pending'); exception when duplicate_object then null; end $$;
do $$ begin create type assignment_kind    as enum ('writing','speaking','practice'); exception when duplicate_object then null; end $$;
do $$ begin create type submission_status  as enum ('pending','submitted','graded'); exception when duplicate_object then null; end $$;
do $$ begin create type entitlement_kind   as enum ('teacher_subscription'); exception when duplicate_object then null; end $$;
do $$ begin create type entitlement_status as enum ('active','canceled','past_due','revoked','expired'); exception when duplicate_object then null; end $$;

-- Entitlements (Polar; nur Service-Role schreibt; nie eine Schüler-Zeile) --
create table if not exists entitlements (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users(id) on delete cascade,  -- die LEHRKRAFT
  kind                  entitlement_kind   not null default 'teacher_subscription',
  status                entitlement_status not null,
  source                text not null default 'polar',
  polar_subscription_id text unique,                        -- idempotenter Webhook-Upsert-Key
  polar_customer_id     text,
  product_id            text,
  current_period_end    timestamptz,                        -- Zugang bis 'revoked', nicht 'canceled'
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (user_id, kind)
);
create index if not exists idx_entitlements_user on entitlements(user_id, kind);
drop trigger if exists trg_entitlements_updated on entitlements;
create trigger trg_entitlements_updated before update on entitlements for each row execute function public.set_updated_at();

alter table entitlements enable row level security;
do $$ begin create policy "entitlements select own" on entitlements for select using (user_id = (select auth.uid())); exception when duplicate_object then null; end $$;
-- KEIN Client-Write → nur der Polar-Webhook (Service-Role) schreibt.

-- Aktiv-Sub-Prüfung INKL. current_period_end: 'canceled' behält Zugang bis Periodenende/Revoke.
create or replace function public.has_active_teacher_sub(p_teacher uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from entitlements
    where user_id = p_teacher and kind = 'teacher_subscription'
      and status = 'active' and (current_period_end is null or current_period_end > now()));
$$;
revoke all on function public.has_active_teacher_sub(uuid) from public, anon;
grant execute on function public.has_active_teacher_sub(uuid) to authenticated;

-- Geteilte Klassen-Helfer + das eine kanonische Teacher-read-Gate --------
create or replace function public.app_shares_active_class(_teacher uuid, _student uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from classes c join class_enrollments e on e.class_id = c.id
    where c.teacher_id = _teacher and e.student_id = _student
      and c.archived_at is null and e.status = 'active');
$$;
create or replace function public.is_enrolled(_class uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from class_enrollments
    where class_id = _class and student_id = auth.uid() and status = 'active');
$$;
create or replace function public.is_class_teacher(_class uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from classes where id = _class and teacher_id = auth.uid());
$$;
create or replace function public.is_assignment_teacher(_assignment uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from assignments a join classes c on c.id = a.class_id
    where a.id = _assignment and c.teacher_id = auth.uid());
$$;
-- DAS kanonische Teacher-read-Gate (Rolle + aktive geteilte Klasse + aktives Abo):
create or replace function public.app_teacher_can_read(_student uuid)
returns boolean language sql stable as $$
  select public.is_teacher()
     and public.app_shares_active_class(auth.uid(), _student)
     and public.has_active_teacher_sub(auth.uid());
$$;
revoke all on function public.app_shares_active_class(uuid,uuid), public.is_enrolled(uuid),
  public.is_class_teacher(uuid), public.is_assignment_teacher(uuid), public.app_teacher_can_read(uuid) from public, anon;
grant execute on function public.app_shares_active_class(uuid,uuid), public.is_enrolled(uuid),
  public.is_class_teacher(uuid), public.is_assignment_teacher(uuid), public.app_teacher_can_read(uuid) to authenticated;

-- CSPRNG-Join-Code-Generator (kein random()) ----------------------------
create or replace function public.gen_join_code()
returns text language plpgsql as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';  -- 31 Zeichen, kein I/L/O/0/1
  code text; b int;
begin
  loop
    code := '';
    while char_length(code) < 8 loop
      b := get_byte(gen_random_bytes(1), 0);                     -- 0..255
      if b < 248 then                                            -- 248..255 verwerfen → unverzerrt über 31 (8*31=248)
        code := code || substr(alphabet, (b % 31) + 1, 1);
      end if;
    end loop;
    exit when not exists (select 1 from classes where join_code = code);
  end loop;
  return code;
end $$;

-- Klassen & Einschreibungen (join/leave nur per RPC) --------------------
create table if not exists classes (
  id          uuid primary key default gen_random_uuid(),
  teacher_id  uuid not null references auth.users(id) on delete cascade,
  name        text not null check (char_length(name) <= 120),
  join_code   text not null unique default public.gen_join_code(),
  archived_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_classes_teacher on classes(teacher_id);
drop trigger if exists trg_classes_updated on classes;
create trigger trg_classes_updated before update on classes for each row execute function public.set_updated_at();

create table if not exists class_enrollments (
  id         uuid primary key default gen_random_uuid(),
  class_id   uuid not null references classes(id)    on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  status     enrollment_status not null default 'active',
  joined_at  timestamptz not null default now(),
  unique (class_id, student_id)
);
create index if not exists idx_class_enrollments_student on class_enrollments(student_id, status);  -- backt app_shares_active_class/is_enrolled
create index if not exists idx_class_enrollments_class   on class_enrollments(class_id, status);    -- backt Roster/Kapazität

alter table classes           enable row level security;
alter table class_enrollments enable row level security;

do $$ begin create policy "classes teacher select" on classes for select using (teacher_id = (select auth.uid())); exception when duplicate_object then null; end $$;
do $$ begin create policy "classes student select" on classes for select using (public.is_enrolled(id)); exception when duplicate_object then null; end $$;
do $$ begin create policy "classes teacher insert" on classes for insert
  with check (teacher_id = (select auth.uid()) and public.is_teacher() and public.has_active_teacher_sub((select auth.uid()))); exception when duplicate_object then null; end $$;
do $$ begin create policy "classes teacher update" on classes for update using (teacher_id = (select auth.uid())) with check (teacher_id = (select auth.uid())); exception when duplicate_object then null; end $$;
do $$ begin create policy "classes teacher delete" on classes for delete using (teacher_id = (select auth.uid())); exception when duplicate_object then null; end $$;

do $$ begin create policy "enroll student select" on class_enrollments for select using (student_id = (select auth.uid())); exception when duplicate_object then null; end $$;
do $$ begin create policy "enroll teacher select" on class_enrollments for select using (public.is_class_teacher(class_id)); exception when duplicate_object then null; end $$;
-- KEIN insert-Policy und KEIN Schüler-update-Policy. Enrollment-Mutationen sind RPC-only (unten).
-- Lehrkraft darf entfernen (status → 'removed'), aber nicht beliebig 'active' fabrizieren:
do $$ begin create policy "enroll teacher remove" on class_enrollments for update
  using (public.is_class_teacher(class_id)) with check (public.is_class_teacher(class_id) and status = 'removed'); exception when duplicate_object then null; end $$;

-- Aufgaben & Einreichungen (enrollment-geprüft; keine gefälschten Noten) --
create table if not exists assignments (
  id            uuid primary key default gen_random_uuid(),
  class_id      uuid not null references classes(id) on delete cascade,
  kind          assignment_kind not null,
  title         text not null,
  simulation_id integer references exam_simulations(id) on delete set null,
  task_id       text    references exam_tasks(id)       on delete set null,
  due_at        timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists idx_assignments_class on assignments(class_id);

create table if not exists assignment_submissions (
  id             uuid primary key default gen_random_uuid(),
  assignment_id  uuid not null references assignments(id) on delete cascade,
  student_id     uuid not null references auth.users(id)  on delete cascade,
  status         submission_status not null default 'pending',
  exam_result_id uuid references exam_results(id) on delete set null,
  submitted_at   timestamptz,
  graded_at      timestamptz,
  created_at     timestamptz not null default now(),
  unique (assignment_id, student_id)
);
create index if not exists idx_asub_assignment on assignment_submissions(assignment_id);
create index if not exists idx_asub_student    on assignment_submissions(student_id);

alter table assignments            enable row level security;
alter table assignment_submissions enable row level security;

do $$ begin create policy "assign read" on assignments for select using (public.is_class_teacher(class_id) or public.is_enrolled(class_id)); exception when duplicate_object then null; end $$;
do $$ begin create policy "assign teacher insert" on assignments for insert with check (public.is_class_teacher(class_id)); exception when duplicate_object then null; end $$;
do $$ begin create policy "assign teacher update" on assignments for update using (public.is_class_teacher(class_id)) with check (public.is_class_teacher(class_id)); exception when duplicate_object then null; end $$;
do $$ begin create policy "assign teacher delete" on assignments for delete using (public.is_class_teacher(class_id)); exception when duplicate_object then null; end $$;

do $$ begin create policy "asub student select" on assignment_submissions for select using (student_id = (select auth.uid())); exception when duplicate_object then null; end $$;
do $$ begin create policy "asub teacher select" on assignment_submissions for select using (public.is_assignment_teacher(assignment_id)); exception when duplicate_object then null; end $$;
-- Schüler darf NUR eigene Einreichung anlegen/ändern, nur wenn eingeschrieben, nur nicht-autoritative Felder:
do $$ begin create policy "asub student insert" on assignment_submissions for insert
  with check (student_id = (select auth.uid())
              and public.is_enrolled((select class_id from assignments where id = assignment_id))
              and status <> 'graded'); exception when duplicate_object then null; end $$;
do $$ begin create policy "asub student update" on assignment_submissions for update
  using (student_id = (select auth.uid()))
  with check (student_id = (select auth.uid()) and status <> 'graded'); exception when duplicate_object then null; end $$;

-- Eigentum eines verlinkten exam_result ist kein FK-Check → per Trigger erzwingen.
create or replace function public.trg_asub_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.exam_result_id is not null
     and not exists (select 1 from exam_results r where r.id = new.exam_result_id and r.user_id = new.student_id)
  then raise exception 'exam_result_not_owned' using errcode='42501'; end if;
  -- graded_at/status='graded' nur Service-Role; Client-Eskalation defensiv blocken:
  if new.status = 'graded' and current_setting('request.jwt.claim.role', true) is distinct from null then
     raise exception 'cannot_set_graded' using errcode='42501';
  end if;
  return new;
end $$;
drop trigger if exists asub_guard on assignment_submissions;
create trigger asub_guard before insert or update on assignment_submissions
  for each row execute function public.trg_asub_guard();

-- Class-join-Ledger + RPCs (gedrosselt, anti-enumeration) ---------------
create table if not exists class_join_attempts (
  user_id      uuid not null references auth.users(id) on delete cascade,
  attempted_at timestamptz not null default now()
);
alter table class_join_attempts enable row level security;   -- KEINE Policies → deny-all
revoke all on class_join_attempts from anon, authenticated;
create index if not exists idx_class_join_attempts on class_join_attempts(user_id, attempted_at desc);

create or replace function public.find_class_by_code(p_code text)
returns table (class_id uuid, class_name text)
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'unauthorized' using errcode='42501'; end if;
  if (select count(*) from class_join_attempts where user_id = v_uid and attempted_at > now() - interval '15 min') >= 10
     then raise exception 'rate_limited' using errcode='53400'; end if;
  insert into class_join_attempts(user_id) values (v_uid);
  return query select c.id, c.name from classes c
    where c.join_code = upper(trim(p_code)) and c.archived_at is null;
end $$;

create or replace function public.join_class(p_code text)
returns table (class_id uuid, class_name text, status text)
language plpgsql security definer set search_path = public as $$
declare v_class classes%rowtype; v_uid uuid := auth.uid(); v_count int; v_max constant int := 200;
begin
  if v_uid is null then raise exception 'unauthorized' using errcode='42501'; end if;
  if (select count(*) from class_join_attempts where user_id = v_uid and attempted_at > now() - interval '15 min') >= 10
     then raise exception 'rate_limited' using errcode='53400'; end if;
  insert into class_join_attempts(user_id) values (v_uid);

  select * into v_class from classes where join_code = upper(trim(p_code)) and archived_at is null;
  if not found then raise exception 'invalid_class_code' using errcode='P0002'; end if;   -- uniforme Fehlermeldung
  select count(*) into v_count from class_enrollments where class_id = v_class.id and status = 'active';
  if v_count >= v_max then raise exception 'class_full' using errcode='P0001'; end if;

  insert into class_enrollments (class_id, student_id, status, joined_at)
  values (v_class.id, v_uid, 'active', now())
  on conflict (class_id, student_id) do update set status='active', joined_at=now();  -- idempotentes Re-Join
  return query select v_class.id, v_class.name, 'active'::text;
end $$;

create or replace function public.leave_class(p_class uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update class_enrollments set status='removed' where class_id = p_class and student_id = auth.uid();
end $$;

create or replace function public.rotate_join_code(p_class uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_code text;
begin
  if not public.is_class_teacher(p_class) then raise exception 'forbidden' using errcode='42501'; end if;
  v_code := public.gen_join_code();
  update classes set join_code = v_code where id = p_class;
  return v_code;
end $$;

revoke all on function public.find_class_by_code(text), public.join_class(text),
  public.leave_class(uuid), public.rotate_join_code(uuid) from public, anon;
grant execute on function public.find_class_by_code(text), public.join_class(text),
  public.leave_class(uuid), public.rotate_join_code(uuid) to authenticated;

-- Teacher-read-Policies (hier, nach Helfern/Tabellen — Forward-Reference-Fix) --
-- `to authenticated`: anon evaluiert diese Policies NIE (und braucht daher kein
-- execute auf die Gate-Funktion) → anon-Reads fallen sauber auf 0 Zeilen zurück.
do $$ begin create policy "profiles teacher read"  on profiles          for select to authenticated using (public.app_teacher_can_read(id)); exception when duplicate_object then null; end $$;
do $$ begin create policy "attempts teacher read"  on exercise_attempts for select to authenticated using (public.app_teacher_can_read(user_id)); exception when duplicate_object then null; end $$;
do $$ begin create policy "progress teacher read"  on exercise_progress for select to authenticated using (public.app_teacher_can_read(user_id)); exception when duplicate_object then null; end $$;
do $$ begin create policy "daily teacher read"     on daily_activity    for select to authenticated using (public.app_teacher_can_read(user_id)); exception when duplicate_object then null; end $$;
-- exam_results: Teacher-read auf Ergebnisse beschränken, die der Schüler an DIE Aufgabe DIESER Lehrkraft eingereicht hat
-- (Datensparsamkeit — keine privaten Übungs-Aufsätze). Red-Team-Fix.
do $$ begin create policy "exam_results teacher read" on exam_results for select to authenticated
  using (exists (
    select 1 from assignment_submissions s join assignments a on a.id = s.assignment_id
    where s.exam_result_id = exam_results.id and s.student_id = exam_results.user_id
      and public.is_class_teacher(a.class_id) and public.has_active_teacher_sub(auth.uid())
  )); exception when duplicate_object then null; end $$;
