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
 * Error types for split data validation
 */
export enum SplitDataError {
  EMPTY_PEOPLE_ARRAY = 'EMPTY_PEOPLE_ARRAY',
  MISMATCHED_ARRAY_LENGTHS = 'MISMATCHED_ARRAY_LENGTHS',
  EMPTY_NAME = 'EMPTY_NAME',
  INVALID_AMOUNT = 'INVALID_AMOUNT',
  NEGATIVE_AMOUNT = 'NEGATIVE_AMOUNT',
  INVALID_TOTAL = 'INVALID_TOTAL',
  NEGATIVE_TOTAL = 'NEGATIVE_TOTAL',
  AMOUNTS_TOTAL_MISMATCH = 'AMOUNTS_TOTAL_MISMATCH',
  INVALID_PHONE_NUMBER = 'INVALID_PHONE_NUMBER',
  INVALID_DATE_FORMAT = 'INVALID_DATE_FORMAT',
  NAME_TOO_LONG = 'NAME_TOO_LONG',
  NOTE_TOO_LONG = 'NOTE_TOO_LONG',
  TOO_MANY_PEOPLE = 'TOO_MANY_PEOPLE',
  AMOUNT_TOO_LARGE = 'AMOUNT_TOO_LARGE',
  INVALID_SPLIT_DETAILS = 'INVALID_SPLIT_DETAILS'
}

/**
 * Result of split data validation with detailed error information
 */
export interface SplitValidationResult {
  isValid: boolean;
  errors: SplitDataError[];
  errorMessages: string[];
}

/**
 * Configuration for split data validation limits
 */
export const VALIDATION_LIMITS = {
  MAX_NAME_LENGTH: 50,
  MAX_NOTE_LENGTH: 100,
  MAX_PEOPLE_COUNT: 50,
  MAX_AMOUNT: 99999.99,
  // Base tolerance for rounding differences when summing individual amounts
  // We will scale this dynamically by number of people to account for
  // compounding rounding errors (up to 1 cent per person)
  AMOUNT_TOLERANCE: 0.01,
} as const;

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
  // Validate input before proceeding
  const validation = validateSerializationInput(people, note, phone, date);
  if (!validation.isValid) {
    throw new Error(`Invalid split data: ${validation.errorMessages.join(', ')}`);
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
 * Validates a phone number for Venmo compatibility
 * 
 * @param phone - Phone number to validate
 * @returns true if valid for Venmo, false otherwise
 */
export function isValidPhoneNumber(phone: string): boolean {
  if (!phone) return false;
  
  // Remove all non-digits
  const digitsOnly = phone.replace(/\D/g, '');
  
  // US phone numbers should be exactly 10 digits (without country code) or 11 digits starting with 1
  if (digitsOnly.length === 10) {
    // Basic US phone number format check: first digit should be 2-9
    const firstDigit = digitsOnly[0];
    return firstDigit >= '2' && firstDigit <= '9';
  } else if (digitsOnly.length === 11) {
    // Should start with 1 (US country code) and the next digit should be 2-9
    const secondDigit = digitsOnly[1];
    return digitsOnly.startsWith('1') && secondDigit >= '2' && secondDigit <= '9';
  }
  
  return false;
}

/**
 * Validates date string format
 * 
 * @param date - Date string to validate
 * @returns true if valid ISO date format, false otherwise
 */
export function isValidDateFormat(date: string): boolean {
  if (!date) return false;
  
  // Check if it's a valid date string that can be parsed
  const parsedDate = new Date(date);
  return !isNaN(parsedDate.getTime()) && date.length >= 8; // Minimum reasonable date length
}

/**
 * Comprehensive validation of split data with detailed error reporting
 * 
 * @param splitData - The split data to validate
 * @returns SplitValidationResult with detailed error information
 */
export function validateSplitDataDetailed(splitData: SharedSplitData): SplitValidationResult {
  const errors: SplitDataError[] = [];
  const errorMessages: string[] = [];

  try {
    // Check for empty arrays
    if (splitData.names.length === 0) {
      errors.push(SplitDataError.EMPTY_PEOPLE_ARRAY);
      errorMessages.push('At least one person must be included in the split');
      return { isValid: false, errors, errorMessages };
    }

    // Check arrays have same length
    if (splitData.names.length !== splitData.amounts.length) {
      errors.push(SplitDataError.MISMATCHED_ARRAY_LENGTHS);
      errorMessages.push('The number of names and amounts must match');
    }

    // Check for too many people
    if (splitData.names.length > VALIDATION_LIMITS.MAX_PEOPLE_COUNT) {
      errors.push(SplitDataError.TOO_MANY_PEOPLE);
      errorMessages.push(`Maximum ${VALIDATION_LIMITS.MAX_PEOPLE_COUNT} people allowed in a split`);
    }

    // Validate names
    splitData.names.forEach((name, index) => {
      const trimmedName = name.trim();
      if (trimmedName.length === 0) {
        errors.push(SplitDataError.EMPTY_NAME);
        errorMessages.push(`Person ${index + 1} has an empty name`);
      } else if (trimmedName.length > VALIDATION_LIMITS.MAX_NAME_LENGTH) {
        errors.push(SplitDataError.NAME_TOO_LONG);
        errorMessages.push(`Name "${trimmedName}" exceeds ${VALIDATION_LIMITS.MAX_NAME_LENGTH} characters`);
      }
    });

    // Validate amounts
    splitData.amounts.forEach((amount, index) => {
      if (isNaN(amount)) {
        errors.push(SplitDataError.INVALID_AMOUNT);
        errorMessages.push(`Amount for ${splitData.names[index]} is not a valid number`);
      } else if (amount < 0) {
        errors.push(SplitDataError.NEGATIVE_AMOUNT);
        errorMessages.push(`Amount for ${splitData.names[index]} cannot be negative`);
      } else if (amount > VALIDATION_LIMITS.MAX_AMOUNT) {
        errors.push(SplitDataError.AMOUNT_TOO_LARGE);
        errorMessages.push(`Amount for ${splitData.names[index]} exceeds maximum allowed (${VALIDATION_LIMITS.MAX_AMOUNT})`);
      }
    });

    // Validate total
    if (isNaN(splitData.total)) {
      errors.push(SplitDataError.INVALID_TOTAL);
      errorMessages.push(`Total amount '${splitData.total}' is not a valid number`);
    } else if (splitData.total < 0) {
      errors.push(SplitDataError.NEGATIVE_TOTAL);
      errorMessages.push(`Total amount '${splitData.total}' cannot be negative`);
    } else {
      // Only check amount sum if total is valid
      const calculatedTotal = splitData.amounts.reduce((sum, amount) => sum + amount, 0);
      const difference = Math.abs(calculatedTotal - splitData.total);

      // Allow up to 1 cent rounding difference per person to account for
      // compounding rounding across many participants
      const dynamicTolerance = Math.max(
        VALIDATION_LIMITS.AMOUNT_TOLERANCE,
        VALIDATION_LIMITS.AMOUNT_TOLERANCE * splitData.names.length
      );

      if (difference > dynamicTolerance) {
        errors.push(SplitDataError.AMOUNTS_TOTAL_MISMATCH);
        errorMessages.push(
          `Individual amounts (${calculatedTotal.toFixed(2)}) do not add up to total (${splitData.total.toFixed(2)}). ` +
          `Allowed rounding tolerance: ±${dynamicTolerance.toFixed(2)}`
        );
      }
    }

    // Validate required note field
    if (!splitData.note || splitData.note.trim().length === 0) {
      errors.push(SplitDataError.EMPTY_NAME); // Reuse existing error type
      errorMessages.push(`Note/memo is required for split sharing. Received: '${splitData.note || 'undefined'}'`);
    } else if (splitData.note.length > VALIDATION_LIMITS.MAX_NOTE_LENGTH) {
      errors.push(SplitDataError.NOTE_TOO_LONG);
      errorMessages.push(`Note '${splitData.note}' exceeds ${VALIDATION_LIMITS.MAX_NOTE_LENGTH} characters (length: ${splitData.note.length})`);
    }

    // Validate required phone field
    if (!splitData.phone || splitData.phone.trim().length === 0) {
      errors.push(SplitDataError.INVALID_PHONE_NUMBER);
      errorMessages.push(`Phone number is required for split sharing. Received: '${splitData.phone || 'undefined'}'`);
    } else if (!isValidPhoneNumber(splitData.phone)) {
      errors.push(SplitDataError.INVALID_PHONE_NUMBER);
      errorMessages.push(`Phone number '${splitData.phone}' format is invalid for Venmo (must be 10 or 11 digits)`);
    }

    // Validate optional date field
    if (splitData.date && !isValidDateFormat(splitData.date)) {
      errors.push(SplitDataError.INVALID_DATE_FORMAT);
      errorMessages.push(`Date format '${splitData.date}' is invalid`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      errorMessages
    };
  } catch {
    return {
      isValid: false,
      errors: [SplitDataError.INVALID_SPLIT_DETAILS],
      errorMessages: [`An unexpected error occurred during validation. Split data: ${JSON.stringify(splitData)}`]
    };
  }
}

/**
 * Simple boolean validation for backward compatibility
 * 
 * @param splitData - The split data to validate
 * @returns true if valid, false otherwise
 */
export function validateSplitData(splitData: SharedSplitData): boolean {
  return validateSplitDataDetailed(splitData).isValid;
}

/**
 * Validates serialization input before processing
 * 
 * @param people - Array of people to validate
 * @param note - Required note/memo for the split
 * @param phone - Required phone number for Venmo
 * @param date - Optional date
 * @returns SplitValidationResult with validation details
 */
export function validateSerializationInput(
  people: Person[],
  note: string,
  phone: string,
  date?: string | null
): SplitValidationResult {
  const errors: SplitDataError[] = [];
  const errorMessages: string[] = [];

  // Check people array
  if (people.length === 0) {
    errors.push(SplitDataError.EMPTY_PEOPLE_ARRAY);
    errorMessages.push('At least one person must be included in the split');
    return { isValid: false, errors, errorMessages };
  }

  if (people.length > VALIDATION_LIMITS.MAX_PEOPLE_COUNT) {
    errors.push(SplitDataError.TOO_MANY_PEOPLE);
    errorMessages.push(`Maximum ${VALIDATION_LIMITS.MAX_PEOPLE_COUNT} people allowed in a split`);
  }

  // Validate each person
  people.forEach((person, index) => {
    if (!person.name || person.name.trim().length === 0) {
      errors.push(SplitDataError.EMPTY_NAME);
      errorMessages.push(`Person ${index + 1} has an empty name`);
    } else if (person.name.trim().length > VALIDATION_LIMITS.MAX_NAME_LENGTH) {
      errors.push(SplitDataError.NAME_TOO_LONG);
      errorMessages.push(`Name "${person.name.trim()}" exceeds ${VALIDATION_LIMITS.MAX_NAME_LENGTH} characters`);
    }

    if (isNaN(person.finalTotal)) {
      errors.push(SplitDataError.INVALID_AMOUNT);
      errorMessages.push(`Amount for ${person.name} is not a valid number`);
    } else if (person.finalTotal < 0) {
      errors.push(SplitDataError.NEGATIVE_AMOUNT);
      errorMessages.push(`Amount for ${person.name} cannot be negative`);
    } else if (person.finalTotal > VALIDATION_LIMITS.MAX_AMOUNT) {
      errors.push(SplitDataError.AMOUNT_TOO_LARGE);
      errorMessages.push(`Amount for ${person.name} exceeds maximum allowed (${VALIDATION_LIMITS.MAX_AMOUNT})`);
    }
  });

  // Validate required note field
  if (!note || note.trim().length === 0) {
    errors.push(SplitDataError.EMPTY_NAME); // Reuse existing error type
    errorMessages.push(`Note/memo is required for split sharing. Received: '${note || 'undefined'}'`);
  } else if (note.length > VALIDATION_LIMITS.MAX_NOTE_LENGTH) {
    errors.push(SplitDataError.NOTE_TOO_LONG);
    errorMessages.push(`Note '${note}' exceeds ${VALIDATION_LIMITS.MAX_NOTE_LENGTH} characters (length: ${note.length})`);
  }

  // Validate required phone field
  if (!phone || phone.trim().length === 0) {
    errors.push(SplitDataError.INVALID_PHONE_NUMBER);
    errorMessages.push(`Phone number is required for split sharing. Received: '${phone || 'undefined'}'`);
  } else if (!isValidPhoneNumber(phone)) {
    errors.push(SplitDataError.INVALID_PHONE_NUMBER);
    errorMessages.push(`Phone number '${phone}' format is invalid for Venmo (must be 10 or 11 digits)`);
  }

  // Validate optional date field
  if (date && !isValidDateFormat(date)) {
    errors.push(SplitDataError.INVALID_DATE_FORMAT);
    errorMessages.push(`Date format '${date}' is invalid`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    errorMessages
  };
}