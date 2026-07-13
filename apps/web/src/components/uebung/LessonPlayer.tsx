"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { RedemittelItem } from "@/types";
import { shuffle } from "@repo/core";
import { WordBankExercise } from "./WordBankExercise";
import { ClozeExercise } from "./ClozeExercise";
import { SKILL_ACCENT } from "@/lib/ui";
import { IconX } from "@/components/icons";
import { Card, Num, Pill, ProgressBar } from "@/components/ui/primitives";
import { Button, buttonClass, buttonStyle } from "@/components/ui/controls";

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
          className="hover-surface press grid h-9 w-9 place-items-center rounded-full text-muted transition-colors hover:text-ink"
        >
          <IconX size={18} />
        </button>
        <ProgressBar
          value={progress}
          color={accent}
          height={10}
          style={{ flex: 1 }}
        />
        <span className="w-12 text-right font-serif text-[13px] tabular-nums text-muted">
          {solved.size}/{total}
        </span>
      </div>

      {/* Exercise */}
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col overflow-y-auto px-4 pt-2">
        <div className="mb-2 text-xs text-faint">
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
  // Gleiche Schwellen wie die Ergebnis-Karte des Lehrkraft-Portals (statusOf).
  const status =
    pct >= 60
      ? { color: "var(--gruen)", tint: "var(--gruen-tint)", label: "Stark!" }
      : pct >= 50
        ? { color: "var(--gold-text)", tint: "var(--gold-tint)", label: "Knapp" }
        : { color: "var(--rot-text)", tint: "var(--rot-tint)", label: "Weiter üben" };

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col items-center justify-center px-6">
      <div className="animate-fade-in w-full">
        <Card radius={24} style={{ padding: "28px 24px", textAlign: "center" }}>
          <div className="text-5xl" aria-hidden>
            🎉
          </div>
          <h1
            className="font-serif"
            style={{
              margin: "14px 0 0",
              fontSize: 24,
              fontWeight: 600,
              color: "var(--text-hi)",
            }}
          >
            Lektion geschafft!
          </h1>

          <div className="mt-5 flex items-baseline justify-center gap-1.5">
            <span
              className="font-serif tabular-nums"
              style={{ fontSize: 40, fontWeight: 600, color: "var(--text-hi)", lineHeight: 1 }}
            >
              {correctFirstTry}
            </span>
            <span className="font-serif tabular-nums" style={{ fontSize: 22, color: "var(--text-2)" }}>
              / {total}
            </span>
            <span className="ml-1 text-[13px] text-muted">auf Anhieb</span>
          </div>

          <div className="mx-auto mt-4 max-w-[240px]">
            <ProgressBar value={pct} color={status.color} height={8} />
          </div>

          <div className="mt-3">
            <Pill tone="neutral" style={{ background: status.tint, color: status.color }}>
              {status.label} · <Num>{pct}%</Num>
            </Pill>
          </div>

          <div className="mt-7 flex flex-col gap-3">
            <Button
              variant="accent"
              onClick={onRestart}
              style={{ height: 48, background: accent, boxShadow: "none" }}
            >
              Nochmal üben
            </Button>
            <Link
              href="/"
              className={buttonClass("outline")}
              style={{ ...buttonStyle("outline"), height: 48 }}
            >
              Zur Übersicht
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
