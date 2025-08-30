import { isValidPhoneNumber } from './split-sharing';

/**
 * Configuration for Venmo payment links
 */
export const VENMO_CONFIG = {
  BASE_URL: 'https://venmo.com/',
  MAX_NOTE_LENGTH: 60, // Venmo has a character limit for notes
  MAX_AMOUNT: 2999.99, // Venmo's single transaction limit
} as const;

/**
 * Interface for Venmo payment link parameters
 */
export interface VenmoPaymentParams {
  phoneNumber: string;
  amount: number;
  note: string;
}

/**
 * Validates Venmo payment parameters
 * 
 * @param params - Venmo payment parameters to validate
 * @returns true if valid for Venmo payment, false otherwise
 */
export function validateVenmoParams(params: VenmoPaymentParams): boolean {
  // Validate phone number
  if (!isValidPhoneNumber(params.phoneNumber)) {
    return false;
  }

  // Validate amount
  if (isNaN(params.amount) || params.amount <= 0 || params.amount > VENMO_CONFIG.MAX_AMOUNT) {
    return false;
  }

  // Validate note (allow empty notes)
  if (params.note.length > VENMO_CONFIG.MAX_NOTE_LENGTH) {
    return false;
  }

  return true;
}

/**
 * Generates a Venmo payment link
 * 
 * @param phoneNumber - Recipient's phone number (10 or 11 digits)
 * @param amount - Payment amount (must be positive and <= $2999.99)
 * @param note - Payment note/memo (optional, max 60 characters)
 * @returns Venmo payment URL or null if parameters are invalid
 */
export function generateVenmoLink(
  phoneNumber: string,
  amount: number,
  note: string = ''
): string | null {
  const params: VenmoPaymentParams = {
    phoneNumber,
    amount,
    note: note.slice(0, VENMO_CONFIG.MAX_NOTE_LENGTH), // Truncate if too long
  };

  // Validate parameters
  if (!validateVenmoParams(params)) {
    return null;
  }

  // Clean phone number (remove non-digits)
  const cleanPhone = phoneNumber.replace(/\D/g, '');

  // Build URL parameters
  const urlParams = new URLSearchParams({
    txn: 'pay',
    recipients: cleanPhone,
    amount: amount.toFixed(2),
  });

  // Add note if provided
  if (note.trim()) {
    urlParams.set('note', note.trim());
  }

  return `${VENMO_CONFIG.BASE_URL}?${urlParams.toString()}`;
}

/**
 * Opens a Venmo payment link in a new window/tab
 * 
 * @param phoneNumber - Recipient's phone number
 * @param amount - Payment amount
 * @param note - Payment note/memo
 * @returns true if link was opened successfully, false if parameters were invalid
 */
export function openVenmoPayment(
  phoneNumber: string,
  amount: number,
  note: string = ''
): boolean {
  const link = generateVenmoLink(phoneNumber, amount, note);
  
  if (!link) {
    return false;
  }

  try {
    window.open(link, '_blank', 'noopener,noreferrer');
    return true;
  } catch (error) {
    console.error('Failed to open Venmo payment link:', error);
    return false;
  }
}

/**
 * Shares a Venmo payment link using the Web Share API if available,
 * otherwise opens the link directly
 * 
 * @param phoneNumber - Recipient's phone number
 * @param amount - Payment amount
 * @param note - Payment note/memo
 * @param personName - Name of the person for the share title
 * @returns Promise that resolves when sharing is complete
 */
export async function shareVenmoPayment(
  phoneNumber: string,
  amount: number,
  note: string = '',
  personName: string = 'someone'
): Promise<void> {
  const link = generateVenmoLink(phoneNumber, amount, note);
  
  if (!link) {
    throw new Error('Invalid payment parameters');
  }

  // Try native sharing first
  if (navigator.share) {
    try {
      await navigator.share({
        title: `Pay ${personName} via Venmo`,
        text: `Pay ${personName} $${amount.toFixed(2)} via Venmo`,
        url: link,
      });
      return;
    } catch (error) {
      // User cancelled or sharing failed, fall back to opening link
      if (error instanceof Error && error.name === 'AbortError') {
        return; // User cancelled, don't open link
      }
    }
  }

  // Fallback to opening link directly
  if (!openVenmoPayment(phoneNumber, amount, note)) {
    throw new Error('Failed to open Venmo payment');
  }
}

/**
 * Formats a note for Venmo payment based on split note and person name
 * 
 * @param splitNote - Note from the split (e.g., restaurant name)
 * @param personName - Name of the person paying (optional)
 * @returns Formatted note string, truncated to Venmo's limit
 */
export function formatVenmoNote(
  splitNote?: string,
  personName?: string
): string {
  // Trim and check if strings are meaningful
  const trimmedNote = splitNote?.trim();
  const trimmedPerson = personName?.trim();
  
  let note = '';
  
  if (trimmedNote && trimmedPerson) {
    note = `${trimmedNote} - ${trimmedPerson}`;
  } else if (trimmedNote) {
    note = trimmedNote;
  } else if (trimmedPerson) {
    note = `Split with ${trimmedPerson}`;
  } else {
    note = 'Receipt Split';
  }

  // Truncate to Venmo's character limit
  return note.slice(0, VENMO_CONFIG.MAX_NOTE_LENGTH);
}