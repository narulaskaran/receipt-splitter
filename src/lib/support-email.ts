/**
 * Public contact shown on /privacy and /support.
 *
 * Set NEXT_PUBLIC_SUPPORT_EMAIL to a real address before release. When it is
 * unset, the pages show SUPPORT_EMAIL_FALLBACK and do not invent an address.
 */
export const SUPPORT_EMAIL_FALLBACK =
  "the contact address listed in the App Store listing";

export function supportEmailFrom(raw: string | undefined): string {
  const trimmed = raw?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : SUPPORT_EMAIL_FALLBACK;
}

export const SUPPORT_EMAIL = supportEmailFrom(
  process.env.NEXT_PUBLIC_SUPPORT_EMAIL,
);

export function isSupportEmailAddress(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
