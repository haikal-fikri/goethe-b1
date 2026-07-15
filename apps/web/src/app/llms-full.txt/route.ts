import { functionRank } from "@repo/core";
import { getAllItems } from "@/lib/redemittel";
import { SKILL_LABEL } from "@/lib/ui";
import { siteUrl } from "@/lib/site";
import { LEVEL_RANK } from "@/types";
import type { RedemittelItem, SkillCode } from "@/types";

// Serviert /llms-full.txt: der vollständige Redemittel-Korpus als flache
// Textdatei (Deutsch → Englisch, mit Niveau + Beispielen). Ergänzt /llms.txt für
// Agenten, die den ganzen Inhalt lesen wollen (maximiert korrekte Zitierbarkeit
// durch ChatGPT/Perplexity). Dynamisch aus der DB — die einzige Wahrheitsquelle.
export const dynamic = "force-dynamic";

const SKILL_ORDER: SkillCode[] = ["schreiben", "sprechen", "shared"];

function build(base: string, items: RedemittelItem[]): string {
  const lines: string[] = [];
  lines.push("# B1+Trainer — Full Redemittel content");
  lines.push("");
  lines.push(
    `> The complete corpus of ${items.length} Redemittel (functional set-phrases) ` +
      `for the German Goethe-Zertifikat B1 exam, German → English, with CEFR level, ` +
      `sentence frame and example sentences. This is the source of truth behind the ` +
      `/lernen reference. The product UI is in German. Curated by Digi.S — Digital ` +
      `Sprache Stiftung. Canonical site: ${base}`
  );
  lines.push("");
  lines.push(
    `Grouping: skill → exam task → communicative function. Level tags: B1, B2, C1, C2. ` +
      `See ${base}/llms.txt for the site overview.`
  );

  // skill → task(code) → function(code) → items
  const bySkill = new Map<SkillCode, RedemittelItem[]>();
  for (const it of items) {
    if (!bySkill.has(it.skill)) bySkill.set(it.skill, []);
    bySkill.get(it.skill)!.push(it);
  }

  const skills = [...bySkill.keys()].sort(
    (a, b) => SKILL_ORDER.indexOf(a) - SKILL_ORDER.indexOf(b)
  );

  for (const skill of skills) {
    const skillItems = bySkill.get(skill)!;
    lines.push("");
    lines.push(`## ${SKILL_LABEL[skill] ?? skill}`);

    // Aufgaben in kanonischer Reihenfolge (Aufgabe-Code).
    const taskCodes = [...new Set(skillItems.map((i) => i.task.code))].sort((a, b) =>
      a.localeCompare(b)
    );

    for (const taskCode of taskCodes) {
      const taskItems = skillItems.filter((i) => i.task.code === taskCode);
      lines.push("");
      lines.push(`### ${taskItems[0].task.labelDe}`);

      // Funktionen in didaktischer Reihenfolge (functionRank), dann alphabetisch.
      const fnCodes = [...new Set(taskItems.map((i) => i.function.code))].sort(
        (a, b) =>
          functionRank(taskCode, a) - functionRank(taskCode, b) || a.localeCompare(b)
      );

      for (const fnCode of fnCodes) {
        const fnItems = taskItems
          .filter((i) => i.function.code === fnCode)
          // Wendungen aufsteigend nach Niveau, dann Schwierigkeit.
          .sort(
            (a, b) => LEVEL_RANK[a.level] - LEVEL_RANK[b.level] || a.difficulty - b.difficulty
          );

        const fn = fnItems[0].function;
        lines.push("");
        lines.push(`#### ${fn.nameDe}${fn.nameEn ? ` (${fn.nameEn})` : ""}`);

        for (const it of fnItems) {
          lines.push(`- "${it.phrase}" → ${it.translation} [${it.level}]`);
          if (it.frame) lines.push(`  frame: ${it.frame}`);
          for (const ex of (it.examples ?? []).slice(0, 2)) {
            lines.push(`  e.g. ${ex.de}${ex.en ? ` — ${ex.en}` : ""}`);
          }
        }
      }
    }
  }

  lines.push("");
  return lines.join("\n");
}

export async function GET() {
  const base = siteUrl.replace(/\/$/, "");
  let items: RedemittelItem[] = [];
  try {
    items = await getAllItems();
  } catch {
    // DB nicht erreichbar → kurzer Fallback statt 500.
    return new Response(
      `# B1+Trainer — Full Redemittel content\n\n> Content is temporarily unavailable. ` +
        `See ${base}/llms.txt for the site overview and ${base}/lernen for the reference.\n`,
      {
        status: 200,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "public, max-age=60",
        },
      }
    );
  }

  return new Response(build(base, items), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control":
        "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
    },
  });
}
