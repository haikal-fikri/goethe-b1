"use client";

import type {
  CriterionBand,
  ExamGrade,
  ExaminerResult,
  ExamTask,
} from "@/types";
import { Card, Num, ProgressBar } from "@/components/ui/primitives";
import { buttonClass, buttonStyle } from "@/components/ui/controls";
import { IconChevronRight } from "@/components/icons";
import { ACCENT, BAND_COLOR, fmtPunkte, statusOf } from "./examUi";
import { SendResultByEmail } from "./SendResultByEmail";

/** Band-Plakette A–E. Zahlen/Buchstaben in der Serife (Designregel). */
export function BandChip({ band }: { band: CriterionBand }) {
  const color = BAND_COLOR[band];
  return (
    <span
      className="grid h-6 w-6 place-items-center rounded-full font-serif text-xs font-semibold"
      style={{
        color,
        backgroundColor: `color-mix(in oklab, ${color} 16%, transparent)`,
        border: `1px solid color-mix(in oklab, ${color} 45%, transparent)`,
      }}
    >
      {band}
    </span>
  );
}

export function GradeResult({
  grade,
  examiners,
  thirdUsed,
  task,
  essay,
  onReset,
}: {
  grade: ExamGrade;
  examiners: ExaminerResult[];
  thirdUsed: boolean;
  task: ExamTask;
  essay: string;
  onReset: () => void;
}) {
  const bandOf = (label: string, key: string): CriterionBand | undefined =>
    examiners
      .find((e) => e.label === label)
      ?.grade.criteria.find((c) => c.key === key)?.band;

  const pct =
    grade.maxPunkte > 0
      ? Math.round((grade.gesamtpunkte / grade.maxPunkte) * 100)
      : 0;
  const status = statusOf(pct);
  const schwelle = Math.round(grade.maxPunkte * 0.6 * 10) / 10;

  return (
    <div className="mt-6 animate-fade-in">
      {/* Gesamtergebnis — Aufbau wie die ScoreSummary des Lehrkraft-Portals */}
      <Card radius={18}>
        <div className="mb-3 flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-[.1em] text-muted">
            Gesamtergebnis · Vier-Augen-Prinzip
          </span>
          <span
            className="inline-flex items-center rounded-full px-2.5 py-1 text-[12.5px] font-semibold"
            style={{ color: status.color, background: status.tint }}
          >
            {grade.bestanden ? status.label : "Nicht bestanden"}
          </span>
        </div>

        <div className="mb-3.5 flex items-end justify-between">
          <div className="flex items-baseline gap-1.5">
            <span
              className="font-serif tabular-nums"
              style={{ fontSize: 40, fontWeight: 600, color: "var(--text-hi)", lineHeight: 1 }}
            >
              {fmtPunkte(grade.gesamtpunkte)}
            </span>
            <span
              className="font-serif tabular-nums"
              style={{ fontSize: 22, color: "var(--text-2)" }}
            >
              / {fmtPunkte(grade.maxPunkte)}
            </span>
            <span className="ml-0.5 text-[13px] text-muted">Punkte</span>
          </div>
          <span
            className="font-serif tabular-nums"
            style={{ fontSize: 26, fontWeight: 600, color: status.color }}
          >
            {pct}%
          </span>
        </div>

        <ProgressBar value={pct} color={status.color} height={8} />

        <p className="mt-2.5 text-xs text-muted">
          Bestehen ab <Num className="text-body">{fmtPunkte(schwelle)}</Num>{" "}
          Punkten (60%)
        </p>
      </Card>

      {/* Kriterien (zusammengeführt) */}
      <ul className="mt-3 flex flex-col gap-3">
        {grade.criteria.map((c) => (
          <li key={c.key}>
            <Card radius={16}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <BandChip band={c.band} />
                  <span className="text-sm font-semibold text-ink">
                    {c.labelDe}
                  </span>
                </div>
                <span className="shrink-0 text-xs text-muted">
                  <Num className="text-ink">{fmtPunkte(c.punkte)}</Num> /{" "}
                  <Num>{fmtPunkte(c.maxPunkte)}</Num> Punkte
                </span>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                {c.begruendungDe}
              </p>
            </Card>
          </li>
        ))}
      </ul>

      {/* Vier-Augen-Aufschlüsselung */}
      {examiners.length >= 2 && (
        <div className="mt-3">
          <Card radius={16}>
            <details className="group/aug">
              <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold text-ink outline-none">
                <span
                  className="transition-transform group-open/aug:rotate-90"
                  style={{ color: ACCENT }}
                >
                  <IconChevronRight size={15} />
                </span>
                4-Augen-Prinzip — die zwei Prüfer im Vergleich
              </summary>

              <div className="mt-3 overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="text-left text-[10.5px] uppercase tracking-[.09em] text-muted">
                      <th className="py-1 pr-3 font-semibold">Kriterium</th>
                      <th className="px-2 py-1 text-center font-semibold">A · mild</th>
                      <th className="px-2 py-1 text-center font-semibold">B · streng</th>
                      {thirdUsed && (
                        <th className="px-2 py-1 text-center font-semibold">Konsens</th>
                      )}
                      <th className="px-2 py-1 text-center font-semibold">Ø Punkte</th>
                    </tr>
                  </thead>
                  <tbody>
                    {grade.criteria.map((c) => {
                      const a = bandOf("mild", c.key);
                      const b = bandOf("streng", c.key);
                      const k = bandOf("konsens", c.key);
                      return (
                        <tr key={c.key} className="border-t border-line">
                          <td className="py-2 pr-3 text-muted">{c.labelDe}</td>
                          <td className="px-2 py-2 text-center">
                            {a && (
                              <span className="inline-grid place-items-center">
                                <BandChip band={a} />
                              </span>
                            )}
                          </td>
                          <td className="px-2 py-2 text-center">
                            {b && (
                              <span className="inline-grid place-items-center">
                                <BandChip band={b} />
                              </span>
                            )}
                          </td>
                          {thirdUsed && (
                            <td className="px-2 py-2 text-center">
                              {k && (
                                <span className="inline-grid place-items-center">
                                  <BandChip band={k} />
                                </span>
                              )}
                            </td>
                          )}
                          <td className="px-2 py-2 text-center text-body">
                            <Num>{fmtPunkte(c.punkte)}</Num>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <p className="mt-3 text-xs leading-relaxed text-faint">
                Wie in der echten Prüfung bewerten zwei Prüfer unabhängig; das
                Endergebnis ist das arithmetische Mittel beider Bewertungen.
                {thirdUsed
                  ? " Da sich die beiden über das Bestehen uneinig waren, gab eine Drittbewertung (Prüfer C) den Ausschlag."
                  : ""}
              </p>
            </details>
          </Card>
        </div>
      )}

      {/* Gesamtrückmeldung */}
      <div className="mt-3">
        <Card radius={16}>
          <h3 className="text-sm font-semibold text-ink">Rückmeldung</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">
            {grade.summaryDe}
          </p>
          {grade.korrekturen && grade.korrekturen.length > 0 && (
            <>
              <h4 className="mt-4 text-[11px] font-semibold uppercase tracking-[.1em] text-muted">
                Verbesserungsvorschläge
              </h4>
              <ul className="mt-2 flex flex-col gap-1.5">
                {grade.korrekturen.map((k, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-muted">
                    <span className="mt-0.5 shrink-0" style={{ color: ACCENT }}>
                      <IconChevronRight size={14} />
                    </span>
                    <span>{k}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>
      </div>

      {/* Ergebnis per E-Mail teilen */}
      <SendResultByEmail
        task={task}
        essay={essay}
        grade={grade}
        examiners={examiners}
        thirdUsed={thirdUsed}
      />

      <button
        onClick={onReset}
        className={`mt-4 ${buttonClass("outline")}`}
        style={buttonStyle("outline")}
      >
        Neue Antwort schreiben
      </button>
    </div>
  );
}
