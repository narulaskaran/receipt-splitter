/// <reference lib="esnext" />
/// <reference lib="webworker" />
import { defaultCache } from "@serwist/turbopack/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { NetworkOnly, Serwist } from "serwist";
import { deleteLegacyCaches } from "../lib/legacy-caches";
import { OFFLINE_FALLBACKS } from "../lib/offline-fallbacks";
import {
  SHARE_TARGET_FIELD,
  SHARE_TARGET_PARAM,
  SHARE_TARGET_PATH,
  storeSharedFiles,
} from "../lib/share-target";

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
  fallbacks: { entries: OFFLINE_FALLBACKS },
});

// Web Share Target: receive files shared to the installed app (see
// src/lib/share-target.ts), then send the page to the home screen.
serwist.registerCapture(
  ({ url }) => url.pathname === SHARE_TARGET_PATH,
  async ({ request }) => {
    try {
      const formData = await request.formData();
      const files = formData
        .getAll(SHARE_TARGET_FIELD)
        .filter((value): value is File => value instanceof File);
      if (files.length > 0) await storeSharedFiles(files);
      return Response.redirect(`/?${SHARE_TARGET_PARAM}=1`, 303);
    } catch {
      return Response.redirect("/", 303);
    }
  },
  "POST"
);

serwist.addEventListeners();

// Visitors of the previous (@ducanh2912/next-pwa, /sw.js) service worker get
// this one in its place, because it registers for the same scope. Drop the
// caches only that worker used (see src/lib/legacy-caches.ts). This listener is
// additive: Serwist's own activate handler keeps running.
self.addEventListener("activate", (event) => {
  event.waitUntil(deleteLegacyCaches(caches));
});
