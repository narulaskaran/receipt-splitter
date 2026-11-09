// Shared (client + server) handling of pasted receipt links.

const MAX_URL_LENGTH = 2048;

/**
 * Returns the canonical http(s) URL for pasted text, or null if it isn't a
 * usable link. A missing scheme is filled in ("toasttab.com/receipts/x"), but
 * anything with whitespace, credentials or a dotless host ("lunch") is not a
 * link.
 */
export function normalizeReceiptUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed || trimmed.length > MAX_URL_LENGTH || /\s/.test(trimmed)) {
    return null;
  }

  const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return null;
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (url.username || url.password) return null;
  if (!url.hostname.includes(".")) return null;
  return url.href;
}

const INVALID_LINK_PREFIX = "invalid link";
const MRKDWN_CHARS = /[<>|`*_~@!&]/g;
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/g;

/** Safe label for a pasted string that did not normalize to a URL (webhooks / Slack). */
export function neutralizeInvalidReceiptLink(input: string): string {
  // ASCII only (no bidi or zero-width tricks), and defanged so chat clients do
  // not auto-link a URL or domain inside the echoed text.
  let cleaned = input
    .replace(CONTROL_CHARS, " ")
    .replace(/[^\x20-\x7e]/g, "")
    .replace(MRKDWN_CHARS, "")
    .replace(/:\/\//g, "[://]")
    .replace(/\./g, "[.]");
  cleaned = cleaned.replace(/\s+/g, " ").trim();
  if (!cleaned) return INVALID_LINK_PREFIX;
  const capped = cleaned.slice(0, 200);
  return `${INVALID_LINK_PREFIX}: ${capped}`;
}
