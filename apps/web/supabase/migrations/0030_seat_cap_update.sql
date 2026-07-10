-- 0030 — Seat-Cap auch bei Reaktivierung erzwingen (Phase-4 Review-Fix)
--
-- 0026 erzwingt den ≤20-Teacher-Seat-Cap nur über den BEFORE-INSERT-Trigger
-- `enforce_seat_cap`. `claim_org_invite()` nutzt INSERT ... ON CONFLICT DO
-- UPDATE, sodass der BEFORE-INSERT-Trigger auch auf dem Reaktivierungs-Pfad
-- feuert und der Cap greift. Ein DIREKTES `update org_members set status='active'`
-- (z. B. reactivateSeat aus dem Client, unter der "orgmem owner all"-FOR-ALL-
-- Policy erlaubt) umgeht den Cap jedoch, weil KEIN BEFORE-UPDATE-Trigger
-- existiert. Ein Owner am Cap könnte so einen Seat sperren, einen neuen einladen
-- (INSERT-Pfad, Cap zählt korrekt) und den gesperrten reaktivieren → > 20 aktive
-- Seats (Plan-/Billing-Invarianten-Bruch).
--
-- Fix: BEFORE-UPDATE-Trigger, der dieselbe geprüfte Funktion wiederverwendet.
-- `trg_enforce_seat_cap()` ist rein NEW-basiert (zählt aktive teacher-Seats der
-- Org EXKL. new.user_id und wirft bei >= max_seats) und damit für UPDATE
-- korrekt. Die WHEN-Klausel begrenzt ihn auf den Übergang → 'active', sodass
-- andere Spalten-Updates (bereits aktiver Seat) den Trigger nicht auslösen.

drop trigger if exists enforce_seat_cap_update on org_members;
create trigger enforce_seat_cap_update
  before update on org_members
  for each row
  when (new.status = 'active' and old.status is distinct from 'active')
  execute function public.trg_enforce_seat_cap();
