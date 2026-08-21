import type { SupabaseClient } from "@supabase/supabase-js";

// Client-direkte Superadmin-Oversight-Reads unter RLS (teacher-lms/03 #29,
// 02 §16.5 + 0022). Jede dieser Tabellen hat eine `is_admin()`-SELECT-Policy
// (JWT app_metadata.role='admin'). NUR Lesen — jeder Admin-Write geht über die
// service-role-Route (/api/admin/corpus, /api/admin/grant-role). Die AI-Entwürfe
// (assignment_ai_recommendations / speaking_ai_recommendations) haben BEWUSST
// KEINE Admin-Read-Policy und fehlen hier.

export const OVERSIGHT_TABLES = [
  "profiles",
  "classes",
  "class_enrollments",
  "class_invites",
  "class_sessions",
  "attendance",
  "assignments",
  "assignment_submissions",
  "assignment_grades",
  "speaking_submissions",
  "speaking_grades",
  "exam_results",
  "exam_result_feedback",
  "readiness_snapshots",
  "entitlements",
  "usage_counters",
  "teacher_agreements",
  "guardian_consents",
  "organizations",
  "org_members",
  "org_invites",
  "class_staff",
  "audit_log",
] as const;

export type OversightTable = (typeof OVERSIGHT_TABLES)[number];

export interface OversightQuery {
  /** Spalten (default "*"). */
  columns?: string;
  /** Order-by-Spalte. */
  orderBy?: string;
  ascending?: boolean;
  limit?: number;
  /** Einfache Gleichheits-Filter (Spalte → Wert). */
  eq?: Record<string, string | number | boolean>;
}

/** Generischer, auf die is_admin()-lesbaren Tabellen begrenzter Oversight-Read. */
export function oversightList(
  sb: SupabaseClient,
  table: OversightTable,
  q: OversightQuery = {}
) {
  let query = sb.from(table).select(q.columns ?? "*");
  if (q.eq) {
    for (const [col, val] of Object.entries(q.eq)) query = query.eq(col, val);
  }
  if (q.orderBy) query = query.order(q.orderBy, { ascending: q.ascending ?? false });
  if (q.limit != null) query = query.limit(q.limit);
  return query;
}

/**
 * Zeilenzahl einer Oversight-Tabelle (HEAD-Request, überträgt keine Zeilen).
 *
 * Gibt bei einem Fehler bewusst `null` zurück, NICHT 0: ein RLS-Deny oder ein
 * Netzwerkfehler darf im Dashboard nicht als „0 Konten" erscheinen. Die UI
 * rendert null als „—".
 */
export async function oversightCount(
  sb: SupabaseClient,
  table: OversightTable,
  eq?: Record<string, string | number | boolean>
): Promise<number | null> {
  let query = sb.from(table).select("*", { count: "exact", head: true });
  if (eq) {
    for (const [col, val] of Object.entries(eq)) query = query.eq(col, val);
  }
  const { count, error } = await query;
  return error ? null : count ?? null;
}

// ── Bequeme Reader für die häufigsten Dashboards ────────────────────────────

/** Jüngste Audit-Log-Einträge (grant-role, term.close, corpus edits …). */
export function recentAuditLog(sb: SupabaseClient, limit = 100) {
  return oversightList(sb, "audit_log", { orderBy: "created_at", limit });
}

/** Alle Entitlements (Plan/Status je Lehrkraft) — Billing-Übersicht. */
export function listEntitlements(sb: SupabaseClient) {
  return oversightList(sb, "entitlements", { orderBy: "updated_at" });
}

/** Alle Organisationen (Pro-Orgs) + Seats zur Übersicht. */
export function listOrganizations(sb: SupabaseClient) {
  return oversightList(sb, "organizations", { orderBy: "created_at" });
}
