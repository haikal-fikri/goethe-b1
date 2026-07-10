import "server-only";
import { sql } from "@/lib/db";
import type { AufgabeNr, ExamTask } from "@repo/types";

// Korpus-Loader — 1:1-Port aus apps/web/src/lib/exam.ts (getExamTask). Die
// aufgelöste Aufgabe ist die AUTORITATIVE Bewertungsquelle (Prompt/Leitpunkte/
// aufgabe/Musterlösung); der Client liefert nie eine Aufgabe. teacher-lms/04 §2.1.

interface TaskRow {
  id: string;
  simulation_id: number;
  aufgabe: number;
  task_type: string;
  title_de: string;
  prompt_de: string;
  bullet_points_de: string[];
  min_words: number;
  recommended_minutes: number | null;
  sample_answer_de: string | null;
}

function toTask(r: TaskRow): ExamTask {
  return {
    id: r.id,
    simulation: r.simulation_id,
    aufgabe: r.aufgabe as AufgabeNr,
    taskType: r.task_type,
    titleDe: r.title_de,
    promptDe: r.prompt_de,
    bulletPointsDe: r.bullet_points_de.length ? r.bullet_points_de : undefined,
    minWords: r.min_words,
    recommendedMinutes: r.recommended_minutes ?? undefined,
    sampleAnswerDe: r.sample_answer_de ?? undefined,
  };
}

/** Einzelne Aufgabe per stabiler ID (für die Bewertung im Route-Handler). */
export async function getExamTask(taskId: string): Promise<ExamTask | undefined> {
  const rows = await sql<TaskRow[]>`
    select id, simulation_id, aufgabe, task_type, title_de, prompt_de,
           bullet_points_de, min_words, recommended_minutes, sample_answer_de
    from exam_tasks
    where id = ${taskId}
    limit 1
  `;
  return rows[0] ? toTask(rows[0]) : undefined;
}
