import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    // Point at the monorepo root so Turbopack can resolve packages hoisted
    // to the workspace-root node_modules (e.g. next itself after npm workspaces).
    root: path.resolve(__dirname, "../.."),
  },
  async rewrites() {
    const apiTarget =
      process.env.INTERNAL_API_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      "http://localhost:3001";
    return [
      {
        source: "/api/:path*",
        destination: `${apiTarget}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
