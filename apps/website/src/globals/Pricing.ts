import type { GlobalConfig } from "payload";
import { revalidatePricing, skipRevalidate } from "@/lib/revalidate";

const authenticated = ({ req }: { req: { user?: unknown } }) => Boolean(req.user);

/**
 * Die drei Tarife auf /loesungen. Als Global gepflegt, damit eine
 * Preisänderung kein Deployment braucht.
 */
export const Pricing: GlobalConfig = {
  slug: "pricing",
  label: "Preise",
  admin: { group: "Einstellungen" },
  access: { read: () => true, update: authenticated },
  hooks: {
    afterChange: [({ context }) => { if (!skipRevalidate(context)) revalidatePricing(); }],
  },
  fields: [
    {
      name: "tiers",
      type: "array",
      label: "Tarife",
      minRows: 1,
      maxRows: 4,
      labels: { singular: "Tarif", plural: "Tarife" },
      admin: { description: "Reihenfolge im Admin ist die Reihenfolge auf der Seite." },
      fields: [
        {
          type: "row",
          fields: [
            {
              name: "eyebrow",
              type: "text",
              required: true,
              label: "Kennung",
              admin: { description: "Kleine Versalien-Zeile, z. B. „Solo“." },
            },
            { name: "name", type: "text", required: true, label: "Titel" },
          ],
        },
        { name: "tagline", type: "text", label: "Untertitel" },
        {
          type: "row",
          fields: [
            {
              name: "monthly",
              type: "number",
              label: "Preis monatlich (€)",
              admin: { description: "Leer lassen für „auf Anfrage“-Tarife." },
            },
            {
              name: "yearly",
              type: "number",
              label: "Preis jährlich (€ / Monat)",
              admin: { description: "Monatlicher Betrag bei Jahreszahlung." },
            },
          ],
        },
        {
          name: "customLabel",
          type: "text",
          label: "Ersatztext statt Preis",
          admin: { description: "Wird statt der Zahlen angezeigt, z. B. „Individuell“." },
        },
        { name: "ctaLabel", type: "text", required: true, label: "Button-Text" },
        {
          name: "highlighted",
          type: "checkbox",
          defaultValue: false,
          label: "Hervorheben",
          admin: { description: "Grüner Rahmen und die Fahne „Meistgewählt“." },
        },
        {
          name: "features",
          type: "array",
          label: "Leistungen",
          labels: { singular: "Leistung", plural: "Leistungen" },
          fields: [{ name: "text", type: "text", required: true, label: "Text" }],
        },
      ],
    },
    {
      name: "note",
      type: "text",
      label: "Fußnote",
      defaultValue:
        "Alle Preise zzgl. USt. Die App ist für Teilnehmende der gebuchten Klassen inklusive.",
    },
  ],
};
