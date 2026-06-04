"use client";

import { useMemo, useState } from "react";
import type { RedemittelItem } from "@/types";
import { LevelBadge } from "@/components/LevelBadge";
import { shuffle } from "@/lib/exercise";

const ACCENT = "var(--accent-write)";

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[.,;!?]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Prüft grob, ob die Wendung (Frame ohne „…“) im Text vorkommt */
function isUsed(item: RedemittelItem, text: string): boolean {
  const haystack = normalize(text);
  if (haystack.length === 0) return false;
  const base = (item.frame ?? item.phrase).replace(/…/g, "|");
  const chunks = base
    .split("|")
    .map((c) => normalize(c))
    .filter((c) => c.length >= 4);
  if (chunks.length === 0) return false;
  return chunks.every((c) => haystack.includes(c));
}

export function SchreibenPractice({ items }: { items: RedemittelItem[] }) {
  const tasks = useMemo(() => {
    const map = new Map<string, { label: string; items: RedemittelItem[] }>();
    for (const it of items) {
      if (!map.has(it.task.code))
        map.set(it.task.code, { label: it.task.labelDe, items: [] });
      map.get(it.task.code)!.items.push(it);
    }
    return [...map.entries()].map(([code, v]) => ({ code, ...v }));
  }, [items]);

  const [taskCode, setTaskCode] = useState(tasks[0]?.code ?? "");
  const [targets, setTargets] = useState<RedemittelItem[]>(() =>
    shuffle(tasks[0]?.items ?? []).slice(0, 5)
  );
  const [text, setText] = useState("");

  function pickTask(code: string) {
    setTaskCode(code);
    const t = tasks.find((x) => x.code === code);
    setTargets(shuffle(t?.items ?? []).slice(0, 5));
    setText("");
  }

  function reshuffle() {
    const t = tasks.find((x) => x.code === taskCode);
    setTargets(shuffle(t?.items ?? []).slice(0, 5));
  }

  const usedCount = targets.filter((t) => isUsed(t, text)).length;
  const words = text.trim() === "" ? 0 : text.trim().split(/\s+/).length;

  return (
    <div className="mx-auto max-w-3xl px-4 pb-20 pt-6">
      <div className="flex flex-wrap gap-2">
        {tasks.map((t) => {
          const isActive = t.code === taskCode;
          return (
            <button
              key={t.code}
              onClick={() => pickTask(t.code)}
              className="rounded-full border px-3 py-1.5 text-xs transition-colors"
              style={{
                borderColor: isActive ? ACCENT : "var(--border-soft)",
                color: isActive ? "var(--fg)" : "var(--fg-muted)",
                backgroundColor: isActive
                  ? `color-mix(in srgb, ${ACCENT} 14%, transparent)`
                  : "transparent",
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Schreibfeld */}
        <div className="flex flex-col">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Schreibe hier deinen Text und versuche, die Redemittel rechts einzubauen …"
            className="min-h-[260px] flex-1 resize-y rounded-[var(--radius)] border border-[var(--border-soft)] bg-[var(--bg-elev)] p-4 text-[15px] leading-relaxed text-[var(--fg)] outline-none focus:border-[var(--border-base)]"
          />
          <div className="mt-2 flex items-center justify-between text-xs text-[var(--fg-dim)]">
            <span>{words} Wörter</span>
            <span>
              {usedCount}/{targets.length} Redemittel verwendet
            </span>
          </div>
        </div>

        {/* Redemittel-Checkliste */}
        <div className="rounded-[var(--radius)] border border-[var(--border-soft)] bg-[var(--bg-elev)] p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[var(--fg)]">
              Diese Redemittel einbauen
            </h2>
            <button
              onClick={reshuffle}
              className="text-xs text-[var(--fg-muted)] underline-offset-2 hover:underline"
            >
              andere
            </button>
          </div>
          <ul className="flex flex-col gap-3">
            {targets.map((t) => {
              const used = isUsed(t, text);
              return (
                <li key={t.id} className="flex items-start gap-2">
                  <span
                    aria-hidden
                    className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px]"
                    style={{
                      backgroundColor: used
                        ? "color-mix(in srgb, var(--ok) 22%, transparent)"
                        : "var(--bg-elev-2)",
                      color: used ? "var(--ok)" : "var(--fg-dim)",
                      border: `1px solid ${
                        used
                          ? "color-mix(in srgb, var(--ok) 50%, transparent)"
                          : "var(--border-soft)"
                      }`,
                    }}
                  >
                    {used ? "✓" : ""}
                  </span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className="text-sm"
                        style={{
                          color: used ? "var(--fg)" : "var(--fg-muted)",
                        }}
                      >
                        {t.frame ?? t.phrase}
                      </span>
                      <LevelBadge level={t.level} />
                    </div>
                    <span className="text-xs italic text-[var(--fg-dim)]">
                      {t.translation}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="mt-4 text-xs text-[var(--fg-dim)]">
            Selbstabgleich ohne Bewertung — das Häkchen erscheint, wenn die
            Wendung ungefähr im Text vorkommt.
          </p>
        </div>
      </div>
    </div>
  );
}
