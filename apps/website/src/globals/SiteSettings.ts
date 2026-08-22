import type { GlobalConfig } from "payload";
import { revalidateSiteSettings, skipRevalidate } from "@/lib/revalidate";

const authenticated = ({ req }: { req: { user?: unknown } }) => Boolean(req.user);

/**
 * Store-Links, Kontaktadressen und die sechs Marketing-Bildplätze.
 *
 * Die Bildplätze liegen bewusst hier: So bleibt das Einsetzen eines echten
 * Screenshots eine reine Inhaltsänderung (Upload im Admin), ohne dass jemand
 * Layout-Code anfassen muss.
 */
export const SiteSettings: GlobalConfig = {
  slug: "site-settings",
  label: "Website-Einstellungen",
  admin: { group: "Einstellungen" },
  access: { read: () => true, update: authenticated },
  hooks: {
    afterChange: [({ context }) => { if (!skipRevalidate(context)) revalidateSiteSettings(); }],
  },
  fields: [
    {
      type: "collapsible",
      label: "Verweise",
      fields: [
        {
          name: "lernenUrl",
          type: "text",
          required: true,
          defaultValue: "https://lernen.digi-s.institute",
          label: "Lernen-URL",
          admin: { description: "Ziel des „Lernen ↗“-Links in Kopf- und Fußzeile." },
        },
        {
          name: "appStoreUrl",
          type: "text",
          label: "App Store",
          admin: { description: "Noch ein Platzhalter aus dem Design — vor dem Launch ersetzen." },
        },
        {
          name: "playStoreUrl",
          type: "text",
          label: "Google Play",
          admin: { description: "Noch ein Platzhalter aus dem Design — vor dem Launch ersetzen." },
        },
      ],
    },
    {
      type: "collapsible",
      label: "Kontakt",
      fields: [
        {
          name: "contactEmail",
          type: "email",
          required: true,
          defaultValue: "hallo@digi-s.institute",
          label: "Allgemeine E-Mail",
          admin: { description: "Empfänger der Formular-Anfragen; steht auch im Seitenfuß." },
        },
        {
          name: "privacyEmail",
          type: "email",
          defaultValue: "datenschutz@digi-s.institute",
          label: "Datenschutz-E-Mail",
        },
      ],
    },
    {
      name: "imageSlots",
      type: "group",
      label: "Bildplätze",
      admin: {
        description:
          "Die festen Bildplätze des Designs. Leer bleiben heißt: der beschriftete Platzhalter steht, das Layout ist bereits final. Bitte keine generierten oder Stock-Bilder einsetzen.",
      },
      fields: [
        { name: "heroLms", type: "upload", relationTo: "media", label: "Start · LMS-Screenshot (16:10)" },
        { name: "heroApp", type: "upload", relationTo: "media", label: "Start · App-Screenshot (9:19)" },
        { name: "homeAblauf", type: "upload", relationTo: "media", label: "Start · Ablauf (Hochformat)" },
        { name: "solApp", type: "upload", relationTo: "media", label: "Lösungen · Mobile App" },
        { name: "solLms", type: "upload", relationTo: "media", label: "Lösungen · LMS" },
        { name: "aboutHero", type: "upload", relationTo: "media", label: "Über uns · Titelbild" },
      ],
    },
  ],
};
