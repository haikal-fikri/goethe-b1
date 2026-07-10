-- ============================================================
--  0027 — billing_events (Polar-Webhook-Idempotenz).
--  teacher-lms/05 §1.3: der Webhook dedupliziert INSERT-first auf der Polar
--  event_id (on conflict do nothing → skip, wenn schon gesehen). Ein Subscription
--  erzeugt viele Events → Dedupe MUSS auf event_id sein, nicht auf subscription_id
--  (dafür ist entitlements.polar_subscription_id da). Deny-all: nur service-role
--  (Vercel B Webhook-Route) schreibt/liest; kein Client-Zugriff.
--  Depends on: nichts (eigenständige Ledger-Tabelle).
-- ============================================================

create table if not exists billing_events (
  event_id    text primary key,          -- Polar event id (Idempotenz-Schlüssel)
  event_type  text,                        -- z.B. 'subscription.active' (nur Metadaten)
  received_at timestamptz not null default now()
);

alter table billing_events enable row level security;
-- Keine Policies → RLS default-deny für anon/authenticated. Service-role (Webhook)
-- umgeht RLS. Zusätzlich Grants entziehen, damit auch kein direktes Table-Privileg bleibt.
revoke all on billing_events from public, anon, authenticated;
