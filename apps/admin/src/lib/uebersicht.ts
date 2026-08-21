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
      oversightCount(sb, "entitlements", { status: "active" }),
      oversightCount(sb, "organizations"),
      oversightCount(sb, "classes"),
      oversightCount(sb, "class_enrollments", { status: "active" }),
      countAvvOffen(sb),
      listAktivitaet(sb),
    ]);

  return { konten, aktiveAbos, organisationen, klassen, einschreibungen, avvOffen, aktivitaet };
}

/**
 * Lehrkräfte mit aktivem Abo ohne Zustimmung zur aktuellen AVV-Version.
 * Mengendifferenz in JS statt „not in (subquery)" — postgrest kann das nicht,
 * und beide Mengen sind klein (eine Zeile je Lehrkraft).
 */
async function countAvvOffen(sb: SupabaseClient): Promise<number | null> {
  const [{ data: ents, error: entErr }, { data: dpas, error: dpaErr }] = await Promise.all([
    sb.from("entitlements").select("user_id").eq("status", "active"),
    sb.from("teacher_agreements").select("teacher_id").eq("dpa_version", CURRENT_DPA_VERSION),
  ]);
  if (entErr || dpaErr || !ents || !dpas) return null;

  const akzeptiert = new Set((dpas as Array<{ teacher_id: string }>).map((d) => d.teacher_id));
  const lehrkraefte = new Set((ents as Array<{ user_id: string }>).map((e) => e.user_id));
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
  const known: Record<string, string> = {
    "role.grant": "Rolle vergeben",
    "corpus.update": "Korpus bearbeitet",
    "entitlement.write": "Abo geändert",
    "audio.purge": "Audio gelöscht",
    "dsar.delete": "Betroffenenanfrage: Löschung",
    "dsar.export": "Betroffenenanfrage: Auskunft",
    "retention.sweep": "Aufbewahrungslauf",
    "term.close": "Kurs abgeschlossen",
    "fair_use.alert": "Faire Nutzung: Hinweis",
  };
  return known[action] ?? action;
}

/** Akzentfarbe je Aktionsfamilie (Aktivitätsliste). */
export function auditTone(action: string): string {
  if (action.startsWith("role.")) return "var(--lila)";
  if (action.startsWith("corpus.")) return "var(--blau)";
  if (action.startsWith("dsar.") || action.startsWith("audio.") || action.startsWith("retention."))
    return "var(--gold)";
  if (action.startsWith("entitlement.")) return "var(--gruen)";
  return "var(--text-3)";
}
