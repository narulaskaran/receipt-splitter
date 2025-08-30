import { 
  serializeSplitData, 
  deserializeSplitData, 
  generateShareableUrl, 
  validateSplitData,
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
    expect(() => serializeSplitData([])).toThrow('Cannot serialize empty people array');
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