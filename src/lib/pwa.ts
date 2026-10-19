// Colors for the installed app's chrome. They match --background in
// globals.css (light: oklch(0.965 0.002 260), dark: oklch(0.145 0 0));
// pwa.test.ts fails if they drift apart.
export const PWA_BACKGROUND_LIGHT = "#f3f3f5";
export const PWA_BACKGROUND_DARK = "#0a0a0a";

// For viewport.themeColor: the browser UI color for each color scheme.
export const PWA_THEME_COLORS = [
  { media: "(prefers-color-scheme: light)", color: PWA_BACKGROUND_LIGHT },
  { media: "(prefers-color-scheme: dark)", color: PWA_BACKGROUND_DARK },
];
