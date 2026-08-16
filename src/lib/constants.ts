/**
 * Maximum file size for receipt uploads.
 *
 * Vercel serverless functions have a 4.5MB body size limit for the request payload.
 * This limit applies to the entire HTTP request body, including form data and file uploads.
 *
 * @see https://vercel.com/kb/guide/how-to-bypass-vercel-body-size-limit-serverless-functions
 */
export const MAX_FILE_SIZE_MB = 4.5;
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

/** Maximum number of receipts that can be added to a single split session. */
export const MAX_RECEIPTS_PER_SESSION = 10;
