import type { CollectionConfig } from "payload";
import { slugField } from "@/fields/slug";
import { revalidateDocs, skipRevalidate } from "@/lib/revalidate";

const authenticated = ({ req }: { req: { user?: unknown } }) => Boolean(req.user);

/**
 * Kapitel der Dokumentation (Erste Schritte, Unterricht, …).
 *
 * Die Artikelzahl wird NICHT hier gespeichert, sondern beim Rendern aus den
 * zugehörigen Docs abgeleitet (`getDocsNav()`) — sonst driftet der Zähler,
 * sobald jemand einen Artikel anlegt oder löscht.
 */
export const DocGroups: CollectionConfig = {
  slug: "doc-groups",
  labels: { singular: "Doku-Kapitel", plural: "Doku-Kapitel" },
  admin: {
    useAsTitle: "label",
    defaultColumns: ["label", "order", "slug"],
    group: "Dokumentation",
  },
  defaultSort: "order",
  access: {
    read: () => true,
    create: authenticated,
    update: authenticated,
    delete: authenticated,
  },
  hooks: {
    afterChange: [({ context }) => { if (!skipRevalidate(context)) revalidateDocs(); }],
    afterDelete: [({ context }) => { if (!skipRevalidate(context)) revalidateDocs(); }],
  },
  fields: [
    { name: "label", type: "text", required: true, label: "Titel" },
    slugField("label"),
    {
      name: "order",
      type: "number",
      required: true,
      defaultValue: 0,
      label: "Reihenfolge",
      admin: { position: "sidebar", description: "Kleinere Zahl steht weiter oben." },
    },
    {
      name: "description",
      type: "textarea",
      label: "Beschreibung",
      admin: { description: "Erscheint auf der Übersichtskarte der Dokumentation." },
    },
  ],
};
