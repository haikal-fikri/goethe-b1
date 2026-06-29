import type { RedemittelItem } from "@/types";

type Phase = "input" | "correct" | "wrong";

/**
 * Gemeinsame Aktions-/Feedback-Leiste für die Übungen (Wortbank & Lücken).
 * input → „Prüfen“, danach Rückmeldung (richtig/falsch). Die Rückmeldung zeigt
 * jetzt das Satzmuster (frame), die Funktion, Notizen und 1–2 Beispielsätze —
 * der Moment nach dem Versuch ist didaktisch ideal zum „Bemerken“ der Struktur.
 */
export function FeedbackBar({
  phase,
  item,
  accent,
  canCheck,
  onCheck,
  onContinue,
}: {
  phase: Phase;
  item: RedemittelItem;
  accent: string;
  canCheck: boolean;
  onCheck: () => void;
  onContinue: () => void;
}) {
  const isCorrect = phase === "correct";
  const isWrong = phase === "wrong";
  const reveal = isCorrect || isWrong;
  const examples = (item.examples ?? []).slice(0, isCorrect ? 2 : 1);

  return (
    <div
      className="sticky bottom-0 -mx-4 mt-4 border-t px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4"
      style={{
        borderColor: isCorrect
          ? "var(--ok)"
          : isWrong
            ? "var(--bad)"
            : "var(--border-soft)",
        backgroundColor: isCorrect
          ? "color-mix(in srgb, var(--ok) 12%, var(--bg))"
          : isWrong
            ? "color-mix(in srgb, var(--bad) 12%, var(--bg))"
            : "var(--bg)",
      }}
      role={phase === "input" ? undefined : "status"}
    >
      <div className="mx-auto flex max-w-2xl flex-col gap-3">
        {reveal && (
          <div className="flex flex-col gap-2 text-sm">
            {/* Kopfzeile: richtig/falsch + Lösung */}
            <div>
              {isCorrect ? (
                <>
                  <span className="font-semibold text-[var(--ok)]">Richtig!</span>{" "}
                  <span className="text-[var(--fg-muted)]">{item.function.nameDe}</span>
                </>
              ) : (
                <>
                  <span className="font-semibold text-[var(--bad)]">Nicht ganz.</span>{" "}
                  <span className="text-[var(--fg-muted)]">Lösung: </span>
                  <span className="font-medium text-[var(--fg)]">{item.phrase}</span>
                </>
              )}
            </div>

            {/* Satzmuster */}
            {item.frame && (
              <div className="text-[var(--fg-muted)]">
                <span className="text-[var(--fg-dim)]">Muster: </span>
                <span className="font-medium italic text-[var(--fg)]">{item.frame}</span>
              </div>
            )}

            {/* Notiz (Grammatik/Pragmatik) */}
            {item.notes && (
              <div className="text-[var(--fg-muted)]">{item.notes}</div>
            )}

            {/* Beispiele im Kontext */}
            {examples.length > 0 && (
              <div className="flex flex-col gap-1 border-l-2 pl-3" style={{ borderColor: accent }}>
                <span className="text-xs font-medium uppercase tracking-wide text-[var(--fg-dim)]">
                  {examples.length > 1 ? "Beispiele" : "Beispiel"}
                </span>
                {examples.map((ex, i) => (
                  <div key={i} className="leading-snug">
                    <span className="text-[var(--fg)]">{ex.de}</span>
                    {ex.en && (
                      <span className="text-[var(--fg-dim)]"> — {ex.en}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {phase === "input" ? (
          <button
            type="button"
            onClick={onCheck}
            disabled={!canCheck}
            className="min-h-[48px] w-full rounded-[var(--radius)] px-4 py-3 text-[15px] font-semibold text-[var(--bg)] transition-opacity disabled:opacity-40"
            style={{ backgroundColor: accent }}
          >
            Prüfen
          </button>
        ) : (
          <button
            type="button"
            onClick={onContinue}
            autoFocus
            className="min-h-[48px] w-full rounded-[var(--radius)] px-4 py-3 text-[15px] font-semibold text-[var(--bg)]"
            style={{
              backgroundColor: isCorrect ? "var(--ok)" : "var(--bad)",
            }}
          >
            Weiter
          </button>
        )}
      </div>
    </div>
  );
}
