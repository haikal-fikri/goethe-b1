import "server-only";
import { sql } from "@/lib/db";
import type { AufgabeNr, ExamSimulation, ExamTask } from "@/types";

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

/** Alle Simulationen mit ihren Aufgaben (Laufzeit-Read aus Postgres). */
export async function getSimulations(): Promise<ExamSimulation[]> {
  const sims = await sql<{ id: number; title_de: string }[]>`
    select id, title_de from exam_simulations order by sort_order, id
  `;
  const rows = await sql<TaskRow[]>`
    select id, simulation_id, aufgabe, task_type, title_de, prompt_de,
           bullet_points_de, min_words, recommended_minutes, sample_answer_de
    from exam_tasks
    order by simulation_id, aufgabe, sort_order
  `;

  return sims.map((s) => ({
    id: s.id,
    titleDe: s.title_de,
    tasks: rows.filter((r) => r.simulation_id === s.id).map(toTask),
  }));
}

/** Einzelne Aufgabe per ID (für die Bewertung im Route-Handler). */
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
