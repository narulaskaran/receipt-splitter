import { Capacitor } from "@capacitor/core";
import { createRoot } from "react-dom/client";
import { App } from "@/mobile/App";
import { setPlatform, webPlatform } from "@/lib/platform";
import { bootNativeShell, configureMobileApp, type MobileViteEnv } from "@/mobile/boot";
import "@/mobile/mobile.css";

// TODO: Analytics for native is documented in docs/ios/privacy.md.
// Do not add analytics SDKs here.

/**
 * Configure, hydrate storage (bounded; a hung Preferences call fails closed
 * inside bootNativeShell), then mount. Failures are logged here so the boot
 * promise does not become an unhandled rejection.
 */
export async function startMobileApp(env: MobileViteEnv, isNative = Capacitor.isNativePlatform()): Promise<void> {
  try {
    configureMobileApp(env);
    if (isNative) await bootNativeShell();
    else if (import.meta.env.DEV && new URLSearchParams(window.location.search).has("native")) {
      // Dev only (stripped from builds): `?native` in a desktop browser shows the
      // iOS layout without the Capacitor bridge, so UI work does not need a phone.
      setPlatform({ ...webPlatform, kind: "ios", isNative: true, showKofi: false });
    }
    const rootElement = document.getElementById("root");
    if (rootElement) createRoot(rootElement).render(<App />);
  } catch (error) {
    console.error("Mobile startup failed", error);
  }
}

const runningUnderJest =
  typeof process !== "undefined" && process.env.JEST_WORKER_ID !== undefined;

if (!runningUnderJest) {
  void startMobileApp({
    VITE_API_ORIGIN: import.meta.env.VITE_API_ORIGIN,
    VITE_PUBLIC_ORIGIN: import.meta.env.VITE_PUBLIC_ORIGIN,
    VITE_APP_VERSION: import.meta.env.VITE_APP_VERSION,
  });
}
