-- ============================================================
--  RLS-Lint (CI-Gate) — scheitert, wenn irgendeine public-Tabelle
--  KEINE Row-Level-Security aktiviert hat. Verhindert die
--  app_rate_limits/class_join_attempts-Fehlerklasse (RLS vergessen).
--    psql "$SHADOW_URL" -f apps/web/supabase/tests/rls_lint.sql
-- ============================================================
\set ON_ERROR_STOP on
do $$
declare r record; bad text := '';
begin
  for r in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'          -- ordinäre Tabellen
      and not c.relrowsecurity
    order by c.relname
  loop bad := bad || ' ' || r.relname; end loop;
  if length(bad) > 0 then
    raise exception 'RLS-LINT FAILED — public-Tabellen ohne RLS:%', bad;
  end if;
  raise notice 'RLS-LINT: alle public-Tabellen haben RLS aktiviert';
end $$;
select 'RLS-LINT: OK' as result;
