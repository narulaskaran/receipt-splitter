/**
 * Currency support utilities for multi-currency receipt splitting
 */

export interface CurrencyInfo {
  code: string;
  name: string;
  symbol: string;
  locale: string;
  minorUnits: number; // Number of decimal places (e.g., 2 for USD, 0 for JPY)
}

/**
 * Supported currencies with their metadata
 * ISO 4217 currency codes
 */
export const SUPPORTED_CURRENCIES: Record<string, CurrencyInfo> = {
  USD: {
    code: 'USD',
    name: 'US Dollar',
    symbol: '$',
    locale: 'en-US',
    minorUnits: 2,
  },
  EUR: {
    code: 'EUR',
    name: 'Euro',
    symbol: '€',
    locale: 'en-EU',
    minorUnits: 2,
  },
  GBP: {
    code: 'GBP',
    name: 'British Pound',
    symbol: '£',
    locale: 'en-GB',
    minorUnits: 2,
  },
  CAD: {
    code: 'CAD',
    name: 'Canadian Dollar',
    symbol: 'C$',
    locale: 'en-CA',
    minorUnits: 2,
  },
  AUD: {
    code: 'AUD',
    name: 'Australian Dollar',
    symbol: 'A$',
    locale: 'en-AU',
    minorUnits: 2,
  },
  JPY: {
    code: 'JPY',
    name: 'Japanese Yen',
    symbol: '¥',
    locale: 'ja-JP',
    minorUnits: 0,
  },
  CNY: {
    code: 'CNY',
    name: 'Chinese Yuan',
    symbol: '¥',
    locale: 'zh-CN',
    minorUnits: 2,
  },
  INR: {
    code: 'INR',
    name: 'Indian Rupee',
    symbol: '₹',
    locale: 'en-IN',
    minorUnits: 2,
  },
  MXN: {
    code: 'MXN',
    name: 'Mexican Peso',
    symbol: 'MX$',
    locale: 'es-MX',
    minorUnits: 2,
  },
  CHF: {
    code: 'CHF',
    name: 'Swiss Franc',
    symbol: 'CHF',
    locale: 'de-CH',
    minorUnits: 2,
  },
  SEK: {
    code: 'SEK',
    name: 'Swedish Krona',
    symbol: 'kr',
    locale: 'sv-SE',
    minorUnits: 2,
  },
  NZD: {
    code: 'NZD',
    name: 'New Zealand Dollar',
    symbol: 'NZ$',
    locale: 'en-NZ',
    minorUnits: 2,
  },
  SGD: {
    code: 'SGD',
    name: 'Singapore Dollar',
    symbol: 'S$',
    locale: 'en-SG',
    minorUnits: 2,
  },
  HKD: {
    code: 'HKD',
    name: 'Hong Kong Dollar',
    symbol: 'HK$',
    locale: 'en-HK',
    minorUnits: 2,
  },
  NOK: {
    code: 'NOK',
    name: 'Norwegian Krone',
    symbol: 'kr',
    locale: 'nb-NO',
    minorUnits: 2,
  },
  DKK: {
    code: 'DKK',
    name: 'Danish Krone',
    symbol: 'kr',
    locale: 'da-DK',
    minorUnits: 2,
  },
  PLN: {
    code: 'PLN',
    name: 'Polish Zloty',
    symbol: 'zł',
    locale: 'pl-PL',
    minorUnits: 2,
  },
  BRL: {
    code: 'BRL',
    name: 'Brazilian Real',
    symbol: 'R$',
    locale: 'pt-BR',
    minorUnits: 2,
  },
  KRW: {
    code: 'KRW',
    name: 'South Korean Won',
    symbol: '₩',
    locale: 'ko-KR',
    minorUnits: 0,
  },
  TRY: {
    code: 'TRY',
    name: 'Turkish Lira',
    symbol: '₺',
    locale: 'tr-TR',
    minorUnits: 2,
  },
};

export const DEFAULT_CURRENCY = 'USD';

/**
 * Get currency info, falling back to USD if not found
 */
export function getCurrencyInfo(currencyCode: string): CurrencyInfo {
  return SUPPORTED_CURRENCIES[currencyCode] || SUPPORTED_CURRENCIES[DEFAULT_CURRENCY];
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
 */
export function toMinorUnits(amount: number, currencyCode: string = DEFAULT_CURRENCY): number {
  const currency = getCurrencyInfo(currencyCode);
  if (!isFinite(amount)) return 0;

  const multiplier = Math.pow(10, currency.minorUnits);
  return Math.round(amount * multiplier);
}

/**
 * Convert amount from minor units to major units
 */
export function fromMinorUnits(amountMinorUnits: number, currencyCode: string = DEFAULT_CURRENCY): number {
  const currency = getCurrencyInfo(currencyCode);
  if (!isFinite(amountMinorUnits)) return 0;

  const divisor = Math.pow(10, currency.minorUnits);
  return amountMinorUnits / divisor;
}

/**
 * Get a list of all supported currency codes
 */
export function getSupportedCurrencies(): CurrencyInfo[] {
  return Object.values(SUPPORTED_CURRENCIES).sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Validate if a currency code is supported
 */
export function isSupportedCurrency(currencyCode: string): boolean {
  return currencyCode in SUPPORTED_CURRENCIES;
}
