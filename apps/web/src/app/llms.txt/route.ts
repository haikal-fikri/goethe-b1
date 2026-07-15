import { getStats } from "@repo/core";
import { getAllItems } from "@/lib/redemittel";
import { siteUrl } from "@/lib/site";

// Serviert /llms.txt (llmstxt.org-Standard): eine kuratierte, maschinenlesbare
// Kurzbeschreibung der Seite für LLM-/Agent-Crawler. Dynamisch aus der DB
// gebaut (die DB ist die einzige Wahrheitsquelle) und aus siteUrl — analog zu
// robots.ts/sitemap.ts. Fällt bei DB-Fehlern auf statische Zahlen zurück, damit
// ein Crawler nie einen 500er sieht.
export const dynamic = "force-dynamic";

interface Stats {
  total: number;
  byLevel: Record<string, number>;
  bySkill: Record<string, number>;
}

// Stand der letzten bekannten Zählung — nur der Fallback, wenn die DB klemmt.
const FALLBACK: Stats = {
  total: 414,
  byLevel: { B1: 126, B2: 126, C1: 108, C2: 54 },
  bySkill: { schreiben: 222, sprechen: 118, shared: 74 },
};

function n(stats: Stats, rec: "byLevel" | "bySkill", key: string): number {
  return stats[rec][key] ?? 0;
}

function build(base: string, stats: Stats): string {
  const lvl = (k: string) => n(stats, "byLevel", k);
  const sk = (k: string) => n(stats, "bySkill", k);

  return `# Satzwerk — German exam Redemittel & sentence-building trainer

> Free, ad-free web app for training Redemittel (functional set-phrases) for the
> German Goethe-Zertifikat B1 exam, focused on Schreiben (writing) and Sprechen
> (speaking). Given an English meaning, learners reconstruct the correct German
> sentence from a scrambled word bank or fill cloze gaps — active production,
> not passive flashcards. Includes an AI writing examiner that grades against the
> four official Goethe criteria. The product UI and content are in German.

Satzwerk is built by Digital Sprache Institut. It contains ${stats.total}
curated Redemittel spanning CEFR levels B1 to C2 (${lvl("B1")} B1, ${lvl("B2")} B2,
${lvl("C1")} C1, ${lvl("C2")} C2), organised by exam task and by communicative
function — such as opening an email, giving and justifying an opinion, agreeing
and disagreeing, making proposals, concluding, and connectors (Konnektoren).
Coverage by skill: Schreiben (${sk("schreiben")}), Sprechen (${sk("sprechen")}),
and shared connectors (${sk("shared")}).

What makes the method distinctive: rather than recognition drills, each item shows
the English translation and asks the learner to rebuild the exact German sentence
from a word bank, or to drag phrases into cloze blanks. After each attempt the app
reveals the sentence frame, grammar and pragmatic notes, and contextual example
sentences — so the structure is noticed, not just recognised.

The AI examiner (/pruefen) simulates the Goethe B1 writing exam and grades a
submitted text against the four official criteria — Erfüllung (task achievement),
Kohärenz (coherence), Wortschatz (vocabulary) and Strukturen (structures) — on A–E
bands with the official 60% pass threshold. It uses a "four-eyes" approach: two
independent examiner passes plus a tie-breaker when they disagree.

Satzwerk is free and pay-what-you-want, mobile-first, and also ships as native
iOS and Android apps.

## Practice & reference
- [Üben — Practice](${base}/): word-bank and cloze exercises, filterable by skill and CEFR level.
- [Lernen — Reference](${base}/lernen): searchable list of all ${stats.total} Redemittel with English translations, grouped by exam task and communicative function.
- [Schreiben · KI-Prüfer — AI writing examiner](${base}/pruefen): write a Goethe B1 exam text and get AI feedback on the four official criteria.

## About
- [Pay what you want](${base}/pay): a voluntary contribution that keeps the app free and ad-free (a payment for use, not a tax-deductible donation).

## Common questions
- Is Satzwerk free? Yes — it is completely free and ad-free, funded by voluntary pay-what-you-want contributions.
- What is a Redemittel? A Redemittel (plural Redemittel) is a ready-made functional phrase or "chunk" used for a specific communicative purpose — opening an email, giving an opinion, agreeing, proposing, concluding. Redemittel are the building blocks that the Goethe B1 Schreiben and Sprechen exams reward.
- How does Satzwerk help me prepare for the Goethe-Zertifikat B1? You practise the exact phrases examiners look for by actively rebuilding them from a word bank, then test a full writing task in a simulated exam that is graded by AI on the four official criteria.
- How does the AI exam grading work? It grades your text against Erfüllung (task achievement), Kohärenz (coherence), Wortschatz (vocabulary) and Strukturen (structures) on A–E bands, with the official 60% pass threshold, using two independent examiner passes plus a tie-breaker.
- Which levels does it cover? CEFR B1 through C2, so the material stretches well beyond the minimum needed to pass B1.
- Is there a mobile app? Yes — native iOS and Android apps, in addition to the web app.
- Who makes it? Digital Sprache Institut, a provider of digital German-language learning.

## Optional
- [Full content export](${base}/llms-full.txt): every Redemittel with its English translation, CEFR level and example sentences.
- [Sitemap](${base}/sitemap.xml)
`;
}

export async function GET() {
  const base = siteUrl.replace(/\/$/, "");
  let stats: Stats = FALLBACK;
  try {
    stats = getStats(await getAllItems());
  } catch {
    // DB nicht erreichbar → statischer Fallback, kein 500 für den Crawler.
  }

  return new Response(build(base, stats), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control":
        "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
    },
  });
}
