import type { SupabaseClient } from "@supabase/supabase-js";
import { oversightCount, recentAuditLog } from "@/lib/data/oversight";
import { CURRENT_DPA_VERSION } from "@/lib/compliance";

// Daten der Konsolen-Übersicht. Alle Reads laufen über den RLS-scoped
// SSR-Client — die is_admin()-SELECT-Policies (0022–0026) gaten sie
// tenant-übergreifend. Wie im Lehrkraft-Dashboard bewusst mehrere flache
// Queries + JS-Zusammenbau statt verschachtelter Embeds: RLS auf einer
// eingebetteten Relation lässt Zeilen sonst stillschweigend verschwinden.
//
// `null` heißt „nicht lesbar" (Fehler/Deny) und wird als „—" gerendert —
// niemals als 0.

export interface AuditEntry {
  id: string;
  actor: string | null;
  action: string;
  target: string | null;
  createdAt: string;
}

export interface UebersichtData {
  konten: number | null;
  aktiveAbos: number | null;
  organisationen: number | null;
  klassen: number | null;
  einschreibungen: number | null;
  /** Lehrkräfte mit aktivem Abo, die die aktuelle AVV-Version nicht akzeptiert haben. */
  avvOffen: number | null;
  aktivitaet: AuditEntry[];
}

export async function getUebersichtData(sb: SupabaseClient): Promise<UebersichtData> {
  const [konten, aktiveAbos, organisationen, klassen, einschreibungen, avvOffen, aktivitaet] =
    await Promise.all([
      oversightCount(sb, "profiles"),
      countAktiveAbos(sb),
      oversightCount(sb, "organizations"),
      oversightCount(sb, "classes"),
      oversightCount(sb, "class_enrollments", { status: "active" }),
      countAvvOffen(sb),
      listAktivitaet(sb),
    ]);

  return { konten, aktiveAbos, organisationen, klassen, einschreibungen, avvOffen, aktivitaet };
}

/**
 * Aktive Abos — nach der Definition, die auch die DB benutzt
 * (`has_active_sub`, 0026): status='active' UND Periode nicht abgelaufen.
 * Nur auf `status` zu zählen überzeichnet: ein Abo bleibt nach dem Auslaufen
 * auf 'active' stehen, bis der Webhook es umschreibt.
 */
async function countAktiveAbos(sb: SupabaseClient): Promise<number | null> {
  const ids = await aktiveLehrkraftIds(sb);
  return ids === null ? null : ids.size;
}

/** IDs der Lehrkräfte mit wirksamem Abo — geteilte Grundmenge. */
export async function aktiveLehrkraftIds(sb: SupabaseClient): Promise<Set<string> | null> {
  const { data, error } = await sb
    .from("entitlements")
    .select("user_id, current_period_end")
    .eq("kind", "teacher_subscription")
    .eq("status", "active");
  if (error || !data) return null;
  const jetzt = Date.now();
  const ids = new Set<string>();
  for (const r of data as Array<{ user_id: string; current_period_end: string | null }>) {
    const ende = r.current_period_end ? new Date(r.current_period_end).getTime() : null;
    if (ende === null || Number.isNaN(ende) || ende > jetzt) ids.add(r.user_id);
  }
  return ids;
}

/**
 * Lehrkräfte mit aktivem Abo ohne Zustimmung zur aktuellen AVV-Version.
 * Mengendifferenz in JS statt „not in (subquery)" — postgrest kann das nicht,
 * und beide Mengen sind klein (eine Zeile je Lehrkraft).
 */
async function countAvvOffen(sb: SupabaseClient): Promise<number | null> {
  const [lehrkraefte, { data: dpas, error: dpaErr }] = await Promise.all([
    aktiveLehrkraftIds(sb),
    sb.from("teacher_agreements").select("teacher_id").eq("dpa_version", CURRENT_DPA_VERSION),
  ]);
  if (lehrkraefte === null || dpaErr || !dpas) return null;

  const akzeptiert = new Set((dpas as Array<{ teacher_id: string }>).map((d) => d.teacher_id));
  let offen = 0;
  for (const id of lehrkraefte) if (!akzeptiert.has(id)) offen++;
  return offen;
}

async function listAktivitaet(sb: SupabaseClient): Promise<AuditEntry[]> {
  const { data, error } = await recentAuditLog(sb, 20);
  if (error || !data) return [];
  // Der Client ist ungetypt (kein generiertes DB-Schema) — select("*") liefert
  // eine Union mit GenericStringError, daher der Umweg über unknown.
  return (data as unknown as Array<{
    id: string;
    actor: string | null;
    action: string;
    target: string | null;
    created_at: string;
  }>).map((r) => ({
    id: r.id,
    actor: r.actor,
    action: r.action,
    target: r.target,
    createdAt: r.created_at,
  }));
}

/** Deutsche Beschriftung für die bekannten audit_log-Aktionen. */
export function auditLabel(action: string): string {
  // Schlüssel = die Strings, die im Code TATSÄCHLICH geschrieben werden
  // (`grep -rhoE 'action: "[a-z_]+\.[a-z_]+"' apps/*/src packages/*/src`).
  // Erfundene Schlüssel greifen nie und lassen die Aktion roh erscheinen.
  const known: Record<string, string> = {
    "role.grant": "Rolle vergeben",
    "corpus.create": "Korpus: angelegt",
    "corpus.update": "Korpus: geändert",
    "corpus.delete": "Korpus: gelöscht",
    "entitlement.write": "Abo geändert",
    "billing.orphan": "Zahlung ohne Zuordnung",
    "audio.purge": "Audio gelöscht",
    "retention.sweep": "Aufbewahrungslauf",
    "consent.record": "Einwilligung erfasst",
    "dpa.accept": "AVV angenommen",
    "term.close": "Kurs abgeschlossen",
    "fairuse.flag": "Faire Nutzung: markiert",
  };
  return known[action] ?? action;
}

/** Akzentfarbe je Aktionsfamilie (Aktivitätsliste). */
export function auditTone(action: string): string {
  if (action.startsWith("role.")) return "var(--lila)";
  if (action.startsWith("corpus.")) return "var(--blau)";
  if (
    action.startsWith("audio.") ||
    action.startsWith("retention.") ||
    action.startsWith("consent.") ||
    action.startsWith("dpa.")
  )
    return "var(--gold)";
  if (action.startsWith("entitlement.") || action.startsWith("billing.")) return "var(--gruen)";
  if (action.startsWith("fairuse.")) return "var(--rot)";
  return "var(--text-3)";
}
