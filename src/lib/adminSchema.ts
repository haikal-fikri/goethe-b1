import { z } from "zod";

const taskSchema = z.object({
  aufgabe: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  taskType: z.string().min(1),
  titleDe: z.string().min(1),
  promptDe: z.string().min(1),
  bulletPointsDe: z.array(z.string()).default([]),
  minWords: z.number().int().positive(),
  recommendedMinutes: z.number().int().positive().optional(),
  sampleAnswerDe: z.string().optional(),
});

export const createSimulationSchema = z.object({
  titleDe: z.string().min(1),
  tasks: z.array(taskSchema).length(3),
});

export type CreateSimulationInput = z.infer<typeof createSimulationSchema>;
