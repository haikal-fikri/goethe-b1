"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { RedemittelItem } from "@/types";
import { shuffle } from "@repo/core";
import { WordBankExercise } from "./WordBankExercise";
import { ClozeExercise } from "./ClozeExercise";
import { SKILL_ACCENT } from "@/lib/ui";

export function LessonPlayer({
  items,
  title,
  subtitle,
}: {
  items: RedemittelItem[];
  title: string;
  subtitle: string;
}) {
  const router = useRouter();
  const initial = useMemo(() => shuffle(items), [items]);
  const total = items.length;
  const accent = SKILL_ACCENT[items[0]?.skill ?? "schreiben"];

  // Erst nach dem Mount randomisieren — sonst weichen Server- und Client-Render
  // (Math.random in shuffle) voneinander ab → Hydration-Fehler.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [queue, setQueue] = useState<RedemittelItem[]>(initial);
  const [pos, setPos] = useState(0);
  const [solved, setSolved] = useState<Set<string>>(new Set());
  const [correctFirstTry, setCorrectFirstTry] = useState(0);
  const [seenWrong, setSeenWrong] = useState<Set<string>>(new Set());

  const current = queue[pos];
  const finished = pos >= queue.length;

  function handleContinue(correct: boolean) {
    const item = queue[pos];
    if (correct) {
      setSolved((s) => new Set(s).add(item.id));
      if (!seenWrong.has(item.id)) {
        setCorrectFirstTry((c) => c + 1);
      }
    } else {
      setSeenWrong((s) => new Set(s).add(item.id));
      // Item ans Ende anhängen, um es erneut zu üben
      setQueue((q) => [...q, item]);
    }
    setPos((p) => p + 1);
  }

  const progress = total === 0 ? 0 : Math.round((solved.size / total) * 100);

  if (finished || !current) {
    return (
      <LessonComplete
        total={total}
        correctFirstTry={correctFirstTry}
        accent={accent}
        onRestart={() => {
          setQueue(shuffle(items));
          setPos(0);
          setSolved(new Set());
          setSeenWrong(new Set());
          setCorrectFirstTry(0);
        }}
      />
    );
  }

  return (
    <div className="flex h-[100dvh] flex-col">
      {/* Top-Bar */}
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          onClick={() => router.push("/")}
          aria-label="Übung schließen"
          className="grid h-9 w-9 place-items-center rounded-full text-[var(--fg-muted)] transition-colors hover:bg-[var(--bg-elev)] hover:text-[var(--fg)]"
        >
          ✕
        </button>
        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[var(--bg-elev)]">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{ width: `${progress}%`, backgroundColor: accent }}
          />
        </div>
        <span className="w-12 text-right font-mono text-xs text-[var(--fg-dim)]">
          {solved.size}/{total}
        </span>
      </div>

      {/* Exercise */}
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col overflow-y-auto px-4 pt-2">
        <div className="mb-2 text-xs text-[var(--fg-dim)]">
          {title} · {subtitle}
        </div>
        <div className="flex-1">
          {/* Vor dem Mount nichts Zufälliges rendern (Hydration). Danach
              abwechselnd: Wortbank ↔ Lückentext (Variation wie bei Duolingo). */}
          {!mounted ? null : pos % 2 === 0 ? (
            <WordBankExercise
              key={`${current.id}-${pos}`}
              item={current}
              onContinue={handleContinue}
            />
          ) : (
            <ClozeExercise
              key={`${current.id}-${pos}`}
              item={current}
              onContinue={handleContinue}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function LessonComplete({
  total,
  correctFirstTry,
  accent,
  onRestart,
}: {
  total: number;
  correctFirstTry: number;
  accent: string;
  onRestart: () => void;
}) {
  const pct = total === 0 ? 0 : Math.round((correctFirstTry / total) * 100);
  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col items-center justify-center px-6 text-center">
      <div className="animate-fade-in">
        <div className="text-5xl" aria-hidden>
          🎉
        </div>
        <h1 className="mt-4 text-2xl font-semibold text-[var(--fg)]">
          Lektion geschafft!
        </h1>
        <p className="mt-2 text-sm text-[var(--fg-muted)]">
          {correctFirstTry} von {total} Wendungen auf Anhieb richtig ({pct}%).
        </p>
        <div className="mt-8 flex flex-col gap-3">
          <button
            onClick={onRestart}
            className="min-h-[48px] rounded-[var(--radius)] px-5 py-3 font-semibold text-[var(--bg)]"
            style={{ backgroundColor: accent }}
          >
            Nochmal üben
          </button>
          <Link
            href="/"
            className="min-h-[48px] rounded-[var(--radius)] border border-[var(--border-soft)] px-5 py-3 font-medium text-[var(--fg)] transition-colors hover:border-[var(--border-base)]"
          >
            Zur Übersicht
          </Link>
        </div>
      </div>
    </div>
  );
}
