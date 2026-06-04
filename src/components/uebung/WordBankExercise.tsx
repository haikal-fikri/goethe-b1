"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RedemittelItem } from "@/types";
import { arraysEqual, buildTiles, type Tile } from "@/lib/exercise";
import { LevelBadge } from "@/components/LevelBadge";
import { SKILL_ACCENT } from "@/lib/ui";

type Phase = "input" | "correct" | "wrong";

export function WordBankExercise({
  item,
  onContinue,
}: {
  item: RedemittelItem;
  onContinue: (correct: boolean) => void;
}) {
  const tiles = useMemo(() => buildTiles(item), [item]);
  const [selected, setSelected] = useState<Tile[]>([]);
  const [phase, setPhase] = useState<Phase>("input");
  const accent = SKILL_ACCENT[item.skill];

  const selectedIds = new Set(selected.map((t) => t.id));
  const bank = tiles.filter((t) => !selectedIds.has(t.id));

  const pickTile = useCallback(
    (tile: Tile) => {
      if (phase !== "input") return;
      setSelected((s) => (s.some((t) => t.id === tile.id) ? s : [...s, tile]));
    },
    [phase]
  );

  const removeTile = useCallback(
    (tile: Tile) => {
      if (phase !== "input") return;
      setSelected((s) => s.filter((t) => t.id !== tile.id));
    },
    [phase]
  );

  const check = useCallback(() => {
    if (phase !== "input" || selected.length === 0) return;
    const correct = arraysEqual(
      selected.map((t) => t.label),
      item.tokens
    );
    setPhase(correct ? "correct" : "wrong");
  }, [phase, selected, item.tokens]);

  const cont = useCallback(() => {
    onContinue(phase === "correct");
  }, [onContinue, phase]);

  // Tastatursteuerung: Ziffern wählen Bank-Kacheln, Enter prüft/weiter, Backspace entfernt
  const bankRef = useRef(bank);
  bankRef.current = bank;
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Enter") {
        e.preventDefault();
        if (phase === "input") check();
        else cont();
        return;
      }
      if (phase !== "input") return;
      if (e.key === "Backspace") {
        e.preventDefault();
        setSelected((s) => s.slice(0, -1));
        return;
      }
      const n = parseInt(e.key, 10);
      if (!Number.isNaN(n) && n >= 1 && n <= 9) {
        const tile = bankRef.current[n - 1];
        if (tile) {
          e.preventDefault();
          pickTile(tile);
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, check, cont, pickTile]);

  return (
    <div className="flex h-full flex-col">
      {/* Prompt */}
      <div className="animate-fade-in px-1">
        <div className="mb-1 flex items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-[var(--fg-dim)]">
            Übersetze
          </span>
          <LevelBadge level={item.level} />
        </div>
        <p className="text-xl font-medium leading-snug text-[var(--fg)]">
          {item.translation}
        </p>
      </div>

      {/* Antwort-Slots */}
      <div
        aria-live="polite"
        aria-label="Dein Satz"
        className="mt-6 flex min-h-[64px] flex-wrap content-start gap-2 rounded-[var(--radius)] border border-dashed border-[var(--border-base)] bg-[color-mix(in_srgb,var(--bg-elev)_50%,transparent)] p-3"
      >
        {selected.length === 0 && (
          <span className="self-center text-sm text-[var(--fg-dim)]">
            Tippe die Wörter in der richtigen Reihenfolge an …
          </span>
        )}
        {selected.map((tile) => (
          <TileButton
            key={tile.id}
            tile={tile}
            onClick={() => removeTile(tile)}
            disabled={phase !== "input"}
          />
        ))}
      </div>

      {/* Wortbank */}
      <div className="mt-4 flex flex-wrap gap-2">
        {bank.map((tile, i) => (
          <TileButton
            key={tile.id}
            tile={tile}
            index={i < 9 ? i + 1 : undefined}
            onClick={() => pickTile(tile)}
            disabled={phase !== "input"}
            variant="bank"
          />
        ))}
        {bank.length === 0 && phase === "input" && (
          <span className="text-sm text-[var(--fg-dim)]">
            Alle Wörter gesetzt — prüfe deine Lösung.
          </span>
        )}
      </div>

      <div className="flex-1" />

      {/* Feedback + Aktion */}
      <FeedbackBar
        phase={phase}
        item={item}
        accent={accent}
        canCheck={selected.length > 0}
        onCheck={check}
        onContinue={cont}
      />
    </div>
  );
}

function TileButton({
  tile,
  onClick,
  disabled,
  index,
  variant = "slot",
}: {
  tile: Tile;
  onClick: () => void;
  disabled?: boolean;
  index?: number;
  variant?: "slot" | "bank";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={
        index ? `${tile.label} (Taste ${index})` : tile.label
      }
      className="relative min-h-[44px] rounded-[var(--radius)] border border-[var(--border-soft)] bg-[var(--bg-elev-2)] px-3.5 py-2 text-[15px] text-[var(--fg)] transition-colors enabled:hover:border-[var(--border-base)] disabled:opacity-60"
    >
      {tile.label}
      {variant === "bank" && index && (
        <span className="ml-1.5 hidden font-mono text-[10px] text-[var(--fg-dim)] sm:inline">
          {index}
        </span>
      )}
    </button>
  );
}

function FeedbackBar({
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
            <span className="font-semibold text-[var(--bad)]">
              Nicht ganz.
            </span>{" "}
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
