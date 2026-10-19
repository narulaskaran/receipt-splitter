/// <reference lib="esnext" />
/// <reference lib="webworker" />
import { defaultCache } from "@serwist/turbopack/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { NetworkOnly, Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // The API is never served from a cache. defaultCache would otherwise
    // apply a NetworkFirst rule to same-origin GETs under /api/.
    {
      matcher: ({ url }) => url.pathname.startsWith("/api/"),
      handler: new NetworkOnly(),
    },
    ...defaultCache,
  ],
});

serwist.addEventListeners();

// Visitors of the previous (@ducanh2912/next-pwa, /sw.js) service worker get
// this one in its place, because it registers for the same scope. Drop the
// caches only that worker used: its Workbox precache and its start-url cache.
// This listener is additive: Serwist's own activate handler keeps running.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("workbox-") || key === "start-url")
            .map((key) => caches.delete(key)),
        ),
      ),
  );
});
