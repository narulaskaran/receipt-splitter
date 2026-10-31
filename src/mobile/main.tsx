import { Capacitor } from "@capacitor/core";
import { createRoot, type Root } from "react-dom/client";
import { App } from "@/mobile/App";
import { bootNativeShell, configureMobileApp, type MobileViteEnv } from "@/mobile/boot";
import "@/mobile/mobile.css";

// TODO: Analytics for native is documented in docs/ios/privacy.md.
// Do not add analytics SDKs here.

let mobileRoot: Root | null = null;

/**
 * Configure, hydrate (bounded; a hung Preferences call fails closed), then
 * mount once. A late hydration result must not mount again. Failures are
 * logged here so the boot promise does not become an unhandled rejection.
 */
export async function startMobileApp(env: MobileViteEnv, isNative = Capacitor.isNativePlatform()): Promise<void> {
  try {
    configureMobileApp(env);
    if (isNative) await bootNativeShell();
    renderMobileRoot();
  } catch (error) {
    console.error("Mobile startup failed; continuing without blocking on boot.", error);
    try {
      renderMobileRoot();
    } catch (renderError) {
      console.error("Mobile render failed", renderError);
    }
  }
}

function renderMobileRoot(): void {
  if (mobileRoot) return;
  const rootElement = document.getElementById("root");
  if (!rootElement) return;
  mobileRoot = createRoot(rootElement);
  mobileRoot.render(<App />);
}

/** Lets tests mount again. Production calls startMobileApp once. */
export function resetMobileRootForTests(): void {
  mobileRoot = null;
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
