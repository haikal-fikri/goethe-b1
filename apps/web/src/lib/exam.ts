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

/**
 * Wie viele Simulationen die ÖFFENTLICHE Web-App zeigt (Kostprobe).
 * Alles darüber ist der mobilen App vorbehalten („weitere Simulationen
 * freischalten" — siehe Seitenleisten-Karte). Die Grenze ist keine reine
 * Anzeige-Grenze: der anonyme Web-Pfad von /api/exam/grade lehnt Aufgaben aus
 * nicht-öffentlichen Simulationen ab (sonst wäre sie mit einer bekannten
 * taskId trivial zu umgehen).
 */
export const PUBLIC_SIMULATION_LIMIT = 2;

/** IDs der öffentlich sichtbaren Simulationen (die ersten N, kanonisch sortiert). */
export async function getPublicSimulationIds(): Promise<number[]> {
  const rows = await sql<{ id: number }[]>`
    select id from exam_simulations
    order by sort_order, id
    limit ${PUBLIC_SIMULATION_LIMIT}
  `;
  return rows.map((r) => r.id);
}

/** Die öffentlichen Simulationen mit ihren Aufgaben (Laufzeit-Read aus Postgres). */
export async function getPublicSimulations(): Promise<ExamSimulation[]> {
  const sims = await sql<{ id: number; title_de: string }[]>`
    select id, title_de from exam_simulations
    order by sort_order, id
    limit ${PUBLIC_SIMULATION_LIMIT}
  `;
  if (sims.length === 0) return [];

  const ids = sims.map((s) => s.id);
  const rows = await sql<TaskRow[]>`
    select id, simulation_id, aufgabe, task_type, title_de, prompt_de,
           bullet_points_de, min_words, recommended_minutes, sample_answer_de
    from exam_tasks
    where simulation_id = any(${ids})
    order by simulation_id, aufgabe, sort_order
  `;

  return sims.map((s) => ({
    id: s.id,
    titleDe: s.title_de,
    tasks: rows.filter((r) => r.simulation_id === s.id).map(toTask),
  }));
}

/**
 * Einzelne Aufgabe per ID — NICHT auf die öffentlichen Simulationen begrenzt.
 *
 * Bewusst unbeschränkt: /api/exam/grade ist dual-mode und die mobile (bezahlte)
 * App kommt über denselben Handler; sie muss ALLE Simulationen bewerten können.
 * Die öffentliche Begrenzung setzt der Route-Handler nur auf dem ANONYMEN Pfad
 * durch (via getPublicSimulationIds). /api/exam/email liest hierüber die Aufgabe
 * zu einem bereits gespeicherten Ergebnis des Nutzers — ebenfalls unbeschränkt.
 */
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
