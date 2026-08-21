import type { SupabaseClient } from "@supabase/supabase-js";
import { CURRENT_DPA_VERSION } from "@/lib/compliance";
import { aktiveLehrkraftIds } from "@/lib/uebersicht";

// Datenschutz-Zentrale. Real gestützt sind zwei Dinge:
//  · AVV-Zustimmungen  → teacher_agreements (0024), je (teacher, dpa_version)
//  · Compliance-Vorgänge → audit_log (0022), gefiltert auf die Lösch-/DSAR-Aktionen
//
// Die Comp zeigt zusätzlich eine DSR-Warteschlange mit Fristen und eine Tabelle
// laufender Aufbewahrungs-Jobs. Beides braucht eine Workflow-Tabelle, die es
// nicht gibt — hier steht deshalb die PROTOKOLL-Sicht (was ist passiert), nicht
// eine Warteschlange (was steht an).

/**
 * audit_log-Aktionen, die als Compliance-Vorgang gelten.
 *
 * Nur Strings, die IRGENDWO im Monorepo wirklich geschrieben werden — geprüft
 * mit `grep -rhoE 'action: "[a-z_]+\.[a-z_]+"' apps/*​/src packages/*​/src`.
 * Erfundene Namen (dsar.*, consent.withdraw) filtern still auf null Treffer
 * und lassen die Seite leer aussehen, obwohl Vorgänge protokolliert sind.
 */
export const COMPLIANCE_ACTIONS = [
  "audio.purge",
  "retention.sweep",
  "consent.record",
  "dpa.accept",
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
  const [agreements, aktive, events] = await Promise.all([
    sb.from("teacher_agreements").select("teacher_id, dpa_version, accepted_at"),
    aktiveLehrkraftIds(sb),
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

  const nurAktive = (ids: Set<string>): number => {
    if (aktive === null) return ids.size;
    let n = 0;
    for (const id of ids) if (aktive.has(id)) n++;
    return n;
  };

  const versionen: AvvVersionRow[] = [...perVersion.entries()]
    .map(([version, e]) => ({
      version,
      zustimmungen: nurAktive(e.teachers),
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

  // Zähler und Nenner MÜSSEN dieselbe Grundmenge haben. teacher_agreements
  // wird nie aufgeräumt, enthält also auch längst abgelaufene Lehrkräfte —
  // ungefiltert gegen die aktiven Abos gerechnet ergäbe das Quoten über 100 %.
  const zaehleZugestimmt = (version: string): number | null => {
    if (agreements.error) return null;
    const zugestimmt = perVersion.get(version)?.teachers;
    if (!zugestimmt) return 0;
    if (aktive === null) return null;
    let n = 0;
    for (const id of zugestimmt) if (aktive.has(id)) n++;
    return n;
  };

  return {
    aktuelleVersion: CURRENT_DPA_VERSION,
    aktiveLehrkraefte: aktive === null ? null : aktive.size,
    aktuellZugestimmt: zaehleZugestimmt(CURRENT_DPA_VERSION),
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
  "audio.purge": "Audio-Aufbewahrung: gelöscht",
  "retention.sweep": "Aufbewahrungslauf",
  "consent.record": "Einwilligung erfasst",
  "dpa.accept": "AVV angenommen",
};
