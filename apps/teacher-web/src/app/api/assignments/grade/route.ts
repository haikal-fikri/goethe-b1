import { apiError, gradeWritingSchema, pointsFromBands } from "@repo/core";
import { CRITERION_LABEL } from "@repo/types";
import { requireTeacher, parseJson, ok } from "@/lib/guard";
import { supabaseService } from "@/lib/supabaseServer";
import { enforce } from "@/lib/ratelimit";
import { newRequestId, log } from "@/lib/log";
import { resolveWritingTask } from "@/lib/resolveWritingTask";
import { pushToUser } from "@/lib/push";

// POST /api/assignments/grade — Lehrkraft/TA trägt die finalen Bänder + inline
// Korrekturen ein; Punkte werden SERVERSEITIG aus den Bändern neu berechnet
// (nie vom Client). Grader-gated (is_submission_grader → Leads UND TAs).
// teacher-lms/04 §2.3/§2.4.
export const runtime = "nodejs";

interface SubmissionRow {
  id: string;
  assignment_id: string;
  student_id: string;
  answer_text: string | null;
  status: string;
}
interface AssignmentRow {
  id: string;
  class_id: string;
  task_id: string | null;
  prompt_de: string | null;
  bullet_points_de: string[];
  min_words: number | null;
}

export async function POST(req: Request) {
  const requestId = newRequestId();
  const ctx = await requireTeacher(req, requestId);
  if (ctx instanceof Response) return ctx;

  const parsed = await parseJson(req, gradeWritingSchema, requestId);
  if (parsed instanceof Response) return parsed;
  const { submissionId, bands, korrekturen, teacherRemarkDe, release } = parsed;

  // Grader-Autorisierung (Lead/Creator/Owner ODER TA) — über den NUTZER-Client,
  // damit auth.uid() greift; is_submission_grader ist an authenticated granted.
  const { data: allowed, error: authErr } = await ctx.supabase.rpc("is_submission_grader", {
    _submission: submissionId,
  });
  if (authErr || !allowed) {
    return apiError(403, "forbidden", "Keine Bewertungsberechtigung für diese Abgabe.", { requestId });
  }

  const rl = await enforce("gradeTeacher", ctx.user.id);
  if (!rl.ok) {
    return apiError(429, "rate_limited", "Zu viele Bewertungen. Bitte kurz warten.", {
      requestId,
      retryAfter: rl.retryAfterSec,
    });
  }

  const svc = supabaseService();

  // Abgabe (autoritativer answer_text — Trust-Boundary für die Korrektur-Spans).
  const { data: submission } = await svc
    .from("assignment_submissions")
    .select("id, assignment_id, student_id, answer_text, status")
    .eq("id", submissionId)
    .maybeSingle<SubmissionRow>();
  if (!submission) return apiError(404, "not_found", "Abgabe nicht gefunden.", { requestId });
  if (submission.status === "pending" || !submission.answer_text) {
    return apiError(409, "conflict", "Diese Abgabe wurde noch nicht eingereicht.", { requestId });
  }
  const answerText = submission.answer_text;

  // Aufgabe auflösen (Korpus 1|2|3 / Custom 2) → treibt die Punkteskala.
  const { data: assignment } = await svc
    .from("assignments")
    .select("id, class_id, task_id, prompt_de, bullet_points_de, min_words")
    .eq("id", submission.assignment_id)
    .maybeSingle<AssignmentRow>();
  if (!assignment) return apiError(404, "not_found", "Aufgabe nicht gefunden.", { requestId });
  const task = await resolveWritingTask(assignment);
  if (!task) return apiError(409, "conflict", "Aufgabe konnte nicht aufgelöst werden.", { requestId });

  // Korrekturen gegen den GESPEICHERTEN answer_text prüfen (04 §2.4): Offsets +
  // exakter Quote. Ein Drift ⇒ 422 (nie eine Client-Länge/Quote vertrauen).
  const len = answerText.length;
  for (const k of korrekturen) {
    if (
      !Number.isInteger(k.start) ||
      !Number.isInteger(k.end) ||
      k.start < 0 ||
      k.end <= k.start ||
      k.end > len ||
      answerText.slice(k.start, k.end) !== k.quote
    ) {
      return apiError(422, "validation_failed", "Eine Korrektur passt nicht mehr zum Text.", { requestId });
    }
  }

  // Punkte SERVERSEITIG aus den Bändern (nie vom Client).
  const recompute = pointsFromBands(task.aufgabe, bands);
  const final = {
    aufgabe: task.aufgabe,
    criteria: recompute.criteria.map((c) => ({
      key: c.key,
      labelDe: CRITERION_LABEL[c.key],
      band: c.band,
      punkte: c.punkte,
      maxPunkte: c.maxPunkte,
      begruendungDe: "",
    })),
    gesamtpunkte: recompute.gesamtpunkte,
    maxPunkte: recompute.maxPunkte,
    bestanden: recompute.bestanden,
    summaryDe: teacherRemarkDe ?? "",
    inlineKorrekturen: korrekturen, // D14 span-anchored (assignment_grades.final.inlineKorrekturen)
  };

  const releasedAt = release ? new Date().toISOString() : null;
  const { error: gradeErr } = await svc.from("assignment_grades").upsert(
    {
      submission_id: submissionId,
      final,
      gesamtpunkte: recompute.gesamtpunkte,
      max_punkte: recompute.maxPunkte,
      bestanden: recompute.bestanden,
      teacher_remark_de: teacherRemarkDe ?? null,
      graded_by: ctx.user.id,
      graded_at: new Date().toISOString(),
      released_at: releasedAt,
    },
    { onConflict: "submission_id" }
  );
  if (gradeErr) {
    log("assignments/grade.persist", { requestId, submissionId, ok: false, err: gradeErr.message });
    return apiError(500, "internal_error", "Bewertung konnte nicht gespeichert werden.", { requestId });
  }

  // status='graded' NUR bei Freigabe (Entwurf: bleibt 'submitted', released_at=null
  // hält die Note ohnehin unsichtbar). Bewusste, kommentierte Abweichung von 03 §2.5.
  if (release) {
    await svc
      .from("assignment_submissions")
      .update({ status: "graded", graded_at: new Date().toISOString() })
      .eq("id", submissionId);

    await svc.rpc("notify", {
      p_user: submission.student_id,
      p_kind: "assignment_graded",
      p_title: "Deine Aufgabe wurde bewertet",
      p_body: recompute.bestanden ? "Bestanden ✅" : "Feedback verfügbar",
      p_data: {
        classId: assignment.class_id,
        assignmentId: assignment.id,
        submissionId,
      },
    });
    await pushToUser(submission.student_id, {
      title: "Deine Aufgabe wurde bewertet",
      body: "Tippe, um dein Feedback zu sehen.",
      data: { assignmentId: assignment.id, submissionId },
    });
  }

  log("assignments/grade", { requestId, submissionId, released: release, bestanden: recompute.bestanden });
  return ok({ released: release, gesamtpunkte: recompute.gesamtpunkte, bestanden: recompute.bestanden }, requestId);
}
