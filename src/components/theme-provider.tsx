"use client";

import { createContext, useCallback, useContext, useEffect, useSyncExternalStore } from "react";

export type Theme = "dark" | "light" | "system";

export const THEME_STORAGE_KEY = "theme";

type ThemeProviderProps = {
  children: React.ReactNode;
  defaultTheme?: Theme;
  enableSystem?: boolean;
  disableTransitionOnChange?: boolean;
  attribute?: string;
};

type ThemeProviderState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

const initialState: ThemeProviderState = {
  theme: "system",
  setTheme: () => null,
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

const THEME_CHANGE_EVENT = "themechange";

function isTheme(value: unknown): value is Theme {
  return value === "light" || value === "dark" || value === "system";
}

function readStoredTheme(): Theme | null {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isTheme(stored) ? stored : null;
  } catch {
    return null;
  }
}

function subscribeToStoredTheme(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  window.addEventListener(THEME_CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(THEME_CHANGE_EVENT, onChange);
  };
}

// Runs before hydration (see layout.tsx) so a saved dark preference doesn't
// flash light on load.
export const themeInitScript = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t!=="light"&&t!=="dark"){t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}document.documentElement.classList.add(t)}catch(e){}})()`;

// When attribute === "class", theme classes are toggled via classList above;
// never overwrite the root's entire class attribute.
function applyAttribute(
  root: HTMLElement,
  attribute: string,
  value: Theme
): void {
  if (attribute !== "class") {
    root.setAttribute(attribute, value);
  }
}

export function ThemeProvider({
  children,
  defaultTheme = "system",
  enableSystem = true,
  disableTransitionOnChange = false,
  attribute = "data-theme",
  ...props
}: ThemeProviderProps) {
  const theme = useSyncExternalStore(
    subscribeToStoredTheme,
    () => readStoredTheme() ?? defaultTheme,
    () => defaultTheme
  );

  const setTheme = useCallback((next: Theme) => {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Storage unavailable (private mode); the change still applies this session.
    }
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
  }, []);

  useEffect(() => {
    const root = window.document.documentElement;

    root.classList.remove("light", "dark");

    if (disableTransitionOnChange) {
      root.classList.add("transition-none");
      window.setTimeout(() => {
        root.classList.remove("transition-none");
      }, 0);
    }

    if (theme === "system" && enableSystem) {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
        .matches
        ? "dark"
        : "light";

      root.classList.add(systemTheme);
      applyAttribute(root, attribute, systemTheme);
      return;
    }

    root.classList.add(theme);
    applyAttribute(root, attribute, theme);
  }, [theme, enableSystem, disableTransitionOnChange, attribute]);

  // Listen for system theme changes
  useEffect(() => {
    if (!enableSystem) return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const handleChange = () => {
      if (theme === "system") {
        const systemTheme = mediaQuery.matches ? "dark" : "light";
        const root = window.document.documentElement;

        root.classList.remove("light", "dark");
        root.classList.add(systemTheme);
        applyAttribute(root, attribute, systemTheme);
      }
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [theme, attribute, enableSystem]);

  return (
    <ThemeProviderContext.Provider {...props} value={{ theme, setTheme }}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext);

  if (context === undefined)
    throw new Error("useTheme must be used within a ThemeProvider");

  return context;
}
