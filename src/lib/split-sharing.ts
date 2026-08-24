import { type Person } from "@/types";
import { toMinorUnits, fromMinorUnits, DEFAULT_CURRENCY } from "./currency";

/**
 * Interface representing the minimal data needed for a shared split
 */
export interface SharedSplitData {
  names: string[];
  amounts: number[];
  total: number;
  note: string; // Required: becomes Venmo transaction description
  phone: string; // Required: needed for Venmo payment links
  currency: string; // Currency code (e.g., 'USD', 'JPY', 'EUR')
  date?: string; // Optional: receipt date for display
  receipts?: SharedReceiptBreakdown[]; // Optional multi-receipt detail
}

/**
 * Per-receipt amounts follow the same person order as the `people` argument
 * passed to serializeSplitData. They are normalized to the sorted name order
 * in the URL payload.
 */
export interface SharedReceiptBreakdown {
  label: string;
  amounts: number[];
}

/**
 * Error types for split data validation
 */
export enum SplitDataError {
  EMPTY_PEOPLE_ARRAY = "EMPTY_PEOPLE_ARRAY",
  MISMATCHED_ARRAY_LENGTHS = "MISMATCHED_ARRAY_LENGTHS",
  EMPTY_NAME = "EMPTY_NAME",
  INVALID_AMOUNT = "INVALID_AMOUNT",
  NEGATIVE_AMOUNT = "NEGATIVE_AMOUNT",
  INVALID_TOTAL = "INVALID_TOTAL",
  NEGATIVE_TOTAL = "NEGATIVE_TOTAL",
  AMOUNTS_TOTAL_MISMATCH = "AMOUNTS_TOTAL_MISMATCH",
  INVALID_PHONE_NUMBER = "INVALID_PHONE_NUMBER",
  INVALID_DATE_FORMAT = "INVALID_DATE_FORMAT",
  NAME_TOO_LONG = "NAME_TOO_LONG",
  NOTE_TOO_LONG = "NOTE_TOO_LONG",
  TOO_MANY_PEOPLE = "TOO_MANY_PEOPLE",
  AMOUNT_TOO_LARGE = "AMOUNT_TOO_LARGE",
  INVALID_SPLIT_DETAILS = "INVALID_SPLIT_DETAILS",
  INVALID_RECEIPT_BREAKDOWN = "INVALID_RECEIPT_BREAKDOWN",
  RECEIPT_LABEL_TOO_LONG = "RECEIPT_LABEL_TOO_LONG",
  TOO_MANY_RECEIPTS = "TOO_MANY_RECEIPTS",
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
  MAX_RECEIPTS_COUNT: 50,
  MAX_RECEIPT_LABEL_LENGTH: 100,
  MAX_AMOUNT: 99999.99,
  // Base tolerance for rounding differences when summing individual amounts
  // We will scale this dynamically by number of people to account for
  // compounding rounding errors (up to 1 cent per person)
  SPLIT_AMOUNT_DEVIATION_PER_PERSON: 0.01,
} as const;

/** Keep optional itemization bounded while leaving the required split usable. */
export const MAX_SHARE_URL_LENGTH = 8000;
const MAX_RECEIPT_PAYLOAD_LENGTH = 6000;

/**
 * Serializes split data into URL-safe parameters
 *
 * @param people - Array of people with their calculated amounts
 * @param note - Required note/memo for the split (becomes Venmo transaction description)
 * @param phone - Required phone number for Venmo payments
 * @param currency - Currency code for the split (defaults to USD)
 * @param date - Optional receipt date
 * @param receiptBreakdown - Optional per-receipt amounts for multi-receipt shares
 * @returns URLSearchParams object ready to be appended to a URL
 */
export function serializeSplitData(
  people: Person[],
  note: string,
  phone: string,
  currency: string = DEFAULT_CURRENCY,
  date?: string | null,
  receiptBreakdown?: SharedReceiptBreakdown[]
): URLSearchParams {
  // Validate input before proceeding
  const validation = validateSerializationInput(people, note, phone, date);
  if (!validation.isValid) {
    throw new Error(
      `Invalid split data: ${validation.errorMessages.join(", ")}`
    );
  }

  // Sort people by name for consistent ordering
  const sortedPeopleWithIndexes = people
    .map((person, index) => ({ person, index }))
    .sort((a, b) => a.person.name.localeCompare(b.person.name));
  const sortedPeople = sortedPeopleWithIndexes.map(({ person }) => person);

  const names = sortedPeople.map((person) => person.name);
  const amountsMinorUnits = sortedPeople.map((person) => toMinorUnits(person.finalTotal, currency));
  const totalMinorUnits = amountsMinorUnits.reduce((sum, amount) => sum + amount, 0);

  const params = new URLSearchParams();

  // Required parameters
  params.set("names", names.join(","));
  // Emit minor units (cents for USD, whole units for JPY, etc.)
  params.set("amounts", amountsMinorUnits.join(","));
  params.set("total", String(totalMinorUnits));
  params.set("note", note.trim());
  params.set("phone", phone.trim());
  params.set("currency", currency);

  // Optional parameters
  if (date) {
    params.set("date", date);
  }

  const serializedReceipts = serializeReceiptBreakdown(
    receiptBreakdown,
    sortedPeopleWithIndexes.map(({ index }) => index),
    sortedPeople.map((person) => person.finalTotal),
    currency
  );
  if (serializedReceipts) {
    params.set("receipts", serializedReceipts);
  }

  return params;
}

function serializeReceiptBreakdown(
  receiptBreakdown: SharedReceiptBreakdown[] | undefined,
  sortedPersonIndexes: number[],
  personTotals: number[],
  currency: string
): string | null {
  if (!receiptBreakdown || receiptBreakdown.length <= 1) {
    return null;
  }
  if (
    !isValidReceiptBreakdown(
      receiptBreakdown,
      sortedPersonIndexes.length,
      currency
    )
  ) {
    return null;
  }

  const normalizedBreakdown = receiptBreakdown.map((receipt) => ({
    label: receipt.label.trim(),
    amounts: sortedPersonIndexes.map((index) => receipt.amounts[index]),
  }));
  if (!receiptBreakdownMatchesTotals(normalizedBreakdown, personTotals, currency)) {
    return null;
  }

  const payload = normalizedBreakdown.map((receipt) => ({
    label: receipt.label,
    amounts: receipt.amounts.map((amount) => toMinorUnits(amount, currency)),
  }));
  const serialized = JSON.stringify(payload);
  return serialized.length <= MAX_RECEIPT_PAYLOAD_LENGTH ? serialized : null;
}

function isValidReceiptBreakdown(
  receiptBreakdown: SharedReceiptBreakdown[],
  personCount: number,
  currency: string
): boolean {
  if (
    receiptBreakdown.length === 0 ||
    receiptBreakdown.length > VALIDATION_LIMITS.MAX_RECEIPTS_COUNT
  ) {
    return false;
  }

  return receiptBreakdown.every(
    (receipt) =>
      typeof receipt.label === "string" &&
      receipt.label.trim().length > 0 &&
      receipt.label.trim().length <= VALIDATION_LIMITS.MAX_RECEIPT_LABEL_LENGTH &&
      Array.isArray(receipt.amounts) &&
      receipt.amounts.length === personCount &&
      receipt.amounts.every((amount) =>
        isValidReceiptAmount(amount, currency)
      )
  );
}

function isValidReceiptAmount(amount: number, currency: string): boolean {
  if (!Number.isFinite(amount) || amount < 0) {
    return false;
  }
  const normalized = fromMinorUnits(toMinorUnits(amount, currency), currency);
  return normalized <= VALIDATION_LIMITS.MAX_AMOUNT;
}

function receiptBreakdownMatchesTotals(
  receiptBreakdown: SharedReceiptBreakdown[],
  personTotals: number[],
  currency: string
): boolean {
  return personTotals.every((total, personIndex) => {
    const itemizedTotal = receiptBreakdown.reduce(
      (sum, receipt) =>
        sum + toMinorUnits(receipt.amounts[personIndex], currency),
      0
    );
    const totalMinorUnits = toMinorUnits(total, currency);
    return (
      Math.abs(itemizedTotal - totalMinorUnits) <= receiptBreakdown.length
    );
  });
}

/**
 * Deserializes URL parameters back into split data
 *
 * @param searchParams - URLSearchParams from the shared URL
 * @returns SharedSplitData object or null if invalid
 */
export function deserializeSplitData(
  searchParams: URLSearchParams
): SharedSplitData | null {
  try {
    const namesParam = searchParams.get("names");
    const amountsParam = searchParams.get("amounts");
    const totalParam = searchParams.get("total");
    const noteParam = searchParams.get("note");
    const phoneParam = searchParams.get("phone");
    const currencyParam = searchParams.get("currency");
    const receiptsParam = searchParams.get("receipts");

    // Required parameters check (currency defaults to USD for backwards compatibility)
    if (
      !namesParam ||
      !amountsParam ||
      !totalParam ||
      !noteParam ||
      !phoneParam
    ) {
      return null;
    }

    const currency = currencyParam || DEFAULT_CURRENCY;
    const names = namesParam
      .split(",")
      .map((name) => name.trim())
      .filter((name) => name.length > 0);
    const amountStrings = amountsParam
      .split(",")
      .map((amount) => amount.trim());
    // Back-compat: support both minor units (integers) and major unit strings
    const parsedTotalRaw = Number(totalParam);
    const isTotalInMinorUnits =
      Number.isInteger(parsedTotalRaw) && !totalParam.includes(".");
    const total = isTotalInMinorUnits
      ? fromMinorUnits(parsedTotalRaw, currency)
      : parseFloat(totalParam);
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
      const raw = Number(amountStr);
      const isMinorUnits = Number.isInteger(raw) && !amountStr.includes(".");
      const amount = isMinorUnits ? fromMinorUnits(raw, currency) : parseFloat(amountStr);
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
    const date = searchParams.get("date") || undefined;
    const receipts = parseReceiptBreakdown(receiptsParam, names.length, currency);
    if (
      receipts === null ||
      (receipts && !receiptBreakdownMatchesTotals(receipts, amounts, currency))
    ) {
      return null;
    }

    return {
      names,
      amounts,
      total,
      note,
      phone,
      currency,
      date,
      ...(receipts ? { receipts } : {}),
    };
  } catch {
    // Return null for any parsing errors
    return null;
  }
}

function parseReceiptBreakdown(
  serialized: string | null,
  personCount: number,
  currency: string
): SharedReceiptBreakdown[] | null | undefined {
  if (serialized === null) {
    return undefined;
  }
  if (serialized.length > MAX_RECEIPT_PAYLOAD_LENGTH) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(serialized);
    if (
      !Array.isArray(parsed) ||
      !isValidReceiptBreakdownShape(parsed, personCount, currency)
    ) {
      return null;
    }

    const receipts = parsed.map((receipt) => {
      const item = receipt as { label: string; amounts: number[] };
      return {
        label: item.label.trim(),
        amounts: item.amounts.map((amount) =>
          Number.isInteger(amount) ? fromMinorUnits(amount, currency) : amount
        ),
      };
    });
    return receipts;
  } catch {
    return null;
  }
}

function isValidReceiptBreakdownShape(
  value: unknown[],
  personCount: number,
  currency: string
): value is SharedReceiptBreakdown[] {
  if (
    value.length === 0 ||
    value.length > VALIDATION_LIMITS.MAX_RECEIPTS_COUNT
  ) {
    return false;
  }

  return value.every((receipt) => {
    if (!receipt || typeof receipt !== "object") return false;
    const item = receipt as { label?: unknown; amounts?: unknown };
    return (
      typeof item.label === "string" &&
      item.label.trim().length > 0 &&
      item.label.trim().length <= VALIDATION_LIMITS.MAX_RECEIPT_LABEL_LENGTH &&
      Array.isArray(item.amounts) &&
      item.amounts.length === personCount &&
      item.amounts.every(
        (amount) =>
          typeof amount === "number" &&
          Number.isFinite(amount) &&
          isValidReceiptAmount(
            Number.isInteger(amount)
              ? fromMinorUnits(amount, currency)
              : amount,
            currency
          )
      )
    );
  });
}

/**
 * Generates a complete shareable URL for a split
 *
 * @param baseUrl - The base URL of the application (e.g., 'https://yourapp.com')
 * @param people - Array of people with their calculated amounts
 * @param note - Required note/memo for the split (becomes Venmo transaction description)
 * @param phone - Required phone number for Venmo payments
 * @param currency - Currency code for the split (defaults to USD)
 * @param date - Optional receipt date
 * @param receiptBreakdown - Optional per-receipt amounts for multi-receipt shares
 * @returns Complete shareable URL
 */
export function generateShareableUrl(
  baseUrl: string,
  people: Person[],
  note: string,
  phone: string,
  currency: string = DEFAULT_CURRENCY,
  date?: string | null,
  receiptBreakdown?: SharedReceiptBreakdown[]
): string {
  const params = serializeSplitData(
    people,
    note,
    phone,
    currency,
    date,
    receiptBreakdown
  );
  // Ensure baseUrl doesn't end with slash to avoid double slashes
  const cleanBaseUrl = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  if (params.has("receipts")) {
    const withBreakdown = `${cleanBaseUrl}/split?${params.toString()}`;
    if (withBreakdown.length > MAX_SHARE_URL_LENGTH) {
      params.delete("receipts");
    }
  }
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
  const digitsOnly = phone.replace(/\D/g, "");

  // US phone numbers should be exactly 10 digits (without country code) or 11 digits starting with 1
  if (digitsOnly.length === 10) {
    // Basic US phone number format check: first digit should be 2-9
    const firstDigit = digitsOnly[0];
    return firstDigit >= "2" && firstDigit <= "9";
  } else if (digitsOnly.length === 11) {
    // Should start with 1 (US country code) and the next digit should be 2-9
    const secondDigit = digitsOnly[1];
    return (
      digitsOnly.startsWith("1") && secondDigit >= "2" && secondDigit <= "9"
    );
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
export function validateSplitDataDetailed(
  splitData: SharedSplitData
): SplitValidationResult {
  const errors: SplitDataError[] = [];
  const errorMessages: string[] = [];

  try {
    // Check for empty arrays
    if (splitData.names.length === 0) {
      errors.push(SplitDataError.EMPTY_PEOPLE_ARRAY);
      errorMessages.push("At least one person must be included in the split");
      return { isValid: false, errors, errorMessages };
    }

    // Check arrays have same length
    if (splitData.names.length !== splitData.amounts.length) {
      errors.push(SplitDataError.MISMATCHED_ARRAY_LENGTHS);
      errorMessages.push("The number of names and amounts must match");
    }

    // Check for too many people
    if (splitData.names.length > VALIDATION_LIMITS.MAX_PEOPLE_COUNT) {
      errors.push(SplitDataError.TOO_MANY_PEOPLE);
      errorMessages.push(
        `Maximum ${VALIDATION_LIMITS.MAX_PEOPLE_COUNT} people allowed in a split`
      );
    }

    if (splitData.receipts) {
      if (
        splitData.receipts.length === 0 ||
        splitData.receipts.length > VALIDATION_LIMITS.MAX_RECEIPTS_COUNT
      ) {
        errors.push(SplitDataError.TOO_MANY_RECEIPTS);
        errorMessages.push(
          `Between 1 and ${VALIDATION_LIMITS.MAX_RECEIPTS_COUNT} receipts are allowed in itemization`
        );
      }

      splitData.receipts.forEach((receipt, index) => {
        if (!receipt.label || receipt.label.trim().length === 0) {
          errors.push(SplitDataError.INVALID_RECEIPT_BREAKDOWN);
          errorMessages.push(`Receipt ${index + 1} has an empty label`);
        } else if (
          receipt.label.trim().length > VALIDATION_LIMITS.MAX_RECEIPT_LABEL_LENGTH
        ) {
          errors.push(SplitDataError.RECEIPT_LABEL_TOO_LONG);
          errorMessages.push(
            `Receipt label "${receipt.label.trim()}" exceeds ${VALIDATION_LIMITS.MAX_RECEIPT_LABEL_LENGTH} characters`
          );
        }

        if (
          !Array.isArray(receipt.amounts) ||
          receipt.amounts.length !== splitData.names.length ||
          receipt.amounts.some(
            (amount) =>
              !isValidReceiptAmount(amount, splitData.currency)
          )
        ) {
          errors.push(SplitDataError.INVALID_RECEIPT_BREAKDOWN);
          errorMessages.push(
            `Receipt ${index + 1} must include one valid amount for each person`
          );
        }
      });

      if (
        isValidReceiptBreakdown(
          splitData.receipts,
          splitData.names.length,
          splitData.currency
        ) &&
        !receiptBreakdownMatchesTotals(
          splitData.receipts,
          splitData.amounts,
          splitData.currency
        )
      ) {
        errors.push(SplitDataError.INVALID_RECEIPT_BREAKDOWN);
        errorMessages.push(
          "Per-receipt amounts must add up to each person's aggregate amount"
        );
      }
    }

    // Validate names
    splitData.names.forEach((name, index) => {
      const trimmedName = name.trim();
      if (trimmedName.length === 0) {
        errors.push(SplitDataError.EMPTY_NAME);
        errorMessages.push(`Person ${index + 1} has an empty name`);
      } else if (trimmedName.length > VALIDATION_LIMITS.MAX_NAME_LENGTH) {
        errors.push(SplitDataError.NAME_TOO_LONG);
        errorMessages.push(
          `Name "${trimmedName}" exceeds ${VALIDATION_LIMITS.MAX_NAME_LENGTH} characters`
        );
      }
    });

    // Validate amounts
    splitData.amounts.forEach((amount, index) => {
      if (isNaN(amount)) {
        errors.push(SplitDataError.INVALID_AMOUNT);
        errorMessages.push(
          `Amount for ${splitData.names[index]} is not a valid number`
        );
      } else if (amount < 0) {
        errors.push(SplitDataError.NEGATIVE_AMOUNT);
        errorMessages.push(
          `Amount for ${splitData.names[index]} cannot be negative`
        );
      } else if (amount > VALIDATION_LIMITS.MAX_AMOUNT) {
        errors.push(SplitDataError.AMOUNT_TOO_LARGE);
        errorMessages.push(
          `Amount for ${splitData.names[index]} exceeds maximum allowed (${VALIDATION_LIMITS.MAX_AMOUNT})`
        );
      }
    });

    // Validate total
    if (isNaN(splitData.total)) {
      errors.push(SplitDataError.INVALID_TOTAL);
      errorMessages.push(
        `Total amount '${splitData.total}' is not a valid number`
      );
    } else if (splitData.total < 0) {
      errors.push(SplitDataError.NEGATIVE_TOTAL);
      errorMessages.push(
        `Total amount '${splitData.total}' cannot be negative`
      );
    } else {
      // Only check amount sum if total is valid
      const calculatedTotal = splitData.amounts.reduce(
        (sum, amount) => sum + amount,
        0
      );
      const difference = Math.abs(calculatedTotal - splitData.total);

      // Allow up to 1 cent rounding difference per person to account for
      // compounding rounding across many participants
      const dynamicTolerance =
        VALIDATION_LIMITS.SPLIT_AMOUNT_DEVIATION_PER_PERSON *
        splitData.names.length;

      // Round to 2 decimal places to avoid floating point precision issues
      const roundedDifference = Math.round(difference * 100) / 100;
      const roundedTolerance = Math.round(dynamicTolerance * 100) / 100;

      if (roundedDifference > roundedTolerance) {
        errors.push(SplitDataError.AMOUNTS_TOTAL_MISMATCH);
        errorMessages.push(
          `Individual amounts (${calculatedTotal.toFixed(
            2
          )}) do not add up to total (${splitData.total.toFixed(2)}). ` +
            `Allowed rounding tolerance: ±${dynamicTolerance.toFixed(2)}`
        );
      }
    }

    // Validate required note field
    if (!splitData.note || splitData.note.trim().length === 0) {
      errors.push(SplitDataError.EMPTY_NAME); // Reuse existing error type
      errorMessages.push(
        `Note/memo is required for split sharing. Received: '${
          splitData.note || "undefined"
        }'`
      );
    } else if (splitData.note.length > VALIDATION_LIMITS.MAX_NOTE_LENGTH) {
      errors.push(SplitDataError.NOTE_TOO_LONG);
      errorMessages.push(
        `Note '${splitData.note}' exceeds ${VALIDATION_LIMITS.MAX_NOTE_LENGTH} characters (length: ${splitData.note.length})`
      );
    }

    // Validate required phone field
    if (!splitData.phone || splitData.phone.trim().length === 0) {
      errors.push(SplitDataError.INVALID_PHONE_NUMBER);
      errorMessages.push(
        `Phone number is required for split sharing. Received: '${
          splitData.phone || "undefined"
        }'`
      );
    } else if (!isValidPhoneNumber(splitData.phone)) {
      errors.push(SplitDataError.INVALID_PHONE_NUMBER);
      errorMessages.push(
        `Phone number '${splitData.phone}' format is invalid for Venmo (must be 10 or 11 digits)`
      );
    }

    // Validate optional date field
    if (splitData.date && !isValidDateFormat(splitData.date)) {
      errors.push(SplitDataError.INVALID_DATE_FORMAT);
      errorMessages.push(`Date format '${splitData.date}' is invalid`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      errorMessages,
    };
  } catch {
    return {
      isValid: false,
      errors: [SplitDataError.INVALID_SPLIT_DETAILS],
      errorMessages: [
        `An unexpected error occurred during validation. Split data: ${JSON.stringify(
          splitData
        )}`,
      ],
    };
  }
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
    errorMessages.push("At least one person must be included in the split");
    return { isValid: false, errors, errorMessages };
  }

  if (people.length > VALIDATION_LIMITS.MAX_PEOPLE_COUNT) {
    errors.push(SplitDataError.TOO_MANY_PEOPLE);
    errorMessages.push(
      `Maximum ${VALIDATION_LIMITS.MAX_PEOPLE_COUNT} people allowed in a split`
    );
  }

  // Validate each person
  people.forEach((person, index) => {
    if (!person.name || person.name.trim().length === 0) {
      errors.push(SplitDataError.EMPTY_NAME);
      errorMessages.push(`Person ${index + 1} has an empty name`);
    } else if (person.name.trim().length > VALIDATION_LIMITS.MAX_NAME_LENGTH) {
      errors.push(SplitDataError.NAME_TOO_LONG);
      errorMessages.push(
        `Name "${person.name.trim()}" exceeds ${
          VALIDATION_LIMITS.MAX_NAME_LENGTH
        } characters`
      );
    }

    if (isNaN(person.finalTotal)) {
      errors.push(SplitDataError.INVALID_AMOUNT);
      errorMessages.push(`Amount for ${person.name} is not a valid number`);
    } else if (person.finalTotal < 0) {
      errors.push(SplitDataError.NEGATIVE_AMOUNT);
      errorMessages.push(`Amount for ${person.name} cannot be negative`);
    } else if (person.finalTotal > VALIDATION_LIMITS.MAX_AMOUNT) {
      errors.push(SplitDataError.AMOUNT_TOO_LARGE);
      errorMessages.push(
        `Amount for ${person.name} exceeds maximum allowed (${VALIDATION_LIMITS.MAX_AMOUNT})`
      );
    }
  });

  // Validate required note field
  if (!note || note.trim().length === 0) {
    errors.push(SplitDataError.EMPTY_NAME); // Reuse existing error type
    errorMessages.push(
      `Note/memo is required for split sharing. Received: '${
        note || "undefined"
      }'`
    );
  } else if (note.length > VALIDATION_LIMITS.MAX_NOTE_LENGTH) {
    errors.push(SplitDataError.NOTE_TOO_LONG);
    errorMessages.push(
      `Note '${note}' exceeds ${VALIDATION_LIMITS.MAX_NOTE_LENGTH} characters (length: ${note.length})`
    );
  }

  // Validate required phone field
  if (!phone || phone.trim().length === 0) {
    errors.push(SplitDataError.INVALID_PHONE_NUMBER);
    errorMessages.push(
      `Phone number is required for split sharing. Received: '${
        phone || "undefined"
      }'`
    );
  } else if (!isValidPhoneNumber(phone)) {
    errors.push(SplitDataError.INVALID_PHONE_NUMBER);
    errorMessages.push(
      `Phone number '${phone}' format is invalid for Venmo (must be 10 or 11 digits)`
    );
  }

  // Validate optional date field
  if (date && !isValidDateFormat(date)) {
    errors.push(SplitDataError.INVALID_DATE_FORMAT);
    errorMessages.push(`Date format '${date}' is invalid`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    errorMessages,
  };
}
