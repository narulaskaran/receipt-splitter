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
  it('should serialize basic split data correctly', () => {
    const params = serializeSplitData(mockPeople);
    
    // Names should be sorted alphabetically
    expect(params.get('names')).toBe('Alice,Bob,Charlie');
    expect(params.get('amounts')).toBe('32.50,19.50,13.00');
    expect(params.get('total')).toBe('65.00');
  });

  it('should include optional parameters when provided', () => {
    const params = serializeSplitData(
      mockPeople,
      'Pizza Palace',
      '2024-01-15',
      '5551234567'
    );
    
    expect(params.get('restaurant')).toBe('Pizza Palace');
    expect(params.get('date')).toBe('2024-01-15');
    expect(params.get('phone')).toBe('5551234567');
  });

  it('should handle null optional parameters', () => {
    const params = serializeSplitData(mockPeople, null, null, undefined);
    
    expect(params.get('restaurant')).toBeNull();
    expect(params.get('date')).toBeNull();
    expect(params.get('phone')).toBeNull();
  });

  it('should throw error for empty people array', () => {
    expect(() => serializeSplitData([])).toThrow('Invalid split data: At least one person must be included in the split');
  });

  it('should handle special characters in names and restaurant', () => {
    const specialPeople: Person[] = [
      { ...mockPeople[0], name: 'José María' },
      { ...mockPeople[1], name: 'François & Co.' },
    ];
    
    const params = serializeSplitData(specialPeople, 'Café René & Co.', null, null);
    
    // Should preserve special characters in URL encoding
    expect(params.get('names')).toBe('François & Co.,José María');
    expect(params.get('restaurant')).toBe('Café René & Co.');
  });
});

describe('deserializeSplitData', () => {
  it('should deserialize valid parameters correctly', () => {
    const params = new URLSearchParams({
      names: 'Alice,Bob,Charlie',
      amounts: '32.50,19.50,13.00',
      total: '65.00',
      restaurant: 'Pizza Palace',
      date: '2024-01-15',
      phone: '5551234567'
    });

    const result = deserializeSplitData(params);
    
    expect(result).not.toBeNull();
    expect(result!.names).toEqual(['Alice', 'Bob', 'Charlie']);
    expect(result!.amounts).toEqual([32.50, 19.50, 13.00]);
    expect(result!.total).toBe(65.00);
    expect(result!.restaurant).toBe('Pizza Palace');
    expect(result!.date).toBe('2024-01-15');
    expect(result!.phone).toBe('5551234567');
  });

  it('should work with only required parameters', () => {
    const params = new URLSearchParams({
      names: 'Alice,Bob',
      amounts: '30.00,20.00',
      total: '50.00'
    });

    const result = deserializeSplitData(params);
    
    expect(result).not.toBeNull();
    expect(result!.names).toEqual(['Alice', 'Bob']);
    expect(result!.amounts).toEqual([30.00, 20.00]);
    expect(result!.total).toBe(50.00);
    expect(result!.restaurant).toBeUndefined();
    expect(result!.date).toBeUndefined();
    expect(result!.phone).toBeUndefined();
  });

  it('should return null for missing required parameters', () => {
    const incompleteParams = [
      new URLSearchParams({ amounts: '30.00', total: '30.00' }), // missing names
      new URLSearchParams({ names: 'Alice', total: '30.00' }), // missing amounts
      new URLSearchParams({ names: 'Alice', amounts: '30.00' }), // missing total
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
      total: '30.00'
    });

    expect(deserializeSplitData(params)).toBeNull();
  });

  it('should return null for invalid amounts', () => {
    const invalidAmountParams = [
      new URLSearchParams({ names: 'Alice', amounts: 'invalid', total: '30.00' }),
      new URLSearchParams({ names: 'Alice', amounts: '-5.00', total: '30.00' }),
      new URLSearchParams({ names: 'Alice', amounts: '30.00', total: 'invalid' }),
      new URLSearchParams({ names: 'Alice', amounts: '30.00', total: '-50.00' }),
    ];

    invalidAmountParams.forEach(params => {
      expect(deserializeSplitData(params)).toBeNull();
    });
  });

  it('should handle empty names gracefully', () => {
    const params = new URLSearchParams({
      names: 'Alice,,Bob', // empty name in middle
      amounts: '30.00,0.00,20.00',
      total: '50.00'
    });

    const result = deserializeSplitData(params);
    expect(result).toBeNull(); // Should reject empty names
  });

  it('should handle special characters correctly', () => {
    const params = new URLSearchParams({
      names: 'José María,François & Co.',
      amounts: '32.50,19.50',
      total: '52.00',
      restaurant: 'Café René & Co.'
    });

    const result = deserializeSplitData(params);
    
    expect(result).not.toBeNull();
    expect(result!.names).toEqual(['José María', 'François & Co.']);
    expect(result!.restaurant).toBe('Café René & Co.');
  });
});

describe('generateShareableUrl', () => {
  it('should generate complete URL with all parameters', () => {
    const baseUrl = 'https://receipt-splitter.app';
    const url = generateShareableUrl(
      baseUrl,
      mockPeople,
      'Pizza Palace',
      '2024-01-15',
      '5551234567'
    );

    expect(url).toMatch(/^https:\/\/receipt-splitter\.app\/split\?/);
    expect(url).toContain('names=Alice%2CBob%2CCharlie');
    expect(url).toContain('amounts=32.50%2C19.50%2C13.00');
    expect(url).toContain('total=65.00');
    expect(url).toContain('restaurant=Pizza+Palace');
    expect(url).toContain('date=2024-01-15');
    expect(url).toContain('phone=5551234567');
  });

  it('should generate URL with only required parameters', () => {
    const baseUrl = 'http://localhost:3000';
    const url = generateShareableUrl(baseUrl, mockPeople);

    expect(url).toMatch(/^http:\/\/localhost:3000\/split\?/);
    expect(url).toContain('names=Alice%2CBob%2CCharlie');
    expect(url).toContain('amounts=32.50%2C19.50%2C13.00');
    expect(url).toContain('total=65.00');
    expect(url).not.toContain('restaurant=');
    expect(url).not.toContain('date=');
    expect(url).not.toContain('phone=');
  });

  it('should handle base URLs with trailing slash', () => {
    const baseUrl = 'https://example.com/';
    const url = generateShareableUrl(baseUrl, mockPeople);

    expect(url).toMatch(/^https:\/\/example\.com\/split\?/);
  });
});

describe('validateSplitData', () => {
  const validSplitData: SharedSplitData = {
    names: ['Alice', 'Bob'],
    amounts: [30.00, 20.00],
    total: 50.00,
    restaurant: 'Test Restaurant',
    date: '2024-01-15',
    phone: '5551234567'
  };

  it('should validate correct split data', () => {
    expect(validateSplitData(validSplitData)).toBe(true);
  });

  it('should validate data without optional fields', () => {
    const minimalData: SharedSplitData = {
      names: ['Alice'],
      amounts: [25.00],
      total: 25.00
    };
    
    expect(validateSplitData(minimalData)).toBe(true);
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
      '2024-01-15',
      '5551234567'
    );
    
    const deserialized = deserializeSplitData(params);
    
    expect(deserialized).not.toBeNull();
    expect(deserialized!.names).toEqual(['Alice', 'Bob', 'Charlie']);
    expect(deserialized!.amounts).toEqual([32.50, 19.50, 13.00]);
    expect(deserialized!.total).toBe(65.00);
    expect(deserialized!.restaurant).toBe('Test Restaurant');
    expect(deserialized!.date).toBe('2024-01-15');
    expect(deserialized!.phone).toBe('5551234567');
    
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

    const params = serializeSplitData(edgeCasePeople);
    const deserialized = deserializeSplitData(params);
    
    expect(deserialized).not.toBeNull();
    expect(deserialized!.names).toEqual(['A']);
    expect(deserialized!.amounts).toEqual([0.01]);
    expect(deserialized!.total).toBe(0.01);
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
    restaurant: 'Test Restaurant',
    date: '2024-01-15',
    phone: '5551234567'
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

  it('should detect mismatched array lengths', () => {
    const invalidData: SharedSplitData = {
      ...validSplitData,
      names: ['Alice'],
      amounts: [30.00, 20.00], // mismatch
    };
    
    const result = validateSplitDataDetailed(invalidData);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain(SplitDataError.MISMATCHED_ARRAY_LENGTHS);
    expect(result.errorMessages[0]).toContain('number of names and amounts must match');
  });

  it('should detect empty names', () => {
    const invalidData: SharedSplitData = {
      ...validSplitData,
      names: ['Alice', '  '], // empty name
      amounts: [30.00, 20.00],
    };
    
    const result = validateSplitDataDetailed(invalidData);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain(SplitDataError.EMPTY_NAME);
    expect(result.errorMessages[0]).toContain('Person 2 has an empty name');
  });

  it('should detect names that are too long', () => {
    const longName = 'A'.repeat(VALIDATION_LIMITS.MAX_NAME_LENGTH + 1);
    const invalidData: SharedSplitData = {
      ...validSplitData,
      names: [longName, 'Bob'],
      amounts: [30.00, 20.00],
    };
    
    const result = validateSplitDataDetailed(invalidData);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain(SplitDataError.NAME_TOO_LONG);
    expect(result.errorMessages[0]).toContain(`exceeds ${VALIDATION_LIMITS.MAX_NAME_LENGTH} characters`);
  });

  it('should detect too many people', () => {
    const tooManyNames = Array(VALIDATION_LIMITS.MAX_PEOPLE_COUNT + 1).fill('Person').map((name, i) => `${name}${i}`);
    const tooManyAmounts = Array(VALIDATION_LIMITS.MAX_PEOPLE_COUNT + 1).fill(10.00);
    const invalidData: SharedSplitData = {
      ...validSplitData,
      names: tooManyNames,
      amounts: tooManyAmounts,
      total: tooManyAmounts.reduce((sum, amount) => sum + amount, 0),
    };
    
    const result = validateSplitDataDetailed(invalidData);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain(SplitDataError.TOO_MANY_PEOPLE);
    expect(result.errorMessages[0]).toContain(`Maximum ${VALIDATION_LIMITS.MAX_PEOPLE_COUNT} people allowed`);
  });

  it('should detect invalid amounts', () => {
    const invalidData: SharedSplitData = {
      ...validSplitData,
      amounts: [30.00, NaN], // invalid amount
    };
    
    const result = validateSplitDataDetailed(invalidData);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain(SplitDataError.INVALID_AMOUNT);
    expect(result.errorMessages[0]).toContain('not a valid number');
  });

  it('should detect negative amounts', () => {
    const invalidData: SharedSplitData = {
      ...validSplitData,
      amounts: [30.00, -20.00], // negative amount
    };
    
    const result = validateSplitDataDetailed(invalidData);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain(SplitDataError.NEGATIVE_AMOUNT);
    expect(result.errorMessages[0]).toContain('cannot be negative');
  });

  it('should detect amounts that are too large', () => {
    const invalidData: SharedSplitData = {
      ...validSplitData,
      amounts: [VALIDATION_LIMITS.MAX_AMOUNT + 1, 20.00],
      total: VALIDATION_LIMITS.MAX_AMOUNT + 21,
    };
    
    const result = validateSplitDataDetailed(invalidData);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain(SplitDataError.AMOUNT_TOO_LARGE);
    expect(result.errorMessages[0]).toContain('exceeds maximum allowed');
  });

  it('should detect invalid total', () => {
    const invalidData: SharedSplitData = {
      ...validSplitData,
      total: NaN,
    };
    
    const result = validateSplitDataDetailed(invalidData);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain(SplitDataError.INVALID_TOTAL);
    expect(result.errorMessages[0]).toContain('not a valid number');
  });

  it('should detect amounts that do not add up to total', () => {
    const invalidData: SharedSplitData = {
      ...validSplitData,
      amounts: [30.00, 20.00],
      total: 60.00, // does not match sum of amounts (50.00)
    };
    
    const result = validateSplitDataDetailed(invalidData);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain(SplitDataError.AMOUNTS_TOTAL_MISMATCH);
    expect(result.errorMessages[0]).toContain('do not add up to total');
  });

  it('should detect invalid phone numbers', () => {
    const invalidData: SharedSplitData = {
      ...validSplitData,
      phone: '123456789', // 9 digits
    };
    
    const result = validateSplitDataDetailed(invalidData);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain(SplitDataError.INVALID_PHONE_NUMBER);
    expect(result.errorMessages[0]).toContain('Phone number format is invalid');
  });

  it('should detect invalid dates', () => {
    const invalidData: SharedSplitData = {
      ...validSplitData,
      date: 'invalid-date',
    };
    
    const result = validateSplitDataDetailed(invalidData);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain(SplitDataError.INVALID_DATE_FORMAT);
    expect(result.errorMessages[0]).toContain('Date format is invalid');
  });

  it('should detect restaurant names that are too long', () => {
    const longRestaurantName = 'R'.repeat(VALIDATION_LIMITS.MAX_RESTAURANT_NAME_LENGTH + 1);
    const invalidData: SharedSplitData = {
      ...validSplitData,
      restaurant: longRestaurantName,
    };
    
    const result = validateSplitDataDetailed(invalidData);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain(SplitDataError.RESTAURANT_NAME_TOO_LONG);
    expect(result.errorMessages[0]).toContain('Restaurant name exceeds');
  });

  it('should return multiple errors when multiple issues exist', () => {
    const invalidData: SharedSplitData = {
      names: ['', 'Bob'], // empty name
      amounts: [-30.00, 20.00], // negative amount
      total: 60.00, // mismatched total
      phone: '123', // invalid phone
      date: 'bad-date', // invalid date
    };
    
    const result = validateSplitDataDetailed(invalidData);
    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(1);
    expect(result.errorMessages.length).toEqual(result.errors.length);
  });
});

describe('validateSerializationInput', () => {
  it('should validate valid Person array input', () => {
    const result = validateSerializationInput(
      mockPeople,
      'Test Restaurant',
      '2024-01-15',
      '5551234567'
    );
    
    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.errorMessages).toEqual([]);
  });

  it('should detect empty people array', () => {
    const result = validateSerializationInput([]);
    
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain(SplitDataError.EMPTY_PEOPLE_ARRAY);
    expect(result.errorMessages[0]).toContain('At least one person must be included');
  });

  it('should detect people with invalid names', () => {
    const invalidPeople: Person[] = [
      { ...mockPeople[0], name: '' }, // empty name
    ];
    
    const result = validateSerializationInput(invalidPeople);
    
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain(SplitDataError.EMPTY_NAME);
  });

  it('should detect people with invalid amounts', () => {
    const invalidPeople: Person[] = [
      { ...mockPeople[0], finalTotal: -10 }, // negative amount
    ];
    
    const result = validateSerializationInput(invalidPeople);
    
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain(SplitDataError.NEGATIVE_AMOUNT);
  });

  it('should detect invalid optional parameters', () => {
    const result = validateSerializationInput(
      mockPeople,
      'Test Restaurant',
      'invalid-date',
      '123' // invalid phone
    );
    
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain(SplitDataError.INVALID_DATE_FORMAT);
    expect(result.errors).toContain(SplitDataError.INVALID_PHONE_NUMBER);
  });
});

describe('enhanced serializeSplitData validation', () => {
  it('should throw error for invalid input', () => {
    const invalidPeople: Person[] = [
      { ...mockPeople[0], name: '' }, // empty name
    ];
    
    expect(() => serializeSplitData(invalidPeople)).toThrow('Invalid split data');
  });

  it('should throw error for invalid phone number', () => {
    expect(() => serializeSplitData(mockPeople, 'Restaurant', null, '123')).toThrow('Phone number format is invalid');
  });

  it('should work with valid data', () => {
    expect(() => serializeSplitData(mockPeople, 'Restaurant', '2024-01-15', '5551234567')).not.toThrow();
  });
});