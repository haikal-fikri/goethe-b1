/**
 * Kleine Bauhelfer für Lexical-JSON.
 *
 * Der Seed erzeugt die Knoten direkt, statt HTML oder Markdown zu konvertieren:
 * Das Ergebnis ist dadurch deterministisch, im Diff lesbar und unabhängig von
 * einer Konverter-Version.
 */

export type LexicalNode = Record<string, unknown>;

/* Bitmaske der Textformate in Lexical. */
export const FORMAT = { bold: 1, italic: 2, strikethrough: 4, underline: 8, code: 16 } as const;

// Fortlaufende, damit ein erneuter Seed-Lauf dieselben IDs erzeugt.
let idCounter = 0;
function nextId(): string {
  idCounter += 1;
  return `seed${idCounter.toString(16).padStart(20, "0")}`;
}

/** Setzt den ID-Zähler zurück — vor jedem Seed-Lauf aufgerufen. */
export function resetIds(): void {
  idCounter = 0;
}

export function text(value: string, format = 0): LexicalNode {
  return { type: "text", detail: 0, format, mode: "normal", style: "", text: value, version: 1 };
}

export const bold = (value: string) => text(value, FORMAT.bold);
export const code = (value: string) => text(value, FORMAT.code);

export function link(value: string, url: string): LexicalNode {
  return {
    type: "link",
    fields: { linkType: "custom", newTab: false, url },
    format: "",
    indent: 0,
    version: 3,
    direction: "ltr",
    children: [text(value)],
  };
}

type Inline = string | LexicalNode;
const toNodes = (children: Inline[]): LexicalNode[] =>
  children.map((child) => (typeof child === "string" ? text(child) : child));

export function paragraph(...children: Inline[]): LexicalNode {
  return {
    type: "paragraph",
    format: "",
    indent: 0,
    version: 1,
    direction: "ltr",
    textFormat: 0,
    textStyle: "",
    children: toNodes(children),
  };
}

export function heading(tag: "h3" | "h4", ...children: Inline[]): LexicalNode {
  return {
    type: "heading",
    tag,
    format: "",
    indent: 0,
    version: 1,
    direction: "ltr",
    children: toNodes(children),
  };
}

export const h3 = (...children: Inline[]) => heading("h3", ...children);
export const h4 = (...children: Inline[]) => heading("h4", ...children);

export function list(items: Inline[][], type: "bullet" | "number" = "bullet"): LexicalNode {
  return {
    type: "list",
    listType: type,
    tag: type === "bullet" ? "ul" : "ol",
    start: 1,
    format: "",
    indent: 0,
    version: 1,
    direction: "ltr",
    children: items.map((item, index) => ({
      type: "listitem",
      value: index + 1,
      format: "",
      indent: 0,
      version: 1,
      direction: "ltr",
      children: toNodes(item),
    })),
  };
}

/** Block-Knoten für die eigenen Payload-Blöcke (Zitat, Hinweis). */
function block(fields: Record<string, unknown>): LexicalNode {
  return {
    type: "block",
    format: "",
    version: 2,
    fields: { id: nextId(), ...fields },
  };
}

export function pullQuote(quote: string, attribution?: string): LexicalNode {
  return block({ blockType: "pullQuote", quote, attribution });
}

export function callout(variant: "note" | "warning", content: string): LexicalNode {
  return block({ blockType: "callout", variant, content });
}

/** Umschlag, den Payload für ein richText-Feld erwartet. */
export function root(...children: LexicalNode[]) {
  return {
    root: {
      type: "root",
      format: "",
      indent: 0,
      version: 1,
      direction: "ltr",
      children,
    },
  };
}
