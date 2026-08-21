import type { SupabaseClient } from "@supabase/supabase-js";

// Abo-Übersicht. Die Comp zeigt hier MRR/ARR/Retention und eine Rechnungsliste —
// dafür gibt es KEINE Datenquelle: `billing_events` (0027) speichert nur
// event_id/event_type/received_at, hat weder Beträge noch eine Admin-Lesepolicy
// (RLS default-deny, Grants entzogen). Beträge liegen ausschließlich bei Polar.
// Diese Seite zeigt deshalb, was die DB wirklich weiß: die Verteilung der Abos.

export interface PlanBucket {
  plan: string;
  anzahl: number;
  anteil: number;
}

export interface StatusBucket {
  status: string;
  anzahl: number;
}

export interface AbrechnungData {
  gesamt: number;
  aktiv: number;
  plaene: PlanBucket[];
  status: StatusBucket[];
  /** Abos, die in den nächsten 30 Tagen auslaufen (canceled/expired-Risiko). */
  laufenAus: Array<{ userId: string; name: string; plan: string; endet: string }>;
  lesbar: boolean;
}

type Row = Record<string, unknown>;
const rows = (d: unknown): Row[] => (Array.isArray(d) ? (d as Row[]) : []);
const str = (v: unknown): string => (typeof v === "string" ? v : "");

export async function getAbrechnungData(sb: SupabaseClient): Promise<AbrechnungData> {
  const { data, error } = await sb
    .from("entitlements")
    .select("user_id, plan, status, current_period_end");

  if (error) {
    return { gesamt: 0, aktiv: 0, plaene: [], status: [], laufenAus: [], lesbar: false };
  }

  const ents = rows(data);
  const gesamt = ents.length;
  // „Aktiv" wie in der DB (has_active_sub, 0026): status='active' UND Periode
  // nicht abgelaufen. Ein ausgelaufenes Abo bleibt auf 'active' stehen, bis
  // der Webhook es umschreibt — nur auf status zu zählen überzeichnet.
  const jetztMs = Date.now();
  const istAktiv = (e: Row): boolean => {
    if (str(e.status) !== "active") return false;
    const ende = str(e.current_period_end);
    if (!ende) return true;
    const t = new Date(ende).getTime();
    return Number.isNaN(t) || t > jetztMs;
  };
  const aktiv = ents.filter(istAktiv).length;

  const planCount = new Map<string, number>();
  const statusCount = new Map<string, number>();
  for (const e of ents) {
    const p = str(e.plan) || "unbekannt";
    const s = str(e.status) || "unbekannt";
    planCount.set(p, (planCount.get(p) ?? 0) + 1);
    statusCount.set(s, (statusCount.get(s) ?? 0) + 1);
  }

  // Auslaufende Abos: aktiv, aber mit Periodenende in den nächsten 30 Tagen.
  const jetzt = jetztMs;
  const grenze = jetzt + 30 * 24 * 60 * 60 * 1000;
  const auslaufend = ents.filter((e) => {
    if (!istAktiv(e)) return false;
    const end = str(e.current_period_end);
    if (!end) return false;
    const t = new Date(end).getTime();
    return !Number.isNaN(t) && t >= jetzt && t <= grenze;
  });

  const names = new Map<string, string>();
  if (auslaufend.length > 0) {
    const ids = [...new Set(auslaufend.map((e) => str(e.user_id)))].filter(Boolean);
    const { data: profs } = await sb.from("profiles").select("id, display_name").in("id", ids);
    for (const p of rows(profs)) {
      names.set(str(p.id), str(p.display_name) || "Ohne Namen");
    }
  }

  return {
    gesamt,
    aktiv,
    plaene: [...planCount.entries()]
      .map(([plan, anzahl]) => ({ plan, anzahl, anteil: gesamt > 0 ? (anzahl / gesamt) * 100 : 0 }))
      .sort((a, b) => b.anzahl - a.anzahl),
    status: [...statusCount.entries()]
      .map(([status, anzahl]) => ({ status, anzahl }))
      .sort((a, b) => b.anzahl - a.anzahl),
    laufenAus: auslaufend
      .map((e) => ({
        userId: str(e.user_id),
        name: names.get(str(e.user_id)) ?? "Unbekannt",
        plan: str(e.plan) || "unbekannt",
        endet: str(e.current_period_end),
      }))
      .sort((a, b) => a.endet.localeCompare(b.endet)),
    lesbar: true,
  };
}

export const PLAN_COLOR: Record<string, string> = {
  pro: "var(--lila)",
  starter: "var(--gruen)",
  unbekannt: "var(--text-3)",
};
