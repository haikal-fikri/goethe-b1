-- ============================================================
--  0017 — Email invitations + join-code plan-cap override.
--  Teacher adds students by email before they have an account; on first login the
--  student calls claim_invites() to convert pending invites → active enrollments.
--  The join code remains the manual fallback (join_class). Canonical: teacher-lms/02 §2.
--  Depends on: 0016 (plan_limits/teacher_plan_of/teacher_active_student_count), 0015 (join_class).
-- ============================================================

set check_function_bodies = off;

do $$ begin create type invite_status as enum ('pending','accepted','revoked','expired'); exception when duplicate_object then null; end $$;

create table if not exists class_invites (
  id            uuid primary key default gen_random_uuid(),
  class_id      uuid not null references classes(id)      on delete cascade,
  email         text not null check (char_length(email) <= 254),  -- store normalized lower(trim(email))
  invited_by    uuid not null references auth.users(id)   on delete cascade,   -- the teacher
  status        invite_status not null default 'pending',
  token         text not null unique default encode(gen_random_bytes(24), 'base64'),  -- opaque; optional email link
  expires_at    timestamptz not null default (now() + interval '30 days'),
  created_at    timestamptz not null default now(),
  accepted_at   timestamptz,
  accepted_user uuid references auth.users(id) on delete set null,
  unique (class_id, email)
);
create index if not exists idx_class_invites_email on class_invites (lower(email)) where status = 'pending';
create index if not exists idx_class_invites_class on class_invites (class_id, status);

alter table class_invites enable row level security;
-- Teacher of the class reads own invites (roster "pending" list). Students NEVER read
-- invites (don't leak other invited emails). No client insert (service-role route creates them).
do $$ begin create policy "invites teacher select" on class_invites for select
  using (public.is_class_teacher(class_id)); exception when duplicate_object then null; end $$;
-- Teacher may only flip an invite to 'revoked' (never fabricate 'accepted'):
do $$ begin create policy "invites teacher revoke" on class_invites for update
  using (public.is_class_teacher(class_id))
  with check (public.is_class_teacher(class_id) and status = 'revoked'); exception when duplicate_object then null; end $$;

-- ── 2.1 claim_invites() — student converts invites on login (§2.1) ─────────
create or replace function public.claim_invites()
returns table (class_id uuid, class_name text)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare v_uid uuid := auth.uid(); v_email text; r record; v_max int;
begin
  if v_uid is null then raise exception 'unauthorized' using errcode = '42501'; end if;
  v_email := lower(trim(coalesce(auth.jwt() ->> 'email', '')));   -- verified email from the access token
  if v_email = '' then return; end if;
  for r in
    select ci.id, ci.class_id, c.teacher_id, c.name, c.archived_at
    from class_invites ci join classes c on c.id = ci.class_id
    where lower(ci.email) = v_email and ci.status = 'pending' and ci.expires_at > now()
  loop
    if r.archived_at is not null then continue; end if;
    -- respect the teacher's student cap unless this student already counts toward it
    select max_students into v_max from public.plan_limits(public.teacher_plan_of(r.teacher_id));
    if v_max is not null
       and public.teacher_active_student_count(r.teacher_id) >= v_max
       and not exists (select 1 from class_enrollments e join classes cc on cc.id = e.class_id
                       where cc.teacher_id = r.teacher_id and e.student_id = v_uid and e.status = 'active')
    then continue; end if;   -- teacher over cap → skip (invite stays pending)
    insert into class_enrollments (class_id, student_id, status, joined_at)
    values (r.class_id, v_uid, 'active', now())
    on conflict (class_id, student_id) do update set status = 'active', joined_at = now();
    update class_invites set status = 'accepted', accepted_at = now(), accepted_user = v_uid where id = r.id;
    class_id := r.class_id; class_name := r.name; return next;
  end loop;
end $$;
revoke all on function public.claim_invites() from public, anon;
grant execute on function public.claim_invites() to authenticated;

-- Pending-invite headroom for the invite route's cap check (distinct pending emails).
create or replace function public.teacher_pending_invite_count(p_teacher uuid)
returns int language sql stable security definer set search_path = public as $$
  select count(distinct lower(ci.email))::int
  from class_invites ci join classes c on c.id = ci.class_id
  where c.teacher_id = p_teacher and ci.status = 'pending' and ci.expires_at > now();
$$;
revoke all on function public.teacher_pending_invite_count(uuid) from public, anon;
grant execute on function public.teacher_pending_invite_count(uuid) to authenticated;

-- ── 2.2 Override join_class() — enforce the plan student cap (§2.2) ─────────
-- Red-team fix: the 0015 join_class caps only per-class (200); it does not know the
-- teacher's PLAN student cap, so a starter teacher could share the join code to
-- onboard the 61st+ student. Replace it so the code path checks the plan cap too —
-- mirroring claim_invites(). Uniform 'class_full' for both ceilings (no plan-leak).
-- Preserves the 0015 body + `#variable_conflict use_column`.
create or replace function public.join_class(p_code text)
returns table (class_id uuid, class_name text, status text)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare v_class classes%rowtype; v_uid uuid := auth.uid(); v_active int; v_max int; v_per_class constant int := 200;
begin
  if v_uid is null then raise exception 'unauthorized' using errcode='42501'; end if;
  if (select count(*) from class_join_attempts where user_id = v_uid and attempted_at > now() - interval '15 min') >= 10
     then raise exception 'rate_limited' using errcode='53400'; end if;
  insert into class_join_attempts(user_id) values (v_uid);

  select * into v_class from classes where join_code = upper(trim(p_code)) and archived_at is null;
  if not found then raise exception 'invalid_class_code' using errcode='P0002'; end if;
  select count(*) into v_active from class_enrollments where class_id = v_class.id and status = 'active';
  if v_active >= v_per_class then raise exception 'class_full' using errcode='P0001'; end if;   -- per-class ceiling
  -- PLAN student cap (new): teacher's distinct active students < plan max, unless this student already counts.
  select max_students into v_max from public.plan_limits(public.teacher_plan_of(v_class.teacher_id));
  if v_max is not null
     and public.teacher_active_student_count(v_class.teacher_id) >= v_max
     and not exists (select 1 from class_enrollments e join classes c on c.id = e.class_id
                     where c.teacher_id = v_class.teacher_id and e.student_id = v_uid and e.status = 'active')
  then raise exception 'class_full' using errcode='P0001'; end if;   -- uniform 'class_full' (no plan-leak)

  insert into class_enrollments (class_id, student_id, status, joined_at)
  values (v_class.id, v_uid, 'active', now())
  on conflict (class_id, student_id) do update set status='active', joined_at=now();
  return query select v_class.id, v_class.name, 'active'::text;
end $$;
revoke all on function public.join_class(text) from public, anon;
grant  execute on function public.join_class(text) to authenticated;

notify pgrst, 'reload schema';
