import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Monorepo: file-tracing must resolve from the workspace root (two levels up
  // from apps/web) so hoisted root node_modules are included in the bundle.
  outputFileTracingRoot: path.join(__dirname, "../../"),
  // Shared workspace packages ship raw TS source — let Next transpile them.
  transpilePackages: ["@repo/types", "@repo/core", "@repo/server"],
  // Sicherheits-Header (backend/12 §5). HSTS/nosniff/Referrer global;
  // no-store zusätzlich auf allen /api-Routen.
  async headers() {
    const base = [
      { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "no-referrer" },
    ];
    return [
      { source: "/:path*", headers: base },
      { source: "/api/:path*", headers: [...base, { key: "Cache-Control", value: "no-store" }] },
    ];
  },
};

export default nextConfig;
