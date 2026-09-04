import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    settings: {
      // eslint-plugin-react 7.37 still calls context.getFilename() when
      // version is "detect". That API was removed in ESLint 10.
      // https://github.com/vercel/next.js/issues/89764
      react: { version: "19.2.8" },
    },
    rules: {
      "@next/next/no-img-element": "off",
      // New in eslint-plugin-react-hooks v7 (eslint-config-next 16).
      // Existing localStorage/dialog reset effects would need a broader refactor.
      "react-hooks/set-state-in-effect": "off",
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "public/sw.js",
    "public/workbox-*.js",
    "coverage/**",
    "scripts/**",
    "__mocks__/**",
  ]),
]);

export default eslintConfig;
