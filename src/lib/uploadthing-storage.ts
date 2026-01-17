import { UTApi, UTFile } from 'uploadthing/server';

/**
 * UploadThing API instance for server-side file operations.
 * Configured automatically via UPLOADTHING_TOKEN environment variable (v7).
 */
const utapi = new UTApi();

/**
 * Result of a file upload attempt
 */
export interface UploadResult {
  success: boolean;
  url: string | null;
  key: string | null;
  error?: string;
}

/**
 * Upload a receipt file to UploadThing storage.
 *
 * This function uploads the file and returns a public URL that can be used
 * in Slack notifications to display the receipt image.
 *
 * The file is named with a timestamp prefix and stored with a custom ID
 * based on the session ID for easier management and future cleanup.
 *
 * @param fileBuffer - The file content as a Buffer
 * @param fileName - Original file name
 * @param mimeType - MIME type of the file (e.g., 'image/jpeg', 'application/pdf')
 * @param sessionId - UUID session identifier for organizing files
 * @returns Upload result with URL on success, or error details on failure
 */
export async function uploadReceiptFile(
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string,
  sessionId: string
): Promise<UploadResult> {
  try {
    // Check if UploadThing is configured
    if (!process.env.UPLOADTHING_TOKEN) {
      console.warn('[UploadThing] UPLOADTHING_TOKEN not configured, skipping upload');
      return {
        success: false,
        url: null,
        key: null,
        error: 'UploadThing not configured',
      };
    }

    // Create a unique filename with timestamp for ordering and custom ID for management
    const timestamp = Date.now();
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const storedFileName = `${timestamp}-${sanitizedFileName}`;

    // Custom ID includes session and timestamp for future cleanup queries
    // Format: receipts/{sessionId}/{timestamp}
    const customId = `receipts/${sessionId}/${timestamp}`;

    console.log('[UploadThing] Uploading file...', {
      fileName: storedFileName,
      mimeType,
      sessionId,
      size: fileBuffer.length,
    });

    // Create UTFile with the buffer converted to Uint8Array and custom ID
    const file = new UTFile([new Uint8Array(fileBuffer)], storedFileName, {
      customId,
      type: mimeType,
    });

    // Upload the file
    const response = await utapi.uploadFiles([file]);

    // Check the result
    const result = response[0];

    if (result.error) {
      console.error('[UploadThing] Upload failed:', result.error);
      return {
        success: false,
        url: null,
        key: null,
        error: result.error.message || 'Upload failed',
      };
    }

    if (result.data) {
      console.log('[UploadThing] Upload successful', {
        key: result.data.key,
        url: result.data.ufsUrl,
        size: result.data.size,
      });

      return {
        success: true,
        url: result.data.ufsUrl,
        key: result.data.key,
      };
    }

    // Unexpected response format
    console.error('[UploadThing] Unexpected response format:', result);
    return {
      success: false,
      url: null,
      key: null,
      error: 'Unexpected response format',
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[UploadThing] Error uploading file:', errorMessage);

    return {
      success: false,
      url: null,
      key: null,
      error: errorMessage,
    };
  }
}

/**
 * Delete files from UploadThing storage by their keys.
 *
 * This can be used for manual cleanup or by a cron job to delete
 * old files (e.g., files older than 90 days).
 *
 * @param keys - Array of file keys to delete
 * @returns True if deletion was successful
 */
export async function deleteReceiptFiles(keys: string[]): Promise<boolean> {
  try {
    if (!process.env.UPLOADTHING_TOKEN) {
      console.warn('[UploadThing] UPLOADTHING_TOKEN not configured, skipping deletion');
      return false;
    }

    if (keys.length === 0) {
      console.log('[UploadThing] No files to delete');
      return true;
    }

    console.log(`[UploadThing] Deleting ${keys.length} files...`);

    await utapi.deleteFiles(keys);

    console.log('[UploadThing] Files deleted successfully');
    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[UploadThing] Error deleting files:', errorMessage);
    return false;
  }
}

/**
 * List files from UploadThing storage.
 *
 * This can be used by a cron job to find and delete old files.
 * Note: Files are organized with customId format: receipts/{sessionId}/{timestamp}
 *
 * @param limit - Maximum number of files to return (default: 500)
 * @returns Array of file info objects
 */
export async function listReceiptFiles(limit: number = 500): Promise<Array<{
  key: string;
  customId: string | null;
  name: string;
  uploadedAt: Date;
}>> {
  try {
    if (!process.env.UPLOADTHING_TOKEN) {
      console.warn('[UploadThing] UPLOADTHING_TOKEN not configured');
      return [];
    }

    const response = await utapi.listFiles({ limit });

    return response.files.map((file) => ({
      key: file.key,
      customId: file.customId,
      name: file.name,
      uploadedAt: new Date(file.uploadedAt),
    }));
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[UploadThing] Error listing files:', errorMessage);
    return [];
  }
}
