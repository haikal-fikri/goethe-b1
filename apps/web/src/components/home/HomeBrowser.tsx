"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { SkillGroup } from "@repo/core";
import type { CEFRLevel, SkillCode } from "@/types";
import { LEVEL_RANK, LEVELS } from "@/types";
import { LevelBadge } from "@/components/LevelBadge";
import { SKILL_ACCENT, SKILL_LABEL } from "@/lib/ui";

const MIN_FILTERS: { label: string; min: CEFRLevel }[] = [
  { label: "Alle", min: "B1" },
  { label: "ab B2", min: "B2" },
  { label: "ab C1", min: "C1" },
];

export function HomeBrowser({ groups }: { groups: SkillGroup[] }) {
  const skills = groups.map((g) => g.skill);
  const [activeSkill, setActiveSkill] = useState<SkillCode>(
    skills[0] ?? "schreiben"
  );
  const [minLevel, setMinLevel] = useState<CEFRLevel>("B1");

  const active = groups.find((g) => g.skill === activeSkill);
  const accent = SKILL_ACCENT[activeSkill];

  return (
    <div className="mx-auto max-w-5xl px-4 pb-20 pt-6">
      {/* Skill-Tabs */}
      <div
        role="tablist"
        aria-label="Prüfungsteil"
        className="flex gap-2 overflow-x-auto pb-1"
      >
        {groups.map((g) => {
          const isActive = g.skill === activeSkill;
          return (
            <button
              key={g.skill}
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveSkill(g.skill)}
              className="shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors"
              style={{
                borderColor: isActive ? "var(--fg)" : "var(--border-soft)",
                color: isActive ? "var(--bg)" : "var(--fg-muted)",
                backgroundColor: isActive ? "var(--fg)" : "transparent",
              }}
            >
              {SKILL_LABEL[g.skill]}
            </button>
          );
        })}
      </div>

      {/* Niveau-Filter */}
      <div className="mt-4 flex items-center gap-2">
        <span className="text-xs text-[var(--fg-dim)]">Niveau:</span>
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
      </div>

      {active && (
        <div key={active.skill} className="animate-fade-in">
          {active.tasks.map((task) => (
            <TaskSection
              key={task.taskCode}
              taskLabel={task.taskLabel}
              functions={task.functions}
              minLevel={minLevel}
              accent={accent}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TaskSection({
  taskLabel,
  functions,
  minLevel,
  accent,
}: {
  taskLabel: string;
  functions: SkillGroup["tasks"][number]["functions"];
  minLevel: CEFRLevel;
  accent: string;
}) {
  const min = LEVEL_RANK[minLevel];
  const visible = useMemo(
    () =>
      functions
        .map((f) => {
          const levels = f.levels.filter((l) => LEVEL_RANK[l] >= min);
          const visibleCount = levels.reduce(
            (sum, l) => sum + (f.countByLevel[l] ?? 0),
            0
          );
          return { ...f, visibleLevels: levels, visibleCount };
        })
        .filter((f) => f.visibleLevels.length > 0),
    [functions, min]
  );

  if (visible.length === 0) return null;

  return (
    <section className="mt-7">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--fg-dim)]">
        {taskLabel}
      </h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {visible.map((f) => (
          <Link
            key={f.lessonId}
            href={`/uebung/${f.lessonId}?min=${minLevel}`}
            className="group flex flex-col gap-2 rounded-[var(--radius)] border border-[var(--outline)] bg-[var(--bg)] p-4 transition-colors hover:bg-[var(--bg-elev)]"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="font-medium text-[var(--fg)]">
                {f.functionName}
              </span>
              <span
                className="mt-0.5 shrink-0 text-[18px] leading-none transition-transform group-hover:translate-x-0.5"
                style={{ color: accent }}
                aria-hidden
              >
                ›
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              {f.visibleLevels.map((l) => (
                <LevelBadge key={l} level={l} />
              ))}
              <span className="ml-auto text-xs text-[var(--fg-dim)]">
                {f.visibleCount} Wendungen
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
