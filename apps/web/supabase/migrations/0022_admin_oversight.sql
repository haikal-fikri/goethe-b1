-- ============================================================
--  0022 — Superadmin oversight + audit (D10).
--  is_admin() (JWT app_metadata.role='admin', 0005) gets cross-tenant READ for
--  oversight (OR-ed with the owner/teacher policies). Corpus edits go through
--  audited apps/admin service-role routes — never broad client write policies.
--  Canonical: teacher-lms/02 §7. Depends on: 0005 (is_admin), 0008–0021.
-- ============================================================

set check_function_bodies = off;

-- ── 7.1 Append-only audit_log (referenced by role-grant/DSAR/corpus/entitlement) ─
create table if not exists audit_log (
  id         uuid primary key default gen_random_uuid(),
  actor      uuid references auth.users(id) on delete set null,
  action     text not null,               -- 'corpus.update' | 'role.grant' | 'entitlement.write' | 'audio.purge' | 'dsar.delete' | …
  target     text,                        -- opaque ref (table:id) — no PII
  meta       jsonb not null default '{}'::jsonb,   -- metadata only; never essay/transcript/audio/email
  created_at timestamptz not null default now()
);
create index if not exists idx_audit_log_created on audit_log(created_at desc);
alter table audit_log enable row level security;
do $$ begin create policy "audit admin read" on audit_log for select using (public.is_admin()); exception when duplicate_object then null; end $$;
-- Service-role write only (no client insert policy).

-- ── 7.2 Cross-tenant READ for oversight (OR-ed with existing policies) ──────
do $$ begin create policy "profiles admin read"        on profiles                     for select using (public.is_admin()); exception when duplicate_object then null; end $$;
do $$ begin create policy "classes admin read"         on classes                      for select using (public.is_admin()); exception when duplicate_object then null; end $$;
do $$ begin create policy "enroll admin read"          on class_enrollments            for select using (public.is_admin()); exception when duplicate_object then null; end $$;
do $$ begin create policy "invites admin read"         on class_invites                for select using (public.is_admin()); exception when duplicate_object then null; end $$;
do $$ begin create policy "entitlements admin read"    on entitlements                 for select using (public.is_admin()); exception when duplicate_object then null; end $$;
do $$ begin create policy "exam_results admin read"    on exam_results                 for select using (public.is_admin()); exception when duplicate_object then null; end $$;
do $$ begin create policy "assign admin read"          on assignments                  for select using (public.is_admin()); exception when duplicate_object then null; end $$;
do $$ begin create policy "asub admin read"            on assignment_submissions       for select using (public.is_admin()); exception when duplicate_object then null; end $$;
do $$ begin create policy "agrade admin read"          on assignment_grades            for select using (public.is_admin()); exception when duplicate_object then null; end $$;
do $$ begin create policy "spk_sub admin read"         on speaking_submissions         for select using (public.is_admin()); exception when duplicate_object then null; end $$;
do $$ begin create policy "spk_grade admin read"       on speaking_grades              for select using (public.is_admin()); exception when duplicate_object then null; end $$;
do $$ begin create policy "readiness_snap admin read"  on readiness_snapshots          for select using (public.is_admin()); exception when duplicate_object then null; end $$;
do $$ begin create policy "sessions admin read"        on class_sessions               for select using (public.is_admin()); exception when duplicate_object then null; end $$;
do $$ begin create policy "attend admin read"          on attendance                   for select using (public.is_admin()); exception when duplicate_object then null; end $$;
-- (usage_counters admin read is in 0023; org/staffing admin reads in 0026.)

-- ── 7.3 Safe content-id allocation (note) ──────────────────────────────────
-- The legacy racy `id = coalesce(max(id),0)+1` for exam_simulations is replaced by
-- `pg_advisory_xact_lock(hashtext('exam_simulations_id')) + max(id)+1` INSIDE the
-- apps/admin /api/admin/corpus/exam-simulations transaction (05 §4.3). No schema
-- change here — content tables keep public-read + no client write.

notify pgrst, 'reload schema';
