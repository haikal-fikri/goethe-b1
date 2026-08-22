import type { CollectionConfig } from "payload";

const authenticated = ({ req }: { req: { user?: unknown } }) => Boolean(req.user);

export const TEAM_SIZES = ["1", "2–5", "6–15", "16–50", "mehr als 50"] as const;

export const CONTACT_TOPICS = [
  "Demo für meine Schule",
  "Testzugang als Einzel-Lehrkraft",
  "Angebot Campus / mehrere Standorte",
  "Datenschutz & AV-Vertrag",
  "Etwas anderes",
] as const;

/**
 * Eingänge des Demo-Formulars.
 *
 * `create: () => false` schließt die öffentliche REST-Schnittstelle: Geschrieben
 * wird ausschließlich aus der Server Action über die Local API (die
 * Zugriffsprüfung standardmäßig überspringt). Ohne diesen Riegel könnte jeder
 * per POST /api/contact-submissions die Sammlung fluten — am Rate-Limit,
 * Honeypot und der Validierung des Formulars vorbei.
 */
export const ContactSubmissions: CollectionConfig = {
  slug: "contact-submissions",
  labels: { singular: "Anfrage", plural: "Anfragen" },
  admin: {
    useAsTitle: "email",
    defaultColumns: ["email", "name", "organisation", "topic", "submittedAt"],
    group: "Anfragen",
    description:
      "Eingänge aus dem Kontaktformular. Werden nach 12 Monaten gelöscht (siehe Datenschutzerklärung).",
  },
  defaultSort: "-submittedAt",
  access: {
    read: authenticated,
    create: () => false,
    update: authenticated,
    delete: authenticated,
  },
  fields: [
    { name: "name", type: "text", required: true, label: "Name" },
    { name: "email", type: "email", required: true, label: "E-Mail" },
    { name: "organisation", type: "text", label: "Einrichtung" },
    {
      name: "teamsize",
      type: "select",
      label: "Lehrkräfte",
      options: TEAM_SIZES.map((value) => ({ label: value, value })),
    },
    {
      name: "topic",
      type: "select",
      label: "Anliegen",
      options: CONTACT_TOPICS.map((value) => ({ label: value, value })),
    },
    { name: "message", type: "textarea", label: "Nachricht" },
    {
      name: "consent",
      type: "checkbox",
      required: true,
      label: "Einwilligung erteilt",
      admin: { description: "Ohne Einwilligung nimmt das Formular die Anfrage nicht an." },
    },
    {
      name: "submittedAt",
      type: "date",
      label: "Eingegangen am",
      admin: { position: "sidebar", date: { pickerAppearance: "dayAndTime" } },
    },
  ],
};
