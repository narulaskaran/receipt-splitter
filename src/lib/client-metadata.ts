export type ClientPlatform = "web" | "ios";

export interface ClientMetadata {
  platform: ClientPlatform | null;
  version: string | null;
}

function parseClientPlatform(header: string | null): ClientPlatform | null {
  const value = header?.trim().toLowerCase();
  return value === "web" || value === "ios" ? value : null;
}

/** Length-capped, alphanumeric-ish client version string for webhooks. */
function parseClientVersion(header: string | null): string | null {
  const sanitized = (header ?? "")
    .trim()
    .replace(/[^\w.\-+]/g, "")
    .slice(0, 64);
  return sanitized.length > 0 ? sanitized : null;
}

export function parseClientMetadata(request: {
  headers: { get(name: string): string | null };
}): ClientMetadata {
  return {
    platform: parseClientPlatform(
      request.headers.get("X-Client-Platform")
    ),
    version: parseClientVersion(request.headers.get("X-Client-Version")),
  };
}
