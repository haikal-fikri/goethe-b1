// Persistenz-Typen — spiegeln die additiven Tabellen (Migrationen 0005–0009) 1:1
// wider, damit apps/web (Trusted Server) und apps/mobile (Client) übereinstimmen.
// Zeitstempel als ISO-`string`, UUIDs als `string`. Rein deklarativ (kein Laufzeitcode).
import type { AufgabeNr, CEFRLevel, ExamResult } from "./index";

// --- 0005 · Profil ---

export type ProfileTheme = "system" | "light" | "dark";

export interface Profile {
  id: string; // = auth.uid()
  displayName: string | null;
  avatarUrl: string | null; // Storage-Objektschlüssel; NUR serverseitig gesetzt
  level: CEFRLevel; // App erzwingt B1 in v1
  nativeLanguage: string | null; // ISO 639-1 (Muttersprache → Redemittel-Übersetzung)
  examDate: string | null; // ISO-Datum
  reminderOptIn: boolean;
  reminderTime: string | null; // 'HH:MM'
  theme: ProfileTheme;
  onboardedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Öffentlich lesbare Feature-Flags / Konfiguration (Tabelle `app_config`). */
export interface AppConfig {
  key: string;
  value: unknown;
}

export interface FeatureFlags {
  /** Klasse/Sprechen-Bewertung sichtbar? In v1 aus (4-Tab-Leiste). */
  classEnabled: boolean;
}

// --- 0006 · Übungsfortschritt + Prüfungsergebnisse ---

export type ExerciseKind = "wordbank" | "cloze" | "speech";

export interface ExerciseAttempt {
  id: string;
  userId: string;
  itemId: string; // redemittel.id
  lessonId: string; // makeLessonId(skill, task, function)
  kind: ExerciseKind; // 'wordbank' | 'cloze' (nie 'speech')
  correct: boolean; // serverseitig neu berechnet
  submittedTokens: string[];
  durationMs: number | null;
  createdAt: string;
}

export interface ExerciseProgress {
  userId: string;
  itemId: string;
  lessonId: string;
  attempts: number;
  correctCount: number;
  lastCorrect: boolean;
  firstTryCorrect: boolean | null; // 0010: gesetzt beim allerersten Versuch (Readiness-Basis)
  masteredAt: string | null;
  lastCorrectAt: string | null; // 0010: letzte richtige Antwort (Readiness-Decay-Reset)
  lastSeenAt: string;
}

export interface DailyActivity {
  userId: string;
  day: string; // UTC-Datumsschlüssel
  attempts: number;
  correctCount: number;
  examsGraded: number;
  activeSeconds: number | null;
}

/** Persistierte KI-Bewertung (`exam_results`). Flache Spalten + volle `result`-jsonb. */
export interface StoredExamResult {
  id: string;
  userId: string;
  simulationId: number | null;
  taskId: string | null;
  aufgabe: AufgabeNr;
  gesamtpunkte: number;
  maxPunkte: number;
  bestanden: boolean;
  thirdUsed: boolean;
  result: ExamResult; // vollständiges ExamResult { reconciled, examiners, thirdUsed }
  answerText: string | null; // eigener Aufsatz der/des Lernenden
  wordCount: number;
  model: string | null;
  gradedAt: string;
  createdAt: string;
}

export interface ExamDraft {
  id: string;
  userId: string;
  taskId: string;
  text: string;
  wordCount: number;
  updatedAt: string;
  createdAt: string;
}

// --- 0008 · Klassen / Einschreibungen / Aufgaben / Entitlements (DEFERRED-Runtime) ---

export type EntitlementKind = "teacher_subscription";
export type EntitlementStatus =
  | "active"
  | "canceled"
  | "past_due"
  | "revoked"
  | "expired";

export interface Entitlement {
  id: string;
  userId: string; // die Lehrkraft
  kind: EntitlementKind;
  status: EntitlementStatus;
  source: string;
  polarSubscriptionId: string | null;
  polarCustomerId: string | null;
  productId: string | null;
  currentPeriodEnd: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Class {
  id: string;
  teacherId: string;
  name: string;
  joinCode: string;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type EnrollmentStatus = "active" | "removed" | "pending";

export interface ClassEnrollment {
  id: string;
  classId: string;
  studentId: string;
  status: EnrollmentStatus;
  joinedAt: string;
}

export type AssignmentKind = "writing" | "speaking" | "practice";

export interface Assignment {
  id: string;
  classId: string;
  kind: AssignmentKind;
  title: string;
  simulationId: number | null;
  taskId: string | null;
  dueAt: string | null;
  createdAt: string;
}

export type SubmissionStatus = "pending" | "submitted" | "graded";

export interface AssignmentSubmission {
  id: string;
  assignmentId: string;
  studentId: string;
  status: SubmissionStatus;
  examResultId: string | null;
  submittedAt: string | null;
  gradedAt: string | null;
  createdAt: string;
}

// --- 0009 · Sprechen (DEFERRED-Runtime) ---

export type SpeakingStatus =
  | "recorded"
  | "scored"
  | "graded"
  | "purged"
  | "failed";

export interface SpeakingAssignment {
  id: string;
  classId: string;
  teil: 1 | 2;
  promptDe: string;
  partnerMode: "peer" | "ai_fallback" | null;
  dueAt: string | null;
  createdAt: string;
}

export interface SpeakingSubmission {
  id: string;
  assignmentId: string;
  studentId: string;
  audioKey: string | null; // R2-Schlüssel; serverseitig; NULL nach Purge
  transcript: string | null;
  speechace: unknown | null;
  durationMs: number | null; // ≤ 300000 (5:00)
  status: SpeakingStatus;
  audioPurgeAt: string;
  createdAt: string;
}

export interface SpeakingGrade {
  id: string;
  submissionId: string;
  gradedBy: string;
  criteria: unknown; // {erfuellung,kohaerenz,wortschatz,strukturen,aussprache} Bänder A–E
  gesamt: number | null;
  bestanden: boolean | null;
  feedbackDe: string | null;
  releasedAt: string | null; // GATE: null = für Lernende nicht sichtbar
  gradedAt: string;
  createdAt: string;
}

// --- 0010 · Gamification (LIVE) ---

/** Fortschritts-/Gamification-Modul; Content-Skill `shared` → Modul `konnektoren`. */
export type Module = "schreiben" | "sprechen" | "konnektoren";

export interface PracticeSession {
  id: string;
  userId: string;
  lessonId: string; // makeLessonId(...) | 'review'
  module: Module;
  itemIds: string[];
  heartsStart: number;
  heartsLeft: number;
  firstTryOk: number;
  attemptedIds: string[];
  masteredIds: string[];
  pointsAwarded: number | null;
  flawless: boolean | null;
  startedAt: string;
  completedAt: string | null;
  lastActivity: string;
}

export type PointsKind =
  | "set_complete"
  | "first_try_bonus"
  | "flawless_bonus"
  | "exam"
  | "sprechen"
  | "daily_goal"
  | "streak_milestone";

export interface PointsEvent {
  id: string;
  userId: string;
  kind: PointsKind;
  points: number;
  refId: string | null;
  weekKey: string; // ISO-Woche, z.B. '2026-W27'
  createdAt: string;
}

export interface ReadinessSnapshot {
  userId: string;
  capturedOn: string; // ISO-Datum (UTC-Tag)
  overall: number; // 0..100
  schreiben: number;
  sprechen: number;
  konnektoren: number;
}

export interface SpeechPractice {
  userId: string;
  itemId: string;
  practicedAt: string;
  count: number;
}

/** Eine Zeile aus `v_readiness` (pro Modul, 0..100) für den aufrufenden Nutzer. */
export interface ReadinessModule {
  module: Module;
  score: number;
}

/** `v_daily_status` — Tagesziel + Serie für den aufrufenden Nutzer. */
export interface DailyStatus {
  goalMetToday: boolean;
  streak: number;
}

/** Rückgabe von `start_set()` (client-gemappt aus dem jsonb). */
export interface StartSetResult {
  sessionId: string;
  hearts: number;
  module: Module;
  items: { id: string; kind: "wordbank" | "cloze" }[];
}

/** `complete_set()`-Nutzlast (verschachtelt in AttemptResult.result). */
export interface SetCompletion {
  completed: boolean;
  points: number;
  flawless: boolean;
  firstTryOk?: number;
  heartsLeft?: number;
}
