import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { getThemeInitScript } from "../src/lib/theme";

const mobileDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(mobileDir, "..");

export default defineConfig({
  root: mobileDir,
  base: "./",
  plugins: [
    react(),
    tailwindcss(),
    {
      // The web app serves /venmo.png from public/. The mobile root is
      // mobile/, so emit just that icon (not the whole public/ folder, which
      // has large PWA screenshots) at the bundle root.
      name: "receipt-splitter-venmo-icon",
      generateBundle() {
        this.emitFile({
          type: "asset",
          fileName: "venmo.png",
          source: fs.readFileSync(path.resolve(repoRoot, "public/venmo.png")),
        });
      },
    },
    {
      // The entry script lives outside the Vite root (mobile/). `vite build`
      // resolves "../src/mobile/main.tsx" relative to the HTML file, but the
      // dev server turns it into "/src/mobile/main.tsx" under the root, which
      // 404s. Serve it through /@fs instead; `server.fs.allow` already covers
      // the repo. Dev only: ctx.server is undefined during a build.
      name: "receipt-splitter-dev-entry",
      transformIndexHtml: {
        // "pre": Vite's own rewrite of relative script URLs would otherwise
        // run first and turn this one into /src/..., which the dev server 404s.
        order: "pre",
        handler(html, ctx) {
          if (!ctx.server) return html;
          return html.replace(
            '"../src/mobile/main.tsx"',
            `"/@fs${path.resolve(repoRoot, "src/mobile/main.tsx")}"`
          );
        },
      },
    },
    {
      name: "receipt-splitter-theme-init",
      transformIndexHtml(html) {
        return html.replace(
          "<!--theme-init-->",
          `<script>${getThemeInitScript("system")}</script>`
        );
      },
    },
  ],
  resolve: {
    alias: {
      "@": path.resolve(repoRoot, "src"),
      "next/image": path.resolve(mobileDir, "shims/next-image.tsx"),
    },
  },
  define: {
    "process.env.NEXT_PUBLIC_SHARE_ORIGIN": JSON.stringify(
      process.env.NEXT_PUBLIC_SHARE_ORIGIN ?? ""
    ),
  },
  build: {
    outDir: path.resolve(repoRoot, "dist-mobile"),
    emptyOutDir: true,
    target: ["es2022", "safari26"],
  },
  server: {
    fs: {
      allow: [repoRoot],
    },
  },
});
