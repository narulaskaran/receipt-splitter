// Jest runs the suite as CommonJS. `import.meta.env` (read by the iOS
// platform adapter for VITE_TIP_PRODUCT_IDS) is module syntax, so the test
// compile rewrites `import.meta.env` to `process.env`. Vite still sees
// `import.meta.env` in the source and inlines it for the mobile build.
function importMetaEnvPlugin() {
  return {
    visitor: {
      // Runs before the TypeScript preset strips `as` casts, so match the
      // MetaProperty itself: `(import.meta as …).env` becomes `process.env`.
      MetaProperty(path) {
        const { node } = path;
        if (node.meta.name === "import" && node.property.name === "meta") {
          path.replaceWithSourceString("process");
        }
      },
    },
  };
}

module.exports = {
  presets: [
    ["@babel/preset-env", { targets: { node: "current" } }],
    ["@babel/preset-react", { runtime: "automatic" }],
    "@babel/preset-typescript",
  ],
  plugins: [importMetaEnvPlugin],
};
