import type { Field } from "payload";

/**
 * Gemeinsame SEO-Gruppe für Posts und Docs. Alle Felder optional — die Seiten
 * fallen auf Titel/Excerpt bzw. den ersten Absatz zurück.
 */
export const seoField: Field = {
  name: "seo",
  type: "group",
  label: "SEO",
  admin: { description: "Optional. Leer lassen heißt: aus dem Inhalt ableiten." },
  fields: [
    {
      name: "title",
      type: "text",
      label: "Meta-Titel",
      admin: { description: "Ersetzt den Seitentitel im Browser-Tab und in Suchergebnissen." },
    },
    {
      name: "description",
      type: "textarea",
      label: "Meta-Beschreibung",
      maxLength: 220,
      admin: { description: "Rund 150–160 Zeichen werden angezeigt." },
    },
    {
      name: "ogImage",
      type: "upload",
      relationTo: "media",
      label: "Social-Bild",
      admin: { description: "Beim Teilen in sozialen Netzwerken. Empfohlen 1200 × 630." },
    },
  ],
};
