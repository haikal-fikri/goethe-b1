"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { SessionVM } from "@/lib/stundenplan";
import { authedFetch } from "@/lib/api";
import { Pill, type Tone } from "@/components/ui/primitives";
import { timeDe, dayLabel, shortDate } from "@/lib/format";
import { CancelSessionModal } from "@/components/stundenplan/CancelSessionModal";

// Terminliste mit Zeilen-Aktionen: Anwesenheit erfassen (Link) + Options-Menü
// (Absage). Die Absage läuft über die service-role-Route (Fan-out an die
// Teilnehmenden) — NICHT client-direkt. Anschließend router.refresh().

function statusMeta(s: SessionVM): { label: string; tone: Tone; bar: string } {
  if (s.status === "canceled") return { label: "Abgesagt", tone: "rot", bar: "var(--rot)" };
  if (s.status === "held") return { label: "Gehalten", tone: "gruen", bar: "var(--gruen)" };
  return {
    label: "Geplant",
    tone: "neutral",
    bar: s.isPast ? "var(--border-strong)" : "var(--gruen)",
  };
}

function DotsIcon() {
  return (
    <svg width={17} height={17} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <circle cx="12" cy="5" r="1.7" />
      <circle cx="12" cy="12" r="1.7" />
      <circle cx="12" cy="19" r="1.7" />
    </svg>
  );
}
function ClipboardIcon() {
  return (
    <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="4" y="5" width="16" height="16" rx="2" />
      <path d="M8 3v4M16 3v4M4 10h16" />
    </svg>
  );
}
function CancelIcon() {
  return (
    <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="4" y="5" width="16" height="16" rx="2" />
      <path d="M8 3v4M16 3v4M4 10h16" />
      <path d="M9.5 14.5l5 5M14.5 14.5l-5 5" />
    </svg>
  );
}

export function SessionList({ sessions }: { sessions: SessionVM[] }) {
  const router = useRouter();
  const [menuId, setMenuId] = useState<string | null>(null);
  const [cancelFor, setCancelFor] = useState<SessionVM | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function confirmCancel(reason: string) {
    if (!cancelFor) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await authedFetch(`/api/class/sessions/${cancelFor.id}/cancel`, {
        method: "POST",
        body: JSON.stringify(reason ? { reason } : {}),
      });
      if (!res.ok) {
        const b = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        throw new Error(b?.error?.message ?? "Absage fehlgeschlagen.");
      }
      setCancelFor(null);
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Fehler.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {sessions.map((s) => {
        const meta = statusMeta(s);
        const open = menuId === s.id;
        const canCancel = s.status === "scheduled" && !s.isPast;
        return (
          <div
            key={s.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              padding: "14px 0",
              borderTop: "1px solid var(--border-1)",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 60, flex: "0 0 60px" }}>
              <span style={{ fontFamily: "var(--font-serif)", fontSize: 17, fontWeight: 600, color: "var(--text-hi)", lineHeight: 1.1 }}>
                {timeDe(s.startsAt)}
              </span>
              <span style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--text-2)" }}>
                {dayLabel(s.startsAt)}
              </span>
            </div>
            <div style={{ width: 3, height: 38, borderRadius: 2, background: meta.bar }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-hi)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {s.className}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {shortDate(s.startsAt)}
                {s.title ? ` · ${s.title}` : ""}
              </div>
            </div>
            <Pill tone={meta.tone}>{meta.label}</Pill>
            {s.status !== "canceled" ? (
              <Link
                href={`/stundenplan/${s.id}`}
                className="press"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  height: 34,
                  padding: "0 14px",
                  borderRadius: 10,
                  border: "1px solid var(--border-strong)",
                  background: "var(--bg)",
                  color: "var(--text-hi)",
                  fontSize: 12.5,
                  fontWeight: 600,
                  textDecoration: "none",
                  whiteSpace: "nowrap",
                }}
              >
                Anwesenheit
              </Link>
            ) : null}
            <div style={{ position: "relative" }}>
              <button
                onClick={() => setMenuId(open ? null : s.id)}
                title="Optionen"
                className="hover-strong press"
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  border: "1px solid var(--border-1)",
                  background: "var(--bg)",
                  color: "var(--text-2)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <DotsIcon />
              </button>
              {open ? (
                <>
                  <div onClick={() => setMenuId(null)} style={{ position: "fixed", inset: 0, zIndex: 20 }} />
                  <div
                    style={{
                      position: "absolute",
                      top: 42,
                      right: 0,
                      width: 220,
                      background: "var(--surface-1)",
                      border: "1px solid var(--border-1)",
                      borderRadius: 13,
                      boxShadow: "var(--shadow-island)",
                      padding: 6,
                      zIndex: 30,
                    }}
                  >
                    {s.status !== "canceled" ? (
                      <Link
                        href={`/stundenplan/${s.id}`}
                        onClick={() => setMenuId(null)}
                        style={menuItemStyle("var(--text-hi)")}
                        className="hover-surface"
                      >
                        <ClipboardIcon />
                        Anwesenheit erfassen
                      </Link>
                    ) : null}
                    {canCancel ? (
                      <>
                        <div style={{ height: 1, background: "var(--border-1)", margin: "5px 6px" }} />
                        <button
                          onClick={() => {
                            setMenuId(null);
                            setErr(null);
                            setCancelFor(s);
                          }}
                          style={{ ...menuItemStyle("var(--rot-text)"), width: "100%", border: "none", background: "transparent", cursor: "pointer", textAlign: "left" }}
                          className="hover-surface"
                        >
                          <CancelIcon />
                          Stunde absagen
                        </button>
                      </>
                    ) : null}
                    {s.status === "canceled" && !canCancel ? (
                      <div style={{ ...menuItemStyle("var(--text-2)"), cursor: "default" }}>Bereits abgesagt</div>
                    ) : null}
                  </div>
                </>
              ) : null}
            </div>
          </div>
        );
      })}

      {cancelFor ? (
        <CancelSessionModal
          sessionLabel={`${cancelFor.className} · ${dayLabel(cancelFor.startsAt)} ${timeDe(cancelFor.startsAt)}`}
          busy={busy}
          error={err}
          onClose={() => (busy ? undefined : setCancelFor(null))}
          onConfirm={confirmCancel}
        />
      ) : null}
    </div>
  );
}

function menuItemStyle(color: string): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: 9,
    padding: "9px 10px",
    borderRadius: 9,
    color,
    fontSize: 13,
    fontWeight: 500,
    textDecoration: "none",
  };
}
