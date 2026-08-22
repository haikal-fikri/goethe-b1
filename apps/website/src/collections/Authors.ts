import type { CollectionConfig } from "payload";
import { revalidateAuthors } from "@/lib/revalidate";
import { skipRevalidate } from "@/lib/revalidate";

const authenticated = ({ req }: { req: { user?: unknown } }) => Boolean(req.user);

/** Autorinnen und Autoren des Blogs. Das Avatar sind die Initialen auf grünem Tint — kein Foto. */
export const Authors: CollectionConfig = {
  slug: "authors",
  admin: {
    useAsTitle: "name",
    defaultColumns: ["name", "role", "initials"],
    group: "Inhalte",
  },
  access: {
    read: () => true,
    create: authenticated,
    update: authenticated,
    delete: authenticated,
  },
  hooks: {
    afterChange: [
      ({ context }) => {
        if (!skipRevalidate(context)) revalidateAuthors();
      },
    ],
  },
  fields: [
    { name: "name", type: "text", required: true, label: "Name" },
    {
      name: "role",
      type: "text",
      label: "Rolle",
      admin: { description: "z. B. „Didaktik & Bewertungsqualität“." },
    },
    {
      name: "initials",
      type: "text",
      required: true,
      maxLength: 3,
      label: "Initialen",
      admin: { description: "Zwei bis drei Zeichen, erscheinen im runden Avatar." },
    },
  ],
};
