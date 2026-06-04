"use client";

import { useMemo, useState } from "react";
import type { CEFRLevel, RedemittelItem, SkillCode } from "@/types";
import { LEVEL_RANK } from "@/types";
import { functionRank } from "@/lib/content";
import { LevelBadge } from "@/components/LevelBadge";
import { SKILL_ACCENT, SKILL_LABEL } from "@/lib/ui";

const MIN_FILTERS: { label: string; min: CEFRLevel }[] = [
  { label: "Alle", min: "B1" },
  { label: "ab B2", min: "B2" },
  { label: "ab C1", min: "C1" },
];

interface Group {
  taskCode: string;
  taskLabel: string;
  functions: { code: string; name: string; items: RedemittelItem[] }[];
}

/** Kurzes Tab-Label, z.B. "Aufgabe 1 — Informelle E-Mail" → "Aufgabe 1". */
function shortTaskLabel(labelDe: string): string {
  return labelDe.split("—")[0].trim() || labelDe;
}

/** Erster Aufgaben-Code einer Fertigkeit (kanonisch sortiert). */
function firstTaskCode(items: RedemittelItem[], skill: SkillCode): string {
  const codes = [
    ...new Set(items.filter((i) => i.skill === skill).map((i) => i.task.code)),
  ].sort((a, b) => a.localeCompare(b));
  return codes[0] ?? "";
}

/**
 * Fasst Wendungen mit gleicher eingeklappter Beschriftung (frame, sonst phrase)
 * zu einem Eintrag zusammen — so erscheint z.B. das Konnektor-Muster „Da …, …"
 * nur einmal, mit allen Beispielsätzen darunter (keine Dubletten).
 */
function groupByLabel(
  items: RedemittelItem[]
): { label: string; items: RedemittelItem[] }[] {
  const map = new Map<string, RedemittelItem[]>();
  for (const it of items) {
    const label = it.frame ?? it.phrase;
    if (!map.has(label)) map.set(label, []);
    map.get(label)!.push(it);
  }
  return [...map.entries()].map(([label, group]) => ({ label, items: group }));
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
  const [activeTask, setActiveTask] = useState<string>(() =>
    firstTaskCode(items, skills[0] ?? "schreiben")
  );
  const [query, setQuery] = useState("");
  const accent = SKILL_ACCENT[activeSkill];

  function pickSkill(s: SkillCode) {
    setActiveSkill(s);
    setActiveTask(firstTaskCode(items, s)); // Aufgaben unterscheiden sich je Fertigkeit
  }

  // Aufgaben (Prüfungsteile) der aktiven Fertigkeit, in kanonischer Reihenfolge.
  const taskTabs = useMemo(() => {
    const map = new Map<string, string>();
    for (const it of items) {
      if (it.skill === activeSkill && !map.has(it.task.code)) {
        map.set(it.task.code, it.task.labelDe);
      }
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([code, label]) => ({ code, label }));
  }, [items, activeSkill]);

  const groups = useMemo<Group[]>(() => {
    const min = LEVEL_RANK[minLevel];
    const q = query.trim().toLowerCase();
    const filtered = items.filter(
      (i) =>
        i.skill === activeSkill &&
        LEVEL_RANK[i.level] >= min &&
        i.task.code === activeTask &&
        (q === "" ||
          i.phrase.toLowerCase().includes(q) ||
          i.frame?.toLowerCase().includes(q) ||
          i.translation.toLowerCase().includes(q))
    );

    const taskMap = new Map<
      string,
      { label: string; fns: Map<string, { name: string; items: RedemittelItem[] }> }
    >();
    for (const it of filtered) {
      if (!taskMap.has(it.task.code))
        taskMap.set(it.task.code, { label: it.task.labelDe, fns: new Map() });
      const fns = taskMap.get(it.task.code)!.fns;
      if (!fns.has(it.function.code))
        fns.set(it.function.code, { name: it.function.nameDe, items: [] });
      fns.get(it.function.code)!.items.push(it);
    }

    // Aufgaben nach Code (Aufgabe 1 → 2 → 3), Funktionen in kanonischer
    // Reihenfolge wie in einem echten Text (Einleitung → … → Schluss).
    return [...taskMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([taskCode, { label, fns }]) => ({
        taskCode,
        taskLabel: label,
        functions: [...fns.entries()]
          .sort(
            ([ca], [cb]) =>
              functionRank(taskCode, ca) - functionRank(taskCode, cb) ||
              ca.localeCompare(cb)
          )
          .map(([code, v]) => ({
            code,
            name: v.name,
            // Wendungen aufsteigend nach Niveau (B1 → C2)
            items: [...v.items].sort(
              (a, b) => LEVEL_RANK[a.level] - LEVEL_RANK[b.level]
            ),
          })),
      }));
  }, [items, activeSkill, minLevel, activeTask, query]);

  return (
    <div className="mx-auto max-w-3xl px-4 pb-20 pt-6">
      <div role="tablist" className="flex gap-2 overflow-x-auto pb-1">
        {skills.map((s) => {
          const isActive = s === activeSkill;
          return (
            <button
              key={s}
              role="tab"
              aria-selected={isActive}
              onClick={() => pickSkill(s)}
              className="shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors"
              style={{
                borderColor: isActive ? "var(--fg)" : "var(--border-soft)",
                color: isActive ? "var(--bg)" : "var(--fg-muted)",
                backgroundColor: isActive ? "var(--fg)" : "transparent",
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
                borderColor: isActive ? "var(--fg)" : "var(--border-soft)",
                color: isActive ? "var(--bg)" : "var(--fg-muted)",
                backgroundColor: isActive ? "var(--fg)" : "transparent",
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
          className="ml-auto min-w-[140px] flex-1 rounded-full border border-[var(--border-soft)] bg-[var(--bg-elev)] px-3 py-1.5 text-sm text-[var(--fg)] outline-none focus:border-[var(--border)] sm:flex-none"
        />
      </div>

      {/* Aufgabe / Prüfungsteil — nur wenn die Fertigkeit mehrere Teile hat
          (also nicht bei Konnektoren mit nur einem Teil). */}
      {taskTabs.length > 1 && (
      <div role="tablist" className="mt-3 flex gap-2 overflow-x-auto pb-1">
        {taskTabs.map((t) => {
          const isActive = t.code === activeTask;
          const label = shortTaskLabel(t.label);
          return (
            <button
              key={t.code}
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveTask(t.code)}
              className="shrink-0 rounded-full border px-3 py-1.5 text-xs transition-colors"
              style={{
                borderColor: isActive ? "var(--fg)" : "var(--border-soft)",
                color: isActive ? "var(--bg)" : "var(--fg-muted)",
                backgroundColor: isActive ? "var(--fg)" : "transparent",
              }}
            >
              {label}
            </button>
          );
        })}
      </div>
      )}

      {groups.length === 0 && (
        <p className="mt-10 text-center text-sm text-[var(--fg-dim)]">
          Keine Treffer.
        </p>
      )}

      <div key={`${activeSkill}-${activeTask}`} className="animate-fade-in">
        {groups.map((g) => (
          <section key={g.taskCode} className="mt-7">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--fg-dim)]">
              {g.taskLabel}
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {g.functions.map((fn) => (
                <div
                  key={fn.code}
                  className="rounded-[var(--radius)] border border-[var(--outline)] bg-[var(--bg)] p-4"
                >
                  <h3 className="mb-2 font-serif text-base font-medium text-[var(--fg)]">
                    {fn.name}
                  </h3>
                  <ul className="flex flex-col gap-1">
                    {groupByLabel(fn.items).map((entry) => (
                      <li key={entry.label}>
                        <details className="group/item">
                          <summary className="flex cursor-pointer list-none items-start gap-2 rounded-[calc(var(--radius)-4px)] py-1 outline-none focus-visible:ring-2 focus-visible:ring-[var(--border)]">
                            <span
                              className="mt-0.5 shrink-0 text-[var(--fg-dim)] transition-transform group-open/item:rotate-90"
                              style={{ color: accent }}
                              aria-hidden
                            >
                              ›
                            </span>
                            <span className="flex-1 text-[var(--fg)]">
                              {entry.label}
                            </span>
                            <LevelBadge level={entry.items[0].level} />
                          </summary>
                          <div className="mt-1 flex flex-col gap-2 border-l-2 pl-3 pt-0.5"
                            style={{ borderColor: `color-mix(in srgb, ${accent} 35%, transparent)`, marginLeft: "0.3rem" }}
                          >
                            {entry.items.map((it) => (
                              <div key={it.id} className="flex flex-col gap-0.5">
                                <span className="text-sm text-[var(--fg)]">
                                  {it.phrase}
                                </span>
                                <span className="text-xs italic text-[var(--fg-dim)]">
                                  {it.translation}
                                </span>
                                {it.notes && (
                                  <span className="text-xs text-[var(--fg-muted)]">
                                    {it.notes}
                                  </span>
                                )}
                              </div>
                            ))}
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
