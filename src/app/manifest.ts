import type { MetadataRoute } from "next";
import { PWA_BACKGROUND_LIGHT } from "@/lib/pwa";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Receipt Splitter",
    short_name: "Split",
    description:
      "Upload a receipt, add people, and easily split items. No downloads or account creation required.",
    lang: "en",
    start_url: "/",
    scope: "/",
    display: "standalone",
    // The manifest has no dark variant, so these use the light page color; the
    // browser UI color follows the color scheme via viewport.themeColor.
    background_color: PWA_BACKGROUND_LIGHT,
    theme_color: PWA_BACKGROUND_LIGHT,
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icon-maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    // Lets Chrome show its richer install dialog. Regenerate these with the
    // screenshot harness' mock data when the UI changes noticeably.
    screenshots: [
      {
        src: "/screenshots/narrow-items.png",
        sizes: "780x1688",
        type: "image/png",
        form_factor: "narrow",
        label: "Assign receipt items to people",
      },
      {
        src: "/screenshots/narrow-results.png",
        sizes: "780x1688",
        type: "image/png",
        form_factor: "narrow",
        label: "See what everyone owes",
      },
      {
        src: "/screenshots/wide-results.png",
        sizes: "1280x720",
        type: "image/png",
        form_factor: "wide",
        label: "See what everyone owes",
      },
    ],
    categories: ["finance", "utilities", "productivity"],
  };
}
