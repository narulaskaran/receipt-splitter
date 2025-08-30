import { 
  serializeSplitData, 
  deserializeSplitData, 
  generateShareableUrl, 
  validateSplitData,
  validateSplitDataDetailed,
  validateSerializationInput,
  isValidPhoneNumber,
  isValidDateFormat,
  SplitDataError,
  VALIDATION_LIMITS,
  type SharedSplitData 
} from './split-sharing';
import { type Person } from '@/types';

// Mock data for testing
const mockPeople: Person[] = [
  {
    id: '1',
    name: 'Alice',
    items: [],
    totalBeforeTax: 25.00,
    tax: 2.50,
    tip: 5.00,
    finalTotal: 32.50,
  },
  {
    id: '2',
    name: 'Bob',
    items: [],
    totalBeforeTax: 15.00,
    tax: 1.50,
    tip: 3.00,
    finalTotal: 19.50,
  },
  {
    id: '3',
    name: 'Charlie',
    items: [],
    totalBeforeTax: 10.00,
    tax: 1.00,
    tip: 2.00,
    finalTotal: 13.00,
  },
];

describe('serializeSplitData', () => {
  it('should serialize split data correctly with required fields', () => {
    const params = serializeSplitData(mockPeople, 'Pizza Palace', '5551234567');
    
    // Names should be sorted alphabetically
    expect(params.get('names')).toBe('Alice,Bob,Charlie');
    expect(params.get('amounts')).toBe('32.50,19.50,13.00');
    expect(params.get('total')).toBe('65.00');
    expect(params.get('note')).toBe('Pizza Palace');
    expect(params.get('phone')).toBe('5551234567');
  });

  it('should include optional date when provided', () => {
    const params = serializeSplitData(
      mockPeople,
      'Pizza Palace',
      '5551234567',
      '2024-01-15'
    );
    
    expect(params.get('note')).toBe('Pizza Palace');
    expect(params.get('phone')).toBe('5551234567');
    expect(params.get('date')).toBe('2024-01-15');
  });

  it('should work without optional date', () => {
    const params = serializeSplitData(mockPeople, 'Test Note', '5551234567', null);
    
    expect(params.get('note')).toBe('Test Note');
    expect(params.get('phone')).toBe('5551234567');
    expect(params.get('date')).toBeNull();
  });

  it('should throw error for empty people array', () => {
    expect(() => serializeSplitData([], 'Test', '5551234567')).toThrow('Invalid split data: At least one person must be included in the split');
  });

  it('should throw error for empty note', () => {
    expect(() => serializeSplitData(mockPeople, '', '5551234567')).toThrow('Invalid split data: Note/memo is required for split sharing');
    expect(() => serializeSplitData(mockPeople, '   ', '5551234567')).toThrow('Invalid split data: Note/memo is required for split sharing');
  });

  it('should throw error for empty phone', () => {
    expect(() => serializeSplitData(mockPeople, 'Test Note', '')).toThrow('Invalid split data: Phone number is required for split sharing');
    expect(() => serializeSplitData(mockPeople, 'Test Note', '   ')).toThrow('Invalid split data: Phone number is required for split sharing');
  });

  it('should handle special characters in names and note', () => {
    const specialPeople: Person[] = [
      { ...mockPeople[0], name: 'José María' },
      { ...mockPeople[1], name: 'François & Co.' },
    ];
    
    const params = serializeSplitData(specialPeople, 'Café René & Co.', '5551234567');
    
    // Should preserve special characters in URL encoding
    expect(params.get('names')).toBe('François & Co.,José María');
    expect(params.get('note')).toBe('Café René & Co.');
  });
});

describe('deserializeSplitData', () => {
  it('should deserialize valid parameters correctly', () => {
    const params = new URLSearchParams({
      names: 'Alice,Bob,Charlie',
      amounts: '32.50,19.50,13.00',
      total: '65.00',
      note: 'Pizza Palace',
      phone: '5551234567',
      date: '2024-01-15'
    });

    const result = deserializeSplitData(params);
    
    expect(result).not.toBeNull();
    expect(result!.names).toEqual(['Alice', 'Bob', 'Charlie']);
    expect(result!.amounts).toEqual([32.50, 19.50, 13.00]);
    expect(result!.total).toBe(65.00);
    expect(result!.note).toBe('Pizza Palace');
    expect(result!.phone).toBe('5551234567');
    expect(result!.date).toBe('2024-01-15');
  });

  it('should work with required parameters only (no date)', () => {
    const params = new URLSearchParams({
      names: 'Alice,Bob',
      amounts: '30.00,20.00',
      total: '50.00',
      note: 'Test Split',
      phone: '5551234567'
    });

    const result = deserializeSplitData(params);
    
    expect(result).not.toBeNull();
    expect(result!.names).toEqual(['Alice', 'Bob']);
    expect(result!.amounts).toEqual([30.00, 20.00]);
    expect(result!.total).toBe(50.00);
    expect(result!.note).toBe('Test Split');
    expect(result!.phone).toBe('5551234567');
    expect(result!.date).toBeUndefined();
  });

  it('should return null for missing required parameters', () => {
    const incompleteParams = [
      new URLSearchParams({ amounts: '30.00', total: '30.00', note: 'Test', phone: '5551234567' }), // missing names
      new URLSearchParams({ names: 'Alice', total: '30.00', note: 'Test', phone: '5551234567' }), // missing amounts
      new URLSearchParams({ names: 'Alice', amounts: '30.00', note: 'Test', phone: '5551234567' }), // missing total
      new URLSearchParams({ names: 'Alice', amounts: '30.00', total: '30.00', phone: '5551234567' }), // missing note
      new URLSearchParams({ names: 'Alice', amounts: '30.00', total: '30.00', note: 'Test' }), // missing phone
      new URLSearchParams({}), // missing everything
    ];

    incompleteParams.forEach(params => {
      expect(deserializeSplitData(params)).toBeNull();
    });
  });

  it('should return null for mismatched array lengths', () => {
    const params = new URLSearchParams({
      names: 'Alice,Bob',
      amounts: '30.00', // only one amount for two names
      total: '30.00',
      note: 'Test',
      phone: '5551234567'
    });

    expect(deserializeSplitData(params)).toBeNull();
  });

  it('should return null for invalid amounts', () => {
    const invalidAmountParams = [
      new URLSearchParams({ names: 'Alice', amounts: 'invalid', total: '30.00', note: 'Test', phone: '5551234567' }),
      new URLSearchParams({ names: 'Alice', amounts: '-5.00', total: '30.00', note: 'Test', phone: '5551234567' }),
      new URLSearchParams({ names: 'Alice', amounts: '30.00', total: 'invalid', note: 'Test', phone: '5551234567' }),
      new URLSearchParams({ names: 'Alice', amounts: '30.00', total: '-50.00', note: 'Test', phone: '5551234567' }),
    ];

    invalidAmountParams.forEach(params => {
      expect(deserializeSplitData(params)).toBeNull();
    });
  });

  it('should handle empty names gracefully', () => {
    const params = new URLSearchParams({
      names: 'Alice,,Bob', // empty name in middle
      amounts: '30.00,0.00,20.00',
      total: '50.00',
      note: 'Test',
      phone: '5551234567'
    });

    const result = deserializeSplitData(params);
    expect(result).toBeNull(); // Should reject empty names
  });

  it('should return null for empty required fields', () => {
    const params = new URLSearchParams({
      names: 'Alice,Bob',
      amounts: '30.00,20.00',
      total: '50.00',
      note: '   ', // empty note
      phone: '5551234567'
    });

    expect(deserializeSplitData(params)).toBeNull();

    const params2 = new URLSearchParams({
      names: 'Alice,Bob',
      amounts: '30.00,20.00',
      total: '50.00',
      note: 'Test',
      phone: '' // empty phone
    });

    expect(deserializeSplitData(params2)).toBeNull();
  });

  it('should handle special characters correctly', () => {
    const params = new URLSearchParams({
      names: 'José María,François & Co.',
      amounts: '32.50,19.50',
      total: '52.00',
      note: 'Café René & Co.',
      phone: '5551234567'
    });

    const result = deserializeSplitData(params);
    
    expect(result).not.toBeNull();
    expect(result!.names).toEqual(['José María', 'François & Co.']);
    expect(result!.note).toBe('Café René & Co.');
    expect(result!.phone).toBe('5551234567');
  });
});

describe('generateShareableUrl', () => {
  it('should generate complete URL with all parameters', () => {
    const baseUrl = 'https://receipt-splitter.app';
    const url = generateShareableUrl(
      baseUrl,
      mockPeople,
      'Pizza Palace',
      '5551234567',
      '2024-01-15'
    );

    expect(url).toMatch(/^https:\/\/receipt-splitter\.app\/split\?/);
    expect(url).toContain('names=Alice%2CBob%2CCharlie');
    expect(url).toContain('amounts=32.50%2C19.50%2C13.00');
    expect(url).toContain('total=65.00');
    expect(url).toContain('note=Pizza+Palace');
    expect(url).toContain('phone=5551234567');
    expect(url).toContain('date=2024-01-15');
  });

  it('should generate URL with required parameters only (no date)', () => {
    const baseUrl = 'http://localhost:3000';
    const url = generateShareableUrl(baseUrl, mockPeople, 'Test Note', '5551234567');

    expect(url).toMatch(/^http:\/\/localhost:3000\/split\?/);
    expect(url).toContain('names=Alice%2CBob%2CCharlie');
    expect(url).toContain('amounts=32.50%2C19.50%2C13.00');
    expect(url).toContain('total=65.00');
    expect(url).toContain('note=Test+Note');
    expect(url).toContain('phone=5551234567');
    expect(url).not.toContain('date=');
  });

  it('should handle base URLs with trailing slash', () => {
    const baseUrl = 'https://example.com/';
    const url = generateShareableUrl(baseUrl, mockPeople, 'Test', '5551234567');

    expect(url).toMatch(/^https:\/\/example\.com\/split\?/);
  });
});

describe('validateSplitData', () => {
  const validSplitData: SharedSplitData = {
    names: ['Alice', 'Bob'],
    amounts: [30.00, 20.00],
    total: 50.00,
    note: 'Test Restaurant',
    phone: '5551234567',
    date: '2024-01-15'
  };

  it('should validate correct split data', () => {
    expect(validateSplitData(validSplitData)).toBe(true);
  });

  it('should validate data without optional date field', () => {
    const minimalData: SharedSplitData = {
      names: ['Alice'],
      amounts: [25.00],
      total: 25.00,
      note: 'Test Split',
      phone: '5551234567'
    };
    
    expect(validateSplitData(minimalData)).toBe(true);
  });

  it('should reject data missing required note field', () => {
    const invalidData: SharedSplitData = {
      ...validSplitData,
      note: ''
    };
    
    expect(validateSplitData(invalidData)).toBe(false);
  });

  it('should reject data missing required phone field', () => {
    const invalidData: SharedSplitData = {
      ...validSplitData,
      phone: ''
    };
    
    expect(validateSplitData(invalidData)).toBe(false);
  });

  it('should reject mismatched array lengths', () => {
    const invalidData: SharedSplitData = {
      ...validSplitData,
      names: ['Alice'],
      amounts: [30.00, 20.00], // mismatch
    };
    
    expect(validateSplitData(invalidData)).toBe(false);
  });

  it('should reject empty arrays', () => {
    const invalidData: SharedSplitData = {
      ...validSplitData,
      names: [],
      amounts: [],
    };
    
    expect(validateSplitData(invalidData)).toBe(false);
  });

  it('should reject empty names', () => {
    const invalidData: SharedSplitData = {
      ...validSplitData,
      names: ['Alice', '  ', 'Bob'], // empty name
    };
    
    expect(validateSplitData(invalidData)).toBe(false);
  });

  it('should reject negative amounts', () => {
    const invalidData: SharedSplitData = {
      ...validSplitData,
      amounts: [30.00, -20.00], // negative amount
    };
    
    expect(validateSplitData(invalidData)).toBe(false);
  });

  it('should reject invalid total', () => {
    const invalidData: SharedSplitData = {
      ...validSplitData,
      total: -50.00, // negative total
    };
    
    expect(validateSplitData(invalidData)).toBe(false);
  });

  it('should reject when amounts do not add up to total', () => {
    const invalidData: SharedSplitData = {
      ...validSplitData,
      amounts: [30.00, 20.00],
      total: 60.00, // does not match sum of amounts (50.00)
    };
    
    expect(validateSplitData(invalidData)).toBe(false);
  });

  it('should allow small rounding differences in total', () => {
    const dataWithRounding: SharedSplitData = {
      ...validSplitData,
      amounts: [30.33, 20.34], // sum = 50.67
      total: 50.67,
    };
    
    expect(validateSplitData(dataWithRounding)).toBe(true);
  });

  it('should reject large differences in total', () => {
    const dataWithLargeDifference: SharedSplitData = {
      ...validSplitData,
      amounts: [30.00, 20.00], // sum = 50.00
      total: 52.00, // difference > 1 cent tolerance
    };
    
    expect(validateSplitData(dataWithLargeDifference)).toBe(false);
  });
});

describe('round-trip serialization', () => {
  it('should maintain data integrity through serialize/deserialize cycle', () => {
    const params = serializeSplitData(
      mockPeople,
      'Test Restaurant',
      '5551234567',
      '2024-01-15'
    );
    
    const deserialized = deserializeSplitData(params);
    
    expect(deserialized).not.toBeNull();
    expect(deserialized!.names).toEqual(['Alice', 'Bob', 'Charlie']);
    expect(deserialized!.amounts).toEqual([32.50, 19.50, 13.00]);
    expect(deserialized!.total).toBe(65.00);
    expect(deserialized!.note).toBe('Test Restaurant');
    expect(deserialized!.phone).toBe('5551234567');
    expect(deserialized!.date).toBe('2024-01-15');
    
    // Validate the round-trip data
    expect(validateSplitData(deserialized!)).toBe(true);
  });

  it('should handle edge cases in round-trip', () => {
    const edgeCasePeople: Person[] = [
      {
        id: '1',
        name: 'A',
        items: [],
        totalBeforeTax: 0.01,
        tax: 0.00,
        tip: 0.00,
        finalTotal: 0.01,
      },
    ];

    const params = serializeSplitData(edgeCasePeople, 'Minimum', '5551234567');
    const deserialized = deserializeSplitData(params);
    
    expect(deserialized).not.toBeNull();
    expect(deserialized!.names).toEqual(['A']);
    expect(deserialized!.amounts).toEqual([0.01]);
    expect(deserialized!.total).toBe(0.01);
    expect(deserialized!.note).toBe('Minimum');
    expect(deserialized!.phone).toBe('5551234567');
    expect(validateSplitData(deserialized!)).toBe(true);
  });
});

describe('isValidPhoneNumber', () => {
  it('should validate 10-digit US phone numbers', () => {
    expect(isValidPhoneNumber('5551234567')).toBe(true);
    expect(isValidPhoneNumber('555-123-4567')).toBe(true);
    expect(isValidPhoneNumber('(555) 123-4567')).toBe(true);
    expect(isValidPhoneNumber('555.123.4567')).toBe(true);
  });

  it('should validate 11-digit US phone numbers with country code', () => {
    expect(isValidPhoneNumber('15551234567')).toBe(true);
    expect(isValidPhoneNumber('1-555-123-4567')).toBe(true);
    expect(isValidPhoneNumber('+1 555 123 4567')).toBe(true);
  });

  it('should reject invalid phone numbers', () => {
    expect(isValidPhoneNumber('')).toBe(false);
    expect(isValidPhoneNumber('123')).toBe(false);
    expect(isValidPhoneNumber('12345')).toBe(false);
    expect(isValidPhoneNumber('123456789')).toBe(false); // 9 digits
    expect(isValidPhoneNumber('10234567890')).toBe(false); // 11 digits starting with 1 but second digit is 0
    expect(isValidPhoneNumber('11234567890')).toBe(false); // 11 digits starting with 1 but second digit is 1
    expect(isValidPhoneNumber('555123456789')).toBe(false); // 12 digits
    expect(isValidPhoneNumber('abc-def-ghij')).toBe(false);
  });
});

describe('isValidDateFormat', () => {
  it('should validate ISO date formats', () => {
    expect(isValidDateFormat('2024-01-15')).toBe(true);
    expect(isValidDateFormat('2024-12-31')).toBe(true);
    expect(isValidDateFormat('2024-01-01T00:00:00Z')).toBe(true);
  });

  it('should validate common date formats', () => {
    expect(isValidDateFormat('01/15/2024')).toBe(true);
    expect(isValidDateFormat('Jan 15, 2024')).toBe(true);
    expect(isValidDateFormat('January 15, 2024')).toBe(true);
  });

  it('should reject invalid dates', () => {
    expect(isValidDateFormat('')).toBe(false);
    expect(isValidDateFormat('invalid')).toBe(false);
    expect(isValidDateFormat('2024')).toBe(false); // too short
    expect(isValidDateFormat('2024-13-01')).toBe(false); // invalid month
    expect(isValidDateFormat('2024-01-32')).toBe(false); // invalid day
  });
});

describe('validateSplitDataDetailed', () => {
  const validSplitData: SharedSplitData = {
    names: ['Alice', 'Bob'],
    amounts: [30.00, 20.00],
    total: 50.00,
    note: 'Test Restaurant',
    phone: '5551234567',
    date: '2024-01-15'
  };

  it('should return detailed validation for valid data', () => {
    const result = validateSplitDataDetailed(validSplitData);
    
    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.errorMessages).toEqual([]);
  });

  it('should detect empty people array', () => {
    const invalidData: SharedSplitData = {
      ...validSplitData,
      names: [],
      amounts: [],
    };
    
    const result = validateSplitDataDetailed(invalidData);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain(SplitDataError.EMPTY_PEOPLE_ARRAY);
    expect(result.errorMessages[0]).toContain('At least one person must be included');
  });

  it('should detect missing required note field', () => {
    const invalidData: SharedSplitData = {
      ...validSplitData,
      note: ''
    };
    
    const result = validateSplitDataDetailed(invalidData);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain(SplitDataError.EMPTY_NAME);
    expect(result.errorMessages[0]).toContain('Note/memo is required');
  });

  it('should detect missing required phone field', () => {
    const invalidData: SharedSplitData = {
      ...validSplitData,
      phone: ''
    };
    
    const result = validateSplitDataDetailed(invalidData);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain(SplitDataError.INVALID_PHONE_NUMBER);
    expect(result.errorMessages[0]).toContain('Phone number is required');
  });

  it('should detect invalid phone numbers', () => {
    const invalidData: SharedSplitData = {
      ...validSplitData,
      phone: '123456789', // 9 digits
    };
    
    const result = validateSplitDataDetailed(invalidData);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain(SplitDataError.INVALID_PHONE_NUMBER);
    expect(result.errorMessages[0]).toContain('Phone number \'123456789\' format is invalid');
  });

  it('should detect invalid dates', () => {
    const invalidData: SharedSplitData = {
      ...validSplitData,
      date: 'invalid-date',
    };
    
    const result = validateSplitDataDetailed(invalidData);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain(SplitDataError.INVALID_DATE_FORMAT);
    expect(result.errorMessages[0]).toContain('Date format \'invalid-date\' is invalid');
  });

  it('should detect note that is too long', () => {
    const longNote = 'N'.repeat(VALIDATION_LIMITS.MAX_NOTE_LENGTH + 1);
    const invalidData: SharedSplitData = {
      ...validSplitData,
      note: longNote,
    };
    
    const result = validateSplitDataDetailed(invalidData);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain(SplitDataError.NOTE_TOO_LONG);
    expect(result.errorMessages[0]).toContain(`Note '${longNote}' exceeds ${VALIDATION_LIMITS.MAX_NOTE_LENGTH} characters`);
  });
});

describe('validateSerializationInput', () => {
  it('should validate valid Person array input', () => {
    const result = validateSerializationInput(
      mockPeople,
      'Test Restaurant',
      '5551234567',
      '2024-01-15'
    );
    
    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.errorMessages).toEqual([]);
  });

  it('should detect empty people array', () => {
    const result = validateSerializationInput([], 'Test', '5551234567');
    
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain(SplitDataError.EMPTY_PEOPLE_ARRAY);
    expect(result.errorMessages[0]).toContain('At least one person must be included');
  });

  it('should detect empty note', () => {
    const result = validateSerializationInput(mockPeople, '', '5551234567');
    
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain(SplitDataError.EMPTY_NAME);
    expect(result.errorMessages[0]).toContain('Note/memo is required');
  });

  it('should detect empty phone', () => {
    const result = validateSerializationInput(mockPeople, 'Test', '');
    
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain(SplitDataError.INVALID_PHONE_NUMBER);
    expect(result.errorMessages[0]).toContain('Phone number is required');
  });

  it('should detect invalid phone format', () => {
    const result = validateSerializationInput(mockPeople, 'Test', '123'); // invalid phone
    
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain(SplitDataError.INVALID_PHONE_NUMBER);
    expect(result.errorMessages[0]).toContain('Phone number \'123\' format is invalid');
  });
});