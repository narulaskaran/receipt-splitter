// Where the client talks to. Web: same origin as the page. iOS: a configured
// HTTPS backend (the bundled app is served from capacitor://localhost, so a
// relative fetch would never reach Vercel). Call `configureApp` once at
// startup from the entrypoint (src/mobile/main.tsx); nothing else should read
// window.location.origin to build API or share URLs.

export type PlatformKind = "web" | "ios";

export interface AppConfig {
  platform: PlatformKind;
  /** Origin of the API, e.g. "https://split.narula.xyz". "" = same origin. */
  apiOrigin: string;
  /** Origin used in links people share (`/split?...`). Never a native-app origin. */
  publicOrigin: string;
  /** Marketing version of the native build, sent as X-Client-Version. */
  appVersion: string | null;
}

/** Documented default; override with NEXT_PUBLIC_SHARE_ORIGIN (web) or VITE_PUBLIC_ORIGIN (mobile). */
export const DEFAULT_PUBLIC_ORIGIN = "https://split.narula.xyz";

/** Versioned parse endpoint. The unversioned /api/parse-receipt stays for older clients. */
export const PARSE_RECEIPT_PATH = "/api/v1/parse-receipt";
export const LEGACY_PARSE_RECEIPT_PATH = "/api/parse-receipt";

let override: Partial<AppConfig> | null = null;

export function configureApp(config: Partial<AppConfig> | null): void {
  override = config;
}

function trimOrigin(origin: string): string {
  return origin.replace(/\/+$/, "");
}

function isHttpOrigin(origin: string): boolean {
  return /^https?:\/\//i.test(origin);
}

export function getAppConfig(): AppConfig {
  const platform = override?.platform ?? "web";
  const webOrigin =
    typeof window !== "undefined" && isHttpOrigin(window.location.origin)
      ? window.location.origin
      : null;

  const apiOrigin = trimOrigin(override?.apiOrigin ?? "");

  const publicOrigin = trimOrigin(
    override?.publicOrigin ||
      process.env.NEXT_PUBLIC_SHARE_ORIGIN ||
      // Web: share links on whatever domain served the page (previews, dev),
      // never capacitor://localhost.
      (platform === "web" ? webOrigin : null) ||
      DEFAULT_PUBLIC_ORIGIN
  );

  return {
    platform,
    apiOrigin,
    publicOrigin,
    appVersion: override?.appVersion ?? null,
  };
}

/** Absolute (native) or root-relative (web) URL for an API path. */
export function apiUrl(path: string): string {
  return `${getAppConfig().apiOrigin}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Origin for links meant to be opened by other people. */
export function getPublicShareOrigin(): string {
  return getAppConfig().publicOrigin;
}
