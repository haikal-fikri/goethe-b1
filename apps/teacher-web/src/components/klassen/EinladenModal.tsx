"use client";
import { useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { authedFetch } from "@/lib/api";
import { IconMail, IconCopy, IconCheck } from "@/components/icons";
import { ModalShell, ModalError } from "./ModalShell";

// E-Mail-Einladungen: service-role-Route POST /api/class/invite (Cross-Table-
// Teilnehmer-Cap + Resend leben dort). Body == inviteSchema { classId, emails }.
// Alternativ kann der Beitritts-Code direkt geteilt werden.
export function EinladenModal({
  classId,
  joinCode,
  onClose,
}: {
  classId: string;
  joinCode: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [raw, setRaw] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [result, setResult] = useState<{ invited: number; sent: number } | null>(null);

  const emails = parseEmails(raw);

  async function submit() {
    if (emails.length === 0) return setErr("Bitte mindestens eine E-Mail-Adresse eingeben.");
    if (emails.length > 50) return setErr("Höchstens 50 Adressen pro Einladung.");

    setBusy(true);
    setErr(null);
    try {
      const res = await authedFetch("/api/class/invite", {
        method: "POST",
        body: JSON.stringify({ classId, emails }),
      });
      // Die /api-Routen antworten via ok() mit der Nutzlast auf oberster Ebene
      // (kein { data }-Wrapper) — die Felder stehen direkt am Body.
      const body = (await res.json().catch(() => null)) as
        | { invited?: number; sent?: number; error?: { message?: string } }
        | null;
      if (!res.ok) throw new Error(body?.error?.message ?? "Einladungen fehlgeschlagen.");
      setResult({ invited: body?.invited ?? emails.length, sent: body?.sent ?? 0 });
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Fehler.");
    } finally {
      setBusy(false);
    }
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(joinCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* Clipboard nicht verfügbar — Code ist sichtbar */
    }
  }

  return (
    <ModalShell onClose={onClose} busy={busy} width={480}>
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: 15,
          background: "var(--blau-tint)",
          color: "var(--blau)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 16,
        }}
      >
        <IconMail size={26} />
      </div>
      <h2 style={{ fontFamily: "var(--font-serif)", fontSize: 23, fontWeight: 600, color: "var(--text-hi)", margin: "0 0 6px" }}>
        Teilnehmende einladen
      </h2>
      <p style={{ margin: "0 0 18px", fontSize: 14, lineHeight: 1.55, color: "var(--text-2)" }}>
        Eine oder mehrere E-Mail-Adressen — durch Komma, Leerzeichen oder Zeilenumbruch getrennt.
      </p>

      {err ? <ModalError message={err} /> : null}

      {result ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 9,
            background: "var(--gruen-tint)",
            color: "var(--gruen)",
            borderRadius: 12,
            padding: "12px 14px",
            fontSize: 13.5,
            fontWeight: 600,
            marginBottom: 18,
          }}
        >
          <IconCheck size={17} strokeWidth={2.2} />
          {result.invited} eingeladen · {result.sent} E-Mail{result.sent === 1 ? "" : "s"} versendet
        </div>
      ) : (
        <textarea
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          placeholder={"anna@example.com\nben@example.com"}
          rows={4}
          autoFocus
          style={{
            width: "100%",
            borderRadius: 12,
            border: "1px solid var(--border-strong)",
            background: "var(--bg)",
            color: "var(--text-hi)",
            fontSize: 14,
            lineHeight: 1.5,
            padding: "11px 13px",
            outline: "none",
            resize: "vertical",
            marginBottom: emails.length ? 8 : 16,
          }}
        />
      )}
      {!result && emails.length ? (
        <div style={{ fontSize: 12, color: "var(--text-2)", marginBottom: 16 }}>
          {emails.length} Adresse{emails.length === 1 ? "" : "n"} erkannt
        </div>
      ) : null}

      {/* Beitritts-Code teilen */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--surface-alt)", borderRadius: 12, padding: "10px 12px", marginBottom: 20 }}>
        <span style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--text-2)" }}>Code</span>
        <span style={{ fontFamily: "var(--font-serif)", fontSize: 16, fontWeight: 600, letterSpacing: ".1em", color: "var(--text-hi)", flex: 1 }}>
          {joinCode}
        </span>
        <button
          onClick={copyCode}
          title="Code kopieren"
          className="hover-strong press"
          style={{ width: 34, height: 34, borderRadius: 9, border: "none", background: "var(--bg)", color: copied ? "var(--gruen)" : "var(--text-1)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          {copied ? <IconCheck size={16} strokeWidth={2.1} /> : <IconCopy size={15} />}
        </button>
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={onClose} disabled={busy} className="hover-strong press" style={cancelBtn(busy)}>
          {result ? "Schließen" : "Abbrechen"}
        </button>
        {!result ? (
          <button onClick={submit} disabled={busy} className="btn-primary press" style={confirmBtn(busy)}>
            {busy ? "Senden…" : "Einladungen senden"}
          </button>
        ) : null}
      </div>
    </ModalShell>
  );
}

function parseEmails(raw: string): string[] {
  return [
    ...new Set(
      raw
        .split(/[\s,;]+/)
        .map((s) => s.trim().toLowerCase())
        .filter((s) => s.includes("@"))
    ),
  ];
}

function cancelBtn(busy: boolean): CSSProperties {
  return {
    flex: 1,
    height: 46,
    borderRadius: 13,
    border: "1px solid var(--border-strong)",
    background: "var(--bg)",
    color: "var(--text-hi)",
    fontSize: 14,
    fontWeight: 600,
    cursor: busy ? "default" : "pointer",
  };
}

function confirmBtn(busy: boolean): CSSProperties {
  return {
    flex: 1.4,
    height: 46,
    borderRadius: 13,
    border: "none",
    background: "var(--primary-btn-bg)",
    color: "var(--primary-btn-fg)",
    fontSize: 14,
    fontWeight: 600,
    cursor: busy ? "default" : "pointer",
    opacity: busy ? 0.7 : 1,
  };
}
