// Zod-Request-Schemas für die Trusted-Server-Routen + geteilte Konstanten.
// Zentral, damit Web + Mobile + Persist dieselben Grenzen benutzen. Zod v4.
import { z } from "zod";

/** Groq-Modell für die Schreiben-Bewertung. Wird in `exam_results.model` persistiert. */
export const MODEL_ID = "openai/gpt-oss-120b";

// --- Schreiben-Prüfung (V1) ---

/** POST /api/exam/grade — ersetzt die manuelle `length>=20`-Prüfung. */
export const examGradeRequestSchema = z.object({
  taskId: z.string().min(1).max(64),
  answer: z.string().trim().min(20).max(12000),
});
export type ExamGradeRequest = z.infer<typeof examGradeRequestSchema>;

/** POST /api/exam/email (Self-Copy-Variante, JWT) — lädt die Bewertung serverseitig. */
export const examEmailRequestSchema = z.object({
  resultId: z.uuid(),
});
export type ExamEmailRequest = z.infer<typeof examEmailRequestSchema>;

/** exam_drafts Upsert (client-direkt, RLS-own) — DB-Guardrail char_length ≤ 6000. */
export const examDraftSchema = z.object({
  taskId: z.string().min(1).max(64),
  text: z.string().max(6000),
  wordCount: z.number().int().min(0).max(10000),
});
export type ExamDraftInput = z.infer<typeof examDraftSchema>;

// --- Übungsfortschritt (V1) ---

/** Argumente für den record_attempt()-RPC. `speech` ist nicht erlaubt (nichts gespeichert). */
export const exerciseAttemptSchema = z.object({
  itemId: z.string().min(1).max(128),
  lessonId: z.string().min(1).max(256),
  kind: z.enum(["wordbank", "cloze"]),
  submittedTokens: z.array(z.string().max(200)).max(64).default([]),
  durationMs: z.number().int().min(0).max(3600000).optional(),
});
export type ExerciseAttemptInput = z.infer<typeof exerciseAttemptSchema>;

// --- Konto (V1) ---

export const resetProgressSchema = z.object({
  includeExamHistory: z.boolean().default(false),
});

// --- Sprechen (Teacher-LMS · teacher-lms/04 §3.1) ---

/**
 * POST /api/speaking/submit — Body ist NUR `{assignmentId}` (04 §3.1): der Server
 * generiert den audio_key, pinnt Content-Type/-Length beim R2-Presign und prüft
 * die Dauer serverseitig per ffprobe neu (Client-Dauer wird nie vertraut).
 * (Reconciled aus der mobile-v1-Skizze mit durationMs/contentType — beide werden
 * vom Teacher-LMS-Kontrakt nicht benutzt und wären ein Trust-Footgun.)
 */
export const speakingSubmitSchema = z.object({
  assignmentId: z.uuid(),
});
export type SpeakingSubmitInput = z.infer<typeof speakingSubmitSchema>;

export const speakingGradeSchema = z.object({
  submissionId: z.uuid(),
  criteria: z.object({
    erfuellung: z.enum(["A", "B", "C", "D", "E"]),
    kohaerenz: z.enum(["A", "B", "C", "D", "E"]),
    wortschatz: z.enum(["A", "B", "C", "D", "E"]),
    strukturen: z.enum(["A", "B", "C", "D", "E"]),
    aussprache: z.enum(["A", "B", "C", "D", "E"]),
  }),
  feedbackDe: z.string().max(4000).optional(),
  release: z.boolean().default(false),
});
export type SpeakingGradeInput = z.infer<typeof speakingGradeSchema>;
