import { Capacitor } from "@capacitor/core";
import { createRoot } from "react-dom/client";
import { App } from "@/mobile/App";
import { bootNativeShell, configureMobileApp } from "@/mobile/boot";
import "@/mobile/mobile.css";

// TODO: Analytics for native is documented in docs/ios/privacy.md.
// Do not add analytics SDKs here.

void (async () => {
  configureMobileApp({
    VITE_API_ORIGIN: import.meta.env.VITE_API_ORIGIN,
    VITE_PUBLIC_ORIGIN: import.meta.env.VITE_PUBLIC_ORIGIN,
    VITE_APP_VERSION: import.meta.env.VITE_APP_VERSION,
  });

  if (Capacitor.isNativePlatform()) {
    await bootNativeShell();
  }

  const rootElement = document.getElementById("root");
  if (!rootElement) return;
  createRoot(rootElement).render(<App />);
})();
