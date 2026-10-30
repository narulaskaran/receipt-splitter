export function homeHash(): string {
  return "#/";
}

export function splitHash(query = ""): string {
  const normalized = query.replace(/^\?/, "");
  return normalized ? `#/split?${normalized}` : "#/split";
}

export type MobileRoute =
  | { name: "home" }
  | { name: "split"; searchParams: URLSearchParams };

/** Hash router: `#/` is home, `#/split?<query>` is the shared split viewer. */
export function parseMobileHash(hash: string): MobileRoute {
  const raw = (hash.startsWith("#") ? hash.slice(1) : hash) || "/";
  const queryIndex = raw.indexOf("?");
  const path = queryIndex === -1 ? raw : raw.slice(0, queryIndex);
  const query = queryIndex === -1 ? "" : raw.slice(queryIndex + 1);
  const normalized = path.startsWith("/") ? path : `/${path}`;

  if (normalized === "/split" || normalized.startsWith("/split/")) {
    return { name: "split", searchParams: new URLSearchParams(query) };
  }

  return { name: "home" };
}
