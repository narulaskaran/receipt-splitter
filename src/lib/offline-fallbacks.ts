import type { PrecacheFallbackEntry } from "serwist";

// What the service worker serves for a page that isn't cached when the network
// is down. The first matching entry wins, so the specific /split entry MUST stay
// before the generic document one; reordering would send shared split links to
// the offline page. All three URLs are precached (see the route in
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
  // The app shell with a query string (e.g. /?share-target=1 after a receipt is
  // shared to the installed app): precache lookups only ignore tracking params,
  // so it wouldn't be found. The page itself explains that it is offline.
  {
    url: "/",
    matcher: ({ request }) =>
      request.destination === "document" &&
      new URL(request.url).pathname === "/",
  },
  {
    url: "/offline",
    matcher: ({ request }) => request.destination === "document",
  },
];
