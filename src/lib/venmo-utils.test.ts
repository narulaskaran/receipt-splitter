import {
  generateVenmoLink,
  generateVenmoWebLink,
  openVenmoPayment,
  formatVenmoNote,
  validateVenmoParams,
  VENMO_CONFIG,
  type VenmoPaymentParams,
} from './venmo-utils';

// Note: window.open, navigator.share are mocked globally in jest.setup.ts
// Use getter functions to ensure we get fresh mock references
const getMockWindowOpen = () => window.open as jest.Mock;

describe('validateVenmoParams', () => {
  const validParams: VenmoPaymentParams = {
    phoneNumber: '5551234567',
    amount: 25.00,
    note: 'Test payment',
  };

  it('validates correct Venmo parameters', () => {
    expect(validateVenmoParams(validParams)).toBe(true);
  });

  it('rejects invalid phone numbers', () => {
    expect(validateVenmoParams({ ...validParams, phoneNumber: '123' })).toBe(false);
    expect(validateVenmoParams({ ...validParams, phoneNumber: '' })).toBe(false);
    expect(validateVenmoParams({ ...validParams, phoneNumber: 'invalid' })).toBe(false);
  });

  it('rejects invalid amounts', () => {
    expect(validateVenmoParams({ ...validParams, amount: 0 })).toBe(false);
    expect(validateVenmoParams({ ...validParams, amount: -10 })).toBe(false);
    expect(validateVenmoParams({ ...validParams, amount: NaN })).toBe(false);
    expect(validateVenmoParams({ ...validParams, amount: VENMO_CONFIG.MAX_AMOUNT + 1 })).toBe(false);
  });

  it('accepts valid amounts within limits', () => {
    expect(validateVenmoParams({ ...validParams, amount: 0.01 })).toBe(true);
    expect(validateVenmoParams({ ...validParams, amount: VENMO_CONFIG.MAX_AMOUNT })).toBe(true);
  });

  it('rejects notes that are too long', () => {
    const longNote = 'A'.repeat(VENMO_CONFIG.MAX_NOTE_LENGTH + 1);
    expect(validateVenmoParams({ ...validParams, note: longNote })).toBe(false);
  });

  it('accepts empty and valid-length notes', () => {
    expect(validateVenmoParams({ ...validParams, note: '' })).toBe(true);
    expect(validateVenmoParams({ ...validParams, note: 'A'.repeat(VENMO_CONFIG.MAX_NOTE_LENGTH) })).toBe(true);
  });
});

describe('generateVenmoLink', () => {
  it('generates a native paycharge link with RFC 3986 note encoding', () => {
    const link = generateVenmoLink('5551234567', 25.50, 'Pizza Palace');
    
    expect(link).toBe('venmo://paycharge?txn=pay&recipients=5551234567&amount=25.50&note=Pizza%20Palace');
  });

  it('encodes spaces in notes as %20 so Venmo does not show plus signs', () => {
    const link = generateVenmoLink('5551234567', 29.53, 'Olive Garden - Karan');

    expect(link).toBe(
      'venmo://paycharge?txn=pay&recipients=5551234567&amount=29.53&note=Olive%20Garden%20-%20Karan'
    );
    expect(link).not.toContain('+');
  });

  it('encodes the reported restaurant+payer note without plus signs', () => {
    const note = formatVenmoNote('ANGEL INDIAN RESTAURANT', 'anuraag');
    const link = generateVenmoLink('5551234567', 25.80, note);

    expect(note).toBe('ANGEL INDIAN RESTAURANT - anuraag');
    expect(link).toBe(
      'venmo://paycharge?txn=pay&recipients=5551234567&amount=25.80&note=ANGEL%20INDIAN%20RESTAURANT%20-%20anuraag'
    );
    expect(link).not.toContain('+');
  });

  it('does not use the Venmo homepage URL that re-encodes spaces as pluses', () => {
    const link = generateVenmoLink('5551234567', 25.50, 'Pizza Palace');

    expect(link).not.toMatch(/^https:\/\/venmo\.com\/\?/);
  });

  it('encodes literal plus signs in notes as %2B', () => {
    const link = generateVenmoLink('5551234567', 25.50, 'A+B special');

    expect(link).toBe(
      'venmo://paycharge?txn=pay&recipients=5551234567&amount=25.50&note=A%2BB%20special'
    );
  });

  it('generates link without note when note is empty', () => {
    const link = generateVenmoLink('5551234567', 25.50, '');
    
    expect(link).toBe('venmo://paycharge?txn=pay&recipients=5551234567&amount=25.50');
  });

  it('generates link without note parameter when note is not provided', () => {
    const link = generateVenmoLink('5551234567', 25.50);
    
    expect(link).toBe('venmo://paycharge?txn=pay&recipients=5551234567&amount=25.50');
  });

  it('handles phone numbers with formatting', () => {
    const link = generateVenmoLink('(555) 123-4567', 25.50, 'Test');
    
    expect(link).toBe('venmo://paycharge?txn=pay&recipients=5551234567&amount=25.50&note=Test');
  });

  it('handles 11-digit phone numbers with country code', () => {
    const link = generateVenmoLink('15551234567', 25.50, 'Test');
    
    expect(link).toBe('venmo://paycharge?txn=pay&recipients=15551234567&amount=25.50&note=Test');
  });

  it('truncates notes that are too long', () => {
    const longNote = 'A'.repeat(VENMO_CONFIG.MAX_NOTE_LENGTH + 10);
    const link = generateVenmoLink('5551234567', 25.50, longNote);
    
    expect(link).toContain(`note=${'A'.repeat(VENMO_CONFIG.MAX_NOTE_LENGTH)}`);
  });

  it('returns null for invalid phone numbers', () => {
    expect(generateVenmoLink('123', 25.50, 'Test')).toBeNull();
    expect(generateVenmoLink('', 25.50, 'Test')).toBeNull();
    expect(generateVenmoLink('invalid', 25.50, 'Test')).toBeNull();
  });

  it('returns null for invalid amounts', () => {
    expect(generateVenmoLink('5551234567', 0, 'Test')).toBeNull();
    expect(generateVenmoLink('5551234567', -10, 'Test')).toBeNull();
    expect(generateVenmoLink('5551234567', NaN, 'Test')).toBeNull();
    expect(generateVenmoLink('5551234567', VENMO_CONFIG.MAX_AMOUNT + 1, 'Test')).toBeNull();
  });

  it('handles special characters in note', () => {
    const link = generateVenmoLink('5551234567', 25.50, 'Café & Co.');

    expect(link).toContain('note=Caf%C3%A9%20%26%20Co.');
  });

  it('generates link for USD currency (explicit)', () => {
    const link = generateVenmoLink('5551234567', 25.50, 'Test', 'USD');

    expect(link).toBe('venmo://paycharge?txn=pay&recipients=5551234567&amount=25.50&note=Test');
  });

  it('returns null for EUR currency (Venmo only supports USD)', () => {
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const link = generateVenmoLink('5551234567', 25.50, 'Test', 'EUR');

    expect(link).toBeNull();
    expect(consoleSpy).toHaveBeenCalledWith('Venmo only supports USD. Attempted to generate link for EUR');

    consoleSpy.mockRestore();
  });

  it('returns null for JPY currency (Venmo only supports USD)', () => {
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const link = generateVenmoLink('5551234567', 1000, 'Test', 'JPY');

    expect(link).toBeNull();
    expect(consoleSpy).toHaveBeenCalledWith('Venmo only supports USD. Attempted to generate link for JPY');

    consoleSpy.mockRestore();
  });

  it('returns null for GBP currency (Venmo only supports USD)', () => {
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const link = generateVenmoLink('5551234567', 25.50, 'Test', 'GBP');

    expect(link).toBeNull();
    expect(consoleSpy).toHaveBeenCalledWith('Venmo only supports USD. Attempted to generate link for GBP');

    consoleSpy.mockRestore();
  });
});

describe('generateVenmoWebLink', () => {
  it('uses the /pay compose page with %20-encoded notes', () => {
    const link = generateVenmoWebLink('5551234567', 25.50, 'Pizza Palace');

    expect(link).toBe(
      'https://venmo.com/pay?txn=pay&recipients=5551234567&amount=25.50&note=Pizza%20Palace'
    );
    expect(link).not.toContain('+');
    expect(link).not.toMatch(/^https:\/\/venmo\.com\/\?/);
  });

  it('returns null for invalid parameters', () => {
    expect(generateVenmoWebLink('invalid', 25.50, 'Test')).toBeNull();
  });
});

describe('openVenmoPayment', () => {
  const originalUserAgent = navigator.userAgent;

  beforeEach(() => {
    getMockWindowOpen().mockClear();
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      value: originalUserAgent,
    });
  });

  it('opens the web compose URL on desktop', () => {
    getMockWindowOpen().mockReturnValue({} as Window);
    const result = openVenmoPayment('5551234567', 25.50, 'Test Restaurant');
    
    expect(result).toBe(true);
    expect(getMockWindowOpen()).toHaveBeenCalledWith(
      'https://venmo.com/pay?txn=pay&recipients=5551234567&amount=25.50&note=Test%20Restaurant',
      '_blank',
      'noopener,noreferrer'
    );
  });

  it('opens the native paycharge URL on mobile so notes keep %20 spaces', () => {
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
    });
    getMockWindowOpen().mockReturnValue({} as Window);

    const result = openVenmoPayment('5551234567', 25.80, 'ANGEL INDIAN RESTAURANT - anuraag');

    expect(result).toBe(true);
    expect(getMockWindowOpen()).toHaveBeenCalledWith(
      'venmo://paycharge?txn=pay&recipients=5551234567&amount=25.80&note=ANGEL%20INDIAN%20RESTAURANT%20-%20anuraag',
      '_self'
    );
  });

  it('returns false for invalid parameters', () => {
    const result = openVenmoPayment('invalid', 25.50, 'Test');
    
    expect(result).toBe(false);
    expect(getMockWindowOpen()).not.toHaveBeenCalled();
  });

  it('handles window.open errors gracefully', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    getMockWindowOpen().mockImplementation(() => {
      throw new Error('Window blocked');
    });

    const result = openVenmoPayment('5551234567', 25.50, 'Test');
    
    expect(result).toBe(false);
    expect(consoleSpy).toHaveBeenCalledWith('Failed to open Venmo payment link:', expect.any(Error));
    
    consoleSpy.mockRestore();
  });
});

describe('formatVenmoNote', () => {
  it('formats note with split note and person name', () => {
    const note = formatVenmoNote('Pizza Palace', 'Alice');
    expect(note).toBe('Pizza Palace - Alice');
  });

  it('formats note with only split note', () => {
    const note = formatVenmoNote('Pizza Palace');
    expect(note).toBe('Pizza Palace');
  });

  it('formats note with only person name', () => {
    const note = formatVenmoNote(undefined, 'Alice');
    expect(note).toBe('Split with Alice');
  });

  it('formats default note when neither name is provided', () => {
    const note = formatVenmoNote();
    expect(note).toBe('Receipt Split');
  });

  it('truncates long notes to Venmo limit', () => {
    const longNote = 'A'.repeat(VENMO_CONFIG.MAX_NOTE_LENGTH);
    const note = formatVenmoNote(longNote, 'Alice');
    
    expect(note.length).toBe(VENMO_CONFIG.MAX_NOTE_LENGTH);
    expect(note).toBe('A'.repeat(VENMO_CONFIG.MAX_NOTE_LENGTH));
  });

  it('handles empty strings as undefined', () => {
    const note = formatVenmoNote('', '');
    expect(note).toBe('Receipt Split');
  });

  it('handles whitespace-only strings', () => {
    const note = formatVenmoNote('   ', '   ');
    expect(note).toBe('Receipt Split');
  });
});