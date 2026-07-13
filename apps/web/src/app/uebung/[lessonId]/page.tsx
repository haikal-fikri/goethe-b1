import Link from "next/link";
import { LessonPlayer } from "@/components/uebung/LessonPlayer";
import { getLessonItems, getLessonMeta } from "@repo/core";
import { getAllItems } from "@/lib/redemittel";
import type { CEFRLevel } from "@/types";
import { LEVELS } from "@/types";
import { Card } from "@/components/ui/primitives";
import { buttonClass, buttonStyle } from "@/components/ui/controls";
import { IconArrowRight } from "@/components/icons";

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
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col items-center justify-center px-6">
        <Card radius={24} style={{ padding: "40px 32px", textAlign: "center" }}>
          <p className="text-sm text-muted">
            Für diese Auswahl gibt es noch keine Wendungen.
          </p>
          <Link
            href="/"
            className={buttonClass("outline")}
            style={{ ...buttonStyle("outline"), marginTop: 20 }}
          >
            Zur Übersicht
            <IconArrowRight size={16} />
          </Link>
        </Card>
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
