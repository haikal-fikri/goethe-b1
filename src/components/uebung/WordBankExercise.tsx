"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { RedemittelItem } from "@/types";
import { arraysEqual, buildTiles, type Tile } from "@/lib/exercise";
import { LevelBadge } from "@/components/LevelBadge";
import { SKILL_ACCENT } from "@/lib/ui";
import { FeedbackBar } from "./FeedbackBar";
import { Pill } from "./dnd/Pill";
import { useExerciseSensors } from "./dnd/sensors";

type Phase = "input" | "correct" | "wrong";

export function WordBankExercise({
  item,
  onContinue,
}: {
  item: RedemittelItem;
  onContinue: (correct: boolean) => void;
}) {
  const tiles = useMemo(() => buildTiles(item), [item]);
  const [selected, setSelected] = useState<Tile[]>([]);
  const [phase, setPhase] = useState<Phase>("input");
  const accent = SKILL_ACCENT[item.skill];
  const sensors = useExerciseSensors({ keyboard: false });

  const selectedIds = new Set(selected.map((t) => t.id));
  const bank = tiles.filter((t) => !selectedIds.has(t.id));
  const locked = phase !== "input";

  const pickTile = useCallback(
    (tile: Tile) => {
      if (locked) return;
      setSelected((s) => (s.some((t) => t.id === tile.id) ? s : [...s, tile]));
    },
    [locked]
  );

  const removeTile = useCallback(
    (tile: Tile) => {
      if (locked) return;
      setSelected((s) => s.filter((t) => t.id !== tile.id));
    },
    [locked]
  );

  // Ziehen ordnet die gesetzten Kacheln um (Maus/Finger).
  const onDragEnd = useCallback((e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setSelected((items) => {
      const oldI = items.findIndex((t) => t.id === active.id);
      const newI = items.findIndex((t) => t.id === over.id);
      if (oldI < 0 || newI < 0) return items;
      return arrayMove(items, oldI, newI);
    });
  }, []);

  const check = useCallback(() => {
    if (locked || selected.length === 0) return;
    const correct = arraysEqual(
      selected.map((t) => t.label),
      item.tokens
    );
    setPhase(correct ? "correct" : "wrong");
  }, [locked, selected, item.tokens]);

  const cont = useCallback(() => {
    onContinue(phase === "correct");
  }, [onContinue, phase]);

  // Tastatursteuerung: Ziffern wählen Bank-Kacheln, Enter prüft/weiter, Backspace entfernt
  const bankRef = useRef(bank);
  bankRef.current = bank;
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Enter") {
        e.preventDefault();
        if (phase === "input") check();
        else cont();
        return;
      }
      if (phase !== "input") return;
      if (e.key === "Backspace") {
        e.preventDefault();
        setSelected((s) => s.slice(0, -1));
        return;
      }
      const n = parseInt(e.key, 10);
      if (!Number.isNaN(n) && n >= 1 && n <= 9) {
        const tile = bankRef.current[n - 1];
        if (tile) {
          e.preventDefault();
          pickTile(tile);
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, check, cont, pickTile]);

  return (
    <div className="flex h-full flex-col">
      {/* Prompt */}
      <div className="animate-fade-in px-1">
        <div className="mb-1 flex items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-[var(--fg-dim)]">
            Übersetze
          </span>
          <LevelBadge level={item.level} />
          <span className="text-xs text-[var(--fg-dim)]">· {item.function.nameDe}</span>
        </div>
        <p className="text-xl font-medium leading-snug text-[var(--fg)]">
          {item.translation}
        </p>
      </div>

      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        {/* Antwort-Slots (ziehbar umsortierbar) */}
        <div
          aria-live="polite"
          aria-label="Dein Satz"
          className="mt-6 flex min-h-[64px] flex-wrap content-start gap-2 rounded-[var(--radius)] border border-dashed border-[var(--border-base)] bg-[color-mix(in_srgb,var(--bg-elev)_50%,transparent)] p-3"
        >
          {selected.length === 0 && (
            <span className="self-center text-sm text-[var(--fg-dim)]">
              Tippe die Wörter in der richtigen Reihenfolge an …
            </span>
          )}
          <SortableContext
            items={selected.map((t) => t.id)}
            strategy={rectSortingStrategy}
          >
            {selected.map((tile) => (
              <SortablePill
                key={tile.id}
                tile={tile}
                disabled={locked}
                onTap={() => removeTile(tile)}
              />
            ))}
          </SortableContext>
        </div>
      </DndContext>

      {/* Wortbank (Tippen zum Hinzufügen) */}
      <div className="mt-4 flex flex-wrap gap-2">
        {bank.map((tile, i) => (
          <Pill
            key={tile.id}
            label={tile.label}
            variant="bank"
            index={i < 9 ? i + 1 : undefined}
            disabled={locked}
            onClick={() => pickTile(tile)}
            aria-label={i < 9 ? `${tile.label} (Taste ${i + 1})` : tile.label}
          />
        ))}
        {bank.length === 0 && phase === "input" && (
          <span className="text-sm text-[var(--fg-dim)]">
            Alle Wörter gesetzt — prüfe deine Lösung.
          </span>
        )}
      </div>

      <div className="flex-1" />

      <FeedbackBar
        phase={phase}
        item={item}
        accent={accent}
        canCheck={selected.length > 0}
        onCheck={check}
        onContinue={cont}
      />
    </div>
  );
}

function SortablePill({
  tile,
  disabled,
  onTap,
}: {
  tile: Tile;
  disabled?: boolean;
  onTap: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: tile.id, disabled });
  return (
    <Pill
      ref={setNodeRef}
      label={tile.label}
      draggable={!disabled}
      dragging={isDragging}
      disabled={disabled}
      onClick={onTap}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 10 : undefined,
      }}
      {...attributes}
      {...listeners}
    />
  );
}
