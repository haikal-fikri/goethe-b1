import type { CollectionConfig } from "payload";
import {
  BlocksFeature,
  HeadingFeature,
  lexicalEditor,
} from "@payloadcms/richtext-lexical";
import { PullQuote } from "@/blocks/PullQuote";
import { seoField } from "@/fields/seo";
import { slugField } from "@/fields/slug";
import { revalidatePost, skipRevalidate } from "@/lib/revalidate";

const authenticated = ({ req }: { req: { user?: unknown } }) => Boolean(req.user);

export const POST_CATEGORIES = [
  { label: "Praxis", value: "praxis" },
  { label: "Produkt", value: "produkt" },
  { label: "Bewertung", value: "bewertung" },
  { label: "Datenschutz", value: "datenschutz" },
  { label: "Fallstudie", value: "fallstudie" },
  { label: "Didaktik", value: "didaktik" },
  { label: "Changelog", value: "changelog" },
] as const;

export const Posts: CollectionConfig = {
  slug: "posts",
  labels: { singular: "Beitrag", plural: "Beiträge" },
  admin: {
    useAsTitle: "title",
    defaultColumns: ["title", "category", "publishedAt", "featured"],
    group: "Inhalte",
  },
  defaultSort: "-publishedAt",
  access: {
    // Öffentlich sichtbar ist nur, was ein Veröffentlichungsdatum in der
    // Vergangenheit hat. Angemeldete Redaktion sieht alles (Vorschau).
    read: ({ req }) =>
      req.user ? true : { publishedAt: { less_than_equal: new Date().toISOString() } },
    create: authenticated,
    update: authenticated,
    delete: authenticated,
  },
  hooks: {
    afterChange: [
      async ({ doc, previousDoc, req, context, operation }) => {
        // Genau ein Beitrag trägt die große Karte auf /blog. Wird hier einer
        // als „featured" markiert, verlieren die anderen das Flag. Der
        // context-Riegel verhindert, dass dieses Update den Hook erneut
        // auslöst (Endlosschleife).
        const ctx = context as
          | { unsetFeatured?: boolean; seeding?: boolean; internal?: boolean }
          | undefined;
        if (doc.featured && !ctx?.unsetFeatured) {
          await req.payload.update({
            collection: "posts",
            where: { and: [{ featured: { equals: true } }, { id: { not_equals: doc.id } }] },
            data: { featured: false },
            // Seeding-/Internal-Marker weiterreichen, damit die verdrängten
            // Beiträge im Seed ebenfalls keine Revalidierung auslösen.
            context: { unsetFeatured: true, seeding: ctx?.seeding, internal: ctx?.internal },
            req,
          });
        }
        if (!skipRevalidate(context)) {
          revalidatePost(doc.slug, operation === "update" ? previousDoc?.slug : undefined);
        }
      },
    ],
    afterDelete: [
      ({ doc, context }) => {
        if (!skipRevalidate(context)) revalidatePost(doc?.slug);
      },
    ],
  },
  fields: [
    { name: "title", type: "text", required: true, label: "Titel" },
    slugField("title"),
    {
      type: "row",
      fields: [
        {
          name: "category",
          type: "select",
          required: true,
          label: "Rubrik",
          options: [...POST_CATEGORIES],
        },
        {
          name: "readingTime",
          type: "text",
          label: "Lesedauer",
          admin: { description: "Wie im Design geschrieben, z. B. „7 Min“." },
        },
      ],
    },
    {
      name: "publishedAt",
      type: "date",
      required: true,
      label: "Veröffentlicht am",
      admin: {
        position: "sidebar",
        date: { pickerAppearance: "dayOnly", displayFormat: "d. MMMM yyyy" },
        description: "Ein Datum in der Zukunft hält den Beitrag unsichtbar.",
      },
    },
    {
      name: "featured",
      type: "checkbox",
      label: "Aufmacher",
      defaultValue: false,
      admin: {
        position: "sidebar",
        description:
          "Große Karte oben auf /blog. Setzt das Flag bei allen anderen Beiträgen zurück.",
      },
    },
    {
      name: "author",
      type: "relationship",
      relationTo: "authors",
      required: true,
      label: "Autor/in",
      admin: { position: "sidebar" },
    },
    {
      name: "heroImage",
      type: "upload",
      relationTo: "media",
      label: "Titelbild",
      admin: {
        description:
          "Füllt die Bildplätze blog-featured (Aufmacher) und article-hero (Artikelkopf). Ohne Bild bleibt der beschriftete Platzhalter stehen.",
      },
    },
    {
      name: "excerpt",
      type: "textarea",
      required: true,
      label: "Teaser",
      admin: { description: "Der Text auf der Karte in der Beitragsübersicht." },
    },
    {
      name: "lead",
      type: "textarea",
      required: true,
      label: "Vorspann",
      admin: { description: "Erster Absatz des Artikels, größer gesetzt als der Fließtext." },
    },
    {
      name: "body",
      type: "richText",
      required: true,
      label: "Text",
      editor: lexicalEditor({
        features: ({ defaultFeatures }) => [
          ...defaultFeatures.filter((feature) => feature.key !== "heading"),
          // Das Design kennt im Artikel nur h3 (Abschnitte) und h4.
          HeadingFeature({ enabledHeadingSizes: ["h3", "h4"] }),
          BlocksFeature({ blocks: [PullQuote] }),
        ],
      }),
    },
    seoField,
  ],
};
