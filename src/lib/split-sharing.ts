import { type Person } from '@/types';

/**
 * Interface representing the minimal data needed for a shared split
 */
export interface SharedSplitData {
  names: string[];
  amounts: number[];
  total: number;
  restaurant?: string;
  date?: string;
  phone?: string;
}

/**
 * Serializes split data into URL-safe parameters
 * 
 * @param people - Array of people with their calculated amounts
 * @param restaurant - Optional restaurant name
 * @param date - Optional receipt date
 * @param phone - Optional phone number for Venmo
 * @returns URLSearchParams object ready to be appended to a URL
 */
export function serializeSplitData(
  people: Person[],
  restaurant?: string | null,
  date?: string | null,
  phone?: string
): URLSearchParams {
  if (people.length === 0) {
    throw new Error('Cannot serialize empty people array');
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
  
  // Optional parameters
  if (restaurant) {
    params.set('restaurant', restaurant);
  }
  
  if (date) {
    params.set('date', date);
  }
  
  if (phone) {
    params.set('phone', phone);
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

    // Required parameters check
    if (!namesParam || !amountsParam || !totalParam) {
      return null;
    }

    const names = namesParam.split(',').map(name => name.trim()).filter(name => name.length > 0);
    const amountStrings = amountsParam.split(',').map(amount => amount.trim());
    const total = parseFloat(totalParam);

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
    const restaurant = searchParams.get('restaurant') || undefined;
    const date = searchParams.get('date') || undefined;
    const phone = searchParams.get('phone') || undefined;

    return {
      names,
      amounts,
      total,
      restaurant,
      date,
      phone,
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
 * @param restaurant - Optional restaurant name
 * @param date - Optional receipt date
 * @param phone - Optional phone number for Venmo
 * @returns Complete shareable URL
 */
export function generateShareableUrl(
  baseUrl: string,
  people: Person[],
  restaurant?: string | null,
  date?: string | null,
  phone?: string
): string {
  const params = serializeSplitData(people, restaurant, date, phone);
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