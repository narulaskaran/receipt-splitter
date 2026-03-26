import {
  generateVenmoLink,
  openVenmoPayment,
  shareVenmoPayment,
  formatVenmoNote,
  validateVenmoParams,
  VENMO_CONFIG,
  type VenmoPaymentParams,
} from './venmo-utils';

// Note: window.open, navigator.share are mocked globally in jest.setup.ts
// Use getter functions to ensure we get fresh mock references
const getMockWindowOpen = () => window.open as jest.Mock;
const getMockNavigatorShare = () => navigator.share as jest.Mock;

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
  it('generates correct Venmo link with all parameters', () => {
    const link = generateVenmoLink('5551234567', 25.50, 'Pizza Palace');
    
    expect(link).toBe('https://venmo.com/?txn=pay&recipients=5551234567&amount=25.50&note=Pizza+Palace');
  });

  it('generates link without note when note is empty', () => {
    const link = generateVenmoLink('5551234567', 25.50, '');
    
    expect(link).toBe('https://venmo.com/?txn=pay&recipients=5551234567&amount=25.50');
  });

  it('generates link without note parameter when note is not provided', () => {
    const link = generateVenmoLink('5551234567', 25.50);
    
    expect(link).toBe('https://venmo.com/?txn=pay&recipients=5551234567&amount=25.50');
  });

  it('handles phone numbers with formatting', () => {
    const link = generateVenmoLink('(555) 123-4567', 25.50, 'Test');
    
    expect(link).toBe('https://venmo.com/?txn=pay&recipients=5551234567&amount=25.50&note=Test');
  });

  it('handles 11-digit phone numbers with country code', () => {
    const link = generateVenmoLink('15551234567', 25.50, 'Test');
    
    expect(link).toBe('https://venmo.com/?txn=pay&recipients=15551234567&amount=25.50&note=Test');
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

    expect(link).toContain('note=Caf%C3%A9+%26+Co.');
  });

  it('generates link for USD currency (explicit)', () => {
    const link = generateVenmoLink('5551234567', 25.50, 'Test', 'USD');

    expect(link).toBe('https://venmo.com/?txn=pay&recipients=5551234567&amount=25.50&note=Test');
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

describe('openVenmoPayment', () => {
  beforeEach(() => {
    getMockWindowOpen().mockClear();
  });

  it('opens valid Venmo payment link', () => {
    getMockWindowOpen().mockReturnValue({} as Window);
    const result = openVenmoPayment('5551234567', 25.50, 'Test Restaurant');
    
    expect(result).toBe(true);
    expect(getMockWindowOpen()).toHaveBeenCalledWith(
      'https://venmo.com/?txn=pay&recipients=5551234567&amount=25.50&note=Test+Restaurant',
      '_blank',
      'noopener,noreferrer'
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

describe('shareVenmoPayment', () => {
  beforeEach(() => {
    getMockNavigatorShare().mockClear();
    getMockWindowOpen().mockClear();
  });

  it('uses native sharing when available', async () => {
    getMockNavigatorShare().mockResolvedValue(undefined);

    await shareVenmoPayment('5551234567', 25.50, 'Test Restaurant', 'Alice');
    
    expect(getMockNavigatorShare()).toHaveBeenCalledWith({
      title: 'Pay Alice via Venmo',
      text: 'Pay Alice $25.50 via Venmo',
      url: 'https://venmo.com/?txn=pay&recipients=5551234567&amount=25.50&note=Test+Restaurant',
    });
    expect(getMockWindowOpen()).not.toHaveBeenCalled();
  });

  it('falls back to window.open when sharing fails', async () => {
    getMockNavigatorShare().mockRejectedValue(new Error('Sharing failed'));
    getMockWindowOpen().mockReturnValue({} as Window);

    await shareVenmoPayment('5551234567', 25.50, 'Test Restaurant', 'Alice');
    
    expect(getMockNavigatorShare()).toHaveBeenCalled();
    expect(getMockWindowOpen()).toHaveBeenCalledWith(
      'https://venmo.com/?txn=pay&recipients=5551234567&amount=25.50&note=Test+Restaurant',
      '_blank',
      'noopener,noreferrer'
    );
  });

  it('does not open link when user cancels sharing', async () => {
    const abortError = new Error('User cancelled');
    abortError.name = 'AbortError';
    getMockNavigatorShare().mockRejectedValue(abortError);

    await shareVenmoPayment('5551234567', 25.50, 'Test Restaurant', 'Alice');
    
    expect(getMockNavigatorShare()).toHaveBeenCalled();
    expect(getMockWindowOpen()).not.toHaveBeenCalled();
  });

  it('throws error for invalid parameters', async () => {
    await expect(
      shareVenmoPayment('invalid', 25.50, 'Test', 'Alice')
    ).rejects.toThrow('Invalid payment parameters');
    
    expect(getMockNavigatorShare()).not.toHaveBeenCalled();
    expect(getMockWindowOpen()).not.toHaveBeenCalled();
  });

  it('throws error when window.open also fails', async () => {
    getMockNavigatorShare().mockRejectedValue(new Error('Sharing failed'));
    getMockWindowOpen().mockImplementation(() => {
      throw new Error('Window blocked');
    });
    
    await expect(
      shareVenmoPayment('5551234567', 25.50, 'Test', 'Alice')
    ).rejects.toThrow('Failed to open Venmo payment');
  });

  it('uses default person name when not provided', async () => {
    getMockNavigatorShare().mockResolvedValue(undefined);

    await shareVenmoPayment('5551234567', 25.50, 'Test Restaurant');
    
    expect(getMockNavigatorShare()).toHaveBeenCalledWith({
      title: 'Pay someone via Venmo',
      text: 'Pay someone $25.50 via Venmo',
      url: expect.stringContaining('venmo.com'),
    });
  });

  it('opens link directly when navigator.share is not available', async () => {
    // Temporarily remove navigator.share
    const originalShare = navigator.share;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (navigator as any).share;
    getMockWindowOpen().mockReturnValue({} as Window);

    await shareVenmoPayment('5551234567', 25.50, 'Test Restaurant', 'Alice');

    expect(getMockWindowOpen()).toHaveBeenCalledWith(
      'https://venmo.com/?txn=pay&recipients=5551234567&amount=25.50&note=Test+Restaurant',
      '_blank',
      'noopener,noreferrer'
    );

    // Restore navigator.share
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (navigator as any).share = originalShare;
  });

  it('throws error for EUR currency (Venmo only supports USD)', async () => {
    await expect(
      shareVenmoPayment('5551234567', 25.50, 'Test', 'Alice', 'EUR')
    ).rejects.toThrow('Venmo only supports USD payments');

    expect(getMockNavigatorShare()).not.toHaveBeenCalled();
    expect(getMockWindowOpen()).not.toHaveBeenCalled();
  });

  it('throws error for JPY currency (Venmo only supports USD)', async () => {
    await expect(
      shareVenmoPayment('5551234567', 1000, 'Test', 'Alice', 'JPY')
    ).rejects.toThrow('Venmo only supports USD payments');

    expect(getMockNavigatorShare()).not.toHaveBeenCalled();
    expect(getMockWindowOpen()).not.toHaveBeenCalled();
  });

  it('works with explicit USD currency', async () => {
    getMockNavigatorShare().mockResolvedValue(undefined);

    await shareVenmoPayment('5551234567', 25.50, 'Test Restaurant', 'Alice', 'USD');

    expect(getMockNavigatorShare()).toHaveBeenCalledWith({
      title: 'Pay Alice via Venmo',
      text: 'Pay Alice $25.50 via Venmo',
      url: 'https://venmo.com/?txn=pay&recipients=5551234567&amount=25.50&note=Test+Restaurant',
    });
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