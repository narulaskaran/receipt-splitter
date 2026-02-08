import {
  formatCurrency,
  getCurrencyInfo,
  getSupportedCurrencies,
  isSupportedCurrency,
  toMinorUnits,
  fromMinorUnits,
  DEFAULT_CURRENCY,
} from './currency';

describe('Currency utilities', () => {
  describe('formatCurrency', () => {
    it('formats USD correctly', () => {
      expect(formatCurrency(12.5, 'USD')).toMatch(/\$12\.50/);
    });

    it('formats EUR correctly', () => {
      expect(formatCurrency(12.5, 'EUR')).toMatch(/12[.,]50/);
    });

    it('formats GBP correctly', () => {
      expect(formatCurrency(12.5, 'GBP')).toMatch(/£12\.50/);
    });

    it('formats JPY correctly (no decimal places)', () => {
      const formatted = formatCurrency(1250, 'JPY');
      expect(formatted).toContain('1,250');
      expect(formatted).not.toContain('.');
    });

    it('defaults to USD for invalid currency', () => {
      expect(formatCurrency(12.5, 'INVALID')).toMatch(/\$12\.50/);
    });

    it('uses default currency when not specified', () => {
      expect(formatCurrency(12.5)).toMatch(/\$12\.50/);
    });
  });

  describe('getCurrencyInfo', () => {
    it('returns USD info for USD', () => {
      const info = getCurrencyInfo('USD');
      expect(info.code).toBe('USD');
      expect(info.symbol).toBe('$');
      expect(info.minorUnits).toBe(2);
    });

    it('returns EUR info for EUR', () => {
      const info = getCurrencyInfo('EUR');
      expect(info.code).toBe('EUR');
      expect(info.symbol).toBe('€');
      expect(info.minorUnits).toBe(2);
    });

    it('returns JPY info for JPY', () => {
      const info = getCurrencyInfo('JPY');
      expect(info.code).toBe('JPY');
      expect(info.minorUnits).toBe(0);
    });

    it('defaults to USD for invalid currency', () => {
      const info = getCurrencyInfo('INVALID');
      expect(info.code).toBe('USD');
    });
  });

  describe('toMinorUnits', () => {
    it('converts USD to cents', () => {
      expect(toMinorUnits(12.50, 'USD')).toBe(1250);
    });

    it('converts EUR to cents', () => {
      expect(toMinorUnits(12.50, 'EUR')).toBe(1250);
    });

    it('converts JPY (no minor units)', () => {
      expect(toMinorUnits(1250, 'JPY')).toBe(1250);
    });

    it('handles rounding correctly', () => {
      expect(toMinorUnits(12.555, 'USD')).toBe(1256);
    });

    it('handles non-finite values', () => {
      expect(toMinorUnits(Infinity, 'USD')).toBe(0);
      expect(toMinorUnits(NaN, 'USD')).toBe(0);
    });
  });

  describe('fromMinorUnits', () => {
    it('converts cents to USD', () => {
      expect(fromMinorUnits(1250, 'USD')).toBe(12.50);
    });

    it('converts cents to EUR', () => {
      expect(fromMinorUnits(1250, 'EUR')).toBe(12.50);
    });

    it('converts JPY (no minor units)', () => {
      expect(fromMinorUnits(1250, 'JPY')).toBe(1250);
    });

    it('handles non-finite values', () => {
      expect(fromMinorUnits(Infinity, 'USD')).toBe(0);
      expect(fromMinorUnits(NaN, 'USD')).toBe(0);
    });
  });

  describe('getSupportedCurrencies', () => {
    it('returns an array of currency info', () => {
      const currencies = getSupportedCurrencies();
      expect(Array.isArray(currencies)).toBe(true);
      expect(currencies.length).toBeGreaterThan(0);
    });

    it('includes USD', () => {
      const currencies = getSupportedCurrencies();
      const usd = currencies.find(c => c.code === 'USD');
      expect(usd).toBeDefined();
    });

    it('includes EUR', () => {
      const currencies = getSupportedCurrencies();
      const eur = currencies.find(c => c.code === 'EUR');
      expect(eur).toBeDefined();
    });

    it('returns currencies sorted by name', () => {
      const currencies = getSupportedCurrencies();
      const names = currencies.map(c => c.name);
      const sortedNames = [...names].sort();
      expect(names).toEqual(sortedNames);
    });
  });

  describe('isSupportedCurrency', () => {
    it('returns true for USD', () => {
      expect(isSupportedCurrency('USD')).toBe(true);
    });

    it('returns true for EUR', () => {
      expect(isSupportedCurrency('EUR')).toBe(true);
    });

    it('returns false for invalid currency', () => {
      expect(isSupportedCurrency('INVALID')).toBe(false);
    });

    it('returns false for empty string', () => {
      expect(isSupportedCurrency('')).toBe(false);
    });
  });

  describe('Cache behavior', () => {
    it('caches currency info for repeated calls', () => {
      // First call should populate cache
      const first = getCurrencyInfo('EUR');

      // Second call should return cached object (same reference)
      const second = getCurrencyInfo('EUR');

      // Verify both calls return the same data
      expect(first.code).toBe(second.code);
      expect(first.symbol).toBe(second.symbol);
      expect(first.name).toBe(second.name);
      expect(first.minorUnits).toBe(second.minorUnits);

      // Verify it's the same cached object (reference equality)
      expect(first).toBe(second);
    });

    it('caches multiple currencies independently', () => {
      const usd = getCurrencyInfo('USD');
      const eur = getCurrencyInfo('EUR');
      const jpy = getCurrencyInfo('JPY');

      // Second calls should return cached objects
      expect(getCurrencyInfo('USD')).toBe(usd);
      expect(getCurrencyInfo('EUR')).toBe(eur);
      expect(getCurrencyInfo('JPY')).toBe(jpy);

      // Verify they're different objects
      expect(usd).not.toBe(eur);
      expect(eur).not.toBe(jpy);
    });
  });

  describe('DEFAULT_CURRENCY', () => {
    it('is set to USD', () => {
      expect(DEFAULT_CURRENCY).toBe('USD');
    });
  });
});
