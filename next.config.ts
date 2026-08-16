import type { NextConfig } from "next";
import withPWA from "@ducanh2912/next-pwa";

// next-pwa injects a webpack config. Next.js 16 defaults to Turbopack, so
// production builds use `next build --webpack` to keep PWA generation working.

const nextConfig: NextConfig = {
  // Empty turbopack config lets `next dev` use Turbopack while next-pwa's
  // webpack plugin still runs for production builds (`next build --webpack`).
  turbopack: {},
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "storage.ko-fi.com",
      },
    ],
  },
};

export default withPWA({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
})(nextConfig);
