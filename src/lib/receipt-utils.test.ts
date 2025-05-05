import { describe, expect, it } from 'vitest';
import { 
  calculatePersonTotals, 
  validateItemAssignments, 
  getUnassignedItems,
  formatCurrency
} from './receipt-utils';
import { Receipt, Person, PersonItemAssignment } from '@/types';

describe('Receipt Utils', () => {
  // Mock data
  const mockReceipt: Receipt = {
    restaurant: 'Test Restaurant',
    date: '2023-01-01',
    subtotal: 100,
    tax: 10,
    tip: 15,
    total: 125,
    items: [
      { name: 'Item 1', price: 20, quantity: 1 },
      { name: 'Item 2', price: 30, quantity: 1 },
      { name: 'Item 3', price: 50, quantity: 1 },
    ],
  };

  const mockPeople: Person[] = [
    { 
      id: 'person1', 
      name: 'Person 1', 
      items: [], 
      totalBeforeTax: 0, 
      tax: 0, 
      tip: 0, 
      finalTotal: 0 
    },
    { 
      id: 'person2', 
      name: 'Person 2', 
      items: [], 
      totalBeforeTax: 0, 
      tax: 0, 
      tip: 0, 
      finalTotal: 0 
    },
  ];

  describe('calculatePersonTotals', () => {
    it('should correctly calculate totals when each person has one item', () => {
      // Person 1 has Item 1, Person 2 has Item 2
      const assignedItems = new Map<number, PersonItemAssignment[]>([
        [0, [{ personId: 'person1', sharePercentage: 100 }]],
        [1, [{ personId: 'person2', sharePercentage: 100 }]],
      ]);

      const result = calculatePersonTotals(mockReceipt, mockPeople, assignedItems);
      
      // Expected calculations:
      // Person 1: Item 1 = $20, 20/100 of total = 20% of tax and tip
      // Person 2: Item 2 = $30, 30/100 of total = 30% of tax and tip
      expect(result[0].totalBeforeTax).toBeCloseTo(20);
      expect(result[0].tax).toBeCloseTo(2); // 20% of $10 tax
      expect(result[0].tip).toBeCloseTo(3); // 20% of $15 tip
      expect(result[0].finalTotal).toBeCloseTo(25); // $20 + $2 + $3
      
      expect(result[1].totalBeforeTax).toBeCloseTo(30);
      expect(result[1].tax).toBeCloseTo(3); // 30% of $10 tax
      expect(result[1].tip).toBeCloseTo(4.5); // 30% of $15 tip
      expect(result[1].finalTotal).toBeCloseTo(37.5); // $30 + $3 + $4.5
    });

    it('should correctly calculate totals when items are split', () => {
      // Item 3 ($50) is split 50/50 between Person 1 and Person 2
      const assignedItems = new Map<number, PersonItemAssignment[]>([
        [2, [
          { personId: 'person1', sharePercentage: 50 },
          { personId: 'person2', sharePercentage: 50 },
        ]],
      ]);

      const result = calculatePersonTotals(mockReceipt, mockPeople, assignedItems);
      
      // Expected calculations:
      // Person 1: 50% of Item 3 = $25, 25/100 of total = 25% of tax and tip
      // Person 2: 50% of Item 3 = $25, 25/100 of total = 25% of tax and tip
      expect(result[0].totalBeforeTax).toBeCloseTo(25);
      expect(result[0].tax).toBeCloseTo(2.5); // 25% of $10 tax
      expect(result[0].tip).toBeCloseTo(3.75); // 25% of $15 tip
      expect(result[0].finalTotal).toBeCloseTo(31.25); // $25 + $2.5 + $3.75
      
      expect(result[1].totalBeforeTax).toBeCloseTo(25);
      expect(result[1].tax).toBeCloseTo(2.5); // 25% of $10 tax
      expect(result[1].tip).toBeCloseTo(3.75); // 25% of $15 tip
      expect(result[1].finalTotal).toBeCloseTo(31.25); // $25 + $2.5 + $3.75
    });

    it('should handle empty assignments', () => {
      const result = calculatePersonTotals(mockReceipt, mockPeople, new Map());
      
      // No items assigned, so everyone should have 0
      expect(result[0].totalBeforeTax).toEqual(0);
      expect(result[0].tax).toEqual(0);
      expect(result[0].tip).toEqual(0);
      expect(result[0].finalTotal).toEqual(0);
      
      expect(result[1].totalBeforeTax).toEqual(0);
      expect(result[1].tax).toEqual(0);
      expect(result[1].tip).toEqual(0);
      expect(result[1].finalTotal).toEqual(0);
    });
  });

  describe('validateItemAssignments', () => {
    it('should return true when all items are fully assigned', () => {
      const assignedItems = new Map<number, PersonItemAssignment[]>([
        [0, [{ personId: 'person1', sharePercentage: 100 }]],
        [1, [{ personId: 'person2', sharePercentage: 100 }]],
        [2, [
          { personId: 'person1', sharePercentage: 50 },
          { personId: 'person2', sharePercentage: 50 },
        ]],
      ]);

      const result = validateItemAssignments(mockReceipt, assignedItems);
      expect(result).toBe(true);
    });

    it('should return false when not all items are assigned', () => {
      const assignedItems = new Map<number, PersonItemAssignment[]>([
        [0, [{ personId: 'person1', sharePercentage: 100 }]],
        // Item 1 and Item 2 are missing
      ]);

      const result = validateItemAssignments(mockReceipt, assignedItems);
      expect(result).toBe(false);
    });

    it('should return false when an item is not fully assigned (less than 100%)', () => {
      const assignedItems = new Map<number, PersonItemAssignment[]>([
        [0, [{ personId: 'person1', sharePercentage: 100 }]],
        [1, [{ personId: 'person2', sharePercentage: 100 }]],
        [2, [{ personId: 'person1', sharePercentage: 80 }]], // Only 80% assigned
      ]);

      const result = validateItemAssignments(mockReceipt, assignedItems);
      expect(result).toBe(false);
    });
  });

  describe('getUnassignedItems', () => {
    it('should return all item indices when nothing is assigned', () => {
      const result = getUnassignedItems(mockReceipt, new Map());
      expect(result).toEqual([0, 1, 2]);
    });

    it('should return only unassigned item indices', () => {
      const assignedItems = new Map<number, PersonItemAssignment[]>([
        [0, [{ personId: 'person1', sharePercentage: 100 }]],
        // Item 1 and 2 are unassigned or not fully assigned
        [2, [{ personId: 'person1', sharePercentage: 60 }]], // Only 60% assigned
      ]);

      const result = getUnassignedItems(mockReceipt, assignedItems);
      expect(result).toContain(1); // Completely unassigned
      expect(result).toContain(2); // Partially assigned
      expect(result).not.toContain(0); // Fully assigned
    });
  });

  describe('formatCurrency', () => {
    it('should format currency values correctly', () => {
      expect(formatCurrency(0)).toBe('$0.00');
      expect(formatCurrency(1)).toBe('$1.00');
      expect(formatCurrency(1.5)).toBe('$1.50');
      expect(formatCurrency(1.55)).toBe('$1.55');
      expect(formatCurrency(1.555)).toBe('$1.56'); // Rounds to 2 decimal places
      expect(formatCurrency(1000)).toBe('$1,000.00'); // Adds thousands separator
    });
  });
});