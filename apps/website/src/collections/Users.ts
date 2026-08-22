import type { CollectionConfig } from "payload";

const authenticated = ({ req }: { req: { user?: unknown } }) => Boolean(req.user);

/**
 * Redaktionskonten für das Payload-Admin. Bewusst getrennt von der
 * Supabase-Auth der übrigen Apps: Diese Konten pflegen Website-Inhalte und
 * haben keinerlei Bezug zu Lernenden, Lehrkräften oder Kursdaten.
 */
export const Users: CollectionConfig = {
  slug: "users",
  auth: true,
  admin: { useAsTitle: "email", group: "System" },
  access: {
    read: authenticated,
    create: authenticated,
    update: authenticated,
    delete: authenticated,
    admin: authenticated,
  },
  fields: [{ name: "name", type: "text", label: "Name" }],
};
