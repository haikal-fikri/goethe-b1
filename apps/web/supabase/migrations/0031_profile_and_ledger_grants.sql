-- 0031 — Spalten-Grants härten (Avatar-IDOR + Daily-Mix-Ledger) (Security-Review-Fix)
--
-- (1) profiles.avatar_url — IDOR-Fix.
--     0005 versucht, avatar_url client-unschreibbar zu machen mit
--       revoke update (avatar_url) on profiles from authenticated, anon;
--     Das ist in Postgres WIRKUNGSLOS: ein Spalten-REVOKE subtrahiert NICHT vom
--     Tabellen-GRANT. Supabase erteilt `authenticated` per Default UPDATE auf der
--     ganzen Tabelle (der Client aktualisiert profiles direkt), also bleibt
--     avatar_url schreibbar. Ein Nutzer kann sein eigenes avatar_url auf den
--     Storage-Key eines anderen Nutzers setzen; /api/profile/avatar liest den Key
--     und signiert ihn mit dem Service-Role-Client → fremdes (privates) Avatar.
--     Fix: Tabellen-UPDATE entziehen, dann NUR die legitim client-schreibbaren
--     Spalten neu granten (identisch mit der Mobile-Whitelist in
--     apps/mobile/src/lib/db.ts; teacher-web ProfilForm schreibt nur display_name).
--     avatar_url / id / created_at / updated_at bleiben ausgeschlossen. Die
--     "profiles update own"-RLS-Policy (0005) pinnt die Zeile weiterhin auf auth.uid().
--
-- (2) daily_mix_runs — Leaderboard-Integrität.
--     0012 lässt den Client die eigene Ledger-Zeile LÖSCHEN ("daily_mix delete own"),
--     während insert/update entzogen sind. Diese Zeile mit bonus_awarded=true ist der
--     Idempotenz-Schutz für den ungedeckelten 40-Punkte-Daily-Mix-Bonus. Löschen →
--     start_set legt eine frische Zeile an → Bonus erneut kassierbar (Farming).
--     Fix: delete-Policy droppen + delete entziehen (kein legitimer Client-Löschbedarf).

-- (1) ------------------------------------------------------------------
revoke update on profiles from authenticated, anon;
grant update (display_name, native_language, exam_date, reminder_opt_in,
              reminder_time, theme, level, onboarded_at)
  on profiles to authenticated;

-- (2) ------------------------------------------------------------------
drop policy if exists "daily_mix delete own" on daily_mix_runs;
revoke delete on daily_mix_runs from authenticated, anon;
