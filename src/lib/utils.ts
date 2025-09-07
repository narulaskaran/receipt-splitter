import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Money helpers (minor units)
export function toCents(amountDollars: number): number {
  if (!isFinite(amountDollars)) return 0;
  return Math.round(amountDollars * 100);
}

export function fromCents(amountCents: number): number {
  if (!isFinite(amountCents)) return 0;
  return amountCents / 100;
}

/**
 * Formats a currency amount given in minor units (cents) to USD major units for display.
 */
export function formatAmount(amountMinorUnits: number): string {
  const dollars = fromCents(amountMinorUnits);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(dollars);
}
