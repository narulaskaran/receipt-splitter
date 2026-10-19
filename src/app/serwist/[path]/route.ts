import { createSerwistRoute } from "@serwist/turbopack";

export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } =
  createSerwistRoute({
    swSrc: "src/app/sw.ts",
    useNativeEsbuild: true,
    // Only the hashed build output is precached (the default also takes every
    // file in public/, which is icons and screenshots the app shell doesn't
    // need). Fonts are included so text renders correctly offline.
    globPatterns: [".next/static/**/*.{js,css,woff2}"],
  });
