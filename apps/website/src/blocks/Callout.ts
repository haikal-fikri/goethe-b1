import type { Block } from "payload";

/**
 * Hinweiskasten der Dokumentation. „note“ ist der grüne Kasten aus dem Design,
 * „warning“ dieselbe Form in Gold.
 */
export const Callout: Block = {
  slug: "callout",
  interfaceName: "CalloutBlock",
  labels: { singular: "Hinweis", plural: "Hinweise" },
  fields: [
    {
      name: "variant",
      type: "select",
      required: true,
      defaultValue: "note",
      label: "Art",
      options: [
        { label: "Hinweis (grün)", value: "note" },
        { label: "Warnung (gold)", value: "warning" },
      ],
    },
    {
      name: "content",
      type: "textarea",
      required: true,
      label: "Text",
    },
  ],
};
