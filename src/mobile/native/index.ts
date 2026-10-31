import { App } from "@capacitor/app";
import { Keyboard } from "@capacitor/keyboard";
import { StatusBar, Style } from "@capacitor/status-bar";

import { setPlatform } from "@/lib/platform";
import { PWA_BACKGROUND_DARK, PWA_BACKGROUND_LIGHT } from "@/lib/pwa";
import { safeGetItem } from "@/lib/storage";
import { THEME_STORAGE_KEY } from "@/lib/theme";

import { createNativePlatform } from "./platform";
import { flush, hydrateStorageFromPreferences } from "./storage";

export { createNativePlatform } from "./platform";
export { createNativeTipJar, TIP_PLUGIN_TIMEOUT_MS } from "./tip-jar";
export { flush, hydrateStorageFromPreferences } from "./storage";

let chromeBound = false;

function themeIsDark(): boolean {
  const root = document.documentElement;
  if (root.classList.contains("dark") && !root.classList.contains("light")) return true;
  if (root.classList.contains("light") && !root.classList.contains("dark")) return false;
  const stored = safeGetItem(THEME_STORAGE_KEY);
  if (stored === "dark") return true;
  if (stored === "light") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

async function applyStatusBar(): Promise<void> {
  const dark = themeIsDark();
  // Style.Dark is light text on a dark bar; Style.Light is dark text.
  const style = dark ? Style.Dark : Style.Light;
  const color = dark ? PWA_BACKGROUND_DARK : PWA_BACKGROUND_LIGHT;
  try {
    await StatusBar.setStyle({ style });
  } catch (error) {
    console.warn("StatusBar.setStyle failed", error);
  }
  try {
    await StatusBar.setBackgroundColor({ color });
  } catch (error) {
    console.warn("StatusBar.setBackgroundColor failed", error);
  }
}

async function applyKeyboard(): Promise<void> {
  try {
    // Receipt names and prices are short fields; the previous/next/done bar
    // is how people move between them on an iPhone.
    await Keyboard.setAccessoryBarVisible({ isVisible: true });
  } catch (error) {
    console.warn("Keyboard accessory bar setup failed", error);
  }
}

function bindChromeUpdates(): void {
  if (chromeBound) return;
  chromeBound = true;
  window.addEventListener("themechange", () => {
    void applyStatusBar();
  });
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    void applyStatusBar();
  });
}

function bindBackgroundFlush(): void {
  const flushInBackground = () => {
    void flush();
  };
  // WKWebView delivers these as well as Capacitor's appStateChange.
  window.addEventListener("pagehide", flushInBackground);
  document.addEventListener("pause", flushInBackground);
}

/**
 * Called once from the mobile entry before the first render. Hydration
 * finishes (or fails closed, without a mirror) before the platform adapter
 * is installed, so the first autosave cannot overwrite Preferences.
 */
export async function bootNative(): Promise<void> {
  await hydrateStorageFromPreferences();
  setPlatform(createNativePlatform());
  await applyStatusBar();
  await applyKeyboard();
  bindChromeUpdates();
  bindBackgroundFlush();
  try {
    await App.addListener("appStateChange", (state) => {
      if (!state.isActive) void flush();
    });
  } catch (error) {
    console.warn("App state listener failed", error);
  }
}
