import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireAuth } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { CURRENT_DPA_VERSION } from "@/lib/compliance";
import { Card, Eyebrow } from "@/components/ui/primitives";
import { IconBell, IconChevronRight } from "@/components/icons";
import { ProfilForm } from "@/components/einstellungen/ProfilForm";
import { AvvCard } from "@/components/einstellungen/AvvCard";
import { ConsentToggle, type ConsentStatus } from "@/components/einstellungen/ConsentToggle";
import { SignOutButton } from "@/components/einstellungen/SignOutButton";

export const dynamic = "force-dynamic";

interface StudentConsent {
  id: string;
  name: string;
  status: ConsentStatus;
}

// Einwilligungs-Liste: Teilnehmende der eigenen Klassen + ihr guardian_consents-
// Status. Alle Reads sind RLS-gedeckt (classes/enroll teacher select, profiles/
// consent teacher read via app_teacher_can_read). Kein Consent-Datensatz ⇒ "none".
async function loadConsentRoster(sb: SupabaseClient): Promise<StudentConsent[]> {
  const { data: classRows } = await sb.from("classes").select("id");
  const classIds = ((classRows ?? []) as Array<{ id: string }>).map((c) => c.id);
  if (classIds.length === 0) return [];

  const { data: enr } = await sb
    .from("class_enrollments")
    .select("student_id")
    .in("class_id", classIds)
    .eq("status", "active");
  const studentIds = [...new Set(((enr ?? []) as Array<{ student_id: string }>).map((e) => e.student_id))];
  if (studentIds.length === 0) return [];

  const [{ data: profs }, { data: cons }] = await Promise.all([
    sb.from("profiles").select("id, display_name").in("id", studentIds),
    sb.from("guardian_consents").select("student_id, status").in("student_id", studentIds),
  ]);

  const nameMap: Record<string, string> = {};
  for (const p of (profs ?? []) as Array<{ id: string; display_name: string | null }>) {
    nameMap[p.id] = (p.display_name ?? "").trim();
  }
  const statusMap: Record<string, "granted" | "withdrawn"> = {};
  for (const c of (cons ?? []) as Array<{ student_id: string; status: "granted" | "withdrawn" }>) {
    statusMap[c.student_id] = c.status;
  }

  return studentIds
    .map((id) => ({
      id,
      name: nameMap[id] || "Teilnehmende:r",
      status: (statusMap[id] ?? "none") as ConsentStatus,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "de"));
}

export default async function EinstellungenPage() {
  const user = await requireAuth("/einstellungen");
  const sb = await supabaseServer();

  const [{ data: profile }, { data: agreements }, roster] = await Promise.all([
    sb.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
    sb
      .from("teacher_agreements")
      .select("dpa_version, accepted_at")
      .eq("teacher_id", user.id)
      .order("accepted_at", { ascending: false }),
    loadConsentRoster(sb),
  ]);

  const displayName = ((profile?.display_name as string | null) ?? "").trim();
  const email = user.email ?? "";
  const agRows = (agreements ?? []) as Array<{ dpa_version: string; accepted_at: string }>;
  const avvAccepted = agRows.length > 0; // mirror dashboard.ts avvNeeded (vorhandene Zeile = angenommen)

  return (
    <div style={{ maxWidth: 1160, margin: "0 auto", padding: "30px 34px 60px" }}>
      <Eyebrow style={{ marginBottom: 8 }}>Einstellungen</Eyebrow>
      <h1
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: 30,
          fontWeight: 600,
          color: "var(--text-hi)",
          margin: "0 0 24px",
          letterSpacing: "-.01em",
        }}
      >
        Einstellungen
      </h1>

      {/* Profil */}
      <ProfilForm userId={user.id} initialName={displayName} email={email} />

      {/* Auftragsverarbeitung (AVV/DPA) */}
      <AvvCard
        accepted={avvAccepted}
        acceptedVersion={agRows[0]?.dpa_version ?? CURRENT_DPA_VERSION}
        acceptedAt={agRows[0]?.accepted_at ?? null}
        currentVersion={CURRENT_DPA_VERSION}
      />

      {/* Einwilligungen · Sprechen */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <Eyebrow>Einwilligungen · Sprechen</Eyebrow>
        <span style={{ fontSize: 12, color: "var(--text-2)" }}>Für Audioaufnahmen erforderlich</span>
      </div>
      {roster.length > 0 ? (
        <Card padded={false} style={{ overflow: "hidden", marginBottom: 16 }}>
          {roster.map((s, i) => (
            <ConsentToggle key={s.id} studentId={s.id} name={s.name} status={s.status} divider={i > 0} />
          ))}
        </Card>
      ) : (
        <Card style={{ marginBottom: 16 }}>
          <div style={{ padding: "10px 0", fontSize: 13, color: "var(--text-2)", textAlign: "center" }}>
            Noch keine Teilnehmenden — Einwilligungen erscheinen, sobald Teilnehmende einer Klasse beigetreten sind.
          </div>
        </Card>
      )}

      {/* Benachrichtigungen (informativ — es gibt noch keine Präferenz-Spalten) */}
      <Eyebrow style={{ marginBottom: 12 }}>Benachrichtigungen</Eyebrow>
      <Card style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 14 }}>
        <span
          style={{
            width: 40,
            height: 40,
            flex: "0 0 40px",
            borderRadius: 11,
            background: "var(--blau-tint)",
            color: "var(--blau)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <IconBell size={19} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-hi)" }}>
            Hinweise in der App
          </div>
          <div style={{ fontSize: 12.5, color: "var(--text-2)", lineHeight: 1.5 }}>
            Neue Einreichungen und Erinnerungen erscheinen über die Glocke oben. Individuelle E-Mail-Einstellungen sind noch nicht verfügbar.
          </div>
        </div>
      </Card>

      {/* Sprache (fest) */}
      <Card
        style={{
          marginBottom: 24,
          padding: "16px 22px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-hi)" }}>Sprache</div>
          <div style={{ fontSize: 12, color: "var(--text-2)" }}>Oberfläche der Lehrkraft-App</div>
        </div>
        <span
          style={{
            fontSize: 13.5,
            fontWeight: 600,
            color: "var(--text-1)",
            background: "var(--surface-alt)",
            padding: "7px 13px",
            borderRadius: 10,
          }}
        >
          Deutsch
        </span>
      </Card>

      {/* Abmelden */}
      <SignOutButton />

      <div style={{ marginTop: 18, textAlign: "center" }}>
        <Link
          href="/dashboard"
          style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12.5, fontWeight: 600, color: "var(--text-2)" }}
        >
          Zurück zum Dashboard
          <IconChevronRight size={14} />
        </Link>
      </div>
    </div>
  );
}
