/**
 * Demo / screenshot session fixtures.
 *
 * Lunch line items must equal subtotal: 15 + (5×2) + (3×2) + 14 = 45.
 * Results runs the same item/subtotal check; a mismatch shows
 * "Split Validation Issues" on an otherwise clean mock walk.
 */

const MOCK_RECEIPT = {
  restaurant: "Test Restaurant",
  date: "2024-01-15",
  subtotal: 45.00,
  tax: 4.50,
  tip: 9.00,
  total: 58.50,
  currency: "USD",
  items: [
    { name: "Burger", price: 15.00, quantity: 1 },
    { name: "Fries", price: 5.00, quantity: 2 },
    { name: "Soda", price: 3.00, quantity: 2 },
    { name: "Salad", price: 14.00, quantity: 1 },
  ],
};

const MOCK_RECEIPT_ID = "receipt-1";

const MOCK_COFFEE_ID = "receipt-coffee";
const MOCK_LUNCH_ID = "receipt-lunch";

const MOCK_COFFEE_RECEIPT = {
  restaurant: "Coffee",
  date: "2024-01-15",
  subtotal: 10.00,
  tax: 1.00,
  tip: 2.00,
  total: 13.00,
  currency: "USD",
  items: [
    { name: "Latte", price: 5.00, quantity: 1 },
    { name: "Muffin", price: 5.00, quantity: 1 },
  ],
};

const MOCK_LUNCH_RECEIPT = {
  ...MOCK_RECEIPT,
  restaurant: "Lunch",
};

function itemsTotal(receipt) {
  return receipt.items.reduce(
    (sum, item) => sum + item.price * (item.quantity || 1),
    0
  );
}

/**
 * Screenshot fixtures must satisfy the same invariants Results validates,
 * or --mock-data walks show a real "Split Validation Issues" banner.
 */
function assertReceiptBalances(receipt) {
  const label = receipt.restaurant || "receipt";
  const lineTotal = itemsTotal(receipt);
  if (Math.abs(lineTotal - receipt.subtotal) > 0.001) {
    throw new Error(
      `Screenshot fixture "${label}" items sum to ${lineTotal.toFixed(2)}, subtotal is ${receipt.subtotal.toFixed(2)}`
    );
  }
  const expectedTotal = receipt.subtotal + receipt.tax + receipt.tip;
  if (Math.abs(expectedTotal - receipt.total) > 0.001) {
    throw new Error(
      `Screenshot fixture "${label}" subtotal+tax+tip is ${expectedTotal.toFixed(2)}, total is ${receipt.total.toFixed(2)}`
    );
  }
}

assertReceiptBalances(MOCK_RECEIPT);
assertReceiptBalances(MOCK_COFFEE_RECEIPT);
assertReceiptBalances(MOCK_LUNCH_RECEIPT);

const MOCK_COFFEE_ASSIGNED_ITEMS = [
  [0, [{ personId: "person-1", sharePercentage: 100 }]],
  [1, [{ personId: "person-2", sharePercentage: 50 }, { personId: "person-3", sharePercentage: 50 }]],
];

// Person totals match calculatePersonTotals() for MOCK_ASSIGNED_ITEMS on Lunch:
// Alice: Burger $15 + 50% of Fries $10 = $20; tax $2; tip $4; final $26
// Bob: 50% of Fries $10 + Soda $6 = $11; tax $1.10; tip $2.20; final $14.30
// Charlie: Salad $14; tax $1.40; tip $2.80; final $18.20
const MOCK_PEOPLE = [
  {
    id: "person-1",
    name: "Alice",
    items: [
      { itemId: 0, itemName: "Burger", originalPrice: 15.00, quantity: 1, sharePercentage: 100, amount: 15.00 },
      { itemId: 1, itemName: "Fries", originalPrice: 5.00, quantity: 2, sharePercentage: 50, amount: 5.00 },
    ],
    totalBeforeTax: 20.00,
    tax: 2.00,
    tip: 4.00,
    finalTotal: 26.00,
  },
  {
    id: "person-2",
    name: "Bob",
    items: [
      { itemId: 1, itemName: "Fries", originalPrice: 5.00, quantity: 2, sharePercentage: 50, amount: 5.00 },
      { itemId: 2, itemName: "Soda", originalPrice: 3.00, quantity: 2, sharePercentage: 100, amount: 6.00 },
    ],
    totalBeforeTax: 11.00,
    tax: 1.10,
    tip: 2.20,
    finalTotal: 14.30,
  },
  {
    id: "person-3",
    name: "Charlie",
    items: [
      { itemId: 3, itemName: "Salad", originalPrice: 14.00, quantity: 1, sharePercentage: 100, amount: 14.00 },
    ],
    totalBeforeTax: 14.00,
    tax: 1.40,
    tip: 2.80,
    finalTotal: 18.20,
  },
];

const MOCK_GROUPS = [
  {
    id: "group-1",
    name: "Friends",
    memberIds: ["person-1", "person-2"],
    emoji: "1f3c8",
  },
];

// assignedItems stored as array of [itemIndex, assignments[]] entries (serialized Map)
const MOCK_ASSIGNED_ITEMS = [
  [0, [{ personId: "person-1", sharePercentage: 100 }]],
  [1, [{ personId: "person-1", sharePercentage: 50 }, { personId: "person-2", sharePercentage: 50 }]],
  [2, [{ personId: "person-2", sharePercentage: 100 }]],
  [3, [{ personId: "person-3", sharePercentage: 100 }]],
];

/**
 * Build a v2 session matching serializeSession() in src/lib/session-persistence.ts.
 * assignedItems is nested: [[receiptId, [[itemIndex, assignments]]]]
 * @param {string} activeTab - Which tab to show (upload, people, assign, results)
 * @param {{ multiReceipt?: boolean }} [options]
 */
function buildMockSession(activeTab = "results", { multiReceipt = false } = {}) {
  if (multiReceipt) {
    return {
      version: 2,
      state: {
        receipts: [
          { id: MOCK_COFFEE_ID, receipt: MOCK_COFFEE_RECEIPT },
          { id: MOCK_LUNCH_ID, receipt: MOCK_LUNCH_RECEIPT },
        ],
        people: MOCK_PEOPLE,
        assignedItems: [
          [MOCK_COFFEE_ID, MOCK_COFFEE_ASSIGNED_ITEMS],
          [MOCK_LUNCH_ID, MOCK_ASSIGNED_ITEMS],
        ],
        groups: MOCK_GROUPS,
        isLoading: false,
        error: null,
      },
      activeTab,
    };
  }

  return {
    version: 2,
    state: {
      receipts: [{ id: MOCK_RECEIPT_ID, receipt: MOCK_RECEIPT }],
      people: MOCK_PEOPLE,
      assignedItems: [[MOCK_RECEIPT_ID, MOCK_ASSIGNED_ITEMS]],
      groups: MOCK_GROUPS,
      isLoading: false,
      error: null,
    },
    activeTab,
  };
}

module.exports = {
  MOCK_RECEIPT,
  MOCK_RECEIPT_ID,
  MOCK_COFFEE_ID,
  MOCK_LUNCH_ID,
  MOCK_COFFEE_RECEIPT,
  MOCK_LUNCH_RECEIPT,
  MOCK_PEOPLE,
  MOCK_GROUPS,
  MOCK_ASSIGNED_ITEMS,
  MOCK_COFFEE_ASSIGNED_ITEMS,
  buildMockSession,
  itemsTotal,
  assertReceiptBalances,
};
