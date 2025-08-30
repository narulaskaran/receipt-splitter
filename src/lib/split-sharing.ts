import { type Person } from '@/types';

/**
 * Interface representing the minimal data needed for a shared split
 */
export interface SharedSplitData {
  names: string[];
  amounts: number[];
  total: number;
  note: string; // Required: becomes Venmo transaction description
  phone: string; // Required: needed for Venmo payment links
  date?: string; // Optional: receipt date for display
}

/**
 * Serializes split data into URL-safe parameters
 * 
 * @param people - Array of people with their calculated amounts
 * @param note - Required note/memo for the split (becomes Venmo transaction description)
 * @param phone - Required phone number for Venmo payments
 * @param date - Optional receipt date
 * @returns URLSearchParams object ready to be appended to a URL
 */
export function serializeSplitData(
  people: Person[],
  note: string,
  phone: string,
  date?: string | null
): URLSearchParams {
  if (people.length === 0) {
    throw new Error('Cannot serialize empty people array');
  }

  if (!note || note.trim().length === 0) {
    throw new Error('Note is required for split sharing');
  }

  if (!phone || phone.trim().length === 0) {
    throw new Error('Phone number is required for split sharing');
  }

  // Sort people by name for consistent ordering
  const sortedPeople = [...people].sort((a, b) => a.name.localeCompare(b.name));
  
  const names = sortedPeople.map(person => person.name);
  const amounts = sortedPeople.map(person => person.finalTotal);
  const total = amounts.reduce((sum, amount) => sum + amount, 0);

  const params = new URLSearchParams();
  
  // Required parameters
  params.set('names', names.join(','));
  params.set('amounts', amounts.map(amount => amount.toFixed(2)).join(','));
  params.set('total', total.toFixed(2));
  params.set('note', note.trim());
  params.set('phone', phone.trim());
  
  // Optional parameters
  if (date) {
    params.set('date', date);
  }

  return params;
}

/**
 * Deserializes URL parameters back into split data
 * 
 * @param searchParams - URLSearchParams from the shared URL
 * @returns SharedSplitData object or null if invalid
 */
export function deserializeSplitData(searchParams: URLSearchParams): SharedSplitData | null {
  try {
    const namesParam = searchParams.get('names');
    const amountsParam = searchParams.get('amounts');
    const totalParam = searchParams.get('total');
    const noteParam = searchParams.get('note');
    const phoneParam = searchParams.get('phone');

    // Required parameters check
    if (!namesParam || !amountsParam || !totalParam || !noteParam || !phoneParam) {
      return null;
    }

    const names = namesParam.split(',').map(name => name.trim()).filter(name => name.length > 0);
    const amountStrings = amountsParam.split(',').map(amount => amount.trim());
    const total = parseFloat(totalParam);
    const note = noteParam.trim();
    const phone = phoneParam.trim();

    // Validate required fields
    if (note.length === 0 || phone.length === 0) {
      return null;
    }

    // Validate arrays have same length
    if (names.length !== amountStrings.length || names.length === 0) {
      return null;
    }

    // Parse and validate amounts
    const amounts: number[] = [];
    for (const amountStr of amountStrings) {
      const amount = parseFloat(amountStr);
      if (isNaN(amount) || amount < 0) {
        return null;
      }
      amounts.push(amount);
    }

    // Validate total
    if (isNaN(total) || total < 0) {
      return null;
    }

    // Optional parameters
    const date = searchParams.get('date') || undefined;

    return {
      names,
      amounts,
      total,
      note,
      phone,
      date,
    };
  } catch {
    // Return null for any parsing errors
    return null;
  }
}

/**
 * Generates a complete shareable URL for a split
 * 
 * @param baseUrl - The base URL of the application (e.g., 'https://yourapp.com')
 * @param people - Array of people with their calculated amounts
 * @param note - Required note/memo for the split (becomes Venmo transaction description)
 * @param phone - Required phone number for Venmo payments
 * @param date - Optional receipt date
 * @returns Complete shareable URL
 */
export function generateShareableUrl(
  baseUrl: string,
  people: Person[],
  note: string,
  phone: string,
  date?: string | null
): string {
  const params = serializeSplitData(people, note, phone, date);
  // Ensure baseUrl doesn't end with slash to avoid double slashes
  const cleanBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  return `${cleanBaseUrl}/split?${params.toString()}`;
}

/**
 * Validates that a SharedSplitData object has consistent data
 * 
 * @param splitData - The split data to validate
 * @returns true if valid, false otherwise
 */
export function validateSplitData(splitData: SharedSplitData): boolean {
  try {
    // Check arrays have same length
    if (splitData.names.length !== splitData.amounts.length) {
      return false;
    }

    // Check for empty arrays
    if (splitData.names.length === 0) {
      return false;
    }

    // Check names are not empty
    if (splitData.names.some(name => name.trim().length === 0)) {
      return false;
    }

    // Check required fields
    if (!splitData.note || splitData.note.trim().length === 0) {
      return false;
    }

    if (!splitData.phone || splitData.phone.trim().length === 0) {
      return false;
    }

    // Check amounts are valid numbers >= 0
    if (splitData.amounts.some(amount => isNaN(amount) || amount < 0)) {
      return false;
    }

    // Check total is valid
    if (isNaN(splitData.total) || splitData.total < 0) {
      return false;
    }

    // Validate amounts roughly add up to total (allow for small rounding differences)
    const calculatedTotal = splitData.amounts.reduce((sum, amount) => sum + amount, 0);
    const difference = Math.abs(calculatedTotal - splitData.total);
    const tolerance = 0.01; // 1 cent tolerance for rounding
    
    if (difference > tolerance) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}