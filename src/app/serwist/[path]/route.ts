import { spawnSync } from "node:child_process";
import { createSerwistRoute } from "@serwist/turbopack";

// Revisions version the precached HTML so a new deployment replaces it. Vercel
// sets the commit SHA; fall back to git, then to a random value (which just
// means every build refreshes the pages).
const revision =
  process.env.VERCEL_GIT_COMMIT_SHA ||
  spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf-8" }).stdout?.trim() ||
  crypto.randomUUID();

export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } =
  createSerwistRoute({
    swSrc: "src/app/sw.ts",
    useNativeEsbuild: true,
    // Only the hashed build output is precached (the default also takes every
    // file in public/, which is icons and screenshots the app shell doesn't
    // need). Fonts are included so text renders correctly offline.
    globPatterns: [".next/static/**/*.{js,css,woff2}"],
    // The app shell, the /split page shell (its data lives in the query
    // string) and the offline fallback.
    additionalPrecacheEntries: ["/", "/split", "/offline"].map((url) => ({
      url,
      revision,
    })),
  });
