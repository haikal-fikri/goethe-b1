"use client";

import { useCallback, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  useDraggable,
  useDroppable,
  type DragEndEvent,
} from "@dnd-kit/core";
import type { RedemittelItem } from "@/types";
import type { Tile } from "@/lib/exercise";
import { buildClozePills, clozeBlanks, parseCloze } from "@/lib/cloze";
import { LevelBadge } from "@/components/LevelBadge";
import { SKILL_ACCENT } from "@/lib/ui";
import { FeedbackBar } from "./FeedbackBar";
import { Pill } from "./dnd/Pill";
import { useExerciseSensors } from "./dnd/sensors";

type Phase = "input" | "correct" | "wrong";

/**
 * Lückentext-Übung: der/die Lernende zieht (oder tippt) Pillen in die Lücken
 * des deutschen Satzes; der englische Satz dient als Bedeutungs-Hinweis.
 */
export function ClozeExercise({
  item,
  onContinue,
}: {
  item: RedemittelItem;
  onContinue: (correct: boolean) => void;
}) {
  const accent = SKILL_ACCENT[item.skill];
  const sensors = useExerciseSensors();

  const parts = useMemo(
    () => parseCloze(item.clozeTemplate ?? item.phrase),
    [item]
  );
  const answers = useMemo(() => clozeBlanks(item.clozeTemplate ?? ""), [item]);
  const pills = useMemo(() => buildClozePills(item), [item]);

  // assignment[blankIndex] = pillId | null  → einzige Quelle der Wahrheit
  const [assignment, setAssignment] = useState<(string | null)[]>(() =>
    Array(answers.length).fill(null)
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("input");

  const pillById = useCallback(
    (id: string | null) => (id ? pills.find((p) => p.id === id) : undefined),
    [pills]
  );
  const assignedIds = new Set(assignment.filter((a): a is string => !!a));
  const trayPills = pills.filter((p) => !assignedIds.has(p.id));
  const filled = assignment.every((a) => a !== null);
  const locked = phase !== "input";

  const place = useCallback((pillId: string, blankIndex: number) => {
    setAssignment((prev) => {
      const next = [...prev];
      const from = next.findIndex((a) => a === pillId);
      if (from !== -1) next[from] = null;
      next[blankIndex] = pillId; // evtl. Vorbesetzung fällt automatisch in die Ablage
      return next;
    });
  }, []);

  const returnToTray = useCallback((pillId: string) => {
    setAssignment((prev) => prev.map((a) => (a === pillId ? null : a)));
  }, []);

  const onDragEnd = useCallback(
    (e: DragEndEvent) => {
      setActiveId(null);
      const { active, over } = e;
      if (!over) return;
      const pillId = String(active.id);
      const overId = String(over.id);
      if (overId === "tray") returnToTray(pillId);
      else if (overId.startsWith("blank-")) place(pillId, Number(overId.slice(6)));
    },
    [place, returnToTray]
  );

  // Tippen: Ablage-Pille → erste freie Lücke; gefüllte Lücke → zurück in die Ablage
  const tapTray = useCallback(
    (pillId: string) => {
      if (locked) return;
      const firstEmpty = assignment.findIndex((a) => a === null);
      if (firstEmpty !== -1) place(pillId, firstEmpty);
    },
    [assignment, locked, place]
  );

  const check = useCallback(() => {
    if (locked || !filled) return;
    const correct = assignment.every(
      (a, i) => pillById(a)?.label === answers[i]
    );
    setPhase(correct ? "correct" : "wrong");
  }, [answers, assignment, filled, locked, pillById]);

  return (
    <div className="flex h-full flex-col">
      <DndContext
        sensors={sensors}
        onDragStart={(e) => setActiveId(String(e.active.id))}
        onDragCancel={() => setActiveId(null)}
        onDragEnd={onDragEnd}
      >
        {/* Hinweis (englische Bedeutung) */}
        <div className="animate-fade-in px-1">
          <div className="mb-1 flex items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-[var(--fg-dim)]">
              Ergänze die Lücken
            </span>
            <LevelBadge level={item.level} />
            <span className="text-xs text-[var(--fg-dim)]">· {item.function.nameDe}</span>
          </div>
          <p className="text-base italic text-[var(--fg-muted)]">
            {item.translation}
          </p>
        </div>

        {/* Deutscher Satz mit Lücken (natürlicher Textfluss) */}
        <div
          aria-label="Satz mit Lücken"
          className="mt-6 text-lg leading-[2.4] text-[var(--fg)]"
        >
          {parts.map((part, i) =>
            part.kind === "text" ? (
              <span key={i}>{part.value}</span>
            ) : (
              <BlankSlot
                key={i}
                index={part.index}
                accent={accent}
                disabled={locked}
              >
                {assignment[part.index] && (
                  <DraggablePill
                    tile={pillById(assignment[part.index])!}
                    disabled={locked}
                    onTap={() =>
                      !locked && returnToTray(assignment[part.index]!)
                    }
                  />
                )}
              </BlankSlot>
            )
          )}
        </div>

        {/* Ablage */}
        <Tray disabled={locked}>
          {trayPills.map((t) => (
            <DraggablePill
              key={t.id}
              tile={t}
              disabled={locked}
              onTap={() => tapTray(t.id)}
            />
          ))}
          {trayPills.length === 0 && phase === "input" && (
            <span className="px-1 text-sm text-[var(--fg-dim)]">
              Alle Pillen gesetzt — prüfe deine Lösung.
            </span>
          )}
        </Tray>

        <DragOverlay>
          {activeId ? (
            <Pill label={pillById(activeId)?.label ?? ""} className="cursor-grabbing shadow-lg" />
          ) : null}
        </DragOverlay>
      </DndContext>

      <div className="flex-1" />

      <FeedbackBar
        phase={phase}
        item={item}
        accent={accent}
        canCheck={filled}
        onCheck={check}
        onContinue={() => onContinue(phase === "correct")}
      />
    </div>
  );
}

function DraggablePill({
  tile,
  disabled,
  onTap,
}: {
  tile: Tile;
  disabled?: boolean;
  onTap: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: tile.id,
    disabled,
  });
  return (
    <Pill
      ref={setNodeRef}
      label={tile.label}
      draggable={!disabled}
      dragging={isDragging}
      disabled={disabled}
      onClick={onTap}
      {...attributes}
      {...listeners}
    />
  );
}

function BlankSlot({
  index,
  accent,
  disabled,
  children,
}: {
  index: number;
  accent: string;
  disabled?: boolean;
  children?: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `blank-${index}`, disabled });
  const empty = !children;
  return (
    <span
      ref={setNodeRef}
      className="mx-1 inline-flex min-h-[44px] min-w-[3.5rem] items-center justify-center rounded-[var(--radius)] align-middle"
      style={{
        border: empty ? "1.5px dashed" : "1.5px solid transparent",
        borderColor: isOver
          ? accent
          : empty
            ? "var(--border-base)"
            : "transparent",
        backgroundColor: isOver
          ? `color-mix(in srgb, ${accent} 12%, transparent)`
          : "transparent",
      }}
    >
      {children}
    </span>
  );
}

function Tray({
  disabled,
  children,
}: {
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: "tray", disabled });
  return (
    <div
      ref={setNodeRef}
      className="mt-6 flex min-h-[60px] flex-wrap content-start gap-2 rounded-[var(--radius)] border border-dashed p-2"
      style={{
        borderColor: isOver ? "var(--border-base)" : "var(--border-soft)",
        backgroundColor: isOver
          ? "color-mix(in srgb, var(--bg-elev) 60%, transparent)"
          : "color-mix(in srgb, var(--bg-elev) 30%, transparent)",
      }}
    >
      {children}
    </div>
  );
}
