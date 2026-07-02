-- ============================================================
--  RLS-Testmatrix (RLS-1 … RLS-24) — Sicherheits-Gate (CI)
--  Plain-SQL-Assertions gegen die TATSÄCHLICH ausgelieferten Policy-Namen
--  (die Kernlektion des Red-Teams). Läuft unter reinem psql:
--    psql "$SHADOW_URL" -f apps/web/supabase/tests/rls_matrix.sql
--  Voraussetzung: 0001–0009 sind auf der (Wegwerf-)Shadow-DB angewandt
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
insert into assignments (id, class_id, kind, title) values
  (:asgX, :clsX, 'writing','A1'),   -- in clsX (stuA eingeschrieben)
  (:asgY, :clsY, 'writing','A2');   -- in clsY (stuA NICHT eingeschrieben)
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

reset role;
select 'RLS MATRIX: ALL 24 ASSERTIONS PASSED' as result;
rollback;
