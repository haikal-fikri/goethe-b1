-- ============================================================
--  0015 — Klasse-Read-RPCs (LIVE, additiv)
--  Zwei SECURITY-DEFINER-Lesefunktionen für die mobile Schüler-
--  Klasse-Oberfläche. Sie liefern gezielt das, was ein eingeschriebener
--  Schüler unter der 0008-RLS NICHT direkt lesen kann:
--    • my_classes()        → Lehrkraft-Name + aktive Mitgliederzahl
--    • class_leaderboard()  → klassenweite Wochen-Rangliste
--  (v_weekly_leaderboard ist security_invoker → kollabiert für den
--   Schüler auf seine eigene Zeile; profiles/class_enrollments sind
--   own-row.) Definer umgeht RLS, gibt aber nur Daten zu Klassen zurück,
--   in denen der Aufrufer aktiv eingeschrieben ist (Guard via is_enrolled).
--  Beide sind read-only (stable). Kein Schreibpfad.
-- ============================================================

-- my_classes(): aktive Einschreibungen des Aufrufers → nicht-archivierte
-- Klassen, mit Lehrkraft-display_name + aktiver Mitgliederzahl.
create or replace function public.my_classes()
returns table (
  class_id     uuid,
  name         text,
  join_code    text,
  teacher_id   uuid,
  teacher_name text,
  member_count integer,
  enrolled_at  timestamptz
)
language plpgsql stable security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then return; end if;                       -- inhärent aufrufer-gescopt
  return query
    select c.id, c.name, c.join_code, c.teacher_id, p.display_name,
           (select count(*)::int from class_enrollments e2
              where e2.class_id = c.id and e2.status = 'active'),
           e.joined_at
    from class_enrollments e
    join classes c       on c.id = e.class_id
    left join profiles p on p.id = c.teacher_id
    where e.student_id = v_uid and e.status = 'active' and c.archived_at is null
    order by e.joined_at desc;                                -- deterministisch: zuletzt beigetreten zuerst
end $$;
revoke all on function public.my_classes() from public, anon;
grant  execute on function public.my_classes() to authenticated;

-- class_leaderboard(p_class_id): Punkte je aktivem Mitglied für die laufende
-- ISO-Woche. Guard: nur wenn der Aufrufer in p_class_id eingeschrieben ist
-- (DEFINER umgeht RLS → Guard ist Pflicht). Basis = class_enrollments (left
-- join points_events) → Mitglieder mit 0 Punkten diese Woche erscheinen auch.
-- week_key identisch zu v_weekly_leaderboard (0010) + jedem Punkte-Writer.
create or replace function public.class_leaderboard(p_class_id uuid)
returns table (
  rank         integer,
  user_id      uuid,
  display_name text,
  points       integer,
  is_me        boolean
)
language plpgsql stable security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null or not public.is_enrolled(p_class_id) then return; end if;
  return query
    with weekly as (
      select e.student_id as uid, coalesce(sum(pe.points), 0)::int as pts
      from class_enrollments e
      left join points_events pe
        on pe.user_id = e.student_id
       and pe.week_key = to_char((now() at time zone 'utc'), 'IYYY"-W"IW')
      where e.class_id = p_class_id and e.status = 'active'
      group by e.student_id
    ), ranked as (
      select w.uid, w.pts, rank() over (order by w.pts desc) as rnk
      from weekly w
    )
    select r.rnk::int, r.uid, pr.display_name, r.pts, (r.uid = v_uid)
    from ranked r left join profiles pr on pr.id = r.uid
    order by r.rnk, r.uid;
end $$;
revoke all on function public.class_leaderboard(uuid) from public, anon;
grant  execute on function public.class_leaderboard(uuid) to authenticated;

-- ── Korrektur: join_class (0008) OUT-Param/Spalten-Ambiguität ───────
-- Die 0008-join_class deklariert via RETURNS TABLE die OUT-Spalten
-- (class_id, class_name, status). Diese verdecken zur LAUFZEIT die
-- gleichnamigen Tabellenspalten in der Zähl-Query UND im ON CONFLICT-Ziel /
-- SET → PL/pgSQL „column reference is ambiguous" (nie getriggert, weil das
-- Klasse-Feature flag-off + ungetestet war). Spalten in INSERT/ON CONFLICT
-- lassen sich nicht aliasen → der saubere Fix ist `#variable_conflict
-- use_column` (die OUT-Params werden nirgends namentlich gelesen; return query
-- ist positional). Sonst byte-identisch zu 0008. Läuft nach 0008 → korrigiert
-- Bestand + Fresh-Bootstrap.
create or replace function public.join_class(p_code text)
returns table (class_id uuid, class_name text, status text)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare v_class classes%rowtype; v_uid uuid := auth.uid(); v_count int; v_max constant int := 200;
begin
  if v_uid is null then raise exception 'unauthorized' using errcode='42501'; end if;
  if (select count(*) from class_join_attempts where user_id = v_uid and attempted_at > now() - interval '15 min') >= 10
     then raise exception 'rate_limited' using errcode='53400'; end if;
  insert into class_join_attempts(user_id) values (v_uid);

  select * into v_class from classes where join_code = upper(trim(p_code)) and archived_at is null;
  if not found then raise exception 'invalid_class_code' using errcode='P0002'; end if;
  select count(*) into v_count from class_enrollments where class_id = v_class.id and status = 'active';
  if v_count >= v_max then raise exception 'class_full' using errcode='P0001'; end if;

  insert into class_enrollments (class_id, student_id, status, joined_at)
  values (v_class.id, v_uid, 'active', now())
  on conflict (class_id, student_id) do update set status='active', joined_at=now();
  return query select v_class.id, v_class.name, 'active'::text;
end $$;
revoke all on function public.join_class(text) from public, anon;
grant  execute on function public.join_class(text) to authenticated;
