-- ============================================================
--  0028 — cancel_session() idempotency fix.
--  Bug (adversarial review): die RETURN QUERY war vom guarded UPDATE entkoppelt —
--  der UPDATE hat `status <> 'canceled'` (0 Zeilen bei Wiederholung), die RETURN
--  QUERY gab aber IMMER alle aktiven student_ids zurück. Folge: ein zweiter
--  /cancel-Aufruf für denselben Termin fächerte notify + Push erneut an ALLE
--  Schüler:innen auf (Spam). Fix: die student_ids NUR zurückgeben, wenn dieser
--  Aufruf den Termin tatsächlich abgesagt hat (row_count via GET DIAGNOSTICS —
--  race-sicher, weil `status <> 'canceled'` atomar genau einen Gewinner hat).
--  Depends on: 0018 (cancel_session, is_session_teacher).
-- ============================================================

create or replace function public.cancel_session(p_session uuid, p_reason text)
returns setof uuid
language plpgsql security definer set search_path = public as $$
declare v_updated int;
begin
  if not public.is_session_teacher(p_session) then raise exception 'forbidden' using errcode = '42501'; end if;
  update class_sessions
     set status = 'canceled', cancel_reason = left(p_reason, 500), canceled_at = now(), canceled_by = auth.uid()
   where id = p_session and status <> 'canceled';
  get diagnostics v_updated = row_count;
  if v_updated = 0 then return; end if;   -- bereits abgesagt (oder unbekannt) → keine Empfänger, kein Re-Notify
  return query
    select e.student_id from class_enrollments e
    join class_sessions s on s.class_id = e.class_id
    where s.id = p_session and e.status = 'active';
end $$;
revoke all on function public.cancel_session(uuid, text) from public, anon;
grant execute on function public.cancel_session(uuid, text) to authenticated;

notify pgrst, 'reload schema';
