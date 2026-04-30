import type { NextConfig } from "next";
import withPWA from "@ducanh2912/next-pwa";

const nextConfig: NextConfig = {
  images: {
    domains: ["storage.ko-fi.com"],
  },
  async headers() {
    return [
      {
        // Advertise the MPP tip endpoint on all HTML pages so agents can discover it
        source: "/:path*",
        headers: [
          {
            key: "Link",
            value: '</api/mpp/tip>; rel="payment"; title="Tip via MPP"',
          },
        ],
      },
    ];
  },
};

export default withPWA({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
})(nextConfig);
