import Decimal from 'decimal.js';
import { type Person, type Receipt, type PersonItem, type PersonItemAssignment } from '@/types';

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
      const personShare = totalItemPrice.mul(sharePercentage).div(100);
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
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
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