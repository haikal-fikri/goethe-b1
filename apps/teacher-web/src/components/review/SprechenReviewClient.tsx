"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { CriterionBand } from "@repo/types";
import { pointsFromSpeakingBands, SPEAKING_CRITERION_KEYS, type SpeakingCriterionKey } from "@repo/core";
import { authedFetch } from "@/lib/api";
import { CriterionBands, type CritItem } from "@/components/review/CriterionBands";
import { ScoreSummary } from "@/components/review/ScoreSummary";
import { FreigebenModal } from "@/components/review/FreigebenModal";
import { IconChevronLeft, IconMic, IconSend, IconCheck, IconPlay, IconClock } from "@/components/icons";

type SpkBands = Record<SpeakingCriterionKey, CriterionBand>;

const SPEAKING_LABEL: Record<SpeakingCriterionKey, string> = {
  erfuellung: "Erfüllung",
  kohaerenz: "Kohärenz",
  wortschatz: "Wortschatz",
  strukturen: "Strukturen",
  aussprache: "Aussprache",
};

// Spiegelt die Punkteskala aus @repo/core (examScoring · speakingScaleFor):
// erfuellung/kohaerenz → SCALE_4 (max 4), sonst → SCALE_6 (max 6).
const S4: Record<CriterionBand, number> = { A: 4, B: 3, C: 2, D: 1, E: 0 };
const S6: Record<CriterionBand, number> = { A: 6, B: 4.5, C: 3, D: 1.5, E: 0 };
function critPts(key: SpeakingCriterionKey, band: CriterionBand): { pts: number; max: number } {
  const s = key === "erfuellung" || key === "kohaerenz" ? S4 : S6;
  return { pts: s[band], max: s.A };
}

export interface SprechenReviewData {
  submissionId: string;
  student: string;
  klasse: string;
  when: string;
  aufgabeTitle: string;
  aufgabenstellung: string;
  stichpunkte: string[];
  transcript: string;
  durationMs: number | null;
  aiBands: Partial<Record<SpeakingCriterionKey, CriterionBand>> | null;
  aiBegruendung: Partial<Record<SpeakingCriterionKey, string>>;
  initialBands: SpkBands;
  initialFeedback: string;
  released: boolean;
}

function mmss(ms: number | null): string {
  if (!ms) return "0:00";
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// Deterministische, dekorative Waveform (echte Amplitude nach dem R2-Setup).
const WAVE = Array.from({ length: 44 }, (_, i) => 0.35 + 0.6 * Math.abs(Math.sin(i * 1.3) * Math.cos(i * 0.7)));

export function SprechenReviewClient(props: SprechenReviewData) {
  const router = useRouter();
  const [bands, setBands] = useState<SpkBands>(props.initialBands);
  const [feedback, setFeedback] = useState(props.initialFeedback);
  const [released, setReleased] = useState(props.released);
  const [saved, setSaved] = useState(false);
  const [modal, setModal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const totals = useMemo(() => pointsFromSpeakingBands(bands), [bands]);

  const items: CritItem[] = SPEAKING_CRITERION_KEYS.map((key) => {
    const { pts, max } = critPts(key, bands[key]);
    const manual = key === "aussprache";
    return {
      key,
      label: SPEAKING_LABEL[key],
      pts,
      max,
      aiBand: manual ? undefined : props.aiBands?.[key],
      begruendung: manual ? "Aussprache wird in v1 manuell bewertet." : props.aiBegruendung[key],
      manual,
    };
  });

  function setBand(key: string, band: CriterionBand) {
    setBands((b) => ({ ...b, [key as SpeakingCriterionKey]: band }));
    setSaved(false);
  }

  async function postGrade(release: boolean) {
    setBusy(true);
    setErr(null);
    try {
      const res = await authedFetch("/api/speaking/grade", {
        method: "POST",
        body: JSON.stringify({
          submissionId: props.submissionId,
          criteria: bands,
          feedbackDe: feedback.trim() || undefined,
          release,
        }),
      });
      if (!res.ok) {
        const b = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        throw new Error(b?.error?.message ?? "Speichern fehlgeschlagen.");
      }
      if (release) {
        setReleased(true);
        setModal(false);
        router.refresh();
      } else {
        setSaved(true);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Fehler.");
      setModal(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ height: "calc(100vh - 63px)", display: "flex", flexDirection: "column", background: "var(--bg)" }}>
      {/* Kopfleiste */}
      <div style={{ flex: "0 0 auto", borderBottom: "1px solid var(--border-1)", background: "var(--surface-1)", padding: "11px 24px", display: "flex", alignItems: "center", gap: 15 }}>
        <button onClick={() => router.back()} className="hover-strong press" style={backBtn}>
          <IconChevronLeft size={18} strokeWidth={1.9} />
        </button>
        <span style={{ width: 36, height: 36, borderRadius: 10, flex: "0 0 36px", background: "var(--blau-tint)", color: "var(--blau)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <IconMic size={19} />
        </span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--text-2)" }}>
            {props.klasse} · Sprechen · eingereicht {props.when}
          </div>
          <div style={{ fontFamily: "var(--font-serif)", fontSize: 19, fontWeight: 600, color: "var(--text-hi)", lineHeight: 1.2 }}>
            {props.student} — {props.aufgabeTitle}
          </div>
        </div>
        <div style={{ flex: 1 }} />
        {released ? (
          <span style={releasedChip}>
            <IconCheck size={16} strokeWidth={2.2} />
            Freigegeben · für {props.student} sichtbar
          </span>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {saved ? (
              <span style={{ fontSize: 12.5, color: "var(--text-2)", display: "flex", alignItems: "center", gap: 6 }}>
                <IconCheck size={15} strokeWidth={2} style={{ color: "var(--gruen)" }} />
                Entwurf gespeichert
              </span>
            ) : null}
            <button onClick={() => postGrade(false)} disabled={busy} className="hover-strong press" style={draftBtn}>
              Entwurf speichern
            </button>
            <button onClick={() => setModal(true)} disabled={busy} className="btn-accent press" style={releaseBtn}>
              <IconSend size={16} />
              Freigeben
            </button>
          </div>
        )}
      </div>

      {err ? (
        <div style={{ padding: "8px 24px", background: "var(--rot-tint)", color: "var(--rot-text)", fontSize: 13 }}>{err}</div>
      ) : null}

      {/* Split */}
      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        {/* Links: Audio + Transkript */}
        <div className="lms-scroll" style={{ flex: 1, minWidth: 0, overflowY: "auto", borderRight: "1px solid var(--border-1)", padding: "24px 26px" }}>
          <div style={{ maxWidth: 640, margin: "0 auto" }}>
            <Eyebrow>Audio-Aufnahme</Eyebrow>
            <div style={{ background: "var(--surface-1)", border: "1px solid var(--border-1)", borderRadius: 16, boxShadow: "var(--shadow-card-now)", padding: "18px 20px", marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <button
                  title="Audio-Wiedergabe wird nach dem R2-Setup (Phase 6) aktiviert"
                  disabled
                  style={{
                    width: 52,
                    height: 52,
                    flex: "0 0 52px",
                    borderRadius: 999,
                    border: "none",
                    background: "var(--blau)",
                    color: "#fff",
                    cursor: "not-allowed",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: "var(--glow-blau)",
                    opacity: 0.85,
                  }}
                >
                  <IconPlay size={22} style={{ marginLeft: 2 }} />
                </button>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 46, padding: "2px 0" }}>
                    {WAVE.map((h, i) => (
                      <span
                        key={i}
                        style={{ flex: 1, height: `${Math.round(h * 100)}%`, minWidth: 2, borderRadius: 2, background: "var(--border-strong)" }}
                      />
                    ))}
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
                    <span style={{ fontFamily: "var(--font-serif)", fontSize: 13, color: "var(--text-hi)" }}>0:00</span>
                    <span style={{ fontFamily: "var(--font-serif)", fontSize: 13, color: "var(--text-2)" }}>{mmss(props.durationMs)}</span>
                  </div>
                </div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "10px 14px", borderRadius: 12, background: "var(--gold-tint)", marginBottom: 24 }}>
              <IconClock size={16} strokeWidth={1.8} style={{ color: "var(--gold-text)", flex: "0 0 auto" }} />
              <span style={{ fontSize: 12.5, color: "var(--gold-text)" }}>
                Audio wird <strong>24 Std.</strong> nach der Bewertung automatisch gelöscht (DSGVO).
              </span>
            </div>

            {props.aufgabenstellung ? (
              <>
                <Eyebrow>Aufgabenstellung</Eyebrow>
                <div style={{ background: "var(--surface-1)", border: "1px solid var(--border-1)", borderRadius: 16, boxShadow: "var(--shadow-card-now)", padding: "18px 20px", marginBottom: 24 }}>
                  <p style={{ margin: props.stichpunkte.length ? "0 0 14px" : 0, fontSize: 14.5, lineHeight: 1.6, color: "var(--text-1)" }}>
                    {props.aufgabenstellung}
                  </p>
                  {props.stichpunkte.length > 0 ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                      {props.stichpunkte.map((lp, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span style={{ width: 20, height: 20, borderRadius: 6, flex: "0 0 20px", background: "var(--blau-tint)", color: "var(--blau)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-serif)", fontSize: 11, fontWeight: 600 }}>
                            {i + 1}
                          </span>
                          <span style={{ fontSize: 13.5, color: "var(--text-1)" }}>{lp}</span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              </>
            ) : null}

            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 9 }}>
              <Eyebrow noMargin>Transkript</Eyebrow>
              <div style={{ fontSize: 11.5, color: "var(--text-3)" }}>automatisch erstellt · kann Fehler enthalten</div>
            </div>
            <div style={{ background: "var(--surface-1)", border: "1px solid var(--border-1)", borderRadius: 16, boxShadow: "var(--shadow-card-now)", padding: "20px 22px" }}>
              <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.8, color: "var(--text-hi)" }}>
                {props.transcript || "Kein Transkript verfügbar."}
              </p>
            </div>
          </div>
        </div>

        {/* Rechts: Bewertung */}
        <div className="lms-scroll" style={{ width: 452, flex: "0 0 452px", overflowY: "auto", padding: "22px 24px", background: "var(--surface-1)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 6 }}>
            <span style={kiChip}>
              <KiIcon />
              KI-Empfehlung
            </span>
          </div>
          <p style={{ margin: "0 0 16px", fontSize: 12.5, lineHeight: 1.5, color: "var(--text-2)" }}>
            KI-Vorschläge für die vier Inhaltskriterien. <span style={{ color: "var(--text-1)", fontWeight: 500 }}>Aussprache</span> wird in v1 manuell bewertet.
          </p>

          <ScoreSummary total={totals.gesamt} max={totals.maxPunkte} />

          <Eyebrow tight>Bewertung nach Kriterien</Eyebrow>
          <CriterionBands items={items} value={bands} onSet={setBand} />

          <Eyebrow tight>Feedback für {props.student}</Eyebrow>
          <textarea
            value={feedback}
            onChange={(e) => {
              setFeedback(e.target.value);
              setSaved(false);
            }}
            placeholder="Gesprochene Rückmeldung notieren — erscheint in der App der/des Teilnehmenden…"
            className="focus-ring"
            style={{
              width: "100%",
              minHeight: 96,
              resize: "vertical",
              borderRadius: 14,
              border: "1px solid var(--border-1)",
              background: "var(--bg)",
              padding: "13px 15px",
              fontSize: 13.5,
              lineHeight: 1.6,
              color: "var(--text-hi)",
              outline: "none",
              fontFamily: "var(--font-ui)",
            }}
          />
        </div>
      </div>

      {modal ? (
        <FreigebenModal
          student={props.student}
          total={totals.gesamt}
          max={totals.maxPunkte}
          busy={busy}
          onCancel={() => setModal(false)}
          onConfirm={() => postGrade(true)}
        />
      ) : null}
    </div>
  );
}

function Eyebrow({ children, noMargin, tight }: { children: React.ReactNode; noMargin?: boolean; tight?: boolean }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--text-2)", marginBottom: noMargin ? 0 : tight ? 11 : 9 }}>
      {children}
    </div>
  );
}
function KiIcon() {
  return (
    <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M12 8.5 13.2 11 12 12.2 10.8 11Z" />
      <path d="M5.6 5.6l2 2M16.4 16.4l2 2M18.4 5.6l-2 2M7.6 16.4l-2 2" />
    </svg>
  );
}

const backBtn: React.CSSProperties = {
  width: 38,
  height: 38,
  borderRadius: 11,
  border: "1px solid var(--border-1)",
  background: "var(--bg)",
  cursor: "pointer",
  color: "var(--text-hi)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flex: "0 0 38px",
};
const draftBtn: React.CSSProperties = {
  height: 40,
  padding: "0 16px",
  borderRadius: 11,
  border: "1px solid var(--border-strong)",
  background: "var(--bg)",
  color: "var(--text-hi)",
  fontSize: 13.5,
  fontWeight: 600,
  cursor: "pointer",
};
const releaseBtn: React.CSSProperties = {
  height: 40,
  padding: "0 18px",
  borderRadius: 11,
  border: "none",
  background: "var(--gruen)",
  color: "#fff",
  fontSize: 13.5,
  fontWeight: 600,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  gap: 8,
  boxShadow: "var(--glow-gruen)",
};
const releasedChip: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  height: 40,
  padding: "0 16px",
  borderRadius: 11,
  background: "var(--gruen-tint)",
  color: "var(--gruen)",
  fontSize: 13.5,
  fontWeight: 600,
};
const kiChip: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: ".06em",
  textTransform: "uppercase",
  color: "var(--lila)",
  background: "var(--lila-tint)",
  padding: "4px 9px",
  borderRadius: 999,
};
