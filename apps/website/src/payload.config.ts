import path from "node:path";
import { fileURLToPath } from "node:url";
import { postgresAdapter } from "@payloadcms/db-postgres";
import { lexicalEditor } from "@payloadcms/richtext-lexical";
import { s3Storage } from "@payloadcms/storage-s3";
import { buildConfig, type Plugin } from "payload";
import sharp from "sharp";

import { Authors } from "@/collections/Authors";
import { ContactSubmissions } from "@/collections/ContactSubmissions";
import { DocGroups } from "@/collections/DocGroups";
import { Docs } from "@/collections/Docs";
import { Media } from "@/collections/Media";
import { Posts } from "@/collections/Posts";
import { Users } from "@/collections/Users";
import { Pricing } from "@/globals/Pricing";
import { SiteSettings } from "@/globals/SiteSettings";

const dirname = path.dirname(fileURLToPath(import.meta.url));

// Uploads landen in einem eigenen Cloudflare-R2-Bucket (S3-kompatibel, wie in
// apps/teacher-web). Fehlen die Variablen, bleibt Payload beim lokalen
// Dateisystem — brauchbar für die Entwicklung, überlebt aber kein Deployment.
const r2Configured = Boolean(
  process.env.R2_BUCKET &&
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY
);

const plugins: Plugin[] = r2Configured
  ? [
      s3Storage({
        collections: { media: true },
        bucket: process.env.R2_BUCKET as string,
        config: {
          region: "auto",
          endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
          credentials: {
            accessKeyId: process.env.R2_ACCESS_KEY_ID as string,
            secretAccessKey: process.env.R2_SECRET_ACCESS_KEY as string,
          },
        },
      }),
    ]
  : [];

export default buildConfig({
  serverURL: process.env.NEXT_PUBLIC_SITE_URL,
  admin: {
    user: Users.slug,
    meta: {
      titleSuffix: " · Digital Sprache Institut",
    },
  },
  collections: [Posts, Authors, Docs, DocGroups, Media, ContactSubmissions, Users],
  globals: [SiteSettings, Pricing],
  editor: lexicalEditor(),
  db: postgresAdapter({
    // Eigenes Schema in der geteilten Supabase-Datenbank: Payloads Migrationen
    // fassen die App-Tabellen (public) nicht an.
    schemaName: "payload",
    migrationDir: path.resolve(dirname, "migrations"),
    pool: {
      // Session-Pooler (5432) — der Transaction-Pooler (6543) blockiert DDL.
      connectionString: process.env.DATABASE_URL,
      // KLEIN halten, und zwar mit Absicht: Der Supabase-Session-Pooler lässt
      // insgesamt nur 15 Verbindungen zu, und die teilt sich diese App mit
      // web, teacher-web und admin auf DERSELBEN Datenbank. Ein Build mit
      // mehreren Arbeitsprozessen (jeder mit eigenem Pool) hat die Grenze
      // sonst gerissen — Fehlermeldung `EMAXCONNSESSION, max clients reached
      // in session mode` — und hätte im Zweifel den laufenden Apps die
      // Verbindungen weggenommen.
      max: Number(process.env.DATABASE_POOL_MAX ?? 2),
      idleTimeoutMillis: 10_000,
      // Lieber kurz anstehen als sofort scheitern, wenn es eng wird.
      connectionTimeoutMillis: 30_000,
    },
  }),
  sharp,
  plugins,
  secret: process.env.PAYLOAD_SECRET || "",
  typescript: { outputFile: path.resolve(dirname, "payload-types.ts") },
  // Ohne eigene Domain-Liste akzeptiert Payload nur denselben Origin; das
  // Admin läuft hier ohnehin unter derselben Domain wie die Website.
  cors: [],
  csrf: [],
  // Die Website liest ausschließlich über die Local API, das Admin über REST.
  // GraphQL wird nirgends gemountet — abschalten, statt eine ungenutzte
  // Abfrageschnittstelle offenzuhalten.
  graphQL: { disable: true },
});
