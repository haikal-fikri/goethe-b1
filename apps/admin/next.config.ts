import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname, "../../"),
  transpilePackages: ["@repo/types", "@repo/core", "@repo/server"],
  // Sicherheits-Header (teacher-lms/06 §7). HSTS/nosniff/Referrer global;
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
