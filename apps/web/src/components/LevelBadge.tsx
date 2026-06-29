import type { CEFRLevel } from "@/types";
import { LEVEL_COLOR } from "@/lib/ui";

export function LevelBadge({ level }: { level: CEFRLevel }) {
  const color = LEVEL_COLOR[level];
  return (
    <span
      className="inline-flex items-center rounded px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wide"
      style={{
        color,
        backgroundColor: `color-mix(in srgb, ${color} 16%, transparent)`,
        border: `1px solid color-mix(in srgb, ${color} 35%, transparent)`,
      }}
    >
      {level}
    </span>
  );
}
