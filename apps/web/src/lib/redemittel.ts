import "server-only";
import { sql } from "@/lib/db";
import type { RedemittelItem } from "@/types";

/**
 * Alle Redemittel zur Laufzeit aus Postgres lesen (View `redemittel_item`,
 * Migration 0001). Die View liefert bereits das App-Item-Format:
 * phrase/frame/translation/skill/registerGroup/clozeTemplate sowie task &
 * function als jsonb-Objekte und tokens/distractors/tags als text[].
 */
export async function getAllItems(): Promise<RedemittelItem[]> {
  const rows = await sql<RedemittelItem[]>`
    select * from redemittel_item
    order by skill, task->>'code', difficulty, id
  `;
  return rows.map((r) => ({
    ...r,
    difficulty: Number(r.difficulty),
    examples: Array.isArray(r.examples) ? r.examples : [],
  }));
}
