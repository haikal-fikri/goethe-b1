import "server-only";
import type { ExamTask } from "@repo/types";
import { getExamTask } from "@/lib/exam";

// Löst die Grader-ExamTask aus der GESPEICHERTEN assignment-Zeile auf (teacher-lms
// /04 §2.1) — Korpus (task_id → getExamTask, autoritativ inkl. echter aufgabe
// 1|2|3) ODER Custom-Synthese (Aufgabe-2-Semantik). Nie eine Client-Aufgabe.
// Die echte `aufgabe` treibt allein scaleFor/criterionPoints/pointsFromBands.
export interface WritingAssignmentRow {
  id: string;
  task_id: string | null;
  prompt_de: string | null;
  bullet_points_de: string[];
  min_words: number | null;
}

export async function resolveWritingTask(
  a: WritingAssignmentRow
): Promise<ExamTask | null> {
  if (a.task_id) {
    // KORPUS: autoritative Aufgabe (echter Prompt/Leitpunkte/aufgabe/Musterlösung).
    return (await getExamTask(a.task_id)) ?? null;
  }
  if (a.prompt_de == null) return null; // weder Korpus noch Custom → ungültige Zeile
  // CUSTOM: synthetisierte Aufgabe (Aufgabe-2 ⇒ 4 Kriterien, SCALE_10, max 40).
  return {
    id: `assign:${a.id}`, // namensraum-getrennt, kollidiert nie mit einer Korpus-ID
    simulation: 0, // synthetisch (keine echte Simulation)
    aufgabe: 2,
    taskType: "Freie Aufgabe",
    titleDe: "Aufgabe",
    promptDe: a.prompt_de,
    bulletPointsDe: a.bullet_points_de.length ? a.bullet_points_de : undefined,
    minWords: a.min_words ?? 80,
  };
}
