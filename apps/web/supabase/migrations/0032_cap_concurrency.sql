-- 0032 — Seat-/Student-Cap-Rennen schließen (TOCTOU) (Security-Review-Fix)
--
-- Alle Cap-Prüfungen sind `count(*) → vergleiche → insert` unter READ COMMITTED
-- OHNE Sperre. N gleichzeitige Anfragen lesen denselben count < max, bevor eine
-- committet, und fügen alle ein → Cap überschritten (Plan-/Billing-Invarianten-
-- Bruch). 0030 hat den Reaktivierungs-Pfad geschlossen, aber nicht die Nebenläufigkeit.
--
-- Fix: pro Subscriber (Org bzw. Teacher) einen transaktions-lokalen Advisory-Lock
-- VOR dem count nehmen. Dadurch serialisieren konkurrierende Aktivierungen/Joins
-- desselben Subscribers; der Lock wird beim Commit automatisch freigegeben. Die
-- Funktionskörper sind ansonsten wortgleich zu 0026/0017 übernommen; die vorhandenen
-- Trigger (enforce_seat_cap INSERT/UPDATE) referenzieren die Funktion per Name und
-- bleiben unverändert gültig.

-- ── Seat cap (Org) ─────────────────────────────────────────────────────────
create or replace function public.trg_enforce_seat_cap() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_owner uuid; v_max int; v_count int;
begin
  if new.role = 'owner' or new.status <> 'active' then return new; end if;
  -- Serialisiert gleichzeitige Seat-Aktivierungen DIESER Org (TOCTOU-Schutz).
  perform pg_advisory_xact_lock(hashtextextended(new.org_id::text, 0));
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

-- ── Student cap (Teacher) — join_class ─────────────────────────────────────
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
  -- Serialisiert gleichzeitige Joins dieser Lehrkraft (TOCTOU auf Per-Class- + Plan-Cap).
  perform pg_advisory_xact_lock(hashtextextended(v_class.teacher_id::text, 0));
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

-- ── Student cap (Teacher) — claim_invites ──────────────────────────────────
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
    -- Serialisiert gleichzeitige Enrollments dieser Lehrkraft (TOCTOU auf Plan-Cap).
    perform pg_advisory_xact_lock(hashtextextended(r.teacher_id::text, 0));
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
