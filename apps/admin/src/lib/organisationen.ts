import type { SupabaseClient } from "@supabase/supabase-js";

// Organisationen = Sitz-Teams einer Pro-Lehrkraft (0026: eine Org je Inhaber,
// Mitglieder mit Rolle owner/teacher). NICHT die zahlenden Sprachschul-Tenants
// aus der Comp — dafür gibt es weder Tabelle noch Beträge. Entsprechend zeigen
// die Screens Inhaber/Sitze/Abo statt Standort/MRR/Rechnungen.
//
// Alle Reads RLS-scoped über is_admin() (0026: "org admin read" u. a.).

export interface OrgRow {
  id: string;
  name: string;
  ownerId: string;
  ownerName: string;
  createdAt: string;
  mitglieder: number;
  aktiveMitglieder: number;
  offeneEinladungen: number;
  plan: string | null;
  aboStatus: string | null;
}

export interface OrgMemberRow {
  userId: string;
  name: string;
  role: string;
  status: string;
  createdAt: string;
}

export interface OrgInviteRow {
  id: string;
  email: string;
  status: string;
  createdAt: string;
  expiresAt: string;
}

export interface OrgDetail {
  id: string;
  name: string;
  ownerId: string;
  ownerName: string;
  createdAt: string;
  plan: string | null;
  aboStatus: string | null;
  periodEnd: string | null;
  mitglieder: OrgMemberRow[];
  einladungen: OrgInviteRow[];
}

type Row = Record<string, unknown>;
const rows = (d: unknown): Row[] => (Array.isArray(d) ? (d as Row[]) : []);
const str = (v: unknown): string => (typeof v === "string" ? v : "");
const strOrNull = (v: unknown): string | null => (typeof v === "string" ? v : null);

/** Anzeigenamen zu Nutzer-IDs (profiles hat KEINE E-Mail-Spalte). */
async function nameMap(sb: SupabaseClient, ids: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const unique = [...new Set(ids)].filter(Boolean);
  if (unique.length === 0) return map;
  const { data } = await sb.from("profiles").select("id, display_name").in("id", unique);
  for (const r of rows(data)) {
    const id = str(r.id);
    if (id) map.set(id, str(r.display_name) || "Ohne Namen");
  }
  return map;
}

/** Abo (plan/status) je Lehrkraft-ID. */
async function entitlementMap(
  sb: SupabaseClient,
  ids: string[]
): Promise<Map<string, { plan: string | null; status: string | null; periodEnd: string | null }>> {
  const map = new Map<string, { plan: string | null; status: string | null; periodEnd: string | null }>();
  const unique = [...new Set(ids)].filter(Boolean);
  if (unique.length === 0) return map;
  const { data } = await sb
    .from("entitlements")
    .select("user_id, plan, status, current_period_end")
    .in("user_id", unique);
  for (const r of rows(data)) {
    const id = str(r.user_id);
    if (id) {
      map.set(id, {
        plan: strOrNull(r.plan),
        status: strOrNull(r.status),
        periodEnd: strOrNull(r.current_period_end),
      });
    }
  }
  return map;
}

export async function listOrgs(sb: SupabaseClient): Promise<OrgRow[]> {
  const { data, error } = await sb
    .from("organizations")
    .select("id, name, owner_id, created_at")
    .order("created_at", { ascending: false });
  if (error) return [];

  const orgs = rows(data);
  if (orgs.length === 0) return [];
  const orgIds = orgs.map((o) => str(o.id));
  const ownerIds = orgs.map((o) => str(o.owner_id));

  // Flache Queries + JS-Join (wie im Lehrkraft-Dashboard) — verschachtelte
  // Embeds können unter RLS stillschweigend Zeilen verlieren.
  const [{ data: memberData }, { data: inviteData }, names, ents] = await Promise.all([
    sb.from("org_members").select("org_id, status").in("org_id", orgIds),
    // Nichts setzt org_invites.status je auf 'expired' — claim_org_invite
    // weist abgelaufene Token nur zurück und lässt die Zeile auf 'pending'
    // stehen. Ohne expires_at-Prüfung würden ewig alte Einladungen als offen
    // gezählt.
    sb
      .from("org_invites")
      .select("org_id, status, expires_at")
      .in("org_id", orgIds)
      .eq("status", "pending")
      .gt("expires_at", new Date().toISOString()),
    nameMap(sb, ownerIds),
    entitlementMap(sb, ownerIds),
  ]);

  const total = new Map<string, number>();
  const aktiv = new Map<string, number>();
  for (const m of rows(memberData)) {
    const oid = str(m.org_id);
    total.set(oid, (total.get(oid) ?? 0) + 1);
    if (str(m.status) === "active") aktiv.set(oid, (aktiv.get(oid) ?? 0) + 1);
  }
  const offen = new Map<string, number>();
  for (const i of rows(inviteData)) {
    const oid = str(i.org_id);
    offen.set(oid, (offen.get(oid) ?? 0) + 1);
  }

  return orgs.map((o) => {
    const id = str(o.id);
    const ownerId = str(o.owner_id);
    const ent = ents.get(ownerId);
    return {
      id,
      name: str(o.name),
      ownerId,
      ownerName: names.get(ownerId) ?? "Unbekannt",
      createdAt: str(o.created_at),
      mitglieder: total.get(id) ?? 0,
      aktiveMitglieder: aktiv.get(id) ?? 0,
      offeneEinladungen: offen.get(id) ?? 0,
      plan: ent?.plan ?? null,
      aboStatus: ent?.status ?? null,
    };
  });
}

export async function getOrg(sb: SupabaseClient, orgId: string): Promise<OrgDetail | null> {
  const { data, error } = await sb
    .from("organizations")
    .select("id, name, owner_id, created_at")
    .eq("id", orgId)
    .maybeSingle();
  if (error || !data) return null;
  const org = data as Row;
  const ownerId = str(org.owner_id);

  const [{ data: memberData }, { data: inviteData }, ents] = await Promise.all([
    sb.from("org_members").select("user_id, role, status, created_at").eq("org_id", orgId),
    sb
      .from("org_invites")
      .select("id, email, status, created_at, expires_at")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false }),
    entitlementMap(sb, [ownerId]),
  ]);

  const memberRows = rows(memberData);
  const names = await nameMap(sb, [ownerId, ...memberRows.map((m) => str(m.user_id))]);
  const ent = ents.get(ownerId);

  return {
    id: str(org.id),
    name: str(org.name),
    ownerId,
    ownerName: names.get(ownerId) ?? "Unbekannt",
    createdAt: str(org.created_at),
    plan: ent?.plan ?? null,
    aboStatus: ent?.status ?? null,
    periodEnd: ent?.periodEnd ?? null,
    mitglieder: memberRows
      .map((m) => ({
        userId: str(m.user_id),
        name: names.get(str(m.user_id)) ?? "Unbekannt",
        role: str(m.role),
        status: str(m.status),
        createdAt: str(m.created_at),
      }))
      .sort((a, b) => (a.role === "owner" ? -1 : b.role === "owner" ? 1 : a.name.localeCompare(b.name, "de"))),
    einladungen: rows(inviteData).map((i) => ({
      id: str(i.id),
      email: str(i.email),
      status: str(i.status),
      createdAt: str(i.created_at),
      expiresAt: str(i.expires_at),
    })),
  };
}

/* ── Beschriftung / Farbgebung ───────────────────────────────────── */

export const PLAN_LABEL: Record<string, string> = { starter: "Starter", pro: "Pro" };

export const ABO_LABEL: Record<string, string> = {
  active: "aktiv",
  canceled: "gekündigt",
  past_due: "überfällig",
  revoked: "entzogen",
  expired: "abgelaufen",
};

export const INVITE_LABEL: Record<string, string> = {
  pending: "offen",
  accepted: "angenommen",
  revoked: "zurückgezogen",
  expired: "abgelaufen",
};

export const MEMBER_ROLE_LABEL: Record<string, string> = { owner: "Inhaber", teacher: "Lehrkraft" };

export function aboTone(status: string | null): "gruen" | "gold" | "rot" | "neutral" {
  if (status === "active") return "gruen";
  if (status === "canceled" || status === "past_due") return "gold";
  if (status === "revoked" || status === "expired") return "rot";
  return "neutral";
}

export function inviteTone(status: string): "gruen" | "gold" | "rot" | "neutral" {
  if (status === "accepted") return "gruen";
  if (status === "pending") return "gold";
  if (status === "revoked" || status === "expired") return "rot";
  return "neutral";
}
