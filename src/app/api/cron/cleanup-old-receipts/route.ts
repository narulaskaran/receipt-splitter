import { NextRequest, NextResponse } from 'next/server';
import { listReceiptFiles, deleteReceiptFiles } from '@/lib/uploadthing-storage';
import { sendErrorNotification } from '@/lib/webhook-notifications';

export const maxDuration = 300;

const RETENTION_DAYS = 90;
const BATCH_SIZE = 100;
const LIST_PAGE_SIZE = 500;
const MAX_PAGES = 50;
const MAX_ELAPSED_MS = 240_000;

function isProductionEnvironment(): boolean {
  return (
    process.env.VERCEL_ENV === 'production' ||
    process.env.NODE_ENV === 'production'
  );
}

/**
 * Cron job to delete receipt files older than 90 days from UploadThing storage.
 * Scheduled to run daily via Vercel Cron.
 *
 * Authentication: Vercel automatically adds the Authorization header with CRON_SECRET
 * for cron jobs. CRON_SECRET is required in production.
 */
export async function GET(request: NextRequest) {
  const startedAt = Date.now();

  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (isProductionEnvironment() && !cronSecret) {
      const message = 'CRON_SECRET is not configured in production';
      console.error(`[Cleanup] ${message}`);
      sendErrorNotification('cleanup_config_error', message).catch(() => {});
      return NextResponse.json(
        { error: 'Server configuration error: CRON_SECRET is required' },
        { status: 500 }
      );
    }

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      console.warn('[Cleanup] Unauthorized request - invalid or missing CRON_SECRET');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!process.env.UPLOADTHING_TOKEN) {
      console.warn('[Cleanup] UPLOADTHING_TOKEN not configured');
      return NextResponse.json(
        { error: 'UploadThing not configured' },
        { status: 500 }
      );
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);

    console.log('[Cleanup] Starting cleanup job', {
      retentionDays: RETENTION_DAYS,
      cutoffDate: cutoffDate.toISOString(),
    });

    let offset = 0;
    let pages = 0;
    let partial = false;
    let checked = 0;
    const keysToDelete: string[] = [];

    while (pages < MAX_PAGES) {
      if (Date.now() - startedAt > MAX_ELAPSED_MS) {
        partial = true;
        console.warn('[Cleanup] Stopping list pagination: elapsed time guard');
        break;
      }

      const { files, hasMore } = await listReceiptFiles({
        limit: LIST_PAGE_SIZE,
        offset,
      });

      pages += 1;
      checked += files.length;

      for (const file of files) {
        if (file.uploadedAt < cutoffDate) {
          keysToDelete.push(file.key);
        }
      }

      if (!hasMore || files.length === 0) {
        break;
      }

      offset += files.length;

      if (pages >= MAX_PAGES && hasMore) {
        partial = true;
        console.warn('[Cleanup] Stopping list pagination: max pages guard');
        break;
      }
    }

    if (checked === 0 && keysToDelete.length === 0 && pages <= 1) {
      console.log('[Cleanup] No files found');
      return NextResponse.json({
        success: true,
        message: 'No files to process',
        deleted: 0,
        checked: 0,
        pages,
        partial,
      });
    }

    console.log(
      `[Cleanup] Scanned ${checked} files across ${pages} page(s); ${keysToDelete.length} older than ${RETENTION_DAYS} days`
    );

    if (keysToDelete.length === 0) {
      return NextResponse.json({
        success: true,
        message: `No files older than ${RETENTION_DAYS} days`,
        deleted: 0,
        checked,
        cutoffDate: cutoffDate.toISOString(),
        pages,
        partial,
      });
    }

    let totalDeleted = 0;

    for (let i = 0; i < keysToDelete.length; i += BATCH_SIZE) {
      const batch = keysToDelete.slice(i, i + BATCH_SIZE);
      const success = await deleteReceiptFiles(batch);

      if (success) {
        totalDeleted += batch.length;
        console.log(
          `[Cleanup] Deleted batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.length} files`
        );
      } else {
        console.error(
          `[Cleanup] Failed to delete batch ${Math.floor(i / BATCH_SIZE) + 1}`
        );
      }
    }

    console.log(
      `[Cleanup] Cleanup complete. Deleted ${totalDeleted} of ${keysToDelete.length} files.`
    );

    return NextResponse.json({
      success: true,
      message: `Deleted ${totalDeleted} files older than ${RETENTION_DAYS} days`,
      deleted: totalDeleted,
      checked,
      cutoffDate: cutoffDate.toISOString(),
      pages,
      partial,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Cleanup] Error during cleanup job:', errorMessage);

    sendErrorNotification('cleanup_job_failure', `Cleanup cron job failed: ${errorMessage}`).catch(() => {});

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
