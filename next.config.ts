import type { NextConfig } from "next";
import { withSerwist } from "@serwist/turbopack";

// The service worker is built by the route handler in
// src/app/serwist/[path]/route.ts (from src/app/sw.ts), so both `next dev`
// and `next build` run on Turbopack.
const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Browsers must always revalidate the worker script so a new
        // deployment's precache manifest is picked up.
        source: "/serwist/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
        ],
      },
    ];
  },
};

export default withSerwist(nextConfig);
