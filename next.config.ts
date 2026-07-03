import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emit a self-contained server bundle in .next/standalone for slim Docker images.
  output: "standalone",
};

export default nextConfig;
