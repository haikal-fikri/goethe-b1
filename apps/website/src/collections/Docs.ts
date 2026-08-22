import type { CollectionConfig } from "payload";
import {
  BlocksFeature,
  HeadingFeature,
  lexicalEditor,
} from "@payloadcms/richtext-lexical";
import { Callout } from "@/blocks/Callout";
import { seoField } from "@/fields/seo";
import { slugField, slugify } from "@/fields/slug";
import { revalidateDocs, skipRevalidate } from "@/lib/revalidate";

const authenticated = ({ req }: { req: { user?: unknown } }) => Boolean(req.user);

export const Docs: CollectionConfig = {
  slug: "docs",
  labels: { singular: "Doku-Artikel", plural: "Doku-Artikel" },
  admin: {
    useAsTitle: "title",
    defaultColumns: ["title", "group", "order", "popular"],
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
    beforeValidate: [
      async ({ data, originalDoc, req, operation }) => {
        // Der Slug muss nur innerhalb seines Kapitels eindeutig sein — die URL
        // ist /dokumentation/<kapitel>/<artikel>. Ohne diese Prüfung
        // gewönne beim Aufruf schlicht der zuerst gefundene Artikel.
        if (!data) return data;
        const slug = data.slug ? slugify(String(data.slug)) : data.title ? slugify(String(data.title)) : null;
        const group = data.group ?? originalDoc?.group;
        if (!slug || !group) return data;

        const groupId = typeof group === "object" && group !== null ? (group as { id: unknown }).id : group;
        const existing = await req.payload.find({
          collection: "docs",
          where: { and: [{ slug: { equals: slug } }, { group: { equals: groupId } }] },
          limit: 1,
          depth: 0,
          pagination: false,
        });
        const clash = existing.docs.find((candidate) => {
          if (operation === "create") return true;
          // Beim Aktualisieren ist der eigene Datensatz kein Konflikt. Fehlt die
          // eigene ID ausnahmsweise, lieber durchlassen als fälschlich
          // blockieren — die Eindeutigkeit ist eine Redaktionshilfe, kein
          // Sicherheitsmerkmal.
          if (originalDoc?.id == null) return false;
          return candidate.id !== originalDoc.id;
        });
        if (clash) {
          throw new Error(
            `In diesem Kapitel gibt es bereits einen Artikel mit dem Slug „${slug}“. Bitte einen anderen Titel oder Slug wählen.`
          );
        }
        return data;
      },
    ],
    afterChange: [({ context }) => { if (!skipRevalidate(context)) revalidateDocs(); }],
    afterDelete: [({ context }) => { if (!skipRevalidate(context)) revalidateDocs(); }],
  },
  fields: [
    { name: "title", type: "text", required: true, label: "Titel" },
    slugField("title", { unique: false }),
    {
      name: "group",
      type: "relationship",
      relationTo: "doc-groups",
      required: true,
      label: "Kapitel",
      admin: { position: "sidebar" },
    },
    {
      name: "order",
      type: "number",
      required: true,
      defaultValue: 0,
      label: "Reihenfolge",
      admin: { position: "sidebar", description: "Position in der Seitenleiste des Kapitels." },
    },
    {
      name: "popular",
      type: "checkbox",
      defaultValue: false,
      label: "Häufig gelesen",
      admin: { position: "sidebar", description: "Erscheint in der Liste auf der Doku-Startseite." },
    },
    {
      name: "popularOrder",
      type: "number",
      label: "Position in „Häufig gelesen“",
      admin: {
        position: "sidebar",
        condition: (_data, siblingData) => Boolean(siblingData?.popular),
        description:
          "Kleinere Zahl steht weiter oben. Die Liste ist kuratiert — ohne diese Angabe richtet sie sich nach der Kapitel-Reihenfolge.",
      },
    },
    {
      type: "row",
      fields: [
        {
          name: "updatedOn",
          type: "date",
          label: "Zuletzt aktualisiert am",
          admin: {
            date: { pickerAppearance: "dayOnly", displayFormat: "d. MMMM yyyy" },
            description: "Wird über dem Artikel angezeigt.",
          },
        },
        {
          name: "appliesTo",
          type: "text",
          label: "Gilt für",
          admin: { description: "z. B. „LMS 2.4 und App 3.1“." },
        },
      ],
    },
    {
      name: "body",
      type: "richText",
      required: true,
      label: "Text",
      editor: lexicalEditor({
        features: ({ defaultFeatures }) => [
          ...defaultFeatures.filter((feature) => feature.key !== "heading"),
          HeadingFeature({ enabledHeadingSizes: ["h3", "h4"] }),
          BlocksFeature({ blocks: [Callout] }),
        ],
      }),
    },
    seoField,
  ],
};
