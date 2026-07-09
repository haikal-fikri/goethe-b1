-- ============================================================
--  0019 — In-app notifications + push tokens (D9).
--  Recipient reads own + marks read; NO client insert/delete (service-role fan-out
--  via notify()). Push delivery is a route/cron job, not the DB's. Canonical: teacher-lms/02 §4.
--  Depends on: 0008.
-- ============================================================

set check_function_bodies = off;

do $$ begin create type notification_kind as enum
  ('assignment_new','assignment_graded','grade_released','session_canceled','session_reminder',
   'enrollment_added','enrollment_removed','announcement'); exception when duplicate_object then null; end $$;

create table if not exists notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,   -- recipient
  kind       notification_kind not null,
  title      text not null check (char_length(title) <= 160),
  body       text check (body is null or char_length(body) <= 500),
  data       jsonb not null default '{}'::jsonb,   -- deep-link refs {classId, assignmentId, sessionId, submissionId}
  read_at    timestamptz,
  pushed_at  timestamptz,                          -- set when Expo push delivered (route or push-flush cron)
  created_at timestamptz not null default now()
);
create index if not exists idx_notifications_user     on notifications(user_id, created_at desc);
create index if not exists idx_notifications_unread   on notifications(user_id) where read_at is null;
create index if not exists idx_notifications_unpushed on notifications(created_at) where pushed_at is null;   -- push-flush cron scan

alter table notifications enable row level security;
-- Recipient reads own; may mark read. NO insert/delete for clients (service-role fan-out via notify()).
do $$ begin create policy "notif select own" on notifications for select
  using (user_id = (select auth.uid())); exception when duplicate_object then null; end $$;
do $$ begin create policy "notif mark read" on notifications for update
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid())); exception when duplicate_object then null; end $$;
-- Column-lock: a client may only touch read_at (not forge title/body/kind/data on a row it can update).
revoke insert, delete on notifications from authenticated, anon;
revoke update on notifications from authenticated, anon;
grant  update (read_at) on notifications to authenticated;

create table if not exists push_tokens (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  token      text not null,                                  -- Expo push token
  platform   text check (platform in ('ios','android')),
  created_at timestamptz not null default now(),
  last_seen  timestamptz not null default now(),
  unique (user_id, token)
);
create index if not exists idx_push_tokens_user on push_tokens(user_id);
alter table push_tokens enable row level security;
-- Client registers/refreshes its OWN token (needed for push).
do $$ begin create policy "push all own" on push_tokens for all
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid())); exception when duplicate_object then null; end $$;

-- Fan-out primitive (service-role & other definer fns/routes call it; never client).
create or replace function public.notify(p_user uuid, p_kind notification_kind, p_title text, p_body text, p_data jsonb default '{}'::jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  insert into notifications(user_id, kind, title, body, data)
  values (p_user, p_kind, left(p_title,160), left(p_body,500), coalesce(p_data,'{}'::jsonb))
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public.notify(uuid, notification_kind, text, text, jsonb) from public, anon, authenticated;

notify pgrst, 'reload schema';
