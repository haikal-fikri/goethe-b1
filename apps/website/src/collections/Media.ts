import type { CollectionConfig } from "payload";
import sharp from "sharp";

const authenticated = ({ req }: { req: { user?: unknown } }) => Boolean(req.user);

/**
 * Bild-Uploads. Liegen in einem eigenen Cloudflare-R2-Bucket, sofern die
 * R2_*-Variablen gesetzt sind (siehe payload.config.ts) — sonst lokal, was nur
 * für die Entwicklung taugt.
 */
export const Media: CollectionConfig = {
  slug: "media",
  admin: { group: "Inhalte" },
  access: {
    read: () => true,
    create: authenticated,
    update: authenticated,
    delete: authenticated,
  },
  upload: {
    mimeTypes: ["image/*"],
    // Breiten für next/image. Die Bildplätze des Designs sind maximal ~1160px
    // breit; 1600 deckt Retina auf dem größten Platz ab.
    imageSizes: [
      { name: "thumbnail", width: 480, height: undefined, position: "centre" },
      { name: "card", width: 900, height: undefined, position: "centre" },
      { name: "wide", width: 1600, height: undefined, position: "centre" },
    ],
    focalPoint: true,
  },
  hooks: {
    beforeChange: [
      async ({ data, req }) => {
        // Winziges, unscharfes Vorschaubild als Data-URI — next/image blendet es
        // ein, bis das echte Bild geladen ist. Schlägt das fehl, wird einfach
        // ohne Blur ausgeliefert; ein Upload darf daran nie scheitern.
        const file = req.file;
        if (!file?.data) return data;
        try {
          const preview = await sharp(file.data)
            .resize(16, 16, { fit: "inside" })
            .webp({ quality: 40 })
            .toBuffer();
          return { ...data, blurDataURL: `data:image/webp;base64,${preview.toString("base64")}` };
        } catch (error) {
          req.payload.logger.warn(
            `[media] Blur-Vorschau konnte nicht erzeugt werden: ${(error as Error).message}`
          );
          return data;
        }
      },
    ],
  },
  fields: [
    {
      name: "alt",
      type: "text",
      required: true,
      label: "Alternativtext",
      admin: {
        description:
          "Beschreibt das Bild für Screenreader und wenn es nicht lädt. Rein dekorative Bilder: kurzen Zweck angeben.",
      },
    },
    {
      name: "blurDataURL",
      type: "text",
      admin: { hidden: true, readOnly: true },
    },
  ],
};
