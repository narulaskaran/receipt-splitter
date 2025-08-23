// Receipt types
export interface ReceiptItem {
  name: string;
  price: number;
  quantity: number;
}

export interface Receipt {
  restaurant: string | null;
  date: string | null;
  subtotal: number;
  tax: number;
  tip: number | null;
  total: number;
  items: ReceiptItem[];
}

// Person types
export interface Person {
  id: string;
  name: string;
  items: PersonItem[];
  totalBeforeTax: number;
  tax: number;
  tip: number;
  finalTotal: number;
}

export interface PersonItem {
  itemId: number;
  itemName: string;
  originalPrice: number;
  quantity: number;
  sharePercentage: number;
  amount: number;
}

// Group types
export interface Group {
  id: string;
  name: string;
  memberIds: string[];
  emoji?: string;
}

// UI State types
export interface ReceiptState {
  originalReceipt: Receipt | null;
  people: Person[];
  assignedItems: Map<number, PersonItemAssignment[]>;
  unassignedItems: number[];
  groups: Group[];
  isLoading: boolean;
  error: string | null;
}

export interface PersonItemAssignment {
  personId: string;
  sharePercentage: number;
}

// Util type for keeping track of item assignments
export interface ItemAssignment {
  itemIndex: number;
  personId: string;
  sharePercentage: number;
}
