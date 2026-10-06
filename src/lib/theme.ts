// Shared by the client ThemeProvider and the server layout, so it must not be
// a "use client" module (the layout calls getThemeInitScript during render).

export type Theme = "dark" | "light" | "system";

export const THEME_STORAGE_KEY = "theme";

export function isTheme(value: unknown): value is Theme {
  return value === "light" || value === "dark" || value === "system";
}

// Inline script for <head> that applies the saved theme before hydration, so a
// saved dark preference doesn't flash light on load. Pass the same
// defaultTheme the ThemeProvider gets so first paint matches it.
export function getThemeInitScript(defaultTheme: Theme = "system"): string {
  return `(function(){var t;try{t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)})}catch(e){}if(t!=="light"&&t!=="dark"&&t!=="system"){t=${JSON.stringify(defaultTheme)}}if(t==="system"){t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}document.documentElement.classList.add(t)})()`;
}
