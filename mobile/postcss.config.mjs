// The repo's PostCSS config is for Next.js (`@tailwindcss/postcss` as a string).
// The mobile bundle uses @tailwindcss/vite instead, so this directory must not
// inherit that plugin.
const config = {
  plugins: {},
};

export default config;
