import type { SupabaseClient } from "@supabase/supabase-js";
import { CURRENT_DPA_VERSION } from "@/lib/compliance";

// Datenschutz-Zentrale. Real gestützt sind zwei Dinge:
//  · AVV-Zustimmungen  → teacher_agreements (0024), je (teacher, dpa_version)
//  · Compliance-Vorgänge → audit_log (0022), gefiltert auf die Lösch-/DSAR-Aktionen
//
// Die Comp zeigt zusätzlich eine DSR-Warteschlange mit Fristen und eine Tabelle
// laufender Aufbewahrungs-Jobs. Beides braucht eine Workflow-Tabelle, die es
// nicht gibt — hier steht deshalb die PROTOKOLL-Sicht (was ist passiert), nicht
// eine Warteschlange (was steht an).

/** audit_log-Aktionen, die als Compliance-Vorgang gelten. */
export const COMPLIANCE_ACTIONS = [
  "dsar.delete",
  "dsar.export",
  "audio.purge",
  "retention.sweep",
  "consent.withdraw",
  "consent.grant",
] as const;

export interface AvvVersionRow {
  version: string;
  zustimmungen: number;
  istAktuell: boolean;
  letzteZustimmung: string | null;
}

export interface ComplianceEvent {
  id: string;
  action: string;
  target: string | null;
  createdAt: string;
}

export interface DsgvoData {
  aktuelleVersion: string;
  /** Nenner: Lehrkräfte mit aktivem Abo. null = nicht lesbar. */
  aktiveLehrkraefte: number | null;
  /** Zustimmungen zur AKTUELLEN Version (Zähler). */
  aktuellZugestimmt: number | null;
  versionen: AvvVersionRow[];
  vorgaenge: ComplianceEvent[];
  /** true, wenn audit_log gelesen werden konnte (0 Vorgänge ≠ Lesefehler). */
  vorgaengeLesbar: boolean;
}

type Row = Record<string, unknown>;
const rows = (d: unknown): Row[] => (Array.isArray(d) ? (d as Row[]) : []);
const str = (v: unknown): string => (typeof v === "string" ? v : "");

export async function getDsgvoData(sb: SupabaseClient): Promise<DsgvoData> {
  const [agreements, ents, events] = await Promise.all([
    sb.from("teacher_agreements").select("teacher_id, dpa_version, accepted_at"),
    sb.from("entitlements").select("user_id").eq("status", "active"),
    sb
      .from("audit_log")
      .select("id, action, target, created_at")
      .in("action", COMPLIANCE_ACTIONS as unknown as string[])
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  // Je Version die Menge zustimmender Lehrkräfte (eine Lehrkraft kann mehreren
  // Versionen zugestimmt haben — PK ist (teacher_id, dpa_version)).
  const perVersion = new Map<string, { teachers: Set<string>; last: string | null }>();
  for (const a of rows(agreements.data)) {
    const v = str(a.dpa_version);
    if (!v) continue;
    const entry = perVersion.get(v) ?? { teachers: new Set<string>(), last: null };
    entry.teachers.add(str(a.teacher_id));
    const at = str(a.accepted_at);
    if (at && (!entry.last || at > entry.last)) entry.last = at;
    perVersion.set(v, entry);
  }

  const versionen: AvvVersionRow[] = [...perVersion.entries()]
    .map(([version, e]) => ({
      version,
      zustimmungen: e.teachers.size,
      istAktuell: version === CURRENT_DPA_VERSION,
      letzteZustimmung: e.last,
    }))
    .sort((a, b) => b.version.localeCompare(a.version));

  // Die aktuelle Version immer zeigen, auch ohne einzige Zustimmung.
  if (!versionen.some((v) => v.istAktuell)) {
    versionen.unshift({
      version: CURRENT_DPA_VERSION,
      zustimmungen: 0,
      istAktuell: true,
      letzteZustimmung: null,
    });
  }

  return {
    aktuelleVersion: CURRENT_DPA_VERSION,
    aktiveLehrkraefte: ents.error
      ? null
      : new Set(rows(ents.data).map((e) => str(e.user_id))).size,
    aktuellZugestimmt: agreements.error
      ? null
      : perVersion.get(CURRENT_DPA_VERSION)?.teachers.size ?? 0,
    versionen: agreements.error ? [] : versionen,
    vorgaenge: rows(events.data).map((e) => ({
      id: str(e.id),
      action: str(e.action),
      target: str(e.target) || null,
      createdAt: str(e.created_at),
    })),
    vorgaengeLesbar: !events.error,
  };
}

export const COMPLIANCE_LABEL: Record<string, string> = {
  "dsar.delete": "Löschung (Betroffenenanfrage)",
  "dsar.export": "Auskunft (Betroffenenanfrage)",
  "audio.purge": "Audio-Aufbewahrung: gelöscht",
  "retention.sweep": "Aufbewahrungslauf",
  "consent.withdraw": "Einwilligung widerrufen",
  "consent.grant": "Einwilligung erteilt",
};
