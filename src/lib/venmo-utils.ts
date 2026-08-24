import { isValidPhoneNumber } from './split-sharing';

/**
 * Configuration for Venmo payment links
 */
export const VENMO_CONFIG = {
  /**
   * Native app URL. The Venmo app percent-decodes notes (`%20` → space) and
   * treats `+` as a literal character. Opening `https://venmo.com/?…` (the
   * homepage) lets Venmo's web interstitial re-serialize the query with `+`
   * for spaces, which is why swapping `+` for `%20` on that URL was not enough.
   */
  APP_URL: 'venmo://paycharge',
  /**
   * Web compose page. Used when the native app scheme is not appropriate
   * (desktop). Do not use `https://venmo.com/` — that is the homepage.
   */
  WEB_URL: 'https://venmo.com/pay',
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

function buildValidatedParams(
  phoneNumber: string,
  amount: number,
  note: string,
  currencyCode: string
): VenmoPaymentParams | null {
  // Venmo only supports USD
  if (currencyCode !== 'USD') {
    console.warn(`Venmo only supports USD. Attempted to generate link for ${currencyCode}`);
    return null;
  }

  const params: VenmoPaymentParams = {
    phoneNumber,
    amount,
    note: note.slice(0, VENMO_CONFIG.MAX_NOTE_LENGTH), // Truncate if too long
  };

  if (!validateVenmoParams(params)) {
    return null;
  }

  return params;
}

/**
 * Builds a Venmo query string.
 *
 * Uses `encodeURIComponent` (RFC 3986, spaces as `%20`) rather than
 * `URLSearchParams#toString()` (form-urlencoded, spaces as `+`). The Venmo
 * app does not treat `+` as a space, so notes like "Olive Garden - Karan"
 * would show up as "Olive+Garden+-+Karan".
 */
function buildVenmoQuery(params: VenmoPaymentParams): string {
  const cleanPhone = params.phoneNumber.replace(/\D/g, '');
  const parts = [
    `txn=${encodeURIComponent('pay')}`,
    `recipients=${encodeURIComponent(cleanPhone)}`,
    `amount=${encodeURIComponent(params.amount.toFixed(2))}`,
  ];

  const trimmedNote = params.note.trim();
  if (trimmedNote) {
    parts.push(`note=${encodeURIComponent(trimmedNote)}`);
  }

  return parts.join('&');
}

function venmoQueryOrNull(
  phoneNumber: string,
  amount: number,
  note: string,
  currencyCode: string
): string | null {
  const params = buildValidatedParams(phoneNumber, amount, note, currencyCode);
  if (!params) {
    return null;
  }
  return buildVenmoQuery(params);
}

/**
 * Generates a Venmo payment link that opens the native app.
 *
 * NOTE: Venmo only supports USD. This function should only be called for USD amounts.
 *
 * @param phoneNumber - Recipient's phone number (10 or 11 digits)
 * @param amount - Payment amount in USD (must be positive and <= $2999.99)
 * @param note - Payment note/memo (optional, max 60 characters)
 * @param currencyCode - Currency code (must be 'USD', defaults to 'USD')
 * @returns Venmo payment URL or null if parameters are invalid or currency is not USD
 */
export function generateVenmoLink(
  phoneNumber: string,
  amount: number,
  note: string = '',
  currencyCode: string = 'USD'
): string | null {
  const query = venmoQueryOrNull(phoneNumber, amount, note, currencyCode);
  if (query === null) {
    return null;
  }
  return `${VENMO_CONFIG.APP_URL}?${query}`;
}

/**
 * Generates a Venmo web compose URL as a fallback when the native app scheme
 * cannot be used (desktop browsers).
 */
export function generateVenmoWebLink(
  phoneNumber: string,
  amount: number,
  note: string = '',
  currencyCode: string = 'USD'
): string | null {
  const query = venmoQueryOrNull(phoneNumber, amount, note, currencyCode);
  if (query === null) {
    return null;
  }
  return `${VENMO_CONFIG.WEB_URL}?${query}`;
}

export function isVenmoAppPreferred(): boolean {
  if (typeof navigator === 'undefined') {
    return false;
  }
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
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
  const preferNativeApp = isVenmoAppPreferred();
  const link = preferNativeApp
    ? generateVenmoLink(phoneNumber, amount, note)
    : generateVenmoWebLink(phoneNumber, amount, note);

  if (!link) {
    return false;
  }

  try {
    // Phones must use the native scheme so the app receives `%20` spaces.
    // `https://venmo.com/?…` is rewritten by Venmo's web interstitial with `+`.
    if (preferNativeApp) {
      // `_self` is a top-level navigation from the user gesture, which iOS
      // allows for custom URL schemes. `window.open(..., '_blank')` is often
      // treated as a popup and blocked for `venmo://`.
      window.open(link, '_self');
      return true;
    }

    window.open(link, '_blank', 'noopener,noreferrer');
    return true;
  } catch (error) {
    console.error('Failed to open Venmo payment link:', error);
    return false;
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
