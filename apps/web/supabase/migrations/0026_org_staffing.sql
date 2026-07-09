-- ============================================================
--  0026 — Organizations, teacher seats, class staffing (Pro, D12).
--  A Pro teacher = org owner: provisions ≤20 teacher seats, assigns class leads,
--  and (with a lead) adds per-class teaching assistants who help grade. TA authority
--  = grading + read-only class dashboard; NEVER class management. Authority derives
--  from org membership + the OWNER's active Pro sub. Canonical: teacher-lms/02 §16.
--  Depends on: 0008, 0016 (plan_limits/teacher_plan_of), 0017 (invite_status), 0020/0021 (submissions).
--
--  LOAD-BEARING: create-or-replace is_class_teacher() (lead/owner) + broaden
--  app_teacher_can_read() (any grader, gated on class_sub_active). Every existing
--  policy that references these keeps its signature and now resolves the wider set.
-- ============================================================

set check_function_bodies = off;

-- ── 16.1 Enums + tables ────────────────────────────────────────────────────
do $$ begin create type org_member_role  as enum ('owner','teacher');   exception when duplicate_object then null; end $$;
do $$ begin create type class_staff_role as enum ('lead','assistant');  exception when duplicate_object then null; end $$;

-- One org per owner (MVP). The Pro sub is the owner's entitlements row; the org is
-- the seat/staffing container.
create table if not exists organizations (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references auth.users(id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 160),
  created_at timestamptz not null default now(),
  unique (owner_id)
);

-- Seats. Owner is a member role='owner' (not counted against the cap). Teachers are the 20 seats.
create table if not exists org_members (
  org_id     uuid not null references organizations(id) on delete cascade,
  user_id    uuid not null references auth.users(id)    on delete cascade,
  role       org_member_role not null default 'teacher',
  status     text not null default 'active' check (status in ('active','suspended')),
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);
create index if not exists idx_org_members_user on org_members(user_id) where status = 'active';

-- Owner invites a teacher by email → they join as a seat on accept (claim_org_invite). Reuses 0017 invite_status.
create table if not exists org_invites (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organizations(id) on delete cascade,
  email         text not null check (char_length(email) <= 254),   -- store lower(trim(email))
  invited_by    uuid not null references auth.users(id) on delete cascade,
  status        invite_status not null default 'pending',
  token         text not null unique default encode(gen_random_bytes(24), 'base64'),
  expires_at    timestamptz not null default (now() + interval '30 days'),
  created_at    timestamptz not null default now(),
  accepted_at   timestamptz,
  accepted_user uuid references auth.users(id) on delete set null,
  unique (org_id, email)
);
create index if not exists idx_org_invites_email on org_invites (lower(email)) where status = 'pending';

-- Who staffs a class + as what. classes.teacher_id stays the creator/owner-of-record.
create table if not exists class_staff (
  class_id    uuid not null references classes(id)     on delete cascade,
  teacher_id  uuid not null references auth.users(id)  on delete cascade,
  role        class_staff_role not null,               -- 'lead' = full management · 'assistant' = grading + read-only dashboard
  assigned_by uuid not null references auth.users(id),
  created_at  timestamptz not null default now(),
  primary key (class_id, teacher_id)
);
create index if not exists idx_class_staff_teacher on class_staff(teacher_id);

-- Tie a class to an org. NULL = Starter solo class. Set = Pro org class.
alter table classes add column if not exists org_id uuid references organizations(id) on delete set null;
create index if not exists idx_classes_org on classes(org_id) where org_id is not null;

-- ── 16.2 Authority helpers — the load-bearing broadening ───────────────────
-- Active teacher subscription for an arbitrary user (parameterized has_active_teacher_sub).
create or replace function public.has_active_sub(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from entitlements
    where user_id = p_user and kind = 'teacher_subscription' and status = 'active'
      and (current_period_end is null or current_period_end > now()));
$$;
revoke all on function public.has_active_sub(uuid) from public, anon;
grant execute on function public.has_active_sub(uuid) to authenticated;

create or replace function public.is_org_owner(_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from organizations where id = _org and owner_id = auth.uid());
$$;
revoke all on function public.is_org_owner(uuid) from public, anon;
grant execute on function public.is_org_owner(uuid) to authenticated;

-- The class's responsible subscription: org owner's (org class) or the solo teacher's.
create or replace function public.class_sub_active(_class uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when c.org_id is not null then public.has_active_sub((select owner_id from organizations where id = c.org_id))
    else public.has_active_sub(c.teacher_id)
  end
  from classes c where c.id = _class;
$$;
revoke all on function public.class_sub_active(uuid) from public, anon;
grant execute on function public.class_sub_active(uuid) to authenticated;

-- MANAGEMENT gate (REPLACES the 0008 is_class_teacher): the class creator, an org
-- 'lead', or the org owner.
create or replace function public.is_class_teacher(_class uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from classes c where c.id = _class and (
      c.teacher_id = auth.uid()
      or exists (select 1 from class_staff s where s.class_id = c.id and s.teacher_id = auth.uid() and s.role = 'lead')
      or (c.org_id is not null and exists (select 1 from organizations o where o.id = c.org_id and o.owner_id = auth.uid()))
    ));
$$;
revoke all on function public.is_class_teacher(uuid) from public, anon;
grant execute on function public.is_class_teacher(uuid) to authenticated;

-- GRADING gate (NEW): a lead/creator/owner (via is_class_teacher) OR an 'assistant' (TA).
create or replace function public.is_class_grader(_class uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_class_teacher(_class)
     or exists (select 1 from class_staff s where s.class_id = _class and s.teacher_id = auth.uid() and s.role = 'assistant');
$$;
revoke all on function public.is_class_grader(uuid) from public, anon;
grant execute on function public.is_class_grader(uuid) to authenticated;

-- READ gate (REPLACES the 0008/0016 app_teacher_can_read): any grader (lead OR TA) of
-- an active, non-archived class the student is actively enrolled in, gated on the class's
-- responsible sub. This is the ONE place TA read is granted — every dashboard/submission/
-- AI-rec/grade read policy routes through app_teacher_can_read, so TAs inherit read here.
-- Moves invoker → security definer; the role check (is_teacher) is subsumed because a
-- grader is by construction the class creator/lead/owner/TA (all teacher-role accounts).
create or replace function public.app_teacher_can_read(_student uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from class_enrollments e join classes c on c.id = e.class_id
    where e.student_id = _student and e.status = 'active' and c.archived_at is null
      and public.is_class_grader(c.id)          -- lead / creator / org owner / TA
      and public.class_sub_active(c.id)          -- responsible Pro/solo sub still active
  );
$$;
revoke all on function public.app_teacher_can_read(uuid) from public, anon;
grant execute on function public.app_teacher_can_read(uuid) to authenticated;

-- Grade-write grader gates for the grade routes (admit TAs). is_submission_teacher()
-- (0020) gates management; these gate grading. NOTE speaking_submissions has NO class_id
-- (0009 FKs assignment_id → speaking_assignments) → JOIN through speaking_assignments
-- (the spec's s.class_id is a schema mismatch, corrected here).
create or replace function public.is_submission_grader(_submission uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from assignment_submissions s
    join assignments a on a.id = s.assignment_id
    where s.id = _submission and public.is_class_grader(a.class_id));
$$;
create or replace function public.is_speaking_grader(_submission uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from speaking_submissions s
    join speaking_assignments a on a.id = s.assignment_id
    where s.id = _submission and public.is_class_grader(a.class_id));
$$;
revoke all on function public.is_submission_grader(uuid), public.is_speaking_grader(uuid) from public, anon;
grant execute on function public.is_submission_grader(uuid), public.is_speaking_grader(uuid) to authenticated;

-- Assignee-is-an-org-seat guard for the "staff manage" with-check (§16.6). MUST be a
-- SECURITY DEFINER helper: an inline subquery on classes/org_members runs under the
-- CALLER's RLS, so a class LEAD (not classes.teacher_id, not owner) can't see the class
-- row or the assignee's org_members row → the check collapses to empty and the lead is
-- wrongly blocked from adding a TA (§16.6 explicitly allows owner OR lead). The definer
-- helper bypasses caller RLS; a non-org assignee is still rejected.
create or replace function public.class_staff_assignee_ok(_class uuid, _teacher uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from classes c join org_members m on m.org_id = c.org_id
    where c.id = _class and m.user_id = _teacher and m.status = 'active');
$$;
revoke all on function public.class_staff_assignee_ok(uuid,uuid) from public, anon;
grant execute on function public.class_staff_assignee_ok(uuid,uuid) to authenticated;

-- ── 16.3 Seat cap (≤ 20 teachers per Pro org) ──────────────────────────────
create or replace function public.trg_enforce_seat_cap() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_owner uuid; v_max int; v_count int;
begin
  if new.role = 'owner' or new.status <> 'active' then return new; end if;
  select owner_id into v_owner from organizations where id = new.org_id;
  select max_seats into v_max from public.plan_limits(public.teacher_plan_of(v_owner));
  if v_max is not null then
    select count(*) into v_count from org_members
      where org_id = new.org_id and role = 'teacher' and status = 'active'
        and user_id <> new.user_id;                      -- re-activating an existing member doesn't double-count
    if v_count >= v_max then
      raise exception 'seat_limit_reached' using errcode = 'P0001', detail = format('plan cap %s seats', v_max);
    end if;
  end if;
  return new;
end $$;
drop trigger if exists enforce_seat_cap on org_members;
create trigger enforce_seat_cap before insert on org_members
  for each row execute function public.trg_enforce_seat_cap();

-- ── 16.4 claim_org_invite() — teacher accepts a seat ───────────────────────
create or replace function public.claim_org_invite(p_token text)
returns table (org_id uuid, org_name text)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare v_uid uuid := auth.uid(); v_email text; r record;
begin
  if v_uid is null then raise exception 'unauthorized' using errcode = '42501'; end if;
  v_email := lower(trim(coalesce(auth.jwt() ->> 'email', '')));
  select i.*, o.name as oname into r from org_invites i join organizations o on o.id = i.org_id
    where i.token = p_token and i.status = 'pending' and i.expires_at > now();
  if not found then raise exception 'invalid_invite' using errcode = 'P0002'; end if;
  if lower(r.email) <> v_email then raise exception 'email_mismatch' using errcode = '42501'; end if;   -- bind to verified JWT email
  insert into org_members (org_id, user_id, role, status) values (r.org_id, v_uid, 'teacher', 'active')
    on conflict (org_id, user_id) do update set status = 'active';   -- seat-cap trigger enforces the 20 ceiling
  update org_invites set status = 'accepted', accepted_at = now(), accepted_user = v_uid where id = r.id;
  org_id := r.org_id; org_name := r.oname; return next;
end $$;
revoke all on function public.claim_org_invite(text) from public, anon;
grant execute on function public.claim_org_invite(text) to authenticated;

-- ── 16.5 RLS ───────────────────────────────────────────────────────────────
alter table organizations enable row level security;
alter table org_members   enable row level security;
alter table org_invites   enable row level security;
alter table class_staff   enable row level security;

-- organizations: owner CRUD own; active member reads; admin reads.
do $$ begin create policy "org owner all"   on organizations for all
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid())); exception when duplicate_object then null; end $$;
do $$ begin create policy "org member read" on organizations for select
  using (exists (select 1 from org_members m where m.org_id = id and m.user_id = (select auth.uid()) and m.status = 'active')); exception when duplicate_object then null; end $$;
do $$ begin create policy "org admin read"  on organizations for select using (public.is_admin()); exception when duplicate_object then null; end $$;

-- org_members: owner manages seats (insert guarded by the cap trigger); a member reads own row; admin reads.
do $$ begin create policy "orgmem owner all" on org_members for all
  using (public.is_org_owner(org_id)) with check (public.is_org_owner(org_id)); exception when duplicate_object then null; end $$;
do $$ begin create policy "orgmem self read" on org_members for select
  using (user_id = (select auth.uid())); exception when duplicate_object then null; end $$;
do $$ begin create policy "orgmem admin read" on org_members for select using (public.is_admin()); exception when duplicate_object then null; end $$;

-- org_invites: owner reads own org's invites; admin reads. NO client insert (route sends
-- the email); invitee never lists invites (redeems via claim_org_invite(token)).
do $$ begin create policy "orginv owner read" on org_invites for select using (public.is_org_owner(org_id)); exception when duplicate_object then null; end $$;
do $$ begin create policy "orginv admin read" on org_invites for select using (public.is_admin()); exception when duplicate_object then null; end $$;

-- class_staff: a lead/owner (is_class_teacher) manages staffing; any grader reads the
-- roster; admin reads. The assignee MUST already be an active org seat of the class's org
-- (§16.6 hard guard) → non-org user can never be staffed; a TA can never staff itself
-- (is_class_teacher, which a TA is not).
do $$ begin create policy "staff manage" on class_staff for all
  using (public.is_class_teacher(class_id))
  with check (public.is_class_teacher(class_id)
    and public.class_staff_assignee_ok(class_id, class_staff.teacher_id)); exception when duplicate_object then null; end $$;
do $$ begin create policy "staff peer read" on class_staff for select
  using (public.is_class_grader(class_id)); exception when duplicate_object then null; end $$;
do $$ begin create policy "staff admin read" on class_staff for select using (public.is_admin()); exception when duplicate_object then null; end $$;

notify pgrst, 'reload schema';
