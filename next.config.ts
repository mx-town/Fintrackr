import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["pdf-parse", "sharp", "better-sqlite3"],
};

export default nextConfig;
