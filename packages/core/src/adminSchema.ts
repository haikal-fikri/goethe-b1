import { z } from "zod";

// Obergrenzen spiegeln die Konvention der übrigen DB-nahen Schemas
// (examResultEmail.ts / requestSchemas.ts) — kein unbegrenzter Speicher.
const taskSchema = z.object({
  aufgabe: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  taskType: z.string().min(1).max(120),
  titleDe: z.string().min(1).max(300),
  promptDe: z.string().min(1).max(8000),
  bulletPointsDe: z.array(z.string().max(500)).max(20).default([]),
  minWords: z.number().int().positive().max(10000),
  recommendedMinutes: z.number().int().positive().max(600).optional(),
  sampleAnswerDe: z.string().max(12000).optional(),
});

export const createSimulationSchema = z.object({
  titleDe: z.string().min(1).max(300),
  tasks: z.array(taskSchema).length(3),
});

export type CreateSimulationInput = z.infer<typeof createSimulationSchema>;

/**
 * Dieselbe Aufgaben-Form, benannt exportiert für den Korpus-Editor
 * (/api/admin/corpus/exam-tasks). Heißt bewusst examTaskSchema und nicht
 * taskSchema: die DB hat zusätzlich eine Korpus-Tabelle `tasks`
 * (→ corpusTaskSchema in ./corpusSchema).
 */
export const examTaskSchema = taskSchema;
export type ExamTaskInput = z.infer<typeof examTaskSchema>;
