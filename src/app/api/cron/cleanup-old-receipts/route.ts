import { NextRequest, NextResponse } from 'next/server';
import { listReceiptFiles, deleteReceiptFiles } from '@/lib/uploadthing-storage';

const RETENTION_DAYS = 90;
const BATCH_SIZE = 100;

/**
 * Cron job to delete receipt files older than 90 days from UploadThing storage.
 * Scheduled to run daily via Vercel Cron.
 *
 * Authentication: Vercel automatically adds the Authorization header with CRON_SECRET
 * for cron jobs. This endpoint verifies the secret to prevent unauthorized calls.
 */
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret to prevent unauthorized calls
    // Vercel sends this automatically for cron jobs
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      console.warn('[Cleanup] Unauthorized request - invalid or missing CRON_SECRET');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if UploadThing is configured
    if (!process.env.UPLOADTHING_TOKEN) {
      console.warn('[Cleanup] UPLOADTHING_TOKEN not configured');
      return NextResponse.json(
        { error: 'UploadThing not configured' },
        { status: 500 }
      );
    }

    // Calculate cutoff date (90 days ago)
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);

    console.log('[Cleanup] Starting cleanup job', {
      retentionDays: RETENTION_DAYS,
      cutoffDate: cutoffDate.toISOString(),
    });

    // List all files
    // Note: If you have more than 500 files, you may need to implement pagination
    const files = await listReceiptFiles(500);

    if (files.length === 0) {
      console.log('[Cleanup] No files found');
      return NextResponse.json({
        success: true,
        message: 'No files to process',
        deleted: 0,
        checked: 0,
      });
    }

    console.log(`[Cleanup] Found ${files.length} total files`);

    // Filter files older than retention period
    const filesToDelete = files.filter((file) => file.uploadedAt < cutoffDate);

    console.log(`[Cleanup] Found ${filesToDelete.length} files older than ${RETENTION_DAYS} days`);

    if (filesToDelete.length === 0) {
      return NextResponse.json({
        success: true,
        message: `No files older than ${RETENTION_DAYS} days`,
        deleted: 0,
        checked: files.length,
        cutoffDate: cutoffDate.toISOString(),
      });
    }

    // Delete files in batches to avoid overwhelming the API
    const keysToDelete = filesToDelete.map((file) => file.key);
    let totalDeleted = 0;

    for (let i = 0; i < keysToDelete.length; i += BATCH_SIZE) {
      const batch = keysToDelete.slice(i, i + BATCH_SIZE);
      const success = await deleteReceiptFiles(batch);

      if (success) {
        totalDeleted += batch.length;
        console.log(`[Cleanup] Deleted batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.length} files`);
      } else {
        console.error(`[Cleanup] Failed to delete batch ${Math.floor(i / BATCH_SIZE) + 1}`);
      }
    }

    console.log(`[Cleanup] Cleanup complete. Deleted ${totalDeleted} of ${filesToDelete.length} files.`);

    return NextResponse.json({
      success: true,
      message: `Deleted ${totalDeleted} files older than ${RETENTION_DAYS} days`,
      deleted: totalDeleted,
      checked: files.length,
      cutoffDate: cutoffDate.toISOString(),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Cleanup] Error during cleanup job:', errorMessage);

    return NextResponse.json(
      {
        success: false,
        error: 'Cleanup job failed',
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}
