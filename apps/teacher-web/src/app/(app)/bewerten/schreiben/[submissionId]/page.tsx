import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { resolveWritingTask } from "@/lib/resolveWritingTask";
import { WRITING_CRITERION_KEYS } from "@repo/core";
import type { CriterionBand, CriterionKey } from "@repo/types";
import { SchreibenReviewClient } from "@/components/review/SchreibenReviewClient";
import { relativeDe } from "@/lib/format";

export const dynamic = "force-dynamic";

type ExamGradeLike = {
  criteria?: Array<{ key: CriterionKey; band: CriterionBand; begruendungDe?: string }>;
  korrekturen?: unknown;
};

function buildInitialBands(
  final: ExamGradeLike | null,
  ai: Partial<Record<CriterionKey, CriterionBand>>
): Record<CriterionKey, CriterionBand> {
  const base: Record<CriterionKey, CriterionBand> = {
    erfuellung: "C",
    kohaerenz: "C",
    wortschatz: "C",
    strukturen: "C",
  };
  const src: Partial<Record<CriterionKey, CriterionBand>> = final?.criteria
    ? (Object.fromEntries(final.criteria.map((c) => [c.key, c.band])) as Partial<Record<CriterionKey, CriterionBand>>)
    : ai;
  for (const k of WRITING_CRITERION_KEYS) {
    const v = src[k as CriterionKey];
    if (v) base[k as CriterionKey] = v;
  }
  return base;
}

export default async function SchreibenReviewPage({ params }: { params: Promise<{ submissionId: string }> }) {
  const { submissionId } = await params;
  await requireAuth(`/bewerten/schreiben/${submissionId}`);
  const sb = await supabaseServer();

  const { data: submission } = await sb
    .from("assignment_submissions")
    .select("id, assignment_id, student_id, answer_text, word_count, status, submitted_at")
    .eq("id", submissionId)
    .maybeSingle();
  if (!submission || !submission.answer_text) notFound();

  const { data: assignment } = await sb
    .from("assignments")
    .select("id, class_id, title, kind, task_id, prompt_de, bullet_points_de, min_words")
    .eq("id", submission.assignment_id)
    .maybeSingle();
  if (!assignment || assignment.kind !== "writing") notFound();

  const task = await resolveWritingTask({
    id: assignment.id,
    task_id: assignment.task_id,
    prompt_de: assignment.prompt_de,
    bullet_points_de: assignment.bullet_points_de ?? [],
    min_words: assignment.min_words,
  });
  if (!task) notFound();

  const [{ data: cls }, { data: prof }, { data: rec }, { data: grade }] = await Promise.all([
    sb.from("classes").select("name").eq("id", assignment.class_id).maybeSingle(),
    sb.from("profiles").select("display_name").eq("id", submission.student_id).maybeSingle(),
    sb.from("assignment_ai_recommendations").select("recommended").eq("submission_id", submissionId).maybeSingle(),
    sb.from("assignment_grades").select("final, teacher_remark_de, released_at").eq("submission_id", submissionId).maybeSingle(),
  ]);

  const aiGrade = (rec?.recommended ?? null) as ExamGradeLike | null;
  const aiBands: Partial<Record<CriterionKey, CriterionBand>> = {};
  const aiBegruendung: Partial<Record<CriterionKey, string>> = {};
  for (const c of aiGrade?.criteria ?? []) {
    aiBands[c.key] = c.band;
    if (c.begruendungDe) aiBegruendung[c.key] = c.begruendungDe;
  }
  const aiKorrekturen = Array.isArray(aiGrade?.korrekturen)
    ? (aiGrade!.korrekturen as unknown[]).filter((x): x is string => typeof x === "string")
    : [];

  const finalGrade = (grade?.final ?? null) as ExamGradeLike | null;
  const initialBands = buildInitialBands(finalGrade, aiBands);

  return (
    <SchreibenReviewClient
      submissionId={submission.id}
      student={prof?.display_name?.trim() || "Teilnehmende:r"}
      klasse={cls?.name ?? "—"}
      when={relativeDe(submission.submitted_at)}
      aufgabe={task.aufgabe}
      aufgabeTitle={task.titleDe || assignment.title}
      aufgabenstellung={task.promptDe}
      leitpunkte={task.bulletPointsDe ?? []}
      essay={submission.answer_text}
      wordCount={submission.word_count}
      minWords={task.minWords}
      aiBands={Object.keys(aiBands).length ? aiBands : null}
      aiBegruendung={aiBegruendung}
      aiKorrekturen={aiKorrekturen}
      initialBands={initialBands}
      initialRemark={grade?.teacher_remark_de ?? ""}
      released={!!grade?.released_at}
    />
  );
}
