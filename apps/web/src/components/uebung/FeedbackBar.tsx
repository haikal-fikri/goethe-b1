import type { RedemittelItem } from "@/types";
import { ON_ACCENT } from "@/lib/ui";

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

  // Der Ergebnis-Ton kommt aus den Akzent-Tokens (grün/rot). Der Hintergrund
  // wird bewusst ÜBER --bg gemischt statt den fertigen *-tint zu nehmen: die
  // Leiste klebt am unteren Rand, und die Dark-Tints sind halbtransparent —
  // sonst scrollte der Übungstext sichtbar hindurch.
  const toneColor = isCorrect ? "var(--gruen)" : "var(--rot-text)";

  return (
    <div
      className="sticky bottom-0 -mx-4 mt-4 border-t px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4"
      style={{
        borderColor: reveal ? toneColor : "var(--border-1)",
        backgroundColor: reveal
          ? `color-mix(in oklab, ${toneColor} 10%, var(--bg))`
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
                  <span className="font-semibold" style={{ color: toneColor }}>
                    Richtig!
                  </span>{" "}
                  <span className="text-muted">{item.function.nameDe}</span>
                </>
              ) : (
                <>
                  <span className="font-semibold" style={{ color: toneColor }}>
                    Nicht ganz.
                  </span>{" "}
                  <span className="text-muted">Lösung: </span>
                  <span className="font-medium text-ink">{item.phrase}</span>
                </>
              )}
            </div>

            {/* Satzmuster */}
            {item.frame && (
              <div className="text-muted">
                <span className="text-faint">Muster: </span>
                <span className="font-medium italic text-ink">{item.frame}</span>
              </div>
            )}

            {/* Notiz (Grammatik/Pragmatik) */}
            {item.notes && <div className="text-muted">{item.notes}</div>}

            {/* Beispiele im Kontext */}
            {examples.length > 0 && (
              <div
                className="flex flex-col gap-1 border-l-2 pl-3"
                style={{ borderColor: accent }}
              >
                <span className="text-xs font-semibold uppercase tracking-wider text-faint">
                  {examples.length > 1 ? "Beispiele" : "Beispiel"}
                </span>
                {examples.map((ex, i) => (
                  <div key={i} className="leading-snug">
                    <span className="text-ink">{ex.de}</span>
                    {ex.en && <span className="text-faint"> — {ex.en}</span>}
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
            className="press min-h-[48px] w-full rounded-tile px-4 py-3 text-[15px] font-semibold transition-opacity disabled:opacity-40"
            // ON_ACCENT (#fff), NIE var(--bg): auf der gesättigten Akzentfläche
            // stünde sonst im Dark-Theme fast-schwarze Schrift auf Grün.
            style={{ backgroundColor: accent, color: ON_ACCENT }}
          >
            Prüfen
          </button>
        ) : (
          <button
            type="button"
            onClick={onContinue}
            autoFocus
            className="press min-h-[48px] w-full rounded-tile px-4 py-3 text-[15px] font-semibold"
            style={{
              backgroundColor: isCorrect ? "var(--gruen)" : "var(--rot)",
              color: ON_ACCENT,
            }}
          >
            Weiter
          </button>
        )}
      </div>
    </div>
  );
}
