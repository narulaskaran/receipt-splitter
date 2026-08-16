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
  /**
   * ISO 4217 currency code (e.g., 'USD', 'EUR', 'GBP', 'JPY')
   *
   * This field is always present after parsing due to Zod schema's `.default('USD')`.
   * While optional in the Zod schema, it will always be set to 'USD' if not detected by AI.
   */
  currency: string;
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
  receiptId?: string;
  receiptName?: string;
}

// Group types
export interface Group {
  id: string;
  name: string;
  memberIds: string[];
  emoji?: string;
}

export interface PersonItemAssignment {
  personId: string;
  sharePercentage: number;
}

// UI State types
export interface StoredReceipt {
  id: string; // crypto.randomUUID()
  receipt: Receipt;
}

export type ItemAssignments = Map<number, PersonItemAssignment[]>;

export interface ReceiptState {
  receipts: StoredReceipt[];
  people: Person[];
  groups: Group[];
  assignedItems: Map<string, ItemAssignments>; // receiptId -> itemIndex -> shares
  isLoading: boolean;
  error: string | null;
}

// Util type for keeping track of item assignments
export interface ItemAssignment {
  itemIndex: number;
  personId: string;
  sharePercentage: number;
}

// Geolocation data from Vercel headers
export interface GeolocationData {
  country: string | null;      // x-vercel-ip-country
  region: string | null;        // x-vercel-ip-country-region
  city: string | null;          // x-vercel-ip-city
  latitude: string | null;      // x-vercel-ip-latitude
  longitude: string | null;     // x-vercel-ip-longitude
}
