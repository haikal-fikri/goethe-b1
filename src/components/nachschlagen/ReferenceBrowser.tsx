"use client";

import { useMemo, useState } from "react";
import type { CEFRLevel, RedemittelItem, SkillCode } from "@/types";
import { LEVEL_RANK } from "@/types";
import { LevelBadge } from "@/components/LevelBadge";
import { SKILL_ACCENT, SKILL_LABEL } from "@/lib/ui";

const MIN_FILTERS: { label: string; min: CEFRLevel }[] = [
  { label: "Alle", min: "B1" },
  { label: "ab B2", min: "B2" },
  { label: "ab C1", min: "C1" },
];

interface Group {
  taskLabel: string;
  functions: { name: string; items: RedemittelItem[] }[];
}

export function ReferenceBrowser({ items }: { items: RedemittelItem[] }) {
  const skills = useMemo(
    () => [...new Set(items.map((i) => i.skill))] as SkillCode[],
    [items]
  );
  const [activeSkill, setActiveSkill] = useState<SkillCode>(
    skills[0] ?? "schreiben"
  );
  const [minLevel, setMinLevel] = useState<CEFRLevel>("B1");
  const [query, setQuery] = useState("");
  const accent = SKILL_ACCENT[activeSkill];

  const groups = useMemo<Group[]>(() => {
    const min = LEVEL_RANK[minLevel];
    const q = query.trim().toLowerCase();
    const filtered = items.filter(
      (i) =>
        i.skill === activeSkill &&
        LEVEL_RANK[i.level] >= min &&
        (q === "" ||
          i.phrase.toLowerCase().includes(q) ||
          i.frame?.toLowerCase().includes(q) ||
          i.translation.toLowerCase().includes(q))
    );

    const taskMap = new Map<string, Map<string, RedemittelItem[]>>();
    for (const it of filtered) {
      if (!taskMap.has(it.task.labelDe)) taskMap.set(it.task.labelDe, new Map());
      const fnMap = taskMap.get(it.task.labelDe)!;
      if (!fnMap.has(it.function.nameDe)) fnMap.set(it.function.nameDe, []);
      fnMap.get(it.function.nameDe)!.push(it);
    }
    return [...taskMap.entries()].map(([taskLabel, fnMap]) => ({
      taskLabel,
      functions: [...fnMap.entries()].map(([name, its]) => ({ name, items: its })),
    }));
  }, [items, activeSkill, minLevel, query]);

  return (
    <div className="mx-auto max-w-3xl px-4 pb-20 pt-6">
      <div role="tablist" className="flex gap-2 overflow-x-auto pb-1">
        {skills.map((s) => {
          const isActive = s === activeSkill;
          const a = SKILL_ACCENT[s];
          return (
            <button
              key={s}
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveSkill(s)}
              className="shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors"
              style={{
                borderColor: isActive
                  ? `color-mix(in srgb, ${a} 55%, transparent)`
                  : "var(--border-soft)",
                color: isActive ? a : "var(--fg-muted)",
                backgroundColor: isActive
                  ? `color-mix(in srgb, ${a} 12%, transparent)`
                  : "transparent",
              }}
            >
              {SKILL_LABEL[s]}
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {MIN_FILTERS.map((f) => {
          const isActive = f.min === minLevel;
          return (
            <button
              key={f.min}
              onClick={() => setMinLevel(f.min)}
              className="rounded-full border px-3 py-1 text-xs transition-colors"
              style={{
                borderColor: isActive ? accent : "var(--border-soft)",
                color: isActive ? "var(--fg)" : "var(--fg-muted)",
                backgroundColor: isActive
                  ? `color-mix(in srgb, ${accent} 14%, transparent)`
                  : "transparent",
              }}
            >
              {f.label}
            </button>
          );
        })}
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Suchen …"
          className="ml-auto min-w-[140px] flex-1 rounded-full border border-[var(--border-soft)] bg-[var(--bg-elev)] px-3 py-1.5 text-sm text-[var(--fg)] outline-none focus:border-[var(--border-base)] sm:flex-none"
        />
      </div>

      {groups.length === 0 && (
        <p className="mt-10 text-center text-sm text-[var(--fg-dim)]">
          Keine Treffer.
        </p>
      )}

      <div key={activeSkill} className="animate-fade-in">
        {groups.map((g) => (
          <section key={g.taskLabel} className="mt-7">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--fg-dim)]">
              {g.taskLabel}
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {g.functions.map((fn) => (
                <div
                  key={fn.name}
                  className="rounded-[var(--radius)] border border-[var(--border-soft)] bg-[var(--bg-elev)] p-4"
                >
                  <h3 className="mb-2 text-sm font-medium text-[var(--fg)]">
                    {fn.name}
                  </h3>
                  <ul className="flex flex-col gap-1">
                    {fn.items.map((it) => (
                      <li key={it.id}>
                        <details className="group/item">
                          <summary className="flex cursor-pointer list-none items-start gap-2 rounded-[calc(var(--radius)-4px)] py-1 outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-base)]">
                            <span
                              className="mt-0.5 shrink-0 text-[var(--fg-dim)] transition-transform group-open/item:rotate-90"
                              style={{ color: accent }}
                              aria-hidden
                            >
                              ›
                            </span>
                            <span className="flex-1 text-[var(--fg)]">
                              {it.frame ?? it.phrase}
                            </span>
                            <LevelBadge level={it.level} />
                          </summary>
                          <div className="mt-1 flex flex-col gap-0.5 border-l-2 pl-3 pt-0.5"
                            style={{ borderColor: `color-mix(in srgb, ${accent} 35%, transparent)`, marginLeft: "0.3rem" }}
                          >
                            <span className="text-sm text-[var(--fg)]">
                              {it.phrase}
                            </span>
                            <span className="text-xs italic text-[var(--fg-dim)]">
                              {it.translation}
                            </span>
                            {it.notes && (
                              <span className="mt-1 text-xs text-[var(--fg-muted)]">
                                {it.notes}
                              </span>
                            )}
                          </div>
                        </details>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
