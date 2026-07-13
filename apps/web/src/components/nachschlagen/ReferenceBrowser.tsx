"use client";

import { useMemo, useState } from "react";
import type { CEFRLevel, RedemittelItem, SkillCode } from "@/types";
import { LEVEL_RANK } from "@/types";
import { functionRank } from "@repo/core";
import { LevelBadge } from "@/components/LevelBadge";
import { SKILL_ACCENT, SKILL_LABEL } from "@/lib/ui";
import { Chip, TextInput } from "@/components/ui/controls";
import { Card, Eyebrow } from "@/components/ui/primitives";
import { IconChevronRight, IconSearch } from "@/components/icons";

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
 * Normalisierter Konnektor-Schlüssel: kleingeschrieben, ohne „…" und ohne
 * Satzzeichen — so fallen Varianten desselben Konnektors zusammen
 * (z.B. „…, gleichwohl …" und „…; gleichwohl …").
 */
function connectorKey(it: RedemittelItem): string {
  return (it.frame ?? it.phrase)
    .toLowerCase()
    .replace(/…/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Fasst Wendungen desselben Konnektors zusammen und behält nur das
 * NIEDRIGSTE vorhandene Niveau (z.B. „gleichwohl" als C1, nicht zusätzlich
 * als C2). So gibt es keine Dubletten über mehrere Niveaus hinweg.
 * Mehrere Beispielsätze auf demselben Niveau erscheinen unter einem Eintrag.
 */
function groupByLabel(
  items: RedemittelItem[]
): { label: string; items: RedemittelItem[] }[] {
  const map = new Map<string, RedemittelItem[]>();
  for (const it of items) {
    const k = connectorKey(it);
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(it);
  }
  return [...map.values()].map((group) => {
    const minRank = Math.min(...group.map((g) => LEVEL_RANK[g.level]));
    const kept = group.filter((g) => LEVEL_RANK[g.level] === minRank);
    return { label: kept[0].frame ?? kept[0].phrase, items: kept };
  });
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
    <div>
      <div role="tablist" className="flex gap-2 overflow-x-auto pb-1">
        {skills.map((s) => (
          <Chip
            key={s}
            role="tab"
            aria-selected={s === activeSkill}
            active={s === activeSkill}
            onClick={() => pickSkill(s)}
          >
            {SKILL_LABEL[s]}
          </Chip>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {MIN_FILTERS.map((f) => (
          <Chip
            key={f.min}
            size="sm"
            active={f.min === minLevel}
            onClick={() => setMinLevel(f.min)}
          >
            {f.label}
          </Chip>
        ))}
        <div className="relative ml-auto flex min-w-[160px] flex-1 items-center sm:max-w-[260px] sm:flex-none">
          <IconSearch
            size={16}
            style={{ position: "absolute", left: 12, color: "var(--text-3)" }}
          />
          <TextInput
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Suchen …"
            style={{ height: 38, paddingLeft: 34, fontSize: 13.5 }}
          />
        </div>
      </div>

      {/* Aufgabe / Prüfungsteil — nur wenn die Fertigkeit mehrere Teile hat
          (also nicht bei Konnektoren mit nur einem Teil). */}
      {taskTabs.length > 1 && (
        <div role="tablist" className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {taskTabs.map((t) => (
            <Chip
              key={t.code}
              size="sm"
              role="tab"
              aria-selected={t.code === activeTask}
              active={t.code === activeTask}
              onClick={() => setActiveTask(t.code)}
            >
              {shortTaskLabel(t.label)}
            </Chip>
          ))}
        </div>
      )}

      {groups.length === 0 && (
        <p className="mt-10 text-center text-sm text-faint">Keine Treffer.</p>
      )}

      <div key={`${activeSkill}-${activeTask}`} className="animate-fade-in">
        {groups.map((g) => (
          <section key={g.taskCode} className="mt-7">
            <Eyebrow style={{ marginBottom: 12 }}>{g.taskLabel}</Eyebrow>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {g.functions.map((fn) => (
                <Card key={fn.code} radius={18} style={{ padding: "16px 18px" }}>
                  <h3
                    className="mb-2 font-serif"
                    style={{
                      margin: "0 0 10px",
                      fontSize: 17,
                      fontWeight: 600,
                      color: "var(--text-hi)",
                    }}
                  >
                    {fn.name}
                  </h3>
                  <ul className="flex flex-col gap-1">
                    {groupByLabel(fn.items).map((entry) => (
                      <li key={entry.label}>
                        <details className="group/item">
                          <summary className="flex cursor-pointer list-none items-start gap-2 rounded-tile py-1 outline-none focus-visible:ring-2 focus-visible:ring-line-strong">
                            <span
                              className="mt-0.5 shrink-0 transition-transform group-open/item:rotate-90"
                              style={{ color: accent }}
                              aria-hidden
                            >
                              <IconChevronRight size={15} />
                            </span>
                            <span className="flex-1 text-sm text-body">
                              {entry.label}
                            </span>
                            <LevelBadge level={entry.items[0].level} />
                          </summary>
                          <div
                            className="mt-1 flex flex-col gap-2 border-l-2 pl-3 pt-0.5"
                            style={{
                              borderColor: `color-mix(in oklab, ${accent} 35%, transparent)`,
                              marginLeft: "0.3rem",
                            }}
                          >
                            {entry.items.map((it) => (
                              <div key={it.id} className="flex flex-col gap-0.5">
                                <span className="text-sm text-ink">{it.phrase}</span>
                                <span className="text-xs italic text-faint">
                                  {it.translation}
                                </span>
                                {it.notes && (
                                  <span className="text-xs text-muted">{it.notes}</span>
                                )}
                                {(it.examples ?? []).slice(0, 2).map((ex, i) => (
                                  <span key={i} className="text-xs text-muted">
                                    <span className="text-ink">{ex.de}</span>
                                    {ex.en && (
                                      <span className="text-faint"> — {ex.en}</span>
                                    )}
                                  </span>
                                ))}
                              </div>
                            ))}
                          </div>
                        </details>
                      </li>
                    ))}
                  </ul>
                </Card>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
