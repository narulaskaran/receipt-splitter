import Decimal from 'decimal.js';
import { type Person, type Receipt, type ReceiptItem, type PersonItem, type PersonItemAssignment } from '@/types';
import { VALIDATION_LIMITS } from './split-sharing';
import { formatCurrency as formatCurrencyNew } from './currency';

/**
 * Detects and corrects the common LLM mis-parse where a multi-quantity line-item's
 * *line total* is returned as `price` instead of the per-unit price.
 *
 * Example: the receipt shows "7 Guinness Dft  $91.00" and the model outputs
 * price=91.00, quantity=7.  The frontend multiplies these, yielding $637 instead
 * of $91.  This function detects the discrepancy via the subtotal cross-check and
 * divides each affected item's price by its quantity to restore the per-unit value.
 *
 * The correction is only applied when:
 *   1. There is at least one item with quantity > 1.
 *   2. The current items total differs from the subtotal by more than 10 %.
 *   3. Dividing all multi-quantity item prices by their quantities brings the total
 *      at least 50 % closer to the subtotal (ensuring we don't over-correct).
 *
 * Note: this assumes all multi-quantity items have the same error. A receipt with
 * a mix of correctly-priced and line-total-priced multi-qty items will not be fixed.
 */
export function fixMultiQuantityPrices(
  items: ReceiptItem[],
  subtotal: number
): { items: ReceiptItem[]; corrected: boolean } {
  if (subtotal <= 0) return { items, corrected: false };

  const hasMultiQty = items.some((item) => (item.quantity || 1) > 1);
  if (!hasMultiQty) return { items, corrected: false };

  const currentTotal = items.reduce(
    (sum, item) => sum + item.price * (item.quantity || 1),
    0
  );
  const currentDiff = Math.abs(currentTotal - subtotal);

  // No meaningful mismatch — nothing to fix (allow 10% tolerance for discounts/rounding)
  if (currentDiff <= subtotal * 0.1) return { items, corrected: false };

  // Try treating every multi-quantity item's price as a line total (divide by qty)
  const candidateItems = items.map((item) => {
    const qty = item.quantity || 1;
    if (qty > 1) {
      return { ...item, price: new Decimal(item.price).dividedBy(qty).toNumber() };
    }
    return item;
  });

  const correctedTotal = candidateItems.reduce(
    (sum, item) => sum + item.price * (item.quantity || 1),
    0
  );
  const correctedDiff = Math.abs(correctedTotal - subtotal);

  // Only apply if correction achieves at least 50% improvement in the mismatch
  if (correctedDiff < currentDiff * 0.5) {
    return { items: candidateItems, corrected: true };
  }

  return { items, corrected: false };
}

/**
 * Calculates the proportion of tax and tip each person should pay based on their items
 */
export function calculatePersonTotals(
  receipt: Receipt,
  people: Person[],
  assignedItems: Map<number, PersonItemAssignment[]>
): Person[] {
  // Convert receipt values to Decimal for precision
  const subtotal = new Decimal(receipt.subtotal || 0);
  const tax = new Decimal(receipt.tax || 0);
  const tip = new Decimal(receipt.tip || 0);
  
  // Calculate each person's items and pre-tax total
  const updatedPeople = people.map((person) => {
    const personItems: PersonItem[] = [];
    let totalBeforeTax = new Decimal(0);
    
    // Go through each item assignment and calculate each person's share
    assignedItems.forEach((assignments, itemIndex) => {
      const item = receipt.items[itemIndex];
      if (!item) return;
      
      // Find this person's assignment for this item
      const assignment = assignments.find(a => a.personId === person.id);
      if (!assignment) return;
      
      const sharePercentage = assignment.sharePercentage;
      const itemPrice = new Decimal(item.price);
      const itemQuantity = new Decimal(item.quantity || 1);
      const totalItemPrice = itemPrice.mul(itemQuantity);

      // Calculate this person's share of this item
      // For $0 items, explicitly assign $0 without calculation
      const personShare = totalItemPrice.isZero()
        ? new Decimal(0)
        : totalItemPrice.mul(sharePercentage).div(100);
      totalBeforeTax = totalBeforeTax.add(personShare);
      
      // Add to person's items
      personItems.push({
        itemId: itemIndex,
        itemName: item.name,
        originalPrice: item.price,
        quantity: item.quantity || 1,
        sharePercentage: sharePercentage,
        amount: personShare.toNumber(),
      });
    });
    
    // Calculate proportional tax and tip
    let personTax = new Decimal(0);
    let personTip = new Decimal(0);
    
    if (!subtotal.isZero()) {
      const proportion = totalBeforeTax.div(subtotal);
      personTax = tax.mul(proportion);
      personTip = tip.mul(proportion);
    }
    
    const finalTotal = totalBeforeTax.add(personTax).add(personTip);
    
    return {
      ...person,
      items: personItems,
      totalBeforeTax: totalBeforeTax.toNumber(),
      tax: personTax.toNumber(),
      tip: personTip.toNumber(),
      finalTotal: finalTotal.toNumber(),
    };
  });
  
  return updatedPeople;
}

/**
 * Validates if all items have been fully assigned (100%)
 */
export function validateItemAssignments(
  receipt: Receipt,
  assignedItems: Map<number, PersonItemAssignment[]>
): boolean {
  if (!receipt?.items?.length) return false;
  
  for (let i = 0; i < receipt.items.length; i++) {
    const assignments = assignedItems.get(i) || [];
    
    // Sum up all share percentages for this item
    const totalPercentage = assignments.reduce(
      (sum, assignment) => sum + assignment.sharePercentage, 
      0
    );
    
    // Item must be fully assigned (100%)
    if (Math.abs(totalPercentage - 100) > 0.01) {
      return false;
    }
  }
  
  return true;
}

/**
 * Formats a currency value for display
 * @param amount - The amount to format
 * @param currencyCode - ISO 4217 currency code (e.g., 'USD', 'EUR', 'GBP'). Defaults to 'USD'
 */
export function formatCurrency(amount: number, currencyCode: string = 'USD'): string {
  return formatCurrencyNew(amount, currencyCode);
}

/**
 * Gets unassigned item indices
 */
export function getUnassignedItems(
  receipt: Receipt,
  assignedItems: Map<number, PersonItemAssignment[]>
): number[] {
  if (!receipt?.items?.length) return [];

  const unassignedItems: number[] = [];

  for (let i = 0; i < receipt.items.length; i++) {
    const assignments = assignedItems.get(i) || [];

    // Sum up all share percentages for this item
    const totalPercentage = assignments.reduce(
      (sum, assignment) => sum + assignment.sharePercentage,
      0
    );

    // If not fully assigned, add to unassigned list
    if (Math.abs(totalPercentage - 100) > 0.01) {
      unassignedItems.push(i);
    }
  }

  return unassignedItems;
}

/**
 * Calculates subtotal using Decimal.js for precision
 */
export function calculateSubtotal(items: Receipt['items']): number {
  return items.reduce(
    (sum, item) => {
      const itemPrice = new Decimal(item.price);
      const itemQuantity = new Decimal(item.quantity || 1);
      return sum.add(itemPrice.mul(itemQuantity));
    },
    new Decimal(0)
  ).toNumber();
}

/**
 * Remaps assignment indices after deleting an item
 * - Removes assignment for deleted item
 * - Shifts down all assignments after deleted index
 */
export function remapAssignmentsAfterDelete(
  assignedItems: Map<number, PersonItemAssignment[]>,
  deletedIndex: number
): Map<number, PersonItemAssignment[]> {
  const newMap = new Map<number, PersonItemAssignment[]>();

  assignedItems.forEach((assignments, itemIndex) => {
    if (itemIndex < deletedIndex) {
      // Items before deleted index stay the same
      newMap.set(itemIndex, assignments);
    } else if (itemIndex > deletedIndex) {
      // Items after deleted index shift down by 1
      newMap.set(itemIndex - 1, assignments);
    }
    // itemIndex === deletedIndex: assignment deleted (not added to map)
  });

  return newMap;
}

/**
 * Enum for amount validation error types
 */
export enum AmountValidationError {
  NEGATIVE_AMOUNT = 'NEGATIVE_AMOUNT',
  RECEIPT_TOTAL_MISMATCH = 'RECEIPT_TOTAL_MISMATCH',
  ITEMS_SUBTOTAL_MISMATCH = 'ITEMS_SUBTOTAL_MISMATCH',
  ITEM_SPLITS_MISMATCH = 'ITEM_SPLITS_MISMATCH',
}

/**
 * Error information for receipt validation
 */
export interface ReceiptValidationError {
  type: AmountValidationError;
  message: string;
  itemId?: string;
  itemName?: string;
  expected?: number;
  actual?: number;
  diff?: number;
  tolerance?: number;
}

/**
 * Result of receipt invariant validation
 */
export interface ReceiptValidationResult {
  isValid: boolean;
  errors: ReceiptValidationError[];
}

/**
 * Validates receipt-level invariants to catch state inconsistencies
 *
 * This function checks that:
 * - Items sum to subtotal (within tolerance)
 * - Each item's splits sum to that item's price (within tolerance)
 * - No negative amounts in items or splits
 *
 * @param receipt - The receipt to validate
 * @param assignedItems - Map of item assignments
 * @param people - Array of people with calculated amounts
 * @returns ReceiptValidationResult with detailed error information
 */
export function validateReceiptInvariants(
  receipt: Receipt | null,
  assignedItems: Map<number, PersonItemAssignment[]>,
  people: Person[]
): ReceiptValidationResult {
  const errors: ReceiptValidationError[] = [];

  // Return valid if no receipt
  if (!receipt) {
    return { isValid: true, errors: [] };
  }

  // 1. Validate no negative amounts in receipt
  if (receipt.subtotal < 0) {
    errors.push({
      type: AmountValidationError.NEGATIVE_AMOUNT,
      message: 'Receipt subtotal cannot be negative',
      expected: 0,
      actual: receipt.subtotal,
    });
  }

  if (receipt.tax < 0) {
    errors.push({
      type: AmountValidationError.NEGATIVE_AMOUNT,
      message: 'Receipt tax cannot be negative',
      expected: 0,
      actual: receipt.tax,
    });
  }

  if (receipt.tip !== null && receipt.tip < 0) {
    errors.push({
      type: AmountValidationError.NEGATIVE_AMOUNT,
      message: 'Receipt tip cannot be negative',
      expected: 0,
      actual: receipt.tip,
    });
  }

  if (receipt.total < 0) {
    errors.push({
      type: AmountValidationError.NEGATIVE_AMOUNT,
      message: 'Receipt total cannot be negative',
      expected: 0,
      actual: receipt.total,
    });
  }

  // 2. Validate that total equals subtotal + tax + tip
  const subtotalDecimal = new Decimal(receipt.subtotal || 0);
  const taxDecimal = new Decimal(receipt.tax || 0);
  const tipDecimal = new Decimal(receipt.tip || 0);
  const expectedTotal = subtotalDecimal.add(taxDecimal).add(tipDecimal);
  const actualTotal = new Decimal(receipt.total);
  const totalDifference = expectedTotal.sub(actualTotal).abs();

  // Use same tolerance as other validations (1 cent)
  const tolerance = new Decimal(VALIDATION_LIMITS.SPLIT_AMOUNT_DEVIATION_PER_PERSON);

  if (totalDifference.toDecimalPlaces(2).toNumber() > tolerance.toDecimalPlaces(2).toNumber()) {
    errors.push({
      type: AmountValidationError.RECEIPT_TOTAL_MISMATCH,
      message: 'Receipt total does not equal subtotal + tax + tip',
      expected: expectedTotal.toNumber(),
      actual: actualTotal.toNumber(),
      diff: totalDifference.toNumber(),
      tolerance: VALIDATION_LIMITS.SPLIT_AMOUNT_DEVIATION_PER_PERSON,
    });
  }

  // 3. Validate no negative amounts in items
  receipt.items.forEach((item, index) => {
    if (item.price < 0) {
      errors.push({
        type: AmountValidationError.NEGATIVE_AMOUNT,
        message: `Item "${item.name}" has negative price`,
        itemId: String(index),
        itemName: item.name,
        expected: 0,
        actual: item.price,
      });
    }

    if (item.quantity < 0) {
      errors.push({
        type: AmountValidationError.NEGATIVE_AMOUNT,
        message: `Item "${item.name}" has negative quantity`,
        itemId: String(index),
        itemName: item.name,
        expected: 0,
        actual: item.quantity,
      });
    }
  });

  // 3. Validate items sum to subtotal (within tolerance)
  if (receipt.items.length > 0) {
    const itemsTotal = new Decimal(
      receipt.items.reduce((sum, item) => {
        const itemPrice = new Decimal(item.price);
        const itemQuantity = new Decimal(item.quantity || 1);
        return sum.add(itemPrice.mul(itemQuantity));
      }, new Decimal(0))
    );

    const subtotal = new Decimal(receipt.subtotal);
    const difference = itemsTotal.sub(subtotal).abs();

    // Dynamic tolerance: 1 cent per item to account for rounding
    const dynamicTolerance = VALIDATION_LIMITS.SPLIT_AMOUNT_DEVIATION_PER_PERSON * receipt.items.length;
    const toleranceDecimal = new Decimal(dynamicTolerance);

    // Round to 2 decimal places to avoid floating point precision issues
    const roundedDifference = difference.toDecimalPlaces(2).toNumber();
    const roundedTolerance = toleranceDecimal.toDecimalPlaces(2).toNumber();

    if (roundedDifference > roundedTolerance) {
      errors.push({
        type: AmountValidationError.ITEMS_SUBTOTAL_MISMATCH,
        message: 'Sum of item prices does not match subtotal',
        expected: subtotal.toNumber(),
        actual: itemsTotal.toNumber(),
        diff: difference.toNumber(),
        tolerance: dynamicTolerance,
      });
    }
  }

  // 4. Validate each item's splits sum to that item's price (within tolerance)
  receipt.items.forEach((item, itemIndex) => {
    const assignments = assignedItems.get(itemIndex) || [];

    if (assignments.length === 0) {
      // Skip unassigned items
      return;
    }

    const itemPrice = new Decimal(item.price);
    const itemQuantity = new Decimal(item.quantity || 1);
    const totalItemPrice = itemPrice.mul(itemQuantity);

    // Calculate sum of all split amounts for this item
    const splitsTotal = assignments.reduce((sum, assignment) => {
      const sharePercentage = new Decimal(assignment.sharePercentage);
      const personShare = totalItemPrice.isZero()
        ? new Decimal(0)
        : totalItemPrice.mul(sharePercentage).div(100);
      return sum.add(personShare);
    }, new Decimal(0));

    const difference = splitsTotal.sub(totalItemPrice).abs();

    // Dynamic tolerance: 1 cent per person assigned to this item
    const participantCount = assignments.length;
    const dynamicTolerance = VALIDATION_LIMITS.SPLIT_AMOUNT_DEVIATION_PER_PERSON * participantCount;
    const toleranceDecimal = new Decimal(dynamicTolerance);

    // Round to 2 decimal places to avoid floating point precision issues
    const roundedDifference = difference.toDecimalPlaces(2).toNumber();
    const roundedTolerance = toleranceDecimal.toDecimalPlaces(2).toNumber();

    if (roundedDifference > roundedTolerance) {
      errors.push({
        type: AmountValidationError.ITEM_SPLITS_MISMATCH,
        message: `Sum of splits for item "${item.name}" does not match item price`,
        itemId: String(itemIndex),
        itemName: item.name,
        expected: totalItemPrice.toNumber(),
        actual: splitsTotal.toNumber(),
        diff: difference.toNumber(),
        tolerance: dynamicTolerance,
      });
    }
  });

  // 5. Validate no negative amounts in person items
  people.forEach((person) => {
    if (person.totalBeforeTax < 0) {
      errors.push({
        type: AmountValidationError.NEGATIVE_AMOUNT,
        message: `Person "${person.name}" has negative total before tax`,
        expected: 0,
        actual: person.totalBeforeTax,
      });
    }

    if (person.tax < 0) {
      errors.push({
        type: AmountValidationError.NEGATIVE_AMOUNT,
        message: `Person "${person.name}" has negative tax`,
        expected: 0,
        actual: person.tax,
      });
    }

    if (person.tip < 0) {
      errors.push({
        type: AmountValidationError.NEGATIVE_AMOUNT,
        message: `Person "${person.name}" has negative tip`,
        expected: 0,
        actual: person.tip,
      });
    }

    if (person.finalTotal < 0) {
      errors.push({
        type: AmountValidationError.NEGATIVE_AMOUNT,
        message: `Person "${person.name}" has negative final total`,
        expected: 0,
        actual: person.finalTotal,
      });
    }

    person.items.forEach((item) => {
      if (item.amount < 0) {
        errors.push({
          type: AmountValidationError.NEGATIVE_AMOUNT,
          message: `Person "${person.name}" has negative amount for item "${item.itemName}"`,
          itemId: String(item.itemId),
          itemName: item.itemName,
          expected: 0,
          actual: item.amount,
        });
      }
    });
  });

  return {
    isValid: errors.length === 0,
    errors,
  };
}