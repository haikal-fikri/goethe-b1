import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { SPEAKING_CRITERION_KEYS, type SpeakingCriterionKey } from "@repo/core";
import type { CriterionBand } from "@repo/types";
import { SprechenReviewClient } from "@/components/review/SprechenReviewClient";
import { relativeDe } from "@/lib/format";

export const dynamic = "force-dynamic";

const BAND_SET = new Set(["A", "B", "C", "D", "E"]);
const isBand = (x: unknown): x is CriterionBand => typeof x === "string" && BAND_SET.has(x);
const isKey = (x: unknown): x is SpeakingCriterionKey =>
  typeof x === "string" && (SPEAKING_CRITERION_KEYS as string[]).includes(x);

/** Extrahiert defensiv Bänder + Begründungen aus der KI-Empfehlung (criteria[] ODER Map). */
function extractAi(recommended: unknown): {
  bands: Partial<Record<SpeakingCriterionKey, CriterionBand>>;
  begr: Partial<Record<SpeakingCriterionKey, string>>;
} {
  const bands: Partial<Record<SpeakingCriterionKey, CriterionBand>> = {};
  const begr: Partial<Record<SpeakingCriterionKey, string>> = {};
  if (!recommended || typeof recommended !== "object") return { bands, begr };
  const rec = recommended as Record<string, unknown>;
  if (Array.isArray(rec.criteria)) {
    for (const c of rec.criteria as Array<Record<string, unknown>>) {
      if (isKey(c.key) && isBand(c.band)) {
        bands[c.key] = c.band;
        if (typeof c.begruendungDe === "string") begr[c.key] = c.begruendungDe;
      }
    }
  } else {
    for (const k of SPEAKING_CRITERION_KEYS) if (isBand(rec[k])) bands[k] = rec[k] as CriterionBand;
  }
  return { bands, begr };
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s;
}

export default async function SprechenReviewPage({ params }: { params: Promise<{ submissionId: string }> }) {
  const { submissionId } = await params;
  await requireAuth(`/bewerten/sprechen/${submissionId}`);
  const sb = await supabaseServer();

  const { data: submission } = await sb
    .from("speaking_submissions")
    .select("id, assignment_id, student_id, transcript, duration_ms, status, created_at")
    .eq("id", submissionId)
    .maybeSingle();
  if (!submission) notFound();

  const { data: assignment } = await sb
    .from("speaking_assignments")
    .select("id, teil, prompt_de, class_id")
    .eq("id", submission.assignment_id)
    .maybeSingle();
  if (!assignment) notFound();

  const [{ data: cls }, { data: prof }, { data: rec }, { data: grade }] = await Promise.all([
    sb.from("classes").select("name").eq("id", assignment.class_id).maybeSingle(),
    sb.from("profiles").select("display_name").eq("id", submission.student_id).maybeSingle(),
    sb.from("speaking_ai_recommendations").select("recommended").eq("submission_id", submissionId).maybeSingle(),
    sb.from("speaking_grades").select("criteria, feedback_de, released_at").eq("submission_id", submissionId).maybeSingle(),
  ]);

  const { bands: aiBands, begr: aiBegruendung } = extractAi(rec?.recommended);

  // Anfangs-Bänder (5): bestehende Note > KI (4 Inhalt) > Default 'C'.
  const initialBands = {
    erfuellung: "C",
    kohaerenz: "C",
    wortschatz: "C",
    strukturen: "C",
    aussprache: "C",
  } as Record<SpeakingCriterionKey, CriterionBand>;
  const gradeCriteria = (grade?.criteria ?? null) as Record<string, unknown> | null;
  for (const k of SPEAKING_CRITERION_KEYS) {
    if (gradeCriteria && isBand(gradeCriteria[k])) initialBands[k] = gradeCriteria[k] as CriterionBand;
    else if (aiBands[k]) initialBands[k] = aiBands[k]!;
  }

  const teil = assignment.teil ?? 2;
  const prompt = assignment.prompt_de ?? "";

  return (
    <SprechenReviewClient
      submissionId={submission.id}
      student={prof?.display_name?.trim() || "Teilnehmende:r"}
      klasse={cls?.name ?? "—"}
      when={relativeDe(submission.created_at)}
      aufgabeTitle={prompt ? `Teil ${teil}: ${truncate(prompt, 30)}` : `Sprechen · Teil ${teil}`}
      aufgabenstellung={prompt}
      stichpunkte={[]}
      transcript={submission.transcript ?? ""}
      durationMs={submission.duration_ms ?? null}
      aiBands={Object.keys(aiBands).length ? aiBands : null}
      aiBegruendung={aiBegruendung}
      initialBands={initialBands}
      initialFeedback={grade?.feedback_de ?? ""}
      released={!!grade?.released_at}
    />
  );
}
