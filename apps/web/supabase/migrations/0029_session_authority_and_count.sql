-- ============================================================
--  0029 — session management authority + generate_sessions count fix
--  (adversarial review batch 4).
--
--  (1) is_session_teacher (0018) war CREATOR-ONLY (classes.teacher_id = auth.uid()).
--      Das 0026-Broadening von is_class_teacher (Creator ODER class_staff-'lead'
--      ODER Org-Owner) wurde hier NICHT nachgezogen → ein Org-Lead/-Owner konnte
--      Termine NICHT über cancel_session absagen (42501→403) und keine Anwesenheit
--      erfassen, obwohl die 'session teacher all'-RLS bereits das breite
--      is_class_teacher benutzt (Lead/Owner darf Sessions anlegen/löschen). Fix:
--      is_session_teacher an is_class_teacher(class_id) delegieren (konsistent;
--      wirkt auf cancel_session + die 'attend teacher all'-Policy).
--
--  (2) generate_sessions zählte JEDE Schleifeniteration (v_ins+1), auch wenn
--      ON CONFLICT DO NOTHING die Zeile übersprang → aufgeblähter `generated`-
--      Rückgabewert. Nur echte Inserts zählen (if found).
--
--  Depends on: 0018 (Originale), 0026 (is_class_teacher-Broadening).
-- ============================================================

create or replace function public.is_session_teacher(_session uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from class_sessions s
    where s.id = _session and public.is_class_teacher(s.class_id)   -- Creator / Lead / Org-Owner
  );
$$;
revoke all on function public.is_session_teacher(uuid) from public, anon;
grant execute on function public.is_session_teacher(uuid) to authenticated;

create or replace function public.generate_sessions(p_class uuid default null, p_until date default (current_date + 42))
returns int language plpgsql security definer set search_path = public as $$
declare s record; d date; v_start timestamptz; v_ins int := 0;
begin
  for s in select * from class_schedules
           where active and (p_class is null or class_id = p_class)
             and starts_on <= p_until and (ends_on is null or ends_on >= current_date)
  loop
    d := greatest(s.starts_on, current_date);
    while d <= least(p_until, coalesce(s.ends_on, p_until)) loop
      if extract(dow from d)::int = s.weekday then
        v_start := (d + s.start_time) at time zone s.timezone;   -- local → timestamptz
        insert into class_sessions (class_id, schedule_id, starts_at, ends_at)
        values (s.class_id, s.id, v_start, v_start + make_interval(mins => s.duration_min))
        on conflict (schedule_id, starts_at) where schedule_id is not null do nothing;
        if found then v_ins := v_ins + 1; end if;   -- ON CONFLICT DO NOTHING → found=false → nicht zählen
      end if;
      d := d + 1;
    end loop;
  end loop;
  return v_ins;
end $$;
revoke all on function public.generate_sessions(uuid, date) from public, anon, authenticated;  -- cron/service-role only

notify pgrst, 'reload schema';
