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

// WICHTIG: `.default()` und `.partial()` beißen sich. Zod v4 behält den
// Default auch im partiellen Schema — ein PATCH ohne dieses Feld bekäme den
// Default INJIZIERT und würde die Spalte überschreiben. Deshalb überall zwei
// Varianten: `…Field` (ohne Default, für PATCH) und `…FieldCreate` (mit
// Default, für POST).
const sortOrderField = z.number().int().min(0).max(32767);
const sortOrderFieldCreate = sortOrderField.default(0);

// ── skills ───────────────────────────────────────────────────────────────────

/** `skills` — PK ist der Enum-Code selbst, nicht frei wählbar. */
const skillCore = z.object({
  code: skillScopeEnum,
  nameDe: z.string().trim().min(1, "Name darf nicht leer sein.").max(120, "Name ist zu lang."),
  sortOrder: sortOrderField,
});

export const skillSchema = skillCore.extend({ sortOrder: sortOrderFieldCreate });
export type SkillInput = z.infer<typeof skillSchema>;

export const skillPatchSchema = skillCore.partial().extend({ code: skillScopeEnum });
export type SkillPatchInput = z.infer<typeof skillPatchSchema>;

// ── tasks (Korpus-Kategorie, NICHT exam_tasks) ───────────────────────────────

const corpusTaskCore = z.object({
  code: codeField,
  skillCode: skillScopeEnum,
  labelDe: z.string().trim().min(1, "Label (DE) darf nicht leer sein.").max(160, "Label ist zu lang."),
  labelEn: z.string().trim().min(1, "Label (EN) darf nicht leer sein.").max(160, "Label ist zu lang."),
  sortOrder: sortOrderField,
});

export const corpusTaskSchema = corpusTaskCore.extend({ sortOrder: sortOrderFieldCreate });
export type CorpusTaskInput = z.infer<typeof corpusTaskSchema>;

export const corpusTaskPatchSchema = corpusTaskCore.partial().extend({ code: codeField });
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
const redemittelCore = z.object({
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
  distractors: z.array(z.string().max(60)).max(20),
  tags: z.array(z.string().max(40)).max(20),
  difficulty: z.number().int().min(1).max(5),
  /** Gesetzt = Beispiel-Kindzeile zu dieser Eltern-ID (0011), sonst kanonisch. */
  parentId: z.string().trim().max(120).optional(),
});

/** Nur fürs Anlegen — beim PATCH dürfen diese Defaults NICHT einspringen. */
const redemittelBase = redemittelCore.extend({
  distractors: z.array(z.string().max(60)).max(20).default([]),
  tags: z.array(z.string().max(40)).max(20).default([]),
  difficulty: z.number().int().min(1).max(5).default(1),
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
export const redemittelPatchSchema = redemittelCore
  .partial()
  .extend({ id: z.string().trim().min(1).max(120) })
  // `parentId` fehlt hier BEWUSST (omit unten): das Verschieben einer Zeile
  // unter eine Eltern-Zeile würde eine kanonische Wendung in eine löschbare
  // Beispielzeile verwandeln — und damit die Löschsperre aushebeln UND die
  // Wendung aus redemittel_item (der Lern-App) entfernen. Eltern-Zuordnung
  // wird beim Anlegen entschieden, danach nur noch per SQL-Migration.
  .omit({ parentId: true })
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
    if (hatPhrase && hatTokens) {
      // Leere tokens sind NUR beim Anlegen einer Beispielzeile zulässig. Im
      // PATCH ist die Elternzuordnung unbekannt (parentId ist hier gesperrt),
      // also wäre `tokens: []` zusammen mit einer Wendung ein stiller Bruch
      // der Wortbank-Lösung — deshalb hier immer nicht-leer verlangen.
      if (d.tokens!.length === 0) {
        ctx.addIssue({
          code: "custom",
          path: ["tokens"],
          message:
            "tokens darf beim Ändern nicht leer sein. Beispielzeilen ohne tokens bitte per SQL-Migration behandeln.",
        });
        return;
      }
      if (d.tokens!.join(" ") !== d.phraseDe) {
        ctx.addIssue({ code: "custom", path: ["tokens"], message: TOKEN_MISMATCH });
      }
    }
    // Die Lückentext-Vorlage ist die zweite Hälfte derselben Invariante
    // (CLAUDE.md: „Editing a phrase requires re-syncing tokens AND
    // cloze_template"). Sie darf leer bleiben, aber wenn die Wendung sich
    // ändert und eine Vorlage mitkommt, muss sie zur neuen Wendung passen.
    if (hatPhrase && d.clozeTemplate === undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["clozeTemplate"],
        message:
          "Beim Ändern der Wendung muss cloze_template mitgeschickt werden (leerer String löscht die Vorlage) — sonst drillt der Lückentext weiter den alten Satz.",
      });
    }
  });
export type RedemittelPatchInput = z.infer<typeof redemittelPatchSchema>;

// ── redemittel_translation ───────────────────────────────────────────────────

/** Eine Zeile je (redemittel_id × Sprache), 0011. `rowId` == Spalte `row_id`. */
const redemittelTranslationCore = z.object({
  rowId: z.string().trim().min(1, "row_id darf nicht leer sein.").max(120),
  lang: z.string().trim().min(2, "Sprachcode zu kurz.").max(8, "Sprachcode zu lang."),
  translation: z.string().trim().min(1, "Übersetzung darf nicht leer sein.").max(500),
  status: z.enum(["draft", "reviewed"]),
  translator: z.string().trim().max(120).optional(),
});

export const redemittelTranslationSchema = redemittelTranslationCore.extend({
  status: z.enum(["draft", "reviewed"]).default("reviewed"),
});
export type RedemittelTranslationInput = z.infer<typeof redemittelTranslationSchema>;

export const redemittelTranslationPatchSchema = redemittelTranslationCore
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
