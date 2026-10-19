import type { PrecacheFallbackEntry } from "serwist";

// What the service worker serves for a page that isn't cached when the network
// is down. The first matching entry wins, so the specific /split entry MUST stay
// before the generic document one; reordering would send shared split links to
// the offline page. Both URLs are precached (see the route in
// src/app/serwist/[path]/route.ts).
export const OFFLINE_FALLBACKS: PrecacheFallbackEntry[] = [
  // A shared split link carries its data in the query string, so the
  // precached /split shell can render it (the page reads the query client-side).
  {
    url: "/split",
    matcher: ({ request }) =>
      request.destination === "document" &&
      new URL(request.url).pathname === "/split",
  },
  {
    url: "/offline",
    matcher: ({ request }) => request.destination === "document",
  },
];
