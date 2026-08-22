import type { Block } from "payload";

/**
 * Das getönte Zitat-Kästchen der Artikelseite. Bewusst ein Block und kein
 * eigenes Feld am Post: So platziert die Redaktion es frei im Fließtext,
 * statt an einer festen Position (Vorgabe aus dem Build-Prompt).
 */
export const PullQuote: Block = {
  slug: "pullQuote",
  interfaceName: "PullQuoteBlock",
  labels: { singular: "Zitat", plural: "Zitate" },
  fields: [
    {
      name: "quote",
      type: "textarea",
      required: true,
      label: "Zitat",
      admin: { description: "Anführungszeichen mitschreiben, z. B. „…“." },
    },
    {
      name: "attribution",
      type: "text",
      label: "Quelle",
      admin: { description: "z. B. „— Kursleitung, Integrationskurs B1, Ulm“." },
    },
  ],
};
