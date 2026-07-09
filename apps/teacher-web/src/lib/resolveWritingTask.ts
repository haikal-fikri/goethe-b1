import "server-only";
import type { ExamTask } from "@repo/types";

// Phase 2/3: resolve the grader's ExamTask from the STORED assignment row —
// corpus (task_id → getExamTask, authoritative) or custom synth (Aufgabe-2
// semantics) (teacher-lms/04 §2.1). NOTE: the real ExamTask has NO `teil` field;
// `aufgabe` is 1|2|3 and drives scaleFor/criterionPoints. Never trust a client task.
export interface WritingAssignmentRow {
  id: string;
  task_id: string | null;
  prompt_de: string | null;
  bullet_points_de: string[];
  min_words: number | null;
}

export function resolveWritingTask(_a: WritingAssignmentRow): Promise<ExamTask> {
  throw new Error("resolveWritingTask(): not implemented (Phase 2/3)");
}
