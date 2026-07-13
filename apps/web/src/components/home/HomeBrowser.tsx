"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { SkillGroup } from "@repo/core";
import type { CEFRLevel, SkillCode } from "@/types";
import { LEVEL_RANK } from "@/types";
import { LevelBadge } from "@/components/LevelBadge";
import { SKILL_ACCENT, SKILL_LABEL, SKILL_TONE } from "@/lib/ui";
import { Chip } from "@/components/ui/controls";
import { Card, Eyebrow, Num, SkillTile } from "@/components/ui/primitives";
import { IconArrowRight, IconPencil, IconMic, IconSparkles } from "@/components/icons";

const MIN_FILTERS: { label: string; min: CEFRLevel }[] = [
  { label: "Alle", min: "B1" },
  { label: "ab B2", min: "B2" },
  { label: "ab C1", min: "C1" },
];

const SKILL_ICON: Record<SkillCode, typeof IconPencil> = {
  schreiben: IconPencil,
  sprechen: IconMic,
  shared: IconSparkles,
};

export function HomeBrowser({ groups }: { groups: SkillGroup[] }) {
  const skills = groups.map((g) => g.skill);
  const [activeSkill, setActiveSkill] = useState<SkillCode>(
    skills[0] ?? "schreiben"
  );
  const [minLevel, setMinLevel] = useState<CEFRLevel>("B1");

  const active = groups.find((g) => g.skill === activeSkill);
  const accent = SKILL_ACCENT[activeSkill];

  return (
    <div>
      {/* Skill-Tabs */}
      <div
        role="tablist"
        aria-label="Prüfungsteil"
        className="flex gap-2 overflow-x-auto pb-1"
      >
        {groups.map((g) => (
          <Chip
            key={g.skill}
            role="tab"
            aria-selected={g.skill === activeSkill}
            active={g.skill === activeSkill}
            onClick={() => setActiveSkill(g.skill)}
          >
            {SKILL_LABEL[g.skill]}
          </Chip>
        ))}
      </div>

      {/* Niveau-Filter */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="text-xs text-faint">Niveau:</span>
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
      </div>

      {active && (
        <div key={active.skill} className="animate-fade-in">
          {active.tasks.map((task) => (
            <TaskSection
              key={task.taskCode}
              taskLabel={task.taskLabel}
              functions={task.functions}
              minLevel={minLevel}
              skill={active.skill}
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
  skill,
  accent,
}: {
  taskLabel: string;
  functions: SkillGroup["tasks"][number]["functions"];
  minLevel: CEFRLevel;
  skill: SkillCode;
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

  const Icon = SKILL_ICON[skill];

  return (
    <section className="mt-7">
      <Eyebrow style={{ marginBottom: 12 }}>{taskLabel}</Eyebrow>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {visible.map((f) => (
          <Link
            key={f.lessonId}
            href={`/uebung/${f.lessonId}?min=${minLevel}`}
            className="group hover-card"
            style={{ textDecoration: "none" }}
          >
            <Card
              radius={18}
              style={{ padding: "16px 18px", height: "100%" }}
              className="flex flex-col gap-3"
            >
              <div className="flex items-start gap-3">
                <SkillTile tone={SKILL_TONE[skill]} size={34} radius={10}>
                  <Icon size={17} />
                </SkillTile>
                <span
                  className="min-w-0 flex-1"
                  style={{ fontSize: 14.5, fontWeight: 600, color: "var(--text-hi)" }}
                >
                  {f.functionName}
                </span>
                <span
                  className="mt-1 shrink-0 transition-transform group-hover:translate-x-0.5"
                  style={{ color: accent }}
                  aria-hidden
                >
                  <IconArrowRight size={16} />
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                {f.visibleLevels.map((l) => (
                  <LevelBadge key={l} level={l} />
                ))}
                <span className="ml-auto text-xs text-muted">
                  <Num>{f.visibleCount}</Num> Wendungen
                </span>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  );
}
