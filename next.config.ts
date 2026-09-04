import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Server-side app (API routes power the mode providers). `standalone` emits a
  // self-contained .next/standalone server for a lean container image (App Runner).
  output: "standalone",
  images: { unoptimized: true },
  // SQLite native module support (Modes 1/2). Kept external so it isn't bundled.
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
