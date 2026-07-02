import type {
  RedemittelItem,
  ExamSimulation,
  ExamTask,
  AufgabeNr,
  Profile,
  ExerciseProgress,
  DailyActivity,
  StoredExamResult,
  ExamDraft,
} from "@repo/types";
import { getSupabase } from "./supabase";

// Client-direkte, RLS-gescopte Reads/Writes (Tier 1). High-trust-Writes
// (grade persist) laufen über den Trusted Server; record_attempt über den RPC.

function sb() {
  const s = getSupabase();
  if (!s) throw new Error("Supabase nicht konfiguriert.");
  return s;
}

// ── Inhalt (public read) ────────────────────────────────────────────
export async function getRedemittel(): Promise<RedemittelItem[]> {
  const { data, error } = await sb().from("redemittel_item").select("*");
  if (error) throw error;
  return (data ?? []).map((r) => ({ ...(r as RedemittelItem), examples: (r as RedemittelItem).examples ?? [] }));
}

interface ExamTaskRow {
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
const toTask = (r: ExamTaskRow): ExamTask => ({
  id: r.id,
  simulation: r.simulation_id,
  aufgabe: r.aufgabe as AufgabeNr,
  taskType: r.task_type,
  titleDe: r.title_de,
  promptDe: r.prompt_de,
  bulletPointsDe: r.bullet_points_de?.length ? r.bullet_points_de : undefined,
  minWords: r.min_words,
  recommendedMinutes: r.recommended_minutes ?? undefined,
  sampleAnswerDe: r.sample_answer_de ?? undefined,
});

export async function getSimulations(): Promise<ExamSimulation[]> {
  const s = sb();
  const [sims, tasks] = await Promise.all([
    s.from("exam_simulations").select("id, title_de").order("sort_order"),
    s.from("exam_tasks").select("*").order("simulation_id").order("aufgabe"),
  ]);
  if (sims.error) throw sims.error;
  if (tasks.error) throw tasks.error;
  const rows = (tasks.data ?? []) as ExamTaskRow[];
  return (sims.data ?? []).map((sim) => ({
    id: sim.id as number,
    titleDe: sim.title_de as string,
    tasks: rows.filter((r) => r.simulation_id === sim.id).map(toTask),
  }));
}

// ── Profil ──────────────────────────────────────────────────────────
export async function getProfile(uid: string): Promise<Profile | null> {
  const { data } = await sb().from("profiles").select("*").eq("id", uid).maybeSingle();
  return (data as Profile) ?? null;
}
export async function upsertProfile(uid: string, patch: Partial<Profile>): Promise<void> {
  // avatar_url ist serverseitig gesetzt → hier nie mitschicken.
  const { avatarUrl: _drop, ...rest } = patch;
  void _drop;
  const snake: Record<string, unknown> = {};
  const map: Record<string, string> = {
    displayName: "display_name", nativeLanguage: "native_language",
    examDate: "exam_date", reminderOptIn: "reminder_opt_in",
    reminderTime: "reminder_time", theme: "theme", level: "level", onboardedAt: "onboarded_at",
  };
  for (const [k, v] of Object.entries(rest)) if (map[k]) snake[map[k]] = v;
  const { error } = await sb().from("profiles").update(snake).eq("id", uid);
  if (error) throw error;
}

// ── Fortschritt ─────────────────────────────────────────────────────
export interface AttemptResult { ok?: boolean; correct?: boolean; error?: string; retryAfter?: number }

export async function recordAttempt(args: {
  itemId: string; lessonId: string; kind: "wordbank" | "cloze";
  submittedTokens: string[]; durationMs?: number;
}): Promise<AttemptResult> {
  const { data, error } = await sb().rpc("record_attempt", {
    p_item_id: args.itemId,
    p_lesson_id: args.lessonId,
    p_kind: args.kind,
    p_submitted_tokens: args.submittedTokens,
    p_duration_ms: args.durationMs ?? null,
  });
  if (error) return { error: error.message };
  return (data as AttemptResult) ?? {};
}

export async function getMyProgress(uid: string): Promise<ExerciseProgress[]> {
  const { data } = await sb().from("exercise_progress").select("*").eq("user_id", uid);
  return (data as ExerciseProgress[]) ?? [];
}
export async function getMyDaily(uid: string): Promise<DailyActivity[]> {
  const { data } = await sb().from("daily_activity").select("*").eq("user_id", uid).order("day", { ascending: false });
  return (data as DailyActivity[]) ?? [];
}
export async function getMyExamResults(uid: string): Promise<StoredExamResult[]> {
  const { data } = await sb().from("exam_results").select("*").eq("user_id", uid).order("created_at", { ascending: false });
  return (data as StoredExamResult[]) ?? [];
}

// ── Entwürfe (client-direkt, RLS own) ───────────────────────────────
export async function getDraft(uid: string, taskId: string): Promise<ExamDraft | null> {
  const { data } = await sb().from("exam_drafts").select("*").eq("user_id", uid).eq("task_id", taskId).maybeSingle();
  return (data as ExamDraft) ?? null;
}
export async function upsertDraft(uid: string, taskId: string, text: string, wordCount: number): Promise<void> {
  await sb().from("exam_drafts").upsert(
    { user_id: uid, task_id: taskId, text, word_count: wordCount },
    { onConflict: "user_id,task_id" }
  );
}
export async function deleteDraft(uid: string, taskId: string): Promise<void> {
  await sb().from("exam_drafts").delete().eq("user_id", uid).eq("task_id", taskId);
}
