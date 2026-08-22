import type { Field, FieldHook } from "payload";

/**
 * Deutsche Umlaute werden transliteriert, bevor alles Nicht-Alphanumerische zu
 * Bindestrichen wird — sonst würde aus „Prüfungs-Korpus" ein „prfungs-korpus".
 */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .normalize("NFD")
    // kombinierende Akzente (U+0300–U+036F) nach der Zerlegung entfernen
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Füllt den Slug aus dem Quellfeld, solange die Redaktion keinen eigenen
 * gesetzt hat. Ein einmal vergebener Slug bleibt stehen (Permalinks!), außer er
 * wird von Hand geleert — dann wird er beim nächsten Speichern neu erzeugt.
 */
const fillFromSource =
  (sourceField: string): FieldHook =>
  ({ value, data, originalDoc }) => {
    if (typeof value === "string" && value.trim() !== "") return slugify(value);
    const source = (data?.[sourceField] ?? originalDoc?.[sourceField]) as unknown;
    if (typeof source === "string" && source.trim() !== "") return slugify(source);
    return value;
  };

/**
 * `unique: false` für Docs: deren Slug muss nur innerhalb des Kapitels
 * eindeutig sein (die URL ist /dokumentation/<kapitel>/<artikel>), damit
 * mehrere Kapitel z. B. je einen „Überblick" haben können. Die Prüfung
 * übernimmt dort ein eigener Hook.
 */
export function slugField(sourceField = "title", { unique = true } = {}): Field {
  return {
    name: "slug",
    type: "text",
    unique,
    index: true,
    admin: {
      position: "sidebar",
      description: `Wird aus „${sourceField}" erzeugt, wenn leer. Teil der URL — nachträgliche Änderungen brechen bestehende Links.`,
    },
    hooks: { beforeValidate: [fillFromSource(sourceField)] },
  };
}
