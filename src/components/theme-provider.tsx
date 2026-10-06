"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useSyncExternalStore,
} from "react";

import { THEME_STORAGE_KEY, isTheme, type Theme } from "@/lib/theme";

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

function readStoredTheme(): Theme | null {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isTheme(stored) ? stored : null;
  } catch {
    return null;
  }
}

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
  // The latest choice made in this tab. Takes precedence over storage so the
  // toggle still works when localStorage is blocked or full; cleared when
  // another tab changes the stored theme.
  const chosenTheme = useRef<Theme | null>(null);

  const subscribe = useCallback((onChange: () => void) => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== null && event.key !== THEME_STORAGE_KEY) return;
      chosenTheme.current = null;
      onChange();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener(THEME_CHANGE_EVENT, onChange);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(THEME_CHANGE_EVENT, onChange);
    };
  }, []);

  const theme = useSyncExternalStore(
    subscribe,
    () => chosenTheme.current ?? readStoredTheme() ?? defaultTheme,
    () => defaultTheme
  );

  const setTheme = useCallback((next: Theme) => {
    chosenTheme.current = next;
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Storage blocked or full: chosenTheme still applies for this page load.
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