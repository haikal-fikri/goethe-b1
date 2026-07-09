-- ============================================================
--  RLS-Testmatrix (RLS-1 … RLS-35) — Sicherheits-Gate (CI)
--  Plain-SQL-Assertions gegen die TATSÄCHLICH ausgelieferten Policy-Namen
--  (die Kernlektion des Red-Teams). Läuft unter reinem psql:
--    psql "$SHADOW_URL" -f apps/web/supabase/tests/rls_matrix.sql
--  Voraussetzung: 0001–0010 sind auf der (Wegwerf-)Shadow-DB angewandt
--  + der Supabase-auth/storage-Shim. Läuft in einer Transaktion und rollt
--  zurück → nicht-destruktiv, wiederholbar.
--  NIEMALS gegen die Live-DB (legt Fixtures in auth.users an).
-- ============================================================
\set ON_ERROR_STOP on
begin;

\set stuA '11111111-1111-1111-1111-111111111111'
\set stuB '22222222-2222-2222-2222-222222222222'
\set teaX '33333333-3333-3333-3333-333333333333'
\set teaY '44444444-4444-4444-4444-444444444444'
\set teaZ '55555555-5555-5555-5555-555555555555'
\set clsX '''aaaaaaaa-0000-0000-0000-000000000001'''
\set clsY '''aaaaaaaa-0000-0000-0000-000000000002'''
\set clsZ '''aaaaaaaa-0000-0000-0000-000000000003'''
\set asgX '''cccccccc-0000-0000-0000-000000000001'''
\set asgY '''cccccccc-0000-0000-0000-000000000002'''
\set resA '''bbbbbbbb-0000-0000-0000-00000000000a'''
\set resB '''bbbbbbbb-0000-0000-0000-00000000000b'''

-- Test-Helfer ----------------------------------------------------------
create or replace function pg_temp.assert(_desc text, cond boolean)
returns void language plpgsql as $$
begin
  if cond is null or not cond then raise exception 'ASSERT FAILED: %', _desc; end if;
  raise notice 'ok  %', _desc;
end $$;

-- Erwartet Scheitern mit RLS/Rechte/Guard-Fehler. SECURITY INVOKER → läuft als Aufrufer.
create or replace function pg_temp.assert_denied(_desc text, ddl text)
returns void language plpgsql as $$
begin
  begin execute ddl;
  exception
    when insufficient_privilege then raise notice 'ok  % (denied 42501)', _desc; return;
    when check_violation      then raise notice 'ok  % (check)', _desc; return;
    when raise_exception      then raise notice 'ok  % (guard)', _desc; return;
    when others then raise exception 'ASSERT FAILED: % — unerwartet % %', _desc, sqlstate, sqlerrm;
  end;
  raise exception 'ASSERT FAILED: % — NICHT abgelehnt', _desc;
end $$;

create or replace function pg_temp.assert_update_zero(_desc text, ddl text)
returns void language plpgsql as $$
declare n integer;
begin
  execute ddl; get diagnostics n = row_count;
  if n <> 0 then raise exception 'ASSERT FAILED: % — % Zeilen (erwartet 0)', _desc, n; end if;
  raise notice 'ok  % (0 rows)', _desc;
end $$;

create or replace function pg_temp.tests_as(_uid uuid, _role text default 'student')
returns void language plpgsql as $$
begin
  perform set_config('role','authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub',_uid::text,'role','authenticated',
                      'app_metadata', json_build_object('role',_role))::text, true);
end $$;

-- ── Fixtures (Superuser → RLS umgangen; simuliert Service-Role) ────────
insert into auth.users (id, email) values
  (:'stuA','stua@test.de'), (:'stuB','stub@test.de'),
  (:'teaX','teax@test.de'), (:'teaY','teay@test.de'), (:'teaZ','teaz@test.de');

insert into skills (code, name_de) values ('schreiben','Schreiben') on conflict do nothing;
insert into tasks (code, skill_code, label_de, label_en) values ('t1','schreiben','T1','T1') on conflict do nothing;
insert into functions (code, name_de, name_en) values ('f1','F1','F1') on conflict do nothing;
insert into redemittel (id, phrase_de, translation_en, level, skill_code, task_code, function_code, tokens, cloze_template)
  values ('itemX','Wie geht es dir?','How are you?','B1','schreiben','t1','f1',
          array['Wie','geht','es','dir?']::text[], '{{Wie}} geht es {{dir?}}');
-- 0011 i18n: languages seeded by the migration; add a reviewed translation for itemX (RLS-37).
insert into languages (code, name_native, name_de, enabled) values ('en','English','Englisch', true) on conflict do nothing;
insert into redemittel_translation (row_id, lang, translation, status) values ('itemX','en','How are you?','reviewed') on conflict do nothing;

insert into entitlements (user_id, status) values (:'teaX','active'), (:'teaZ','revoked');
insert into classes (id, teacher_id, name) values
  (:clsX, :'teaX', 'clsX'), (:clsY, :'teaY', 'clsY'), (:clsZ, :'teaZ', 'clsZ');
insert into class_enrollments (class_id, student_id, status) values
  (:clsX, :'stuA', 'active'),      -- teaX teilt aktiv mit stuA
  (:clsZ, :'stuA', 'active');      -- teaZ teilt aktiv, aber Sub revoked
-- stuA ist NICHT in clsY (teaY) → RLS-11/18.

insert into exam_results (id, user_id, aufgabe, gesamtpunkte, max_punkte, bestanden, result)
  values (:resA, :'stuA', 1, 28, 40, true, '{}'::jsonb),
         (:resB, :'stuB', 1, 30, 40, true, '{}'::jsonb);
-- 0020 assignments_writing_source_ck: a kind='writing' row needs EXACTLY ONE of
-- task_id (corpus) XOR prompt_de (custom). These are custom (prompt_de set).
insert into assignments (id, class_id, kind, title, prompt_de) values
  (:asgX, :clsX, 'writing','A1','Custom-Aufgabe A1'),   -- in clsX (stuA eingeschrieben)
  (:asgY, :clsY, 'writing','A2','Custom-Aufgabe A2');   -- in clsY (stuA NICHT eingeschrieben)
insert into assignment_submissions (assignment_id, student_id, status, exam_result_id)
  values (:asgX, :'stuA', 'submitted', :resA);

-- ═══ RLS-1…6 — Forge/Recompute (stuA) ═══
select pg_temp.tests_as(:'stuA');
select pg_temp.assert_denied('RLS-1 stuA insert exam_results',
  format('insert into exam_results (user_id,aufgabe,gesamtpunkte,max_punkte,bestanden,result) values (%L,1,40,40,true,''{}''::jsonb)', :'stuA'));
select pg_temp.assert_update_zero('RLS-2 stuA update exam_results',
  'update exam_results set gesamtpunkte=100 where true');
select pg_temp.assert_denied('RLS-3 stuA insert entitlements',
  format('insert into entitlements (user_id,status) values (%L,''active'')', :'stuA'));
select pg_temp.assert_denied('RLS-4 stuA insert exercise_attempts direct',
  format('insert into exercise_attempts (user_id,item_id,lesson_id,kind,correct) values (%L,''itemX'',''les'',''wordbank'',true)', :'stuA'));
select pg_temp.assert_denied('RLS-5 stuA update exercise_progress direct',
  'update exercise_progress set correct_count=999 where true');
select record_attempt('itemX','les','wordbank', array['falsch']::text[]);
select pg_temp.assert('RLS-6 record_attempt recompute → correct=false',
  (select last_correct = false from exercise_progress where user_id = :'stuA' and item_id='itemX'));
select record_attempt('itemX','les','cloze', array['Wie','dir?']::text[]);
select pg_temp.assert('RLS-6b cloze recompute → correct=true',
  (select last_correct = true from exercise_progress where user_id = :'stuA' and item_id='itemX'));

-- ═══ RLS-7…9 — Cross-Tenant (stuB liest stuA) ═══
select pg_temp.tests_as(:'stuB');
select pg_temp.assert('RLS-7 stuB !read stuA exam_results', (select count(*) = 0 from exam_results where user_id = :'stuA'));
select pg_temp.assert('RLS-8 stuB !read stuA profile',      (select count(*) = 0 from profiles where id = :'stuA'));
select pg_temp.assert('RLS-9 stuB !read stuA attempts',     (select count(*) = 0 from exercise_attempts where user_id = :'stuA'));

-- ═══ RLS-10…15 — Teacher-Gate ═══
select pg_temp.tests_as(:'teaX','teacher');
select pg_temp.assert('RLS-10 teaX liest stuA profile',            (select count(*) = 1 from profiles where id = :'stuA'));
select pg_temp.assert('RLS-10b teaX liest stuA exam_result (asgX)', (select count(*) = 1 from exam_results where user_id = :'stuA'));
select pg_temp.tests_as(:'teaY','teacher');
select pg_temp.assert('RLS-11 teaY (keine geteilte Klasse) → 0',   (select count(*) = 0 from profiles where id = :'stuA'));
select pg_temp.tests_as(:'teaZ','teacher');
select pg_temp.assert('RLS-15 teaZ (Sub revoked) → 0',             (select count(*) = 0 from profiles where id = :'stuA'));
select pg_temp.tests_as(:'stuA');
select pg_temp.assert('RLS-12 jwt_role bleibt student', (select public.jwt_role() = 'student'));

-- RLS-13 removed → teaX 0
reset role; select set_config('request.jwt.claims','',true);
update class_enrollments set status='removed' where class_id=:clsX and student_id=:'stuA';
select pg_temp.tests_as(:'teaX','teacher');
select pg_temp.assert('RLS-13 removed enrollment → teaX 0', (select count(*) = 0 from profiles where id = :'stuA'));
reset role;
update class_enrollments set status='active' where class_id=:clsX and student_id=:'stuA';
-- RLS-14 archived → teaX 0
update classes set archived_at=now() where id=:clsX;
select pg_temp.tests_as(:'teaX','teacher');
select pg_temp.assert('RLS-14 archived class → teaX 0', (select count(*) = 0 from profiles where id = :'stuA'));
reset role;
update classes set archived_at=null where id=:clsX;

-- ═══ RLS-16…20 — Enrollment-Backdoor + Submission-Forge ═══
update class_enrollments set status='removed' where class_id=:clsX and student_id=:'stuA';
select pg_temp.tests_as(:'stuA');
select pg_temp.assert_update_zero('RLS-16 stuA(removed) self-reactivate → 0',
  format('update class_enrollments set status=''active'' where student_id=%L', :'stuA'));
select pg_temp.assert_update_zero('RLS-17 stuA class-hop → 0',
  format('update class_enrollments set class_id=%L where student_id=%L and class_id=%L', :clsZ, :'stuA', :clsX));
select pg_temp.assert_denied('RLS-18 stuA submit in nicht-eingeschriebene Klasse (clsY)',
  format('insert into assignment_submissions (assignment_id,student_id,status) values (%L,%L,''submitted'')', :asgY, :'stuA'));
reset role;
update class_enrollments set status='active' where class_id=:clsX and student_id=:'stuA';
select pg_temp.tests_as(:'stuA');
select pg_temp.assert_denied('RLS-19 stuA set status=graded',
  format('update assignment_submissions set status=''graded'' where student_id=%L', :'stuA'));
select pg_temp.assert_denied('RLS-20 stuA link fremdes exam_result (resB von stuB)',
  format('update assignment_submissions set exam_result_id=%L where student_id=%L', :resB, :'stuA'));

-- ═══ RLS-21…24 — Ledger default-deny · Speaking-Gate · anon ═══
select pg_temp.assert_denied('RLS-21a stuA delete class_join_attempts', 'delete from class_join_attempts where true');
select pg_temp.assert_denied('RLS-21b stuA select app_rate_limits',     'select count(*) from app_rate_limits');
select pg_temp.assert_denied('RLS-22 stuA insert speaking_submissions',
  format('insert into speaking_submissions (assignment_id,student_id,audio_key) values (gen_random_uuid(),%L,''victim'')', :'stuA'));
reset role; select set_config('request.jwt.claims','',true);
insert into speaking_assignments (id, class_id, teil, prompt_de)
  values ('dddddddd-0000-0000-0000-000000000001', :clsX, 2, 'P');
insert into speaking_submissions (id, assignment_id, student_id)
  values ('eeeeeeee-0000-0000-0000-000000000001','dddddddd-0000-0000-0000-000000000001', :'stuA');
insert into speaking_grades (submission_id, graded_by, criteria, released_at)
  values ('eeeeeeee-0000-0000-0000-000000000001', :'teaX', '{}'::jsonb, null);
select pg_temp.tests_as(:'stuA');
select pg_temp.assert('RLS-23 stuA sieht ungated speaking_grade nicht',
  (select count(*) = 0 from speaking_grades where submission_id='eeeeeeee-0000-0000-0000-000000000001'));
reset role; select set_config('request.jwt.claims','',true);
select set_config('role','anon', true);
select pg_temp.assert('RLS-24a anon → 0 profiles',            (select count(*) = 0 from profiles));
select pg_temp.assert('RLS-24b anon liest Content (redemittel)', (select count(*) >= 1 from redemittel));

-- ═══ RLS-25…35 — 0010 Gamification: scored tables (no client write, select-own) ═══
-- practice_sessions / points_events / readiness_snapshots / speech_practice sind
-- server-berechnet → wie exam_results/exercise_*: kein Client-insert/update/delete
-- (delete-own nur wo Reset erlaubt), select-own, geschrieben nur via SECURITY DEFINER RPC.
reset role; select set_config('request.jwt.claims','',true);
select pg_temp.tests_as(:'stuA');
-- Kein direkter Client-INSERT (revoke → 42501)
select pg_temp.assert_denied('RLS-25 stuA insert practice_sessions direct',
  format('insert into practice_sessions (user_id,lesson_id,module,item_ids) values (%L,''les'',''schreiben'',array[''itemX'']::text[])', :'stuA'));
select pg_temp.assert_denied('RLS-26 stuA insert points_events direct (ledger forge)',
  format('insert into points_events (user_id,kind,points,week_key) values (%L,''set_complete'',999,''2026-W01'')', :'stuA'));
select pg_temp.assert_denied('RLS-27 stuA insert readiness_snapshots direct',
  format('insert into readiness_snapshots (user_id,captured_on,overall,schreiben,sprechen,konnektoren) values (%L,current_date,99,99,99,99)', :'stuA'));
select pg_temp.assert_denied('RLS-28 stuA insert speech_practice direct',
  format('insert into speech_practice (user_id,item_id) values (%L,''itemX'')', :'stuA'));
-- Kein direkter Client-UPDATE (revoke → 42501)
select pg_temp.assert_denied('RLS-29 stuA update points_events (points forge)',
  'update points_events set points=999 where true');
select pg_temp.assert_denied('RLS-30 stuA update practice_sessions (hearts/points forge)',
  'update practice_sessions set points_awarded=999, hearts_left=99 where true');
-- Kein Client-DELETE auf Ledger/Snapshots (append-only)
select pg_temp.assert_denied('RLS-31a stuA delete points_events (ledger)', 'delete from points_events where true');
select pg_temp.assert_denied('RLS-31b stuA delete readiness_snapshots',    'delete from readiness_snapshots where true');
-- RPC-Schreibpfad funktioniert + select-own: start_set/record_speech_practice legen EIGENE Zeilen an
select start_set('schreiben__t1__f1');
select pg_temp.assert('RLS-32 stuA sieht eigene practice_session (RPC-geschrieben)',
  (select count(*) >= 1 from practice_sessions where user_id = :'stuA'));
select record_speech_practice('itemX');
select pg_temp.assert('RLS-32b stuA sieht eigene speech_practice (RPC-geschrieben)',
  (select count(*) = 1 from speech_practice where user_id = :'stuA' and item_id='itemX'));
-- Cross-Tenant: stuB liest stuA-Gamification-Zeilen nicht
select pg_temp.tests_as(:'stuB');
select pg_temp.assert('RLS-33 stuB !read stuA practice_sessions', (select count(*) = 0 from practice_sessions where user_id = :'stuA'));
select pg_temp.assert('RLS-34 stuB !read stuA points_events',     (select count(*) = 0 from points_events where user_id = :'stuA'));
-- anon default-deny
reset role; select set_config('request.jwt.claims','',true);
select set_config('role','anon', true);
select pg_temp.assert('RLS-35a anon → 0 practice_sessions', (select count(*) = 0 from practice_sessions));
select pg_temp.assert('RLS-35b anon → 0 points_events',     (select count(*) = 0 from points_events));

-- ═══ RLS-36…37 — 0012 Daily Mix (daily_mix_runs) + 0011 translations ═══
-- daily_mix_runs = server-computed (kein Client-write, select-own); redemittel_translation
-- = public read, service-role-write only (wie jede Content-Tabelle).
reset role; select set_config('request.jwt.claims','',true);
select pg_temp.tests_as(:'stuA');
select pg_temp.assert_denied('RLS-36a stuA insert daily_mix_runs direct',
  format('insert into daily_mix_runs (user_id,run_on) values (%L,current_date)', :'stuA'));
select pg_temp.assert_denied('RLS-36b stuA update daily_mix_runs (bonus forge)',
  'update daily_mix_runs set bonus_awarded=true where true');
-- RPC-Schreibpfad: start_set('daily_mix') legt EIGENE daily_mix_runs-Zeile an
select start_set(null::text, 'daily_mix');
select pg_temp.assert('RLS-36c stuA sieht eigenen daily_mix_run (RPC-geschrieben)',
  (select count(*) >= 1 from daily_mix_runs where user_id = :'stuA' and run_on = (now() at time zone 'utc')::date));
-- Cross-Tenant + public-read translations
select pg_temp.tests_as(:'stuB');
select pg_temp.assert('RLS-36d stuB !read stuA daily_mix_runs', (select count(*) = 0 from daily_mix_runs where user_id = :'stuA'));
select pg_temp.assert('RLS-37a stuB liest Übersetzungen (public read)',
  (select count(*) >= 1 from redemittel_translation where row_id='itemX' and lang='en'));
select pg_temp.assert_denied('RLS-37b stuB insert redemittel_translation (service-role only)',
  'insert into redemittel_translation (row_id,lang,translation) values (''itemX'',''id'',''forge'')');
-- anon default-deny (daily_mix_runs) + public content read (translations)
reset role; select set_config('request.jwt.claims','',true);
select set_config('role','anon', true);
select pg_temp.assert('RLS-37c anon → 0 daily_mix_runs', (select count(*) = 0 from daily_mix_runs));
select pg_temp.assert('RLS-37d anon liest Übersetzungen (public)', (select count(*) >= 1 from redemittel_translation));

-- ═══════════════════════════════════════════════════════════════════════════
--  Teacher-LMS T-1 … T-28b (migrations 0016–0026). Against shipped policy names.
--  New actors: teaP/teaP2 (pro owners), teaSeat (lead), taTA (assistant), stuC (invited).
--  Convention: all new UUIDs stored RAW; referenced with :'var' (bare SQL) and %L
--  (inside format()) — matching the shipped :'stuA' style.
--  Route-level tests (T-22b DPA-gate, T-23b consent-gate, T-27b grade-carve-out) are
--  proven in the Phase-3 route suite, not here (no HTTP layer in psql).
-- ═══════════════════════════════════════════════════════════════════════════
reset role; select set_config('request.jwt.claims','',true);

\set teaP    77777777-7777-7777-7777-777777777777
\set teaP2   88888888-8888-8888-8888-888888888888
\set teaSeat 99999999-9999-9999-9999-999999999999
\set taTA    a1a1a1a1-1111-1111-1111-111111111111
\set stuC    c1c1c1c1-1111-1111-1111-111111111111
\set clsX2   aaaaaaaa-0000-0000-0000-000000000012
\set clsX3   aaaaaaaa-0000-0000-0000-000000000013
\set clsP    aaaaaaaa-0000-0000-0000-0000000000f1
\set clsTerm aaaaaaaa-0000-0000-0000-0000000000f2
\set orgO1   ff000000-0000-0000-0000-000000000001
\set orgO2   ff000000-0000-0000-0000-000000000002
\set asgP    cccccccc-0000-0000-0000-0000000000f1
\set subP    cccccccc-0000-0000-0000-0000000000f2
\set spkAsgP dddddddd-0000-0000-0000-0000000000f1
\set spkSubP eeeeeeee-0000-0000-0000-0000000000f1
\set sessF1  bbbbbbbb-0000-0000-0000-0000000000f1

insert into auth.users (id, email) values
  (:'teaP','teap@test.de'), (:'teaP2','teap2@test.de'),
  (:'teaSeat','teaseat@test.de'), (:'taTA','tata@test.de'), (:'stuC','stuc@test.de');
insert into entitlements (user_id, status, plan) values
  (:'teaP','active','pro'), (:'teaP2','active','pro');

-- teaX (starter) → 3-class cap (clsX exists; add clsX2, clsX3).
insert into classes (id, teacher_id, name) values (:'clsX2', :'teaX', 'clsX2'), (:'clsX3', :'teaX', 'clsX3');
-- teaX → 60-student cap: 60 dummy students in clsX2 (+ stuA in clsX = 61 distinct).
with ins as (
  insert into auth.users (id, email)
    select gen_random_uuid(), 'dummy_stu_'||g||'@test.de' from generate_series(1,60) g returning id)
insert into class_enrollments (class_id, student_id, status) select :'clsX2', id, 'active' from ins;

-- Pro org O1 (teaP owner) + seats; clsP org class; teaSeat lead, taTA assistant.
insert into organizations (id, owner_id, name) values (:'orgO1', :'teaP', 'Org O1');
insert into org_members (org_id, user_id, role, status) values
  (:'orgO1', :'teaP', 'owner', 'active'), (:'orgO1', :'teaSeat', 'teacher', 'active'), (:'orgO1', :'taTA', 'teacher', 'active');
insert into classes (id, teacher_id, org_id, name) values (:'clsP', :'teaP', :'orgO1', 'clsP');
insert into class_staff (class_id, teacher_id, role, assigned_by) values
  (:'clsP', :'teaSeat', 'lead', :'teaP'), (:'clsP', :'taTA', 'assistant', :'teaP');
-- Term-ended class (teaP, no class cap) for the is_class_locked test.
insert into classes (id, teacher_id, name, term_start, term_end) values
  (:'clsTerm', :'teaP', 'clsTerm', current_date - 30, current_date - 1);

-- Pending invites for stuC: clsP (teaP, no cap) + clsX2 (teaX, at cap).
insert into class_invites (class_id, email, invited_by) values
  (:'clsP', 'stuc@test.de', :'teaP'), (:'clsX2', 'stuc@test.de', :'teaX');

-- ═══ T-1 — class cap ═══
select pg_temp.tests_as(:'teaX','teacher');
select pg_temp.assert_denied('T-1 teaX at 3-class cap insert 4th',
  format('insert into classes (teacher_id,name) values (%L,''cls4'')', :'teaX'));

-- ═══ T-2 / T-3 — claim_invites (stuC email; clsP succeeds, clsX2 skipped over cap) ═══
select set_config('role','authenticated', true);
select set_config('request.jwt.claims',
  json_build_object('sub',:'stuC','role','authenticated','email','stuc@test.de',
                    'app_metadata', json_build_object('role','student'))::text, true);
select claim_invites();
reset role; select set_config('request.jwt.claims','',true);
select pg_temp.assert('T-2 stuC enrolled in clsP via claim_invites',
  (select count(*) = 1 from class_enrollments where class_id = :'clsP' and student_id = :'stuC' and status = 'active'));
select pg_temp.assert('T-3 teaX(at cap) invite stays pending',
  (select status = 'pending' from class_invites where class_id = :'clsX2' and lower(email) = 'stuc@test.de'));

-- ═══ T-4 / T-5 — invite read/forge ═══
select pg_temp.tests_as(:'stuB');
select pg_temp.assert('T-4 stuB !read class_invites', (select count(*) = 0 from class_invites));
select pg_temp.tests_as(:'teaX','teacher');
select pg_temp.assert_denied('T-5 teaX update invite → accepted (with-check only revoked)',
  format('update class_invites set status=''accepted'' where class_id=%L', :'clsX2'));

-- ═══ T-19b — writing route-only (client insert/update denied) ═══
select pg_temp.tests_as(:'stuA');
select pg_temp.assert_denied('T-19b stuA insert assignment_submissions (route-only)',
  format('insert into assignment_submissions (assignment_id,student_id,answer_text,status) values (%L,%L,''x'',''submitted'')', :asgX, :'stuA'));
select pg_temp.assert_denied('T-19b stuA update assignment_submissions.answer_text (route-only)',
  format('update assignment_submissions set answer_text=''forge'' where student_id=%L', :'stuA'));

-- AI-recommendation + grade + feedback fixtures for stuA's asgX submission (service-role rows).
reset role; select set_config('request.jwt.claims','',true);
insert into assignment_ai_recommendations (submission_id, recommended)
  select id, '{}'::jsonb from assignment_submissions where assignment_id = :asgX and student_id = :'stuA';
insert into assignment_grades (submission_id, final, gesamtpunkte, max_punkte, bestanden, graded_by, released_at)
  select id, '{}'::jsonb, 30, 40, true, :'teaX', null from assignment_submissions where assignment_id = :asgX and student_id = :'stuA';
insert into speaking_ai_recommendations (submission_id, recommended)
  values ('eeeeeeee-0000-0000-0000-000000000001', '{}'::jsonb);
insert into exam_result_feedback (exam_result_id, teacher_id, feedback_de, released_at)
  values (:resA, :'teaX', 'Gut gemacht.', null);
insert into guardian_consents (student_id, status) values (:'stuA', 'granted');
-- a class_sessions + attendance row in clsX for T-10/T-11.
insert into class_sessions (id, class_id, starts_at, ends_at)
  values (:'sessF1', :clsX, now(), now() + interval '90 min');
insert into attendance (session_id, student_id, status, marked_by)
  values (:'sessF1', :'stuA', 'present', :'teaX');

-- ═══ T-6/T-7/T-8 — AI drafts + unreleased grades hidden from the student ═══
select pg_temp.tests_as(:'stuA');
select pg_temp.assert('T-6 stuA !read assignment_ai_recommendations', (select count(*) = 0 from assignment_ai_recommendations));
select pg_temp.assert('T-7 stuA !read unreleased assignment_grades',   (select count(*) = 0 from assignment_grades));
select pg_temp.assert('T-8 stuA !read speaking_ai_recommendations',     (select count(*) = 0 from speaking_ai_recommendations));

-- ═══ T-9 — notification column-lock (only read_at) ═══
select pg_temp.assert_denied('T-9 stuA update notifications.title',
  format('update notifications set title=''x'' where user_id=%L', :'stuA'));

-- ═══ T-10 / T-11 — attendance cross-read + student session-cancel ═══
select pg_temp.tests_as(:'stuB');
select pg_temp.assert('T-10 stuB !read stuA attendance', (select count(*) = 0 from attendance where student_id = :'stuA'));
select pg_temp.tests_as(:'stuA');
select pg_temp.assert_update_zero('T-11 stuA cancel session (not teacher)',
  format('update class_sessions set status=''canceled'' where class_id=%L', :clsX));

-- ═══ T-12 / T-13 — teacher_student_readiness (security_invoker fix) ═══
reset role; select set_config('request.jwt.claims','',true);
grant execute on function public._readiness_for(uuid) to authenticated;  -- test-only (rolled back) for the equivalence check
select pg_temp.tests_as(:'teaX','teacher');
select pg_temp.assert('T-12 teacher_student_readiness(stuA)==_readiness_for(stuA)',
  (select count(*) >= 1 and bool_and(t.score = f.score)
     from teacher_student_readiness(:'stuA') t join public._readiness_for(:'stuA') f using (module)));
select pg_temp.tests_as(:'teaY','teacher');
select pg_temp.assert_denied('T-13 teaY teacher_student_readiness(stuA) forbidden',
  format('select * from teacher_student_readiness(%L)', :'stuA'));

-- ═══ T-14 / T-14b / T-15 — lapsed-sub + D3 drill-read drop ═══
select pg_temp.tests_as(:'teaZ','teacher');
select pg_temp.assert('T-14 teaZ(revoked) !read stuA exam_results', (select count(*) = 0 from exam_results where user_id = :'stuA'));
select pg_temp.assert('T-14b teaZ(revoked) !read stuA AI rec',  (select count(*) = 0 from assignment_ai_recommendations));
select pg_temp.assert('T-14b teaZ(revoked) !read stuA grades',  (select count(*) = 0 from assignment_grades));
select pg_temp.tests_as(:'teaX','teacher');
select pg_temp.assert('T-15 teaX !read stuA exercise_attempts (D3 drop)', (select count(*) = 0 from exercise_attempts where user_id = :'stuA'));

-- ═══ T-16 — admin cross-tenant read ═══
select pg_temp.tests_as(:'teaP2','admin');
select pg_temp.assert('T-16 admin reads classes cross-tenant',      (select count(*) >= 3 from classes));
select pg_temp.assert('T-16 admin reads entitlements cross-tenant', (select count(*) >= 1 from entitlements));

-- ═══ T-17 — usage_counters own-only ═══
reset role; select set_config('request.jwt.claims','',true);
insert into usage_counters (teacher_id, period, writing_ai_grades) values (:'teaP', to_char(now() at time zone 'utc','YYYY-MM'), 3);
select pg_temp.tests_as(:'teaX','teacher');
select pg_temp.assert('T-17 teaX !read teaP usage_counters', (select count(*) = 0 from usage_counters where teacher_id = :'teaP'));

-- ═══ T-18b — join-code path capped ═══
reset role; select join_code as jc from classes where id = :'clsX2' \gset
select set_config('role','authenticated', true);
select set_config('request.jwt.claims',
  json_build_object('sub',:'stuC','role','authenticated','app_metadata', json_build_object('role','student'))::text, true);
select pg_temp.assert_denied('T-18b stuC join_class(clsX2 code) over cap → class_full',
  format('select join_class(%L)', :'jc'));

-- ═══ T-20b / T-21b — consent + feedback release gates ═══
select pg_temp.tests_as(:'stuB');
select pg_temp.assert('T-20b stuB !read stuA guardian_consents', (select count(*) = 0 from guardian_consents where student_id = :'stuA'));
select pg_temp.tests_as(:'stuA');
select pg_temp.assert('T-21b stuA !read own unreleased exam_result_feedback', (select count(*) = 0 from exam_result_feedback where exam_result_id = :resA));
select pg_temp.tests_as(:'teaX','teacher');
select pg_temp.assert('T-21b teaX reads stuA exam_result_feedback (dashboard scope)', (select count(*) = 1 from exam_result_feedback where exam_result_id = :resA));

-- clsP assignment + stuC submission + AI recs + speaking (for the TA tests).
reset role; select set_config('request.jwt.claims','',true);
insert into assignments (id, class_id, kind, title, prompt_de) values (:'asgP', :'clsP', 'writing', 'AP', 'Custom AP');
insert into assignment_submissions (id, assignment_id, student_id, status, answer_text) values (:'subP', :'asgP', :'stuC', 'submitted', 'Antwort');
insert into assignment_ai_recommendations (submission_id, recommended) values (:'subP', '{}'::jsonb);
insert into speaking_assignments (id, class_id, teil, prompt_de) values (:'spkAsgP', :'clsP', 2, 'SP');
insert into speaking_submissions (id, assignment_id, student_id) values (:'spkSubP', :'spkAsgP', :'stuC');
insert into speaking_ai_recommendations (submission_id, recommended) values (:'spkSubP', '{}'::jsonb);

-- ═══ T-24b — TA grades: reads submissions/AI-recs + is_submission_grader true ═══
select pg_temp.tests_as(:'taTA','teacher');
select pg_temp.assert('T-24b TA reads clsP submission',            (select count(*) = 1 from assignment_submissions where id = :'subP'));
select pg_temp.assert('T-24b TA reads clsP AI recommendation',     (select count(*) = 1 from assignment_ai_recommendations where submission_id = :'subP'));
select pg_temp.assert('T-24b TA reads clsP speaking AI rec',       (select count(*) = 1 from speaking_ai_recommendations where submission_id = :'spkSubP'));
select pg_temp.assert('T-24b is_submission_grader(subP) true for TA',  (select public.is_submission_grader(:'subP')));
select pg_temp.assert('T-24b is_speaking_grader(spkSubP) true for TA', (select public.is_speaking_grader(:'spkSubP')));

-- ═══ T-25b — TA cannot manage (assignment/schedule create) ═══
select pg_temp.assert_denied('T-25b TA insert assignment (management)',
  format('insert into assignments (class_id,kind,title,prompt_de) values (%L,''writing'',''X'',''p'')', :'clsP'));
select pg_temp.assert_denied('T-25b TA insert class_schedule (management)',
  format('insert into class_schedules (class_id,weekday,start_time,starts_on) values (%L,1,''10:00'',current_date)', :'clsP'));

-- ═══ T-26b — seat cap + non-org staffing ═══
-- Org O2 (teaP2 owner) with 20 active teacher seats.
reset role; select set_config('request.jwt.claims','',true);
insert into organizations (id, owner_id, name) values (:'orgO2', :'teaP2', 'Org O2');
insert into org_members (org_id, user_id, role, status) values (:'orgO2', :'teaP2', 'owner', 'active');
with ins as (
  insert into auth.users (id, email)
    select gen_random_uuid(), 'dummy_tea_'||g||'@test.de' from generate_series(1,20) g returning id)
insert into org_members (org_id, user_id, role, status) select :'orgO2', id, 'teacher', 'active' from ins;
select pg_temp.tests_as(:'teaP2','teacher');
select pg_temp.assert_denied('T-26b owner insert 21st seat → seat_limit_reached',
  format('insert into org_members (org_id,user_id,role,status) values (%L,%L,''teacher'',''active'')', :'orgO2', :'stuB'));
-- Non-org user staffing on clsP (O1) → with-check fails (assignee not an org seat).
select pg_temp.tests_as(:'teaP','teacher');
select pg_temp.assert_denied('T-26b staff a non-org user → denied',
  format('insert into class_staff (class_id,teacher_id,role,assigned_by) values (%L,%L,''assistant'',%L)', :'clsP', :'stuA', :'teaP'));
-- Positive: a class LEAD (not owner) may assign a valid org-seat TA — regression for the
-- caller-RLS with-check bug (inline subquery ran under the lead's RLS and wrongly failed).
reset role; select set_config('request.jwt.claims','',true);
\set teaSeat2 a2a2a2a2-2222-2222-2222-222222222222
insert into auth.users (id, email) values (:'teaSeat2','teaseat2@test.de');
insert into org_members (org_id, user_id, role, status) values (:'orgO1', :'teaSeat2', 'teacher', 'active');
select pg_temp.tests_as(:'teaSeat','teacher');   -- teaSeat is the clsP LEAD
-- Top-level insert (a with-check regression would raise here → ON_ERROR_STOP aborts).
insert into class_staff (class_id, teacher_id, role, assigned_by)
  values (:'clsP', :'teaSeat2', 'assistant', :'teaSeat');
select pg_temp.assert('T-26c lead assigns a valid org-seat TA (succeeds)',
  (select count(*) = 1 from class_staff where class_id = :'clsP' and teacher_id = :'teaSeat2'));

-- ═══ T-27b — term-ended class locks new work (is_class_locked) ═══
select pg_temp.tests_as(:'teaP','teacher');
select pg_temp.assert_denied('T-27b insert assignment on term-ended class (is_class_locked)',
  format('insert into assignments (class_id,kind,title,prompt_de) values (%L,''writing'',''X'',''p'')', :'clsTerm'));

-- ═══ T-28b — lapsed OWNER sub zeroes every seat's authority ═══
reset role; select set_config('request.jwt.claims','',true);
update entitlements set status = 'revoked' where user_id = :'teaP';   -- owner sub lapses
select pg_temp.tests_as(:'taTA','teacher');
select pg_temp.assert('T-28b lapsed-owner: TA !read clsP submission', (select count(*) = 0 from assignment_submissions where id = :'subP'));
select pg_temp.assert_denied('T-28b lapsed-owner: TA teacher_student_readiness(stuC) forbidden',
  format('select * from teacher_student_readiness(%L)', :'stuC'));

reset role;
select 'RLS MATRIX + TEACHER-LMS T-MATRIX: ALL ASSERTIONS PASSED' as result;
rollback;
