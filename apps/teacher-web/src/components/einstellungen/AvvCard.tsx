"use client";
import { useState } from "react";
import { authedFetch } from "@/lib/api";
import { Card, Pill } from "@/components/ui/primitives";
import { IconShieldCheck } from "@/components/icons";
import { shortDate } from "@/lib/format";

// Auftragsverarbeitung (AVV/DPA). Bereits angenommen ⇒ Status + Datum. Sonst
// Annahme über die service-role-Route POST /api/onboarding/accept-dpa (leerer
// Body — die Version kommt serverseitig aus CURRENT_DPA_VERSION). Spiegelt das
// dashboard-Gate: vorhandene Zeile = angenommen.
export function AvvCard({
  accepted: initialAccepted,
  acceptedVersion,
  acceptedAt: initialAt,
  currentVersion,
}: {
  accepted: boolean;
  acceptedVersion: string;
  acceptedAt: string | null;
  currentVersion: string;
}) {
  const [accepted, setAccepted] = useState(initialAccepted);
  const [version, setVersion] = useState(acceptedVersion);
  const [at, setAt] = useState<string | null>(initialAt);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function accept() {
    setBusy(true);
    setErr(null);
    try {
      const res = await authedFetch("/api/onboarding/accept-dpa", {
        method: "POST",
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const b = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        throw new Error(b?.error?.message ?? "Annahme konnte nicht gespeichert werden.");
      }
      setAccepted(true);
      setVersion(currentVersion);
      setAt(new Date().toISOString());
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Fehler.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14.5, fontWeight: 600, color: "var(--text-hi)", marginBottom: 3 }}>
            Datenschutzvereinbarung (AVV)
          </div>
          <div style={{ fontSize: 12.5, color: "var(--text-2)" }}>
            {accepted
              ? `Angenommen · Version ${version} · ${shortDate(at)}`
              : `Aktuelle Version ${currentVersion} · Annahme erforderlich`}
          </div>
          {err ? (
            <div style={{ fontSize: 12.5, color: "var(--rot-text)", marginTop: 6 }}>{err}</div>
          ) : null}
        </div>
        {accepted ? (
          <Pill tone="gruen" style={{ flex: "0 0 auto", padding: "6px 12px" }}>
            <IconShieldCheck size={15} />
            Angenommen
          </Pill>
        ) : (
          <button
            onClick={accept}
            disabled={busy}
            className="press"
            style={{
              flex: "0 0 auto",
              height: 38,
              padding: "0 15px",
              borderRadius: 11,
              border: "none",
              background: "var(--gold-tint)",
              color: "var(--gold-text)",
              fontSize: 13,
              fontWeight: 600,
              cursor: busy ? "default" : "pointer",
              opacity: busy ? 0.7 : 1,
            }}
          >
            {busy ? "Wird angenommen…" : "AVV annehmen"}
          </button>
        )}
      </div>
    </Card>
  );
}
