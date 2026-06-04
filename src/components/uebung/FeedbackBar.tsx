import type { RedemittelItem } from "@/types";

type Phase = "input" | "correct" | "wrong";

/**
 * Gemeinsame Aktions-/Feedback-Leiste für die Übungen (Wortbank & Lücken).
 * input → „Prüfen“, danach Rückmeldung (richtig/falsch) + „Weiter“.
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
        {isCorrect && (
          <div className="text-sm">
            <span className="font-semibold text-[var(--ok)]">Richtig!</span>{" "}
            <span className="text-[var(--fg-muted)]">
              {item.function.nameDe}
              {item.notes ? ` · ${item.notes}` : ""}
            </span>
          </div>
        )}
        {isWrong && (
          <div className="text-sm">
            <span className="font-semibold text-[var(--bad)]">Nicht ganz.</span>{" "}
            <span className="text-[var(--fg-muted)]">Lösung: </span>
            <span className="font-medium text-[var(--fg)]">{item.phrase}</span>
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
