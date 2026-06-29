import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Monorepo: file-tracing must resolve from the workspace root (two levels up
  // from apps/web) so hoisted root node_modules are included in the bundle.
  outputFileTracingRoot: path.join(__dirname, "../../"),
  // Shared workspace packages ship raw TS source — let Next transpile them.
  transpilePackages: ["@repo/types", "@repo/core"],
};

export default nextConfig;
