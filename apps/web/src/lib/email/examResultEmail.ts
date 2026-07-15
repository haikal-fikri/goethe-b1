import { z } from "zod";
import type { CriterionBand } from "@/types";

// Validierung der E-Mail-Nutzlast (Client → /api/exam/email). Größen sind
// gedeckelt, um Missbrauch (Spam-Relay) zu begrenzen. Die Bewertungsdaten kommen
// im MVP vom Client (siehe Plan: "trust browser data").
const recipientsSchema = z.object({
  studentEmail: z.email(),
  teacherEmail: z.email(),
  studentName: z.string().trim().max(120).optional(),
  teacherName: z.string().trim().max(120).optional(),
});

const criterionSchema = z.object({
  key: z.enum(["erfuellung", "kohaerenz", "wortschatz", "strukturen"]),
  labelDe: z.string().max(120),
  band: z.enum(["A", "B", "C", "D", "E"]),
  punkte: z.number(),
  maxPunkte: z.number(),
  begruendungDe: z.string().max(4000),
});

const gradeSchema = z.object({
  aufgabe: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  criteria: z.array(criterionSchema).min(1).max(8),
  gesamtpunkte: z.number(),
  maxPunkte: z.number(),
  bestanden: z.boolean(),
  summaryDe: z.string().max(8000),
  korrekturen: z.array(z.string().max(2000)).max(20).optional(),
});

const examinerSchema = z.object({
  label: z.enum(["mild", "streng", "konsens"]),
  grade: gradeSchema,
});

const taskSchema = z.object({
  titleDe: z.string().max(300),
  taskType: z.string().max(120),
  aufgabe: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  promptDe: z.string().max(8000),
  bulletPointsDe: z.array(z.string().max(500)).max(20).optional(),
  minWords: z.number(),
});

export const examEmailSchema = z.object({
  recipients: recipientsSchema,
  task: taskSchema,
  essay: z.string().trim().min(1).max(12000),
  grade: gradeSchema,
  examiners: z.array(examinerSchema).max(3).optional(),
  thirdUsed: z.boolean().optional(),
});

export type ExamEmailPayload = z.infer<typeof examEmailSchema>;

// --- Rendering ---------------------------------------------------------------

/** HTML-escapen — Pflicht, da wir HTML per String-Konkatenation bauen. */
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Escapen + Zeilenumbrüche in <br> wandeln (z.B. für den Aufsatztext). */
function escMultiline(s: string): string {
  return esc(s).replace(/\r?\n/g, "<br>");
}

/** Punkte mit deutschem Dezimalkomma, z.B. 7.5 → "7,5" (wie in ExamRunner). */
function fmtPunkte(n: number): string {
  return n.toLocaleString("de-DE", { maximumFractionDigits: 1 });
}

// Palette: Markenfarbtöne, aber kontraststark auf hellem E-Mail-Hintergrund
// gewählt (E-Mail-Clients unterstützen kein var() und erzwingen oft Light-Mode).
const C = {
  pageBg: "#f4f4f5",
  cardBg: "#ffffff",
  border: "#e4e4e7",
  text: "#1a1a1a",
  muted: "#52525b",
  dim: "#71717a",
  accent: "#a87b1d", // dunkleres Gold, lesbar auf Weiß (UI-Akzent: #e8c468)
  okText: "#15803d",
  okBg: "#dcfce7",
  badText: "#b91c1c",
  badBg: "#fde2e2",
  goldText: "#92700f",
  goldBg: "#fdf0cf",
} as const;

function bandColors(band: CriterionBand): { text: string; bg: string } {
  if (band === "A" || band === "B") return { text: C.okText, bg: C.okBg };
  if (band === "C") return { text: C.goldText, bg: C.goldBg };
  return { text: C.badText, bg: C.badBg }; // D, E
}

function bandChip(band: CriterionBand): string {
  const { text, bg } = bandColors(band);
  return `<span style="display:inline-block;min-width:18px;text-align:center;font-weight:700;font-size:12px;color:${text};background:${bg};border-radius:999px;padding:2px 7px;">${esc(
    band
  )}</span>`;
}

function badge(bestanden: boolean): string {
  const text = bestanden ? C.okText : C.badText;
  const bg = bestanden ? C.okBg : C.badBg;
  const label = bestanden ? "bestanden" : "nicht bestanden";
  return `<span style="display:inline-block;font-weight:600;font-size:14px;color:${text};background:${bg};border-radius:999px;padding:4px 12px;">${label}</span>`;
}

const card = (inner: string): string =>
  `<div style="background:${C.cardBg};border:1px solid ${C.border};border-radius:10px;padding:16px;margin-top:12px;">${inner}</div>`;

const EXAMINER_HEAD: Record<string, string> = {
  mild: "A · mild",
  streng: "B · streng",
  konsens: "Konsens",
};

/** Betreff der Ergebnis-E-Mail. */
export function buildSubject(p: ExamEmailPayload): string {
  const status = p.grade.bestanden ? "bestanden" : "nicht bestanden";
  const punkte = `${fmtPunkte(p.grade.gesamtpunkte)}/${fmtPunkte(p.grade.maxPunkte)}`;
  return `Satzwerk — Schreibergebnis: ${p.task.titleDe} (${status}, ${punkte})`;
}

/** Vollständige HTML-E-Mail mit Aufgabe, Aufsatz und KI-Bewertung. */
export function renderExamResultEmail(p: ExamEmailPayload, siteUrl: string): string {
  const { recipients: r, task, grade } = p;

  const greetingName = r.teacherName?.trim() || r.studentName?.trim();
  const greeting = greetingName
    ? `Hallo ${esc(greetingName)},`
    : "Hallo,";

  const byline = r.studentName?.trim()
    ? `${esc(r.studentName.trim())} hat eine Schreibaufgabe bearbeitet und vom KI-Prüfer bewerten lassen.`
    : "Eine Schreibaufgabe wurde bearbeitet und vom KI-Prüfer bewertet.";

  // Aufgabe
  const bullets =
    task.bulletPointsDe && task.bulletPointsDe.length > 0
      ? `<ul style="margin:8px 0 0;padding-left:18px;color:${C.muted};font-size:14px;">${task.bulletPointsDe
          .map((b) => `<li style="margin:2px 0;">${esc(b)}</li>`)
          .join("")}</ul>`
      : "";

  const taskBlock = card(`
    <div style="font-size:12px;color:${C.accent};font-weight:600;text-transform:uppercase;letter-spacing:.04em;">Aufgabe ${task.aufgabe} · ${esc(
    task.taskType
  )}</div>
    <div style="font-size:16px;font-weight:600;color:${C.text};margin-top:4px;">${esc(
    task.titleDe
  )}</div>
    <div style="font-size:14px;color:${C.muted};margin-top:6px;white-space:pre-line;">${escMultiline(
    task.promptDe
  )}</div>
    ${bullets}
    <div style="font-size:12px;color:${C.dim};margin-top:8px;">Richtwert: ca. ${esc(
    String(task.minWords)
  )} Wörter</div>
  `);

  // Aufsatz
  const essayBlock = card(`
    <div style="font-size:12px;color:${C.dim};font-weight:600;text-transform:uppercase;letter-spacing:.04em;">Eingereichter Text</div>
    <div style="font-size:14px;line-height:1.6;color:${C.text};margin-top:8px;">${escMultiline(
    p.essay
  )}</div>
  `);

  // Gesamtergebnis
  const scoreBlock = card(`
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="vertical-align:middle;">
        <div style="font-size:12px;color:${C.dim};">Gesamtergebnis · Vier-Augen-Prinzip</div>
        <div style="font-size:24px;font-weight:700;color:${C.text};margin-top:2px;">${fmtPunkte(
    grade.gesamtpunkte
  )}<span style="font-size:15px;font-weight:400;color:${C.dim};"> / ${fmtPunkte(
    grade.maxPunkte
  )}</span></div>
      </td>
      <td style="vertical-align:middle;text-align:right;">${badge(grade.bestanden)}</td>
    </tr></table>
  `);

  // Kriterien
  const criteriaBlock = card(`
    <div style="font-size:14px;font-weight:600;color:${C.text};">Bewertung nach Kriterien</div>
    ${grade.criteria
      .map(
        (c) => `
      <div style="border-top:1px solid ${C.border};margin-top:12px;padding-top:12px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="vertical-align:middle;">${bandChip(c.band)}<span style="font-size:14px;font-weight:600;color:${C.text};margin-left:8px;">${esc(
          c.labelDe
        )}</span></td>
          <td style="vertical-align:middle;text-align:right;font-size:12px;color:${C.dim};">${fmtPunkte(
          c.punkte
        )} / ${fmtPunkte(c.maxPunkte)} Punkte</td>
        </tr></table>
        <div style="font-size:14px;color:${C.muted};margin-top:6px;line-height:1.55;">${esc(
          c.begruendungDe
        )}</div>
      </div>`
      )
      .join("")}
  `);

  // Vier-Augen-Aufschlüsselung (optional)
  const examiners = p.examiners ?? [];
  const bandOf = (label: string, key: string): CriterionBand | undefined =>
    examiners
      .find((e) => e.label === label)
      ?.grade.criteria.find((c) => c.key === key)?.band;
  const hasKonsens = Boolean(p.thirdUsed);

  const examinersBlock =
    examiners.length >= 2
      ? card(`
    <div style="font-size:14px;font-weight:600;color:${C.text};">4-Augen-Prinzip — die Prüfer im Vergleich</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:10px;border-collapse:collapse;font-size:13px;">
      <tr style="color:${C.dim};text-align:left;">
        <th style="padding:4px 8px 4px 0;font-weight:500;">Kriterium</th>
        <th style="padding:4px 8px;font-weight:500;text-align:center;">${EXAMINER_HEAD.mild}</th>
        <th style="padding:4px 8px;font-weight:500;text-align:center;">${EXAMINER_HEAD.streng}</th>
        ${hasKonsens ? `<th style="padding:4px 8px;font-weight:500;text-align:center;">${EXAMINER_HEAD.konsens}</th>` : ""}
        <th style="padding:4px 8px;font-weight:500;text-align:center;">Ø Punkte</th>
      </tr>
      ${grade.criteria
        .map((c) => {
          const a = bandOf("mild", c.key);
          const b = bandOf("streng", c.key);
          const k = bandOf("konsens", c.key);
          return `<tr style="border-top:1px solid ${C.border};">
            <td style="padding:8px 8px 8px 0;color:${C.muted};">${esc(c.labelDe)}</td>
            <td style="padding:8px;text-align:center;">${a ? bandChip(a) : ""}</td>
            <td style="padding:8px;text-align:center;">${b ? bandChip(b) : ""}</td>
            ${hasKonsens ? `<td style="padding:8px;text-align:center;">${k ? bandChip(k) : ""}</td>` : ""}
            <td style="padding:8px;text-align:center;color:${C.muted};">${fmtPunkte(c.punkte)}</td>
          </tr>`;
        })
        .join("")}
    </table>
    <div style="font-size:12px;color:${C.dim};margin-top:10px;line-height:1.5;">Wie in der echten Prüfung bewerten zwei Prüfer unabhängig; das Endergebnis ist das arithmetische Mittel beider Bewertungen.${
          hasKonsens
            ? " Da sich die beiden über das Bestehen uneinig waren, gab eine Drittbewertung den Ausschlag."
            : ""
        }</div>
  `)
      : "";

  // Rückmeldung + Verbesserungsvorschläge
  const korrekturen =
    grade.korrekturen && grade.korrekturen.length > 0
      ? `<div style="font-size:12px;font-weight:600;color:${C.dim};text-transform:uppercase;letter-spacing:.04em;margin-top:12px;">Verbesserungsvorschläge</div>
         <ul style="margin:6px 0 0;padding-left:18px;color:${C.muted};font-size:14px;">${grade.korrekturen
           .map((k) => `<li style="margin:3px 0;line-height:1.5;">${esc(k)}</li>`)
           .join("")}</ul>`
      : "";

  const feedbackBlock = card(`
    <div style="font-size:14px;font-weight:600;color:${C.text};">Rückmeldung</div>
    <div style="font-size:14px;color:${C.muted};margin-top:6px;line-height:1.6;">${esc(
    grade.summaryDe
  )}</div>
    ${korrekturen}
  `);

  return `<!doctype html>
<html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${C.pageBg};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.pageBg};">
    <tr><td align="center" style="padding:24px 12px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
        <tr><td style="padding-bottom:4px;">
          <div style="font-size:18px;font-weight:700;color:${C.text};">Satzwerk</div>
          <div style="font-size:13px;color:${C.dim};margin-top:2px;">Schreibergebnis · KI-Prüfer · von Digital Sprache Institut</div>
        </td></tr>
        <tr><td>
          ${card(`<div style="font-size:15px;color:${C.text};">${greeting}</div>
                  <div style="font-size:14px;color:${C.muted};margin-top:6px;line-height:1.6;">${byline}</div>`)}
          ${taskBlock}
          ${essayBlock}
          ${scoreBlock}
          ${criteriaBlock}
          ${examinersBlock}
          ${feedbackBlock}
          <div style="font-size:12px;color:${C.dim};text-align:center;margin-top:20px;line-height:1.6;">
            Diese Bewertung wurde automatisch von einer KI erstellt und ersetzt keine offizielle Prüfung.<br>
            <a href="${esc(siteUrl)}" style="color:${C.accent};text-decoration:none;">${esc(
    siteUrl.replace(/^https?:\/\//, "")
  )}</a>
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}
