import type { SupabaseClient } from "@supabase/supabase-js";

// Client-direkte Aufgaben-Erstellung unter RLS (teacher-lms/03 #14). Insert-Policy
// "assign teacher insert" (is_class_teacher AND NOT is_class_locked → Term-Lock).
// CHECK assignments_writing_source_ck: bei kind='writing' GENAU EINE Quelle
// (task_id XOR prompt_de). Eine ganze Simulation = eine Zeile pro exam_task,
// alle mit gleicher simulation_id (Gruppierung). Der AFTER-INSERT-Trigger
// fächert 'assignment_new'-Notifications auf. Submission-Writes sind route-only.

export type AssignmentKind = "writing" | "speaking" | "practice";

interface BaseAssignment {
  class_id: string;
  title: string;
  due_at?: string | null;
  recommended_minutes?: number | null;
  instructions_de?: string | null;
}

/** Schreib-Aufgabe aus dem Korpus (exam_task). */
export interface WritingCorpusInput extends BaseAssignment {
  task_id: string;
  simulation_id?: number | null;
}

/** Frei formulierte Schreib-Aufgabe (D4). */
export interface WritingCustomInput extends BaseAssignment {
  prompt_de: string;
  bullet_points_de?: string[];
  min_words: number;
}

export function listAssignments(sb: SupabaseClient, classId: string) {
  return sb
    .from("assignments")
    .select("*")
    .eq("class_id", classId)
    .order("due_at", { ascending: true, nullsFirst: false });
}

export function createWritingCorpusAssignment(sb: SupabaseClient, input: WritingCorpusInput) {
  return sb
    .from("assignments")
    .insert({
      class_id: input.class_id,
      kind: "writing",
      title: input.title,
      task_id: input.task_id,
      simulation_id: input.simulation_id ?? null,
      prompt_de: null,
      due_at: input.due_at ?? null,
      recommended_minutes: input.recommended_minutes ?? null,
      instructions_de: input.instructions_de ?? null,
    })
    .select()
    .single();
}

export function createWritingCustomAssignment(sb: SupabaseClient, input: WritingCustomInput) {
  return sb
    .from("assignments")
    .insert({
      class_id: input.class_id,
      kind: "writing",
      title: input.title,
      task_id: null,
      prompt_de: input.prompt_de,
      bullet_points_de: input.bullet_points_de ?? [],
      min_words: input.min_words,
      due_at: input.due_at ?? null,
      recommended_minutes: input.recommended_minutes ?? null,
      instructions_de: input.instructions_de ?? null,
    })
    .select()
    .single();
}

/** Sprech-/Übungs-Aufgabe (kind='speaking'|'practice'). */
export function createAssignment(
  sb: SupabaseClient,
  kind: Exclude<AssignmentKind, "writing">,
  input: BaseAssignment & { task_id?: string | null; simulation_id?: number | null }
) {
  return sb
    .from("assignments")
    .insert({
      class_id: input.class_id,
      kind,
      title: input.title,
      task_id: input.task_id ?? null,
      simulation_id: input.simulation_id ?? null,
      due_at: input.due_at ?? null,
      recommended_minutes: input.recommended_minutes ?? null,
      instructions_de: input.instructions_de ?? null,
    })
    .select()
    .single();
}

export function updateAssignment(
  sb: SupabaseClient,
  assignmentId: string,
  patch: Partial<BaseAssignment>
) {
  return sb.from("assignments").update(patch).eq("id", assignmentId).select().single();
}

export function deleteAssignment(sb: SupabaseClient, assignmentId: string) {
  return sb.from("assignments").delete().eq("id", assignmentId);
}

/** Schüler-Abgaben einer Aufgabe lesen ("asub teacher select"). Read-only. */
export function listSubmissions(sb: SupabaseClient, assignmentId: string) {
  return sb.from("assignment_submissions").select("*").eq("assignment_id", assignmentId);
}
