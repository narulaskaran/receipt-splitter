import { NextResponse } from "next/server";

const DEFAULT_NATIVE_ORIGINS = ["capacitor://localhost"];

let cachedOriginsEnv: string | undefined;
let cachedExtraOrigins: string[] = [];

function isValidOriginEntry(entry: string): string | null {
  if (entry === "*" || /\s/.test(entry)) return null;
  try {
    const url = new URL(entry);
    if (url.search || url.hash) return null;
    const path = url.pathname;
    if (path !== "" && path !== "/") return null;
    if (url.protocol === "http:" || url.protocol === "https:") {
      return url.origin;
    }
    return `${url.protocol}//${url.host}`;
  } catch {
    return null;
  }
}

/** Valid, normalized origins from a NATIVE_APP_ORIGINS value, plus the entries that were dropped. */
export function parseNativeAppOrigins(env: string): { origins: string[]; ignored: string[] } {
  const origins: string[] = [];
  const ignored: string[] = [];
  for (const part of env.split(",")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const normalized = isValidOriginEntry(trimmed);
    if (!normalized) ignored.push(trimmed);
    else if (!origins.includes(normalized)) origins.push(normalized);
  }
  return { origins, ignored };
}

function configuredNativeOrigins(): string[] {
  const env = process.env.NATIVE_APP_ORIGINS ?? "";
  if (env !== cachedOriginsEnv) {
    const { origins, ignored } = parseNativeAppOrigins(env);
    if (ignored.length > 0) {
      console.warn(`[CORS] Ignoring invalid NATIVE_APP_ORIGINS entries: ${ignored.join(", ")}`);
    }
    cachedOriginsEnv = env;
    cachedExtraOrigins = origins;
  }
  return [...DEFAULT_NATIVE_ORIGINS, ...cachedExtraOrigins];
}

function isLocalDevHttpOrigin(origin: string): boolean {
  if (process.env.NODE_ENV === "production") {
    return false;
  }
  try {
    const url = new URL(origin);
    return (
      url.protocol === "http:" &&
      (url.hostname === "localhost" || url.hostname === "127.0.0.1")
    );
  } catch {
    return false;
  }
}

/** Echoes the request origin when allowed (never `*`); otherwise null. */
function resolveAllowedOrigin(origin: string | null): string | null {
  if (!origin) return null;
  if (configuredNativeOrigins().includes(origin) || isLocalDevHttpOrigin(origin)) {
    return origin;
  }
  return null;
}

// CORS and session IDs are not authentication — they only gate browser cross-origin
// access and correlate requests for observability.

export function v1PreflightResponse(origin: string | null): NextResponse {
  const allowed = resolveAllowedOrigin(origin);
  if (!allowed) {
    return NextResponse.json({ error: "Origin not allowed" }, { status: 403 });
  }

  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": allowed,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers":
        "Content-Type, X-Client-Platform, X-Client-Version",
      "Access-Control-Max-Age": "86400",
      Vary: "Origin",
    },
  });
}

export function withV1Cors(
  response: NextResponse,
  origin: string | null,
  extraHeaders?: Record<string, string>
): NextResponse {
  const allowed = resolveAllowedOrigin(origin);
  if (allowed) {
    response.headers.set("Access-Control-Allow-Origin", allowed);
    response.headers.set("Vary", "Origin");
  }
  response.headers.set("X-API-Version", "1");
  response.headers.set(
    "Access-Control-Expose-Headers",
    "X-API-Version, Retry-After"
  );
  if (extraHeaders) {
    for (const [key, value] of Object.entries(extraHeaders)) {
      response.headers.set(key, value);
    }
  }
  return response;
}
