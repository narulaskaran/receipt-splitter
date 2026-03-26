/**
 * Currency support utilities for multi-currency receipt splitting
 *
 * This module uses the browser's built-in Intl API to derive currency symbols and names,
 * while maintaining only the essential metadata (minorUnits, locale) that can't be derived.
 */

import Decimal from 'decimal.js';

export interface CurrencyInfo {
  code: string;
  name: string;
  symbol: string;
  locale: string;
  minorUnits: number; // Number of decimal places (e.g., 2 for USD, 0 for JPY)
}

/**
 * Essential currency metadata that can't be derived from Intl API
 * Only stores: locale (for formatting) and minorUnits (decimal places)
 */
interface CurrencyMetadata {
  locale: string;
  minorUnits: number;
}

/**
 * Minimal hardcoded data - only what we can't derive from Intl API
 */
const CURRENCY_METADATA: Record<string, CurrencyMetadata> = {
  USD: { locale: 'en-US', minorUnits: 2 },
  EUR: { locale: 'de-DE', minorUnits: 2 },
  GBP: { locale: 'en-GB', minorUnits: 2 },
  CAD: { locale: 'en-CA', minorUnits: 2 },
  AUD: { locale: 'en-AU', minorUnits: 2 },
  JPY: { locale: 'ja-JP', minorUnits: 0 }, // Zero decimal places
  CNY: { locale: 'zh-CN', minorUnits: 2 },
  INR: { locale: 'en-IN', minorUnits: 2 },
  MXN: { locale: 'es-MX', minorUnits: 2 },
  CHF: { locale: 'de-CH', minorUnits: 2 },
  SEK: { locale: 'sv-SE', minorUnits: 2 },
  NZD: { locale: 'en-NZ', minorUnits: 2 },
  SGD: { locale: 'en-SG', minorUnits: 2 },
  HKD: { locale: 'en-HK', minorUnits: 2 },
  NOK: { locale: 'nb-NO', minorUnits: 2 },
  DKK: { locale: 'da-DK', minorUnits: 2 },
  PLN: { locale: 'pl-PL', minorUnits: 2 },
  BRL: { locale: 'pt-BR', minorUnits: 2 },
  KRW: { locale: 'ko-KR', minorUnits: 0 }, // Zero decimal places
  TRY: { locale: 'tr-TR', minorUnits: 2 },
};

export const DEFAULT_CURRENCY = 'USD';

/**
 * Cache for CurrencyInfo objects to avoid repeated Intl calls
 */
const currencyInfoCache = new Map<string, CurrencyInfo>();

/**
 * Extract currency symbol from Intl.NumberFormat
 */
function extractCurrencySymbol(currencyCode: string, locale: string): string {
  try {
    const formatter = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currencyCode,
      currencyDisplay: 'symbol',
    });

    // Format 0 and extract the currency symbol from parts
    const parts = formatter.formatToParts(0);
    const symbolPart = parts.find(part => part.type === 'currency');
    return symbolPart?.value || currencyCode;
  } catch {
    // Fallback to currency code if Intl fails
    return currencyCode;
  }
}

/**
 * Get currency display name from Intl.DisplayNames
 * Always uses English for consistency across the app
 */
function getCurrencyDisplayName(currencyCode: string): string {
  try {
    // Use English locale for consistency (app is in English)
    if (typeof Intl !== 'undefined' && 'DisplayNames' in Intl) {
      const displayNames = new Intl.DisplayNames(['en-US'], { type: 'currency' });
      return displayNames.of(currencyCode) || currencyCode;
    }
  } catch {
    // Fallback if DisplayNames not available
  }

  // Simple fallback mapping for display names
  const fallbackNames: Record<string, string> = {
    USD: 'US Dollar',
    EUR: 'Euro',
    GBP: 'British Pound',
    CAD: 'Canadian Dollar',
    AUD: 'Australian Dollar',
    JPY: 'Japanese Yen',
    CNY: 'Chinese Yuan',
    INR: 'Indian Rupee',
    MXN: 'Mexican Peso',
    CHF: 'Swiss Franc',
    SEK: 'Swedish Krona',
    NZD: 'New Zealand Dollar',
    SGD: 'Singapore Dollar',
    HKD: 'Hong Kong Dollar',
    NOK: 'Norwegian Krone',
    DKK: 'Danish Krone',
    PLN: 'Polish Zloty',
    BRL: 'Brazilian Real',
    KRW: 'South Korean Won',
    TRY: 'Turkish Lira',
  };

  return fallbackNames[currencyCode] || currencyCode;
}

/**
 * Build full CurrencyInfo from metadata + Intl API
 */
function buildCurrencyInfo(currencyCode: string): CurrencyInfo {
  const metadata = CURRENCY_METADATA[currencyCode] || CURRENCY_METADATA[DEFAULT_CURRENCY];

  return {
    code: currencyCode,
    name: getCurrencyDisplayName(currencyCode),
    symbol: extractCurrencySymbol(currencyCode, metadata.locale),
    locale: metadata.locale,
    minorUnits: metadata.minorUnits,
  };
}

/**
 * Supported currencies registry (for backward compatibility)
 * Lazy-loaded from CURRENCY_METADATA
 */
export const SUPPORTED_CURRENCIES: Record<string, CurrencyInfo> = new Proxy({} as Record<string, CurrencyInfo>, {
  get(target, prop: string) {
    if (!(prop in CURRENCY_METADATA)) {
      return undefined;
    }

    // Return cached or build new
    if (!currencyInfoCache.has(prop)) {
      currencyInfoCache.set(prop, buildCurrencyInfo(prop));
    }

    return currencyInfoCache.get(prop);
  },

  has(target, prop: string) {
    return prop in CURRENCY_METADATA;
  },

  ownKeys() {
    return Object.keys(CURRENCY_METADATA);
  },

  getOwnPropertyDescriptor(target, prop) {
    if (prop in CURRENCY_METADATA) {
      return {
        enumerable: true,
        configurable: true,
      };
    }
    return undefined;
  },
});

/**
 * Get currency info, falling back to USD if not found
 */
export function getCurrencyInfo(currencyCode: string): CurrencyInfo {
  // Check cache first
  if (currencyInfoCache.has(currencyCode)) {
    return currencyInfoCache.get(currencyCode)!;
  }

  // Build and cache if supported
  if (currencyCode in CURRENCY_METADATA) {
    const info = buildCurrencyInfo(currencyCode);
    currencyInfoCache.set(currencyCode, info);
    return info;
  }

  // Fallback to USD
  return getCurrencyInfo(DEFAULT_CURRENCY);
}

/**
 * Format an amount in the specified currency
 */
export function formatCurrency(amount: number, currencyCode: string = DEFAULT_CURRENCY): string {
  const currency = getCurrencyInfo(currencyCode);

  return new Intl.NumberFormat(currency.locale, {
    style: 'currency',
    currency: currency.code,
    minimumFractionDigits: currency.minorUnits,
    maximumFractionDigits: currency.minorUnits,
  }).format(amount);
}

/**
 * Convert amount to minor units (cents/pence/etc) based on currency
 *
 * Uses Decimal.js to avoid floating-point precision errors in financial calculations.
 * Example: toMinorUnits(12.34, 'USD') => 1234 (cents)
 *
 * @param amount - The amount in major units (e.g., dollars)
 * @param currencyCode - ISO 4217 currency code (defaults to USD)
 * @returns The amount in minor units (e.g., cents)
 */
export function toMinorUnits(amount: number, currencyCode: string = DEFAULT_CURRENCY): number {
  const currency = getCurrencyInfo(currencyCode);
  if (!isFinite(amount)) return 0;

  const multiplier = Math.pow(10, currency.minorUnits);
  return new Decimal(amount).times(multiplier).round().toNumber();
}

/**
 * Convert amount from minor units to major units
 *
 * Uses Decimal.js to avoid floating-point precision errors in financial calculations.
 * Example: fromMinorUnits(1234, 'USD') => 12.34 (dollars)
 *
 * @param amountMinorUnits - The amount in minor units (e.g., cents)
 * @param currencyCode - ISO 4217 currency code (defaults to USD)
 * @returns The amount in major units (e.g., dollars)
 */
export function fromMinorUnits(amountMinorUnits: number, currencyCode: string = DEFAULT_CURRENCY): number {
  const currency = getCurrencyInfo(currencyCode);
  if (!isFinite(amountMinorUnits)) return 0;

  const divisor = Math.pow(10, currency.minorUnits);
  return new Decimal(amountMinorUnits).dividedBy(divisor).toNumber();
}

/**
 * Get a list of all supported currency codes
 */
export function getSupportedCurrencies(): CurrencyInfo[] {
  return Object.keys(CURRENCY_METADATA)
    .map(code => getCurrencyInfo(code))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Validate if a currency code is supported
 */
export function isSupportedCurrency(currencyCode: string): boolean {
  return currencyCode in CURRENCY_METADATA;
}
