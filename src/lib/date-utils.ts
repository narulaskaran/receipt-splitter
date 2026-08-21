const ISO_DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Parse a date string without shifting calendar dates across timezones.
 * `YYYY-MM-DD` is treated as a local calendar date (not UTC midnight).
 */
export function parseDateString(dateString: string): Date | null {
  const isoDate = ISO_DATE_ONLY.exec(dateString);
  const date = isoDate
    ? new Date(
        Number(isoDate[1]),
        Number(isoDate[2]) - 1,
        Number(isoDate[3])
      )
    : new Date(dateString);

  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Format a date for display on the split page.
 * Invalid values fall back to the original string.
 */
export function formatDisplayDate(dateString: string): string {
  const date = parseDateString(dateString);
  if (!date) {
    return dateString;
  }

  return date.toLocaleDateString("en-US", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
