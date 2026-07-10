import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

// Server-seitiger View-Model-Aufbau für die Aufgaben-Ansichten (Liste + Detail).
// Alle Reads laufen über den RLS-scoped SSR-Client — die teacher-select-Policies
// gaten sie auf die eigenen Klassen. Bewusst mehrere kleine Queries + JS-Assembly
// (wie dashboard.ts), robuster gegenüber RLS auf verschachtelten Relationen.

export type Skill = "schreiben" | "sprechen";
export type SubStatus = "pending" | "submitted" | "graded";

/** kind → Fertigkeit (Schreiben = grün, Sprechen = blau). */
function skillOf(kind: string): Skill {
  return kind === "writing" ? "schreiben" : "sprechen";
}

export interface AssignmentListItem {
  id: string;
  title: string;
  klasse: string;
  skill: Skill;
  dueAt: string | null;
  enrolled: number;
  submitted: number; // eingereicht (submitted + graded)
  toGrade: number; // status='submitted', noch nicht bewertet
}

export interface AssignmentListVM {
  hasClasses: boolean;
  items: AssignmentListItem[];
}

type Row = Record<string, unknown>;

function nameMap(rows: Row[], idKey: string, nameKey: string): Record<string, string> {
  const m: Record<string, string> = {};
  for (const r of rows) m[r[idKey] as string] = (r[nameKey] as string | null) ?? "";
  return m;
}

/** Sortierung nach Fälligkeit; ohne Datum ans Ende. */
function byDueAt(a: { dueAt: string | null }, b: { dueAt: string | null }): number {
  if (a.dueAt === b.dueAt) return 0;
  if (!a.dueAt) return 1;
  if (!b.dueAt) return -1;
  return a.dueAt.localeCompare(b.dueAt);
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s;
}

/** speaking_status → Anzeige-Status (SubStatus). scored = fertig transkribiert,
 *  wartet auf manuelle Bewertung → als „eingereicht" behandelt. */
function mapSpeakingStatus(s: string): SubStatus {
  if (s === "graded" || s === "purged") return "graded";
  if (s === "recorded" || s === "scored") return "submitted";
  return "pending";
}

/** Aufgaben über ALLE Klassen der Lehrkraft, sortiert nach Fälligkeit. */
export async function getAssignmentList(sb: SupabaseClient): Promise<AssignmentListVM> {
  const { data: classRows } = await sb.from("classes").select("id, name");
  const classes = (classRows ?? []) as Array<{ id: string; name: string }>;
  const classIds = classes.map((c) => c.id);
  if (classIds.length === 0) return { hasClasses: false, items: [] };
  const classNames = nameMap(classes, "id", "name");

  // Aktive Einschreibungen je Klasse (= "total"/enrolled für den Fortschritt).
  const { data: enr } = await sb
    .from("class_enrollments")
    .select("class_id")
    .in("class_id", classIds)
    .eq("status", "active");
  const enrolledByClass: Record<string, number> = {};
  for (const e of (enr ?? []) as Array<{ class_id: string }>) {
    enrolledByClass[e.class_id] = (enrolledByClass[e.class_id] ?? 0) + 1;
  }

  // ── Schreib-/Übungs-Aufgaben (assignments) ──
  const { data: assignRows } = await sb
    .from("assignments")
    .select("id, class_id, kind, title, due_at")
    .in("class_id", classIds);
  const assigns = (assignRows ?? []) as Array<{
    id: string;
    class_id: string;
    kind: string;
    title: string;
    due_at: string | null;
  }>;
  const writingSubmittedBy: Record<string, number> = {};
  const writingToGradeBy: Record<string, number> = {};
  if (assigns.length) {
    const assignIds = assigns.map((a) => a.id);
    const { data: subRows } = await sb
      .from("assignment_submissions")
      .select("assignment_id, status")
      .in("assignment_id", assignIds);
    for (const s of (subRows ?? []) as Array<{ assignment_id: string; status: SubStatus }>) {
      if (s.status === "submitted" || s.status === "graded") {
        writingSubmittedBy[s.assignment_id] = (writingSubmittedBy[s.assignment_id] ?? 0) + 1;
      }
      if (s.status === "submitted") {
        writingToGradeBy[s.assignment_id] = (writingToGradeBy[s.assignment_id] ?? 0) + 1;
      }
    }
  }
  const writingItems: AssignmentListItem[] = assigns.map((a) => ({
    id: a.id,
    title: a.title,
    klasse: classNames[a.class_id] ?? "—",
    skill: skillOf(a.kind),
    dueAt: a.due_at,
    enrolled: enrolledByClass[a.class_id] ?? 0,
    submitted: writingSubmittedBy[a.id] ?? 0,
    toGrade: writingToGradeBy[a.id] ?? 0,
  }));

  // ── Sprech-Aufgaben (eigene Tabelle speaking_assignments; „scored" = zu bewerten) ──
  const { data: spkRows } = await sb
    .from("speaking_assignments")
    .select("id, class_id, teil, prompt_de, due_at")
    .in("class_id", classIds);
  const spk = (spkRows ?? []) as Array<{
    id: string;
    class_id: string;
    teil: number;
    prompt_de: string;
    due_at: string | null;
  }>;
  const spkSubmittedBy: Record<string, number> = {};
  const spkToGradeBy: Record<string, number> = {};
  if (spk.length) {
    const spkIds = spk.map((s) => s.id);
    const { data: spkSubs } = await sb
      .from("speaking_submissions")
      .select("assignment_id, status")
      .in("assignment_id", spkIds);
    for (const s of (spkSubs ?? []) as Array<{ assignment_id: string; status: string }>) {
      if (s.status === "recorded" || s.status === "scored" || s.status === "graded") {
        spkSubmittedBy[s.assignment_id] = (spkSubmittedBy[s.assignment_id] ?? 0) + 1;
      }
      if (s.status === "scored") {
        spkToGradeBy[s.assignment_id] = (spkToGradeBy[s.assignment_id] ?? 0) + 1;
      }
    }
  }
  const speakingItems: AssignmentListItem[] = spk.map((s) => ({
    id: s.id,
    title: `Teil ${s.teil}: ${truncate(s.prompt_de, 40)}`,
    klasse: classNames[s.class_id] ?? "—",
    skill: "sprechen",
    dueAt: s.due_at,
    enrolled: enrolledByClass[s.class_id] ?? 0,
    submitted: spkSubmittedBy[s.id] ?? 0,
    toGrade: spkToGradeBy[s.id] ?? 0,
  }));

  const items = [...writingItems, ...speakingItems].sort(byDueAt);
  return { hasClasses: true, items };
}

export interface SubmissionRow {
  id: string;
  student: string;
  status: SubStatus;
  submittedAt: string | null;
  canGrade: boolean; // eingereicht, noch nicht bewertet
  gradeHref: string | null;
}

export interface AssignmentDetailVM {
  id: string;
  title: string;
  klasse: string;
  skill: Skill;
  kind: string;
  dueAt: string | null;
  promptDe: string | null;
  instructionsDe: string | null;
  bulletPoints: string[];
  minWords: number | null;
  recommendedMinutes: number | null;
  taskType: string | null; // Korpus-Aufgabentyp, falls task_id
  enrolled: number;
  submitted: number;
  toGrade: number;
  submissions: SubmissionRow[];
}

/**
 * Aufgaben-Detail. Gibt `null`, wenn die Aufgabe nicht existiert ODER nicht der
 * Lehrkraft gehört (RLS liefert dann keine Zeile) → die Seite ruft notFound().
 */
export async function getAssignmentDetail(
  sb: SupabaseClient,
  id: string
): Promise<AssignmentDetailVM | null> {
  const { data: a } = await sb
    .from("assignments")
    .select(
      "id, class_id, kind, title, due_at, task_id, prompt_de, bullet_points_de, min_words, recommended_minutes, instructions_de"
    )
    .eq("id", id)
    .maybeSingle();
  // Kein Treffer in assignments? Dann ist es evtl. eine Sprech-Aufgabe (eigene
  // Tabelle) — oder sie gehört nicht der Lehrkraft (RLS) → dort weiter/​null.
  if (!a) return getSpeakingAssignmentDetail(sb, id);
  const assign = a as {
    id: string;
    class_id: string;
    kind: string;
    title: string;
    due_at: string | null;
    task_id: string | null;
    prompt_de: string | null;
    bullet_points_de: string[] | null;
    min_words: number | null;
    recommended_minutes: number | null;
    instructions_de: string | null;
  };
  const skill = skillOf(assign.kind);

  const { data: cls } = await sb
    .from("classes")
    .select("name")
    .eq("id", assign.class_id)
    .maybeSingle();
  const klasse = ((cls as { name?: string } | null)?.name ?? "—") as string;

  // Korpus-Aufgabe (task_id) → autoritativen Prompt/Leitpunkte zeigen (public read).
  let promptDe = assign.prompt_de;
  let bulletPoints = assign.bullet_points_de ?? [];
  let minWords = assign.min_words;
  let taskType: string | null = null;
  if (assign.task_id) {
    const { data: task } = await sb
      .from("exam_tasks")
      .select("task_type, prompt_de, bullet_points_de, min_words")
      .eq("id", assign.task_id)
      .maybeSingle();
    const t = task as {
      task_type?: string;
      prompt_de?: string;
      bullet_points_de?: string[];
      min_words?: number;
    } | null;
    if (t) {
      promptDe = t.prompt_de ?? promptDe;
      bulletPoints = t.bullet_points_de ?? bulletPoints;
      minWords = t.min_words ?? minWords;
      taskType = t.task_type ?? null;
    }
  }

  // Enrolled (aktiv) für die Klasse.
  const { data: enr } = await sb
    .from("class_enrollments")
    .select("student_id")
    .eq("class_id", assign.class_id)
    .eq("status", "active");
  const enrolled = (enr ?? []).length;

  // Abgaben dieser Aufgabe + Namen.
  const { data: subRows } = await sb
    .from("assignment_submissions")
    .select("id, student_id, status, submitted_at")
    .eq("assignment_id", id)
    .order("submitted_at", { ascending: true, nullsFirst: false });
  const subs = (subRows ?? []) as Array<{
    id: string;
    student_id: string;
    status: SubStatus;
    submitted_at: string | null;
  }>;

  const studentIds = [...new Set(subs.map((s) => s.student_id))];
  const studentNames: Record<string, string> = {};
  if (studentIds.length) {
    const { data: p } = await sb.from("profiles").select("id, display_name").in("id", studentIds);
    Object.assign(studentNames, nameMap((p ?? []) as Row[], "id", "display_name"));
  }
  const nameOf = (sid: string) => studentNames[sid]?.trim() || "Teilnehmende:r";

  const gradeBase = skill === "schreiben" ? "/bewerten/schreiben" : "/bewerten/sprechen";
  const submissions: SubmissionRow[] = subs.map((s) => {
    const canGrade = s.status === "submitted";
    return {
      id: s.id,
      student: nameOf(s.student_id),
      status: s.status,
      submittedAt: s.submitted_at,
      canGrade,
      gradeHref: canGrade ? `${gradeBase}/${s.id}` : null,
    };
  });

  const submitted = subs.filter((s) => s.status === "submitted" || s.status === "graded").length;
  const toGrade = subs.filter((s) => s.status === "submitted").length;

  return {
    id: assign.id,
    title: assign.title,
    klasse,
    skill,
    kind: assign.kind,
    dueAt: assign.due_at,
    promptDe,
    instructionsDe: assign.instructions_de,
    bulletPoints,
    minWords,
    recommendedMinutes: assign.recommended_minutes,
    taskType,
    enrolled,
    submitted,
    toGrade,
    submissions,
  };
}

/**
 * Detail einer Sprech-Aufgabe (speaking_assignments). Gibt `null`, wenn die
 * Aufgabe nicht existiert ODER nicht der Lehrkraft gehört (RLS) → notFound().
 * Bewertbar sind Einreichungen im Status 'scored' (transkribiert, noch offen)
 * → Link auf /bewerten/sprechen/[submissionId].
 */
async function getSpeakingAssignmentDetail(
  sb: SupabaseClient,
  id: string
): Promise<AssignmentDetailVM | null> {
  const { data: a } = await sb
    .from("speaking_assignments")
    .select("id, class_id, teil, prompt_de, due_at")
    .eq("id", id)
    .maybeSingle();
  if (!a) return null;
  const assign = a as {
    id: string;
    class_id: string;
    teil: number;
    prompt_de: string;
    due_at: string | null;
  };

  const { data: cls } = await sb.from("classes").select("name").eq("id", assign.class_id).maybeSingle();
  const klasse = ((cls as { name?: string } | null)?.name ?? "—") as string;

  const { data: enr } = await sb
    .from("class_enrollments")
    .select("student_id")
    .eq("class_id", assign.class_id)
    .eq("status", "active");
  const enrolled = (enr ?? []).length;

  const { data: subRows } = await sb
    .from("speaking_submissions")
    .select("id, student_id, status, created_at")
    .eq("assignment_id", id)
    .order("created_at", { ascending: true, nullsFirst: false });
  const subs = (subRows ?? []) as Array<{
    id: string;
    student_id: string;
    status: string;
    created_at: string | null;
  }>;

  const studentIds = [...new Set(subs.map((s) => s.student_id))];
  const studentNames: Record<string, string> = {};
  if (studentIds.length) {
    const { data: p } = await sb.from("profiles").select("id, display_name").in("id", studentIds);
    Object.assign(studentNames, nameMap((p ?? []) as Row[], "id", "display_name"));
  }
  const nameOf = (sid: string) => studentNames[sid]?.trim() || "Teilnehmende:r";

  const submissions: SubmissionRow[] = subs.map((s) => {
    const canGrade = s.status === "scored";
    return {
      id: s.id,
      student: nameOf(s.student_id),
      status: mapSpeakingStatus(s.status),
      submittedAt: s.created_at,
      canGrade,
      gradeHref: canGrade ? `/bewerten/sprechen/${s.id}` : null,
    };
  });

  const submitted = subs.filter((s) => ["recorded", "scored", "graded"].includes(s.status)).length;
  const toGrade = subs.filter((s) => s.status === "scored").length;

  return {
    id: assign.id,
    title: `Teil ${assign.teil}: ${truncate(assign.prompt_de, 60)}`,
    klasse,
    skill: "sprechen",
    kind: "speaking",
    dueAt: assign.due_at,
    promptDe: assign.prompt_de,
    instructionsDe: null,
    bulletPoints: [],
    minWords: null,
    recommendedMinutes: null,
    taskType: null,
    enrolled,
    submitted,
    toGrade,
    submissions,
  };
}
