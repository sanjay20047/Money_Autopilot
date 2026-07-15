import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite loads its WASM/data assets from node_modules at runtime —
  // keep it external instead of bundling it into the server build.
  serverExternalPackages: ["@electric-sql/pglite"],
};

export default nextConfig;
