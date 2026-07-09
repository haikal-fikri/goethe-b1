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
  ReadinessModule,
  ReadinessSnapshot,
  DailyStatus,
  StartSetResult,
  DailyMixRun,
  Language,
  Module,
  EnrolledClass,
  Assignment,
  AssignmentSubmission,
  ClassLeaderboardEntry,
} from "@repo/types";
import type { LevelScope } from "@repo/core";
import { getSupabase } from "./supabase";

// Client-direkte, RLS-gescopte Reads/Writes (Tier 1). High-trust-Writes
// (grade persist) laufen über den Trusted Server; record_attempt über den RPC.

function sb() {
  const s = getSupabase();
  if (!s) throw new Error("Supabase nicht konfiguriert.");
  return s;
}

// supabase-js gibt rohe snake_case-Spalten zurück (kein Auto-camelCase) → hier
// auf die camelCase-Domain-Typen mappen. (redemittel_item + exam_tasks sind
// bereits camelCase via View/toTask.)
type Row = Record<string, any>;
const mapProfile = (r: Row): Profile => ({
  id: r.id, displayName: r.display_name ?? null, avatarUrl: r.avatar_url ?? null, level: r.level,
  nativeLanguage: r.native_language ?? null, examDate: r.exam_date ?? null, reminderOptIn: r.reminder_opt_in,
  reminderTime: r.reminder_time ?? null, theme: r.theme, onboardedAt: r.onboarded_at ?? null,
  createdAt: r.created_at, updatedAt: r.updated_at,
});
const mapProgress = (r: Row): ExerciseProgress => ({
  userId: r.user_id, itemId: r.item_id, lessonId: r.lesson_id, attempts: r.attempts,
  correctCount: r.correct_count, lastCorrect: r.last_correct,
  firstTryCorrect: r.first_try_correct ?? null, masteredAt: r.mastered_at ?? null,
  lastCorrectAt: r.last_correct_at ?? null, lastSeenAt: r.last_seen_at,
});
const mapDaily = (r: Row): DailyActivity => ({
  userId: r.user_id, day: r.day, attempts: r.attempts, correctCount: r.correct_count,
  examsGraded: r.exams_graded, activeSeconds: r.active_seconds ?? null,
});
const mapExamResult = (r: Row): StoredExamResult => ({
  id: r.id, userId: r.user_id, simulationId: r.simulation_id ?? null, taskId: r.task_id ?? null, aufgabe: r.aufgabe,
  gesamtpunkte: Number(r.gesamtpunkte), maxPunkte: Number(r.max_punkte), bestanden: r.bestanden, thirdUsed: r.third_used,
  result: r.result, answerText: r.answer_text ?? null, wordCount: r.word_count, model: r.model ?? null,
  gradedAt: r.graded_at, createdAt: r.created_at,
});
const mapDraft = (r: Row): ExamDraft => ({
  id: r.id, userId: r.user_id, taskId: r.task_id, text: r.text, wordCount: r.word_count,
  updatedAt: r.updated_at, createdAt: r.created_at,
});

// ── Inhalt (public read) ────────────────────────────────────────────
// Sprach-bewusster Read (0011): über redemittel_item wird für die gewählte
// Muttersprache ein Overlay aus redemittel_translation (status='reviewed') gelegt
// — Phrase + Beispiele. Fallback ist inhärent Englisch (translation_en NOT NULL);
// 'en'/leer → keine Overlay-Abfrage. Pro Sprache gecacht (queryKey enthält lang).
export async function getRedemittel(nativeLanguage?: string | null): Promise<RedemittelItem[]> {
  const { data, error } = await sb().from("redemittel_item").select("*");
  if (error) throw error;
  const items = (data ?? []).map((r) => ({ ...(r as RedemittelItem), examples: (r as RedemittelItem).examples ?? [] }));

  const lang = nativeLanguage ?? "en";
  if (lang === "en") return items;

  const { data: tr } = await sb()
    .from("redemittel_translation")
    .select("row_id, translation")
    .eq("lang", lang)
    .eq("status", "reviewed");
  if (!tr?.length) return items;
  const overlay = new Map<string, string>((tr as Row[]).map((t) => [t.row_id as string, t.translation as string]));

  return items.map((it) => ({
    ...it,
    translation: overlay.get(it.id) ?? it.translation,
    examples: (it.examples ?? []).map((e) => ({ ...e, en: (e.row_id ? overlay.get(e.row_id) : undefined) ?? e.en })),
  }));
}

/** Sprachen für den Muttersprache-Picker (nur enabled=true; public read). */
export async function getLanguages(): Promise<Language[]> {
  const { data } = await sb().from("languages").select("*").eq("enabled", true).order("sort_order");
  return (data ?? []).map((r: Row) => ({
    code: r.code, nameNative: r.name_native, nameDe: r.name_de, rtl: r.rtl, enabled: r.enabled, sortOrder: r.sort_order,
  }));
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
  return data ? mapProfile(data) : null;
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
// Session-bewusste RPC-Antwort (record_attempt). `result` = complete_set-Nutzlast, falls das Set fertig ist.
export interface AttemptResult {
  ok?: boolean;
  correct?: boolean;
  heartsLeft?: number | null;
  remaining?: number | null;
  completed?: boolean;
  result?: { completed: boolean; points: number; flawless: boolean; firstTryOk?: number; heartsLeft?: number; dailyMixBonus?: number } | null;
  error?: string;
  retryAfter?: number;
}

export async function recordAttempt(args: {
  itemId: string; lessonId: string; kind: "wordbank" | "cloze";
  submittedTokens: string[]; durationMs?: number; sessionId?: string;
}): Promise<AttemptResult> {
  const { data, error } = await sb().rpc("record_attempt", {
    p_item_id: args.itemId,
    p_lesson_id: args.lessonId,
    p_kind: args.kind,
    p_submitted_tokens: args.submittedTokens,
    p_duration_ms: args.durationMs ?? null,
    p_session_id: args.sessionId ?? null,
  });
  if (error) return { error: error.message };
  const d = (data as Row) ?? {};
  return {
    ok: d.ok, correct: d.correct, heartsLeft: d.hearts_left ?? null, remaining: d.remaining ?? null,
    completed: d.completed ?? false,
    result: d.result ? { completed: d.result.completed, points: d.result.points, flawless: d.result.flawless,
      firstTryOk: d.result.first_try_ok, heartsLeft: d.result.hearts_left, dailyMixBonus: d.result.daily_mix_bonus } : null,
    error: d.error, retryAfter: d.retryAfter,
  };
}

// ── Gamification-RPCs (0010) ────────────────────────────────────────
/** start_set: Server fixiert Item-Liste + Kinds (id-Hash) + Hearts. levelScope = Niveau-Filter (R2-3).
 *  mode='daily_mix' → tagesgeseedeter modulübergreifender Regain-Set (0012). */
export async function startSet(
  lessonId: string, mode: "category" | "review" | "daily_mix" = "category", levelScope: LevelScope = "exam",
): Promise<StartSetResult | { error: string; retryAfter?: number }> {
  const { data, error } = await sb().rpc("start_set", { p_lesson_id: lessonId, p_mode: mode, p_level_scope: levelScope });
  if (error) return { error: error.message };
  const d = (data as Row) ?? {};
  if (d.error) return { error: d.error, retryAfter: d.retryAfter };
  return {
    sessionId: d.session_id, hearts: d.hearts, module: d.module as Module,
    items: (d.items ?? []) as { id: string; kind: "wordbank" | "cloze" }[],
  };
}
/** On-Device-Sprechen 20/22: Selbstauskunft. `success` (Aussprache erkannt / Anordnen korrekt)
 * schreibt Readiness (Ring + Bereitschaft) + XP; jeder Aufruf zählt als Aktivität (Serie). */
export async function recordSpeechPractice(
  itemId: string, success = false, firstTry = false,
): Promise<{ ok?: boolean; error?: string }> {
  const { data, error } = await sb().rpc("record_speech_practice", {
    p_item_id: itemId, p_success: success, p_first_try: firstTry,
  });
  if (error) return { error: error.message };
  return (data as { ok?: boolean; error?: string }) ?? {};
}
/** Vordergrund-Sitzungszeit → daily_activity.active_seconds (BUG-4 "Woche"). */
export async function bumpActiveSeconds(seconds: number): Promise<void> {
  await sb().rpc("bump_active_seconds", { p_seconds: Math.max(0, Math.round(seconds)) });
}
/** Verwirft eine (Game-over-)Session, damit ein Retry sie nicht fortsetzt — start_set('daily_mix')
 *  resumt sonst dieselbe Session bei 0 Herzen. RLS erlaubt DELETE der eigenen practice_sessions-Zeile. */
export async function abandonSession(sessionId: string): Promise<void> {
  await sb().from("practice_sessions").delete().eq("id", sessionId);
}

export async function getMyProgress(uid: string): Promise<ExerciseProgress[]> {
  const { data } = await sb().from("exercise_progress").select("*").eq("user_id", uid);
  return (data ?? []).map(mapProgress);
}
export async function getMyDaily(uid: string): Promise<DailyActivity[]> {
  const { data } = await sb().from("daily_activity").select("*").eq("user_id", uid).order("day", { ascending: false });
  return (data ?? []).map(mapDaily);
}
export async function getMyExamResults(uid: string): Promise<StoredExamResult[]> {
  const { data } = await sb().from("exam_results").select("*").eq("user_id", uid).order("created_at", { ascending: false });
  return (data ?? []).map(mapExamResult);
}

// ── Readiness / Tagesstatus (0010 Views; security_invoker → eigene Zeilen) ──
export async function getMyReadiness(): Promise<ReadinessModule[]> {
  const { data } = await sb().from("v_readiness").select("*");
  return (data ?? []).map((r: Row) => ({ module: r.module as Module, score: Number(r.score) }));
}
export async function getMyDailyStatus(): Promise<DailyStatus> {
  const { data } = await sb().from("v_daily_status").select("*").maybeSingle();
  const r = (data as Row) ?? {};
  return { goalMetToday: Boolean(r.goal_met_today), streak: Number(r.streak ?? 0), practicePointsToday: Number(r.practice_points_today ?? 0) };
}

/** Heutiger Tagesmix-Status (0012): steuert „Los geht's" ↔ „Heute erledigt ✓". */
export async function getDailyMixToday(): Promise<DailyMixRun | null> {
  const today = new Date().toISOString().slice(0, 10); // UTC-Tag
  const { data } = await sb().from("daily_mix_runs").select("*").eq("run_on", today).maybeSingle();
  const r = data as Row | null;
  return r ? { runOn: r.run_on, bonusAwarded: Boolean(r.bonus_awarded), completedAt: r.completed_at ?? null } : null;
}

/** readiness_snapshots (Cron-geschrieben) für „+Δ diese Woche". */
export async function getReadinessSnapshots(): Promise<ReadinessSnapshot[]> {
  const { data } = await sb().from("readiness_snapshots").select("*").order("captured_on", { ascending: false });
  return (data ?? []).map((r: Row) => ({
    userId: r.user_id, capturedOn: r.captured_on, overall: r.overall,
    schreiben: r.schreiben, sprechen: r.sprechen, konnektoren: r.konnektoren,
  }));
}

// ── Klasse (0008 RLS-Reads + 0015 Definer-RPCs) ─────────────────────
const mapEnrolledClass = (r: Row): EnrolledClass => ({
  classId: r.class_id, name: r.name, joinCode: r.join_code, teacherId: r.teacher_id,
  teacherName: r.teacher_name ?? null, memberCount: r.member_count ?? 0, enrolledAt: r.enrolled_at,
});
const mapAssignment = (r: Row): Assignment => ({
  id: r.id, classId: r.class_id, kind: r.kind, title: r.title,
  simulationId: r.simulation_id ?? null, taskId: r.task_id ?? null,
  dueAt: r.due_at ?? null, createdAt: r.created_at,
});
const mapSubmission = (r: Row): AssignmentSubmission => ({
  id: r.id, assignmentId: r.assignment_id, studentId: r.student_id, status: r.status,
  examResultId: r.exam_result_id ?? null, submittedAt: r.submitted_at ?? null,
  gradedAt: r.graded_at ?? null, createdAt: r.created_at,
});
const mapLeaderboardEntry = (r: Row): ClassLeaderboardEntry => ({
  rank: r.rank, userId: r.user_id, displayName: r.display_name ?? null,
  points: r.points ?? 0, isMe: Boolean(r.is_me),
});

/** Eingeschriebene Klassen des Aufrufers (my_classes-RPC: Lehrkraft-Name +
 *  Mitgliederzahl, die unter 0008-RLS nicht direkt lesbar sind). */
export async function getMyClasses(): Promise<EnrolledClass[]> {
  const { data, error } = await sb().rpc("my_classes");
  if (error) throw error;
  return ((data as Row[]) ?? []).map(mapEnrolledClass);
}
/** Aufgaben einer Klasse (RLS-direkt: „assign read" = is_enrolled(class_id)). */
export async function getClassAssignments(classId: string): Promise<Assignment[]> {
  const { data } = await sb().from("assignments").select("*").eq("class_id", classId)
    .order("due_at", { ascending: true, nullsFirst: false });
  return (data ?? []).map(mapAssignment);
}
/** Eigene Abgaben (RLS-direkt: „asub student select" = student_id = auth.uid()). */
export async function getMySubmissions(uid: string): Promise<AssignmentSubmission[]> {
  const { data } = await sb().from("assignment_submissions").select("*").eq("student_id", uid);
  return (data ?? []).map(mapSubmission);
}
/** Klassenweite Wochen-Rangliste (class_leaderboard-RPC, enrollment-gated). */
export async function getClassLeaderboard(classId: string): Promise<ClassLeaderboardEntry[]> {
  const { data, error } = await sb().rpc("class_leaderboard", { p_class_id: classId });
  if (error) throw error;
  return ((data as Row[]) ?? []).map(mapLeaderboardEntry);
}

/** find_class_by_code: Vorschau (Klassenname) vor dem Beitritt. null = kein Treffer. */
export async function findClassByCode(code: string): Promise<{ classId: string; className: string } | null> {
  const { data, error } = await sb().rpc("find_class_by_code", { p_code: code.trim().toUpperCase() });
  if (error) return null;
  const row = ((data as Row[]) ?? [])[0];
  return row ? { classId: row.class_id, className: row.class_name } : null;
}
/** join_class: idempotenter Beitritt per Code. Fehler (roher Code) → { ok:false }. */
export async function joinClass(code: string): Promise<{ ok: boolean; className?: string; error?: string }> {
  const { data, error } = await sb().rpc("join_class", { p_code: code.trim().toUpperCase() });
  if (error) return { ok: false, error: error.message };
  const row = ((data as Row[]) ?? [])[0];
  return { ok: true, className: row?.class_name };
}
/** leave_class: setzt die eigene Einschreibung auf 'removed'. */
export async function leaveClass(classId: string): Promise<void> {
  await sb().rpc("leave_class", { p_class: classId });
}

// ── Entwürfe (client-direkt, RLS own) ───────────────────────────────
export async function getDraft(uid: string, taskId: string): Promise<ExamDraft | null> {
  const { data } = await sb().from("exam_drafts").select("*").eq("user_id", uid).eq("task_id", taskId).maybeSingle();
  return data ? mapDraft(data) : null;
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
