import { NextResponse } from "next/server";

const DEFAULT_NATIVE_ORIGINS = ["capacitor://localhost"];

function configuredNativeOrigins(): string[] {
  const extra =
    process.env.NATIVE_APP_ORIGINS?.split(",")
      .map((s) => s.trim())
      .filter(Boolean) ?? [];
  return [...DEFAULT_NATIVE_ORIGINS, ...extra];
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

/** Returns true when `origin` may receive CORS headers (never `*`). */
export function isOriginAllowed(origin: string | null): boolean {
  if (!origin) {
    return false;
  }
  if (configuredNativeOrigins().includes(origin)) {
    return true;
  }
  return isLocalDevHttpOrigin(origin);
}

/** Echoes the request origin when allowed; otherwise null. */
export function resolveAllowedOrigin(origin: string | null): string | null {
  if (origin && isOriginAllowed(origin)) {
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
