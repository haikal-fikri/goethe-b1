// Zod-Schemas für den Korpus-Editor der Superadmin-Konsole (Vercel C ·
// apps/admin, teacher-lms/05 §4.2). Die Inhaltstabellen bleiben dauerhaft
// „public read + kein Client-Write" — jede Änderung geht durch
// /api/admin/corpus/:resource, wird hier validiert und ins audit_log geschrieben.
//
// Konventionen wie in ./teacherSchemas: deutsche Meldungen, überall .max()
// (kein unbegrenzter Speicher), Zod v4.
//
// ⚠️ Namensgebung: die DB hat ZWEI Tabellen namens „tasks" —
//   · `tasks`      = Korpus-Kategorie (Redemittel-Aufgabentyp)  → corpusTaskSchema
//   · `exam_tasks` = Prüfungsaufgabe einer Simulation           → examTaskSchema
// (letzteres in ./adminSchema). Die Schemas heißen entsprechend unterschiedlich.
import { z } from "zod";

/** skill_scope (0001). */
export const skillScopeEnum = z.enum(["schreiben", "sprechen", "shared"]);

/** cefr_level (0001). */
export const cefrLevelEnum = z.enum(["B1", "B2", "C1", "C2"]);

const codeField = z
  .string()
  .trim()
  .min(1, "Code darf nicht leer sein.")
  .max(80, "Code ist zu lang.");

const sortOrderField = z.number().int().min(0).max(32767).default(0);

// ── skills ───────────────────────────────────────────────────────────────────

/** `skills` — PK ist der Enum-Code selbst, nicht frei wählbar. */
export const skillSchema = z.object({
  code: skillScopeEnum,
  nameDe: z.string().trim().min(1, "Name darf nicht leer sein.").max(120, "Name ist zu lang."),
  sortOrder: sortOrderField,
});
export type SkillInput = z.infer<typeof skillSchema>;

export const skillPatchSchema = skillSchema.partial().extend({ code: skillScopeEnum });
export type SkillPatchInput = z.infer<typeof skillPatchSchema>;

// ── tasks (Korpus-Kategorie, NICHT exam_tasks) ───────────────────────────────

export const corpusTaskSchema = z.object({
  code: codeField,
  skillCode: skillScopeEnum,
  labelDe: z.string().trim().min(1, "Label (DE) darf nicht leer sein.").max(160, "Label ist zu lang."),
  labelEn: z.string().trim().min(1, "Label (EN) darf nicht leer sein.").max(160, "Label ist zu lang."),
  sortOrder: sortOrderField,
});
export type CorpusTaskInput = z.infer<typeof corpusTaskSchema>;

export const corpusTaskPatchSchema = corpusTaskSchema.partial().extend({ code: codeField });
export type CorpusTaskPatchInput = z.infer<typeof corpusTaskPatchSchema>;

// ── functions ────────────────────────────────────────────────────────────────

export const functionSchema = z.object({
  code: codeField,
  nameDe: z.string().trim().min(1, "Name (DE) darf nicht leer sein.").max(160, "Name ist zu lang."),
  nameEn: z.string().trim().min(1, "Name (EN) darf nicht leer sein.").max(160, "Name ist zu lang."),
});
export type FunctionInput = z.infer<typeof functionSchema>;

export const functionPatchSchema = functionSchema.partial().extend({ code: codeField });
export type FunctionPatchInput = z.infer<typeof functionPatchSchema>;

// ── redemittel ───────────────────────────────────────────────────────────────

/**
 * HARTE INVARIANTE der Wortbank: `tokens.join(" ") === phrase_de`. tokens ist
 * der Lösungsschlüssel der Übung — driften beide auseinander, ist die Aufgabe
 * unlösbar. Wird unten in beiden Richtungen erzwungen (Create UND Patch).
 *
 * Beispiel-Kindzeilen (parentId gesetzt, 0011) dürfen `tokens: []` haben — sie
 * sind dann nicht übbar, nur Kontext. Deshalb gilt die Invariante dort nur,
 * wenn überhaupt tokens angegeben sind.
 */
const redemittelBase = z.object({
  id: z.string().trim().min(1, "ID darf nicht leer sein.").max(120, "ID ist zu lang."),
  phraseDe: z.string().trim().min(1, "Wendung darf nicht leer sein.").max(500, "Wendung ist zu lang."),
  frameDe: z.string().trim().max(500).optional(),
  translationEn: z.string().trim().min(1, "Übersetzung darf nicht leer sein.").max(500),
  level: cefrLevelEnum,
  skillCode: skillScopeEnum,
  taskCode: codeField,
  functionCode: codeField,
  registerGroup: z.string().trim().max(80).optional(),
  notes: z.string().trim().max(1000).optional(),
  clozeTemplate: z.string().trim().max(600).optional(),
  audioUrl: z.string().trim().max(500).optional(),
  tokens: z.array(z.string().min(1).max(60)).max(40),
  distractors: z.array(z.string().max(60)).max(20).default([]),
  tags: z.array(z.string().max(40)).max(20).default([]),
  difficulty: z.number().int().min(1).max(5).default(1),
  /** Gesetzt = Beispiel-Kindzeile zu dieser Eltern-ID (0011), sonst kanonisch. */
  parentId: z.string().trim().max(120).optional(),
});

const TOKEN_MISMATCH = 'tokens.join(" ") muss exakt phrase_de ergeben.';

export const redemittelSchema = redemittelBase.superRefine((d, ctx) => {
  const istKind = Boolean(d.parentId);
  if (!istKind && d.tokens.length === 0) {
    ctx.addIssue({
      code: "custom",
      path: ["tokens"],
      message: "Kanonische Wendungen brauchen tokens (Wortbank-Lösung).",
    });
    return;
  }
  if (d.tokens.length > 0 && d.tokens.join(" ") !== d.phraseDe) {
    ctx.addIssue({ code: "custom", path: ["tokens"], message: TOKEN_MISMATCH });
  }
});
export type RedemittelInput = z.infer<typeof redemittelSchema>;

/**
 * PATCH. `id` ist ein STABILER Surrogatschlüssel — er wird nie neu berechnet,
 * Bearbeiten heißt UPDATE an Ort und Stelle (Attempts/Progress/Übersetzungen/
 * Kindzeilen hängen daran).
 *
 * Die Invariante ist hier der eigentliche Knackpunkt: würde man nur `phraseDe`
 * patchen, stimmten die gespeicherten tokens nicht mehr — die Übung wäre
 * stillschweigend kaputt. Deshalb müssen beide Felder GEMEINSAM kommen.
 */
export const redemittelPatchSchema = redemittelBase
  .partial()
  .extend({ id: z.string().trim().min(1).max(120) })
  .superRefine((d, ctx) => {
    const hatPhrase = d.phraseDe !== undefined;
    const hatTokens = d.tokens !== undefined;
    if (hatPhrase !== hatTokens) {
      ctx.addIssue({
        code: "custom",
        path: [hatPhrase ? "tokens" : "phraseDe"],
        message:
          "phraseDe und tokens müssen zusammen geändert werden, sonst bricht die Wortbank-Lösung.",
      });
      return;
    }
    if (hatPhrase && hatTokens && d.tokens!.length > 0 && d.tokens!.join(" ") !== d.phraseDe) {
      ctx.addIssue({ code: "custom", path: ["tokens"], message: TOKEN_MISMATCH });
    }
  });
export type RedemittelPatchInput = z.infer<typeof redemittelPatchSchema>;

// ── redemittel_translation ───────────────────────────────────────────────────

/** Eine Zeile je (redemittel_id × Sprache), 0011. `rowId` == Spalte `row_id`. */
export const redemittelTranslationSchema = z.object({
  rowId: z.string().trim().min(1, "row_id darf nicht leer sein.").max(120),
  lang: z.string().trim().min(2, "Sprachcode zu kurz.").max(8, "Sprachcode zu lang."),
  translation: z.string().trim().min(1, "Übersetzung darf nicht leer sein.").max(500),
  status: z.enum(["draft", "reviewed"]).default("reviewed"),
  translator: z.string().trim().max(120).optional(),
});
export type RedemittelTranslationInput = z.infer<typeof redemittelTranslationSchema>;

export const redemittelTranslationPatchSchema = redemittelTranslationSchema
  .partial()
  .extend({
    rowId: z.string().trim().min(1).max(120),
    lang: z.string().trim().min(2).max(8),
  });
export type RedemittelTranslationPatchInput = z.infer<typeof redemittelTranslationPatchSchema>;

/** DELETE-Ziel einer Übersetzung (PK ist zusammengesetzt). */
export const redemittelTranslationDeleteSchema = z.object({
  rowId: z.string().trim().min(1).max(120),
  lang: z.string().trim().min(2).max(8),
});
export type RedemittelTranslationDeleteInput = z.infer<typeof redemittelTranslationDeleteSchema>;

/** DELETE-Ziel einer Beispiel-Kindzeile (nur Zeilen mit parent_id sind löschbar). */
export const redemittelDeleteSchema = z.object({
  id: z.string().trim().min(1).max(120),
});
export type RedemittelDeleteInput = z.infer<typeof redemittelDeleteSchema>;
