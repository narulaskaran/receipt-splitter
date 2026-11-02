import { useSyncExternalStore } from "react";

function subscribe(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

/**
 * Whether the browser reports a network connection. `true` is not a guarantee
 * (a captive portal still reads as online), but `false` reliably means offline
 * in a normal browser. WKWebView can leave `navigator.onLine` true when the
 * radio is up and the request still fails, so a failed parse is also treated
 * as offline-like. Assumes online on the server so hydration matches the
 * common case.
 */
export function useOnlineStatus(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true
  );
}
