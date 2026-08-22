import { withPayload } from "@payloadcms/next/withPayload";
import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Diese App ist ESM ("type": "module" — Payloads CLI lädt die Config sonst als
// CJS und scheitert am Top-Level-await von @payloadcms/richtext-lexical).
// Deshalb kein __dirname wie in den übrigen Apps.
const dirname = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // Monorepo: file-tracing from the workspace root (two levels up) so hoisted
  // root node_modules are included.
  outputFileTracingRoot: path.join(dirname, "../../"),
  // Shared workspace packages ship raw TS source — let Next transpile them.
  transpilePackages: ["@repo/types", "@repo/core", "@repo/server"],
  images: {
    formats: ["image/avif", "image/webp"],
  },
  // Sicherheits-Header analog zu apps/teacher-web. Abweichung: frame-ancestors
  // 'self' statt 'none', damit die Payload-Live-Preview (gleicher Origin) das
  // Frontend einbetten kann.
  async headers() {
    const base = [
      { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "no-referrer" },
      { key: "X-Frame-Options", value: "SAMEORIGIN" },
      { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
    ];
    return [
      { source: "/:path*", headers: base },
      // Medien-Dateien laufen über /api/media/file/* und müssen zwischen-
      // gespeichert werden dürfen — sonst lädt jedes Bild bei jedem Aufruf neu.
      { source: "/api/media/:path*", headers: base },
      { source: "/api/:path*", headers: [...base, { key: "Cache-Control", value: "no-store" }] },
      { source: "/admin/:path*", headers: [...base, { key: "Cache-Control", value: "no-store" }] },
    ];
  },
};

export default withPayload(nextConfig);
