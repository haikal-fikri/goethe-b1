"use client";
import { useState } from "react";
import { authedFetch } from "@/lib/api";
import { Button } from "@/components/ui/controls";
import { Field, TextInput, Select } from "@/components/ui/form";
import { ModalShell, ModalError } from "@/components/ui/ModalShell";
import { Pill } from "@/components/ui/primitives";
import { IconShieldCheck } from "@/components/icons";

// Oberfläche zu POST /api/admin/grant-role — der gefährlichsten Route im
// System (Selbst-Eskalation zu admin). Deshalb bewusst nüchtern und mit
// Zwischenschritt: Rolle wählen, dann in einem zweiten Dialog bestätigen.
//
// Die Route selbst ist die Autorität: admin-JWT, service-role, 5 Vergaben pro
// Tag FAIL-CLOSED, jeder Aufruf auditiert. Hier wird nichts davon dupliziert —
// Fehlermeldungen der Route werden unverändert angezeigt.
//
// profiles hat KEINE E-Mail-Spalte, deshalb wird die Nutzer-ID (UUID) verlangt.
// Sie steht in Supabase Auth → Users.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function RollenKarte() {
  const [targetUserId, setTargetUserId] = useState("");
  const [role, setRole] = useState("");
  const [bestaetigen, setBestaetigen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [erfolg, setErfolg] = useState<string | null>(null);

  const idOk = UUID_RE.test(targetUserId.trim());
  const bereit = idOk && (role === "teacher" || role === "admin");

  async function vergeben() {
    setBusy(true);
    setFehler(null);
    try {
      const res = await authedFetch("/api/admin/grant-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId: targetUserId.trim(), role }),
      });
      const data = (await res.json().catch(() => null)) as
        | { vorher?: string; error?: { message?: string } }
        | null;
      if (!res.ok) {
        setFehler(data?.error?.message ?? "Rolle konnte nicht gesetzt werden.");
        return;
      }
      setBestaetigen(false);
      setErfolg(
        data?.vorher && data.vorher !== role
          ? `Rolle „${data.vorher}" → „${role}". Die Person muss sich neu anmelden.`
          : `Rolle „${role}" vergeben. Die Person muss sich neu anmelden.`
      );
      setTargetUserId("");
      setRole("");
    } catch {
      setFehler("Verbindung fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <Field label="Nutzer-ID (UUID)" hint="Zu finden in Supabase Auth → Users.">
          <TextInput
            value={targetUserId}
            onChange={(v) => {
              setTargetUserId(v);
              setErfolg(null);
            }}
            placeholder="00000000-0000-0000-0000-000000000000"
            mono
          />
        </Field>
        <Field label="Rolle">
          <Select value={role} onChange={setRole} options={["teacher", "admin"]} />
        </Field>

        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 2 }}>
          <Button variant="outline" disabled={!bereit} onClick={() => setBestaetigen(true)}>
            Rolle vergeben
          </Button>
          {erfolg ? <Pill tone="gruen">{erfolg}</Pill> : null}
        </div>

        {targetUserId.trim() !== "" && !idOk ? (
          <div style={{ fontSize: 12, color: "var(--gold-text)", marginTop: 8 }}>
            Das ist keine gültige UUID.
          </div>
        ) : null}
      </div>

      {bestaetigen ? (
        <ModalShell
          onClose={() => {
            setBestaetigen(false);
            setFehler(null);
          }}
          busy={busy}
          width={480}
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
            <span
              style={{
                width: 34,
                height: 34,
                borderRadius: 9,
                flex: "0 0 34px",
                background: role === "admin" ? "var(--rot-tint)" : "var(--gold-tint)",
                color: role === "admin" ? "var(--rot-text)" : "var(--gold-text)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <IconShieldCheck size={18} strokeWidth={1.9} />
            </span>
            <div>
              <h2
                style={{
                  fontFamily: "var(--font-serif)",
                  fontSize: 19,
                  fontWeight: 600,
                  color: "var(--text-hi)",
                  margin: "0 0 4px",
                }}
              >
                Rolle „{role}" vergeben?
              </h2>
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: "var(--text-2)" }}>
                {role === "admin"
                  ? "Diese Person erhält vollen Zugriff auf die Konsole — einschließlich der Möglichkeit, weitere Administratoren zu ernennen und den Prüfungs-Korpus zu ändern."
                  : "Diese Person erhält Lehrkraft-Rechte. Die tatsächliche Klassen-Befugnis hängt zusätzlich an einem aktiven Abo."}
              </p>
            </div>
          </div>

          <div
            style={{
              background: "var(--surface-alt)",
              borderRadius: 12,
              padding: "11px 13px",
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              color: "var(--text-1)",
              wordBreak: "break-all",
              marginBottom: 14,
            }}
          >
            {targetUserId.trim()}
          </div>

          <p style={{ margin: "0 0 16px", fontSize: 12.5, lineHeight: 1.55, color: "var(--text-2)" }}>
            Die Rolle wird <strong>ersetzt</strong>, nicht ergänzt — hat das Konto bereits eine
            andere Rolle, ist es danach nur noch „{role}". Prüfen Sie die ID vor dem Bestätigen.
            Der Vorgang wird protokolliert; die Rolle steckt im JWT und wird erst beim nächsten
            Anmelden wirksam.
          </p>

          {fehler ? <ModalError message={fehler} /> : null}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <Button
              variant="ghost"
              onClick={() => {
                setBestaetigen(false);
                setFehler(null); // sonst steht die alte Meldung beim nächsten Öffnen noch da
              }}
              disabled={busy}
            >
              Abbrechen
            </Button>
            <Button variant={role === "admin" ? "danger" : "accent"} onClick={vergeben} disabled={busy}>
              {busy ? "Wird vergeben …" : "Ja, vergeben"}
            </Button>
          </div>
        </ModalShell>
      ) : null}
    </>
  );
}
