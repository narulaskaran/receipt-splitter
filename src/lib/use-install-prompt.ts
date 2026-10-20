import { useEffect, useState, useSyncExternalStore } from "react";

// Chromium fires `beforeinstallprompt` when the app is installable. It isn't in
// lib.dom.d.ts.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
}

// Captured at module scope so an event that fires before React mounts is not
// missed. It can only be used once, so it is dropped after prompting.
let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

function setDeferredPrompt(event: BeforeInstallPromptEvent | null) {
  deferredPrompt = event;
  listeners.forEach((listener) => listener());
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault(); // keep the event so we can show our own prompt
    setDeferredPrompt(event as BeforeInstallPromptEvent);
  });
  window.addEventListener("appinstalled", () => setDeferredPrompt(null));
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function isIOSDevice(nav: Pick<Navigator, "userAgent" | "maxTouchPoints">) {
  // iPadOS reports a desktop Mac user agent, but a Mac has no touch points.
  return (
    /iPad|iPhone|iPod/.test(nav.userAgent) ||
    (/Macintosh/.test(nav.userAgent) && nav.maxTouchPoints > 1)
  );
}

function isStandalone() {
  return (
    window.matchMedia?.("(display-mode: standalone)")?.matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export type InstallMethod =
  /** Chromium: we can trigger the browser's install prompt. */
  | "prompt"
  /** iOS: no API; the user has to use Share > Add to Home Screen. */
  | "ios-instructions";

/**
 * How the user can install the app right now, or null when they can't (already
 * installed, or a browser without an install flow).
 */
export function useInstallPrompt(): {
  method: InstallMethod | null;
  promptInstall: () => Promise<void>;
} {
  const deferred = useSyncExternalStore(
    subscribe,
    () => deferredPrompt,
    () => null
  );
  // Browser-only facts, read after mount so server and client markup match.
  const [env, setEnv] = useState({ standalone: false, ios: false });
  useEffect(() => {
    const update = () =>
      setEnv({ standalone: isStandalone(), ios: isIOSDevice(navigator) });
    update();
    // Installing from the browser menu switches the window to standalone
    // without necessarily firing appinstalled in this tab.
    const standaloneQuery = window.matchMedia?.("(display-mode: standalone)");
    standaloneQuery?.addEventListener?.("change", update);
    return () => standaloneQuery?.removeEventListener?.("change", update);
  }, []);

  const promptInstall = async () => {
    if (!deferred) return;
    // The event can only be used once, so the link goes away now, even if the
    // user dismisses the dialog. Chromium fires beforeinstallprompt again
    // later, though not necessarily in this session.
    setDeferredPrompt(null);
    try {
      await deferred.prompt();
    } catch (error) {
      console.error("Install prompt failed:", error);
    }
  };

  let method: InstallMethod | null = null;
  if (!env.standalone) {
    if (deferred) method = "prompt";
    else if (env.ios) method = "ios-instructions";
  }
  return { method, promptInstall };
}
