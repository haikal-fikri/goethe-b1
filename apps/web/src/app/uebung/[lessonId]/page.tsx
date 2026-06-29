import Link from "next/link";
import { LessonPlayer } from "@/components/uebung/LessonPlayer";
import { getLessonItems, getLessonMeta } from "@repo/core";
import { getAllItems } from "@/lib/redemittel";
import type { CEFRLevel } from "@/types";
import { LEVELS } from "@/types";

export const dynamic = "force-dynamic";

export default async function LessonPage({
  params,
  searchParams,
}: {
  params: Promise<{ lessonId: string }>;
  searchParams: Promise<{ min?: string }>;
}) {
  const { lessonId } = await params;
  const { min } = await searchParams;

  const minLevel: CEFRLevel = LEVELS.includes(min as CEFRLevel)
    ? (min as CEFRLevel)
    : "B1";

  const allItems = await getAllItems();
  const meta = getLessonMeta(allItems, lessonId);
  const items = getLessonItems(allItems, lessonId, minLevel);

  if (!meta || items.length === 0) {
    return (
      <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-[var(--fg-muted)]">
          Für diese Auswahl gibt es noch keine Wendungen.
        </p>
        <Link
          href="/"
          className="rounded-[var(--radius)] border border-[var(--border-soft)] px-4 py-2 text-sm text-[var(--fg)] hover:border-[var(--border-base)]"
        >
          Zur Übersicht
        </Link>
      </div>
    );
  }

  return (
    <LessonPlayer
      items={items}
      title={meta.functionName}
      subtitle={meta.taskLabel}
    />
  );
}
