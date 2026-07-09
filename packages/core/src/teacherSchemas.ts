// Zod-Request-Schemas für die Teacher-LMS-Routen (Vercel B · apps/teacher-web)
// und den Superadmin (Vercel C · apps/admin). Zentral in @repo/core, damit die
// Routen (Phase 3) und die Klienten (Phase 5) DIESELBEN Grenzen benutzen.
//
// Reihenfolge folgt dem Endpoint-Katalog aus teacher-lms/03 §1. Jede Grenze ist
// dort begründet; abweichende Feldnamen sind unten am Schema kommentiert.
// Sprechen-Submit/-Grade leben weiterhin in ./requestSchemas (dort seit mobile-v1);
// hier nur, was die Lehrer-Phase NEU hinzufügt. Zod v4 (`z.uuid()`/`z.email()` top-level).
import { z } from "zod";
import { korrekturSchema } from "./examSchema";

/** Kriteriums-Band A–E — geteilt über alle Bewertungs-Schemas. */
export const bandEnum = z.enum(["A", "B", "C", "D", "E"]);
export type Band = z.infer<typeof bandEnum>;

// ── Schreiben: Einreichen + Bewerten (03 §2.3/§2.5, 04 §2.3) ────────────────

/**
 * POST /api/assignments/:id/submit — Schüler:in reicht den Aufsatz ein.
 * Feldname `answerText` (== DB-Spalte `answer_text`, 03 §2.3); Mindestlänge 20
 * (04 §2.3 — kürzer ist nicht bewertbar; deckt sich mit examGradeRequestSchema).
 */
export const submitWritingSchema = z.object({
  answerText: z
    .string()
    .trim()
    .min(20, "Der Text ist zu kurz für eine Bewertung.")
    .max(8000, "Der Text ist zu lang."),
});
export type SubmitWritingInput = z.infer<typeof submitWritingSchema>;

/**
 * POST /api/assignments/grade — Lehrkraft (oder TA) trägt die finalen Bänder ein.
 * `korrekturen` ist NIE optional (04 §2.4) — leer erlaubt; der Server prüft jede
 * Span-Verankerung gegen den GESPEICHERTEN answer_text (Trust-Boundary, 04 §2.4).
 * `teacherRemarkDe` == DB-Spalte `teacher_remark_de` (04 §2.3). Punkte werden NICHT
 * hier übergeben — der Server rechnet sie aus den Bändern (pointsFromBands).
 */
export const gradeWritingSchema = z.object({
  submissionId: z.uuid(),
  bands: z.object({
    erfuellung: bandEnum,
    kohaerenz: bandEnum,
    wortschatz: bandEnum,
    strukturen: bandEnum,
  }),
  korrekturen: z.array(korrekturSchema).max(200).default([]),
  teacherRemarkDe: z.string().trim().max(4000).optional(),
  release: z.boolean().default(true),
});
export type GradeWritingInput = z.infer<typeof gradeWritingSchema>;

// ── Sprechen: Finalisieren (03 §2.6 / 04 §3.1) ──────────────────────────────
// submit/grade: siehe ./requestSchemas (speakingSubmitSchema/speakingGradeSchema).

/** POST /api/speaking/finalize — nach dem R2-Upload; startet ffprobe + Whisper. */
export const speakingFinalizeSchema = z.object({
  submissionId: z.uuid(),
});
export type SpeakingFinalizeInput = z.infer<typeof speakingFinalizeSchema>;

// ── Klasse: Einladung / Entfernen / Termin absagen (03 §2.1/§2.2) ───────────

/** POST /api/class/invite — bis zu 50 E-Mails pro Anfrage (03 §2.1). */
export const inviteSchema = z.object({
  classId: z.uuid(),
  emails: z
    .array(z.email("Ungültige E-Mail-Adresse."))
    .min(1, "Mindestens eine E-Mail-Adresse angeben.")
    .max(50, "Höchstens 50 Adressen pro Einladung."),
});
export type InviteInput = z.infer<typeof inviteSchema>;

/** POST /api/class/sessions/:id/cancel — Grund optional, ≤500 Zeichen (03 §2.2). */
export const cancelSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});
export type CancelInput = z.infer<typeof cancelSchema>;

/** POST /api/class/remove-student (03 §1 #6). */
export const removeStudentSchema = z.object({
  classId: z.uuid(),
  studentId: z.uuid(),
});
export type RemoveStudentInput = z.infer<typeof removeStudentSchema>;

// ── Abrechnung (03 §2.7, 05 §1.2) ───────────────────────────────────────────

/** POST /api/billing/checkout — Plan-Wahl; product_id wird serverseitig gemappt. */
export const checkoutSchema = z.object({
  plan: z.enum(["starter", "pro"]),
});
export type CheckoutInput = z.infer<typeof checkoutSchema>;

// ── Pro-Organisation: Sitz-Einladung (03 §2.11, 05 §2.4) ────────────────────

/** POST /api/org/invite — Owner stellt Lehrer-Sitze bereit; ≤20 pro Anfrage. */
export const orgInviteSchema = z.object({
  orgId: z.uuid(),
  emails: z
    .array(z.email("Ungültige E-Mail-Adresse."))
    .min(1, "Mindestens eine E-Mail-Adresse angeben.")
    .max(20, "Höchstens 20 Adressen pro Einladung."),
});
export type OrgInviteInput = z.infer<typeof orgInviteSchema>;

// ── Compliance + Feedback (03 §2.10) ────────────────────────────────────────

/**
 * POST /api/onboarding/accept-dpa — kein Nutzdaten-Body: die DPA-Version kommt
 * serverseitig aus CURRENT_DPA_VERSION. Schema erzwingt nur einen leeren Body.
 */
export const acceptDpaSchema = z.object({}).strict();
export type AcceptDpaInput = z.infer<typeof acceptDpaSchema>;

/**
 * POST /api/consent — Erziehungsberechtigten-Einwilligung (Stimme). `studentId`
 * weggelassen ⇒ auth.uid() (Guardian-Self); von der Lehrkraft gesetzt ⇒ Papierbeleg.
 * `method` z.B. 'in_app' | 'paper' (freies Kürzel, ≤64).
 */
export const consentSchema = z.object({
  studentId: z.uuid().optional(),
  status: z.enum(["granted", "withdrawn"]),
  method: z.string().trim().min(1).max(64),
});
export type ConsentInput = z.infer<typeof consentSchema>;

/** POST /api/exam-feedback — Lehrkraft-Feedback zu einem Built-in-Sim-Ergebnis. */
export const examFeedbackSchema = z.object({
  examResultId: z.uuid(),
  feedbackDe: z.string().trim().min(1).max(4000),
  release: z.boolean().default(true),
});
export type ExamFeedbackInput = z.infer<typeof examFeedbackSchema>;

// ── Superadmin (Vercel C · 05 §5) ───────────────────────────────────────────

/**
 * POST /api/admin/grant-role — die gefährlichste Route (Selbst-Eskalation).
 * Nur `teacher`/`admin`; Aufrufer muss bereits admin sein (Route-Guard), jeder
 * Aufruf wird auditiert (05 §5). Setzt auth.users.app_metadata.role.
 */
export const grantRoleSchema = z.object({
  targetUserId: z.uuid(),
  role: z.enum(["teacher", "admin"]),
});
export type GrantRoleInput = z.infer<typeof grantRoleSchema>;
