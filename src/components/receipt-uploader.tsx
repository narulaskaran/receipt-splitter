import { useCallback, useEffect, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Camera, Loader2, Plus, UploadCloud } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { type Receipt } from "@/types";
import {
  MAX_FILE_SIZE_MB,
  MAX_FILE_SIZE_BYTES,
  MAX_RECEIPTS_PER_SESSION,
} from "@/lib/constants";
import imageCompression from "browser-image-compression";
import { getSessionId } from "@/lib/session";
import { RECEIPT_IMAGE_STORAGE_KEY, safeRemoveItem } from "@/lib/storage";
import { clearThumbnails } from "@/lib/receipt-thumbnails";
import {
  createReceiptThumbnail,
  persistReceiptThumbnail,
} from "@/lib/receipt-thumbnail-image";

interface ReceiptUploaderProps {
  /**
   * Called after a file is parsed. Return `false` to reject the receipt
   * (currency mismatch, session cap). Return the new receipt's id on accept
   * so the uploader can key the persisted thumbnail to that receipt.
   * Thumbnail persistence only happens on accept.
   */
  onReceiptParsed: (receipt: Receipt) => string | false | void;
  isLoading: boolean;
  setIsLoading: (isLoading: boolean) => void;
  resetImageTrigger?: number;
  /** How many more receipts the session can accept. Defaults to the session cap. */
  maxRemaining?: number;
  /** When true, show the compact "add another" dropzone instead of the empty-state prompt. */
  hasReceipts?: boolean;
}

const MAX_COMPRESSION_FILE_SIZE_MB = 50;
const COMPRESSION_TARGET_SIZE_MB = 4;

async function prepareReceiptFile(
  file: File,
  setIsCompressing: (value: boolean) => void
): Promise<File | null> {
  if (!file.type.startsWith("image/") && file.type !== "application/pdf") {
    toast.error("Please upload an image or PDF file");
    return null;
  }

  const fileSizeMB = file.size / (1024 * 1024);

  // Attempt client-side compression for images that exceed the upload limit
  if (file.type.startsWith("image/") && file.size > MAX_FILE_SIZE_BYTES) {
    if (fileSizeMB > MAX_COMPRESSION_FILE_SIZE_MB) {
      toast.error(
        `File is too large to compress (${fileSizeMB.toFixed(1)}MB). Maximum is ${MAX_COMPRESSION_FILE_SIZE_MB}MB.`
      );
      return null;
    }

    try {
      setIsCompressing(true);
      const compressed = await imageCompression(file, {
        maxSizeMB: COMPRESSION_TARGET_SIZE_MB,
        maxWidthOrHeight: 2048,
        useWebWorker: true,
      });
      const originalSize = fileSizeMB.toFixed(1);
      const newSize = (compressed.size / (1024 * 1024)).toFixed(1);
      if (compressed.size > MAX_FILE_SIZE_BYTES) {
        toast.error(
          `Compressed from ${originalSize}MB to ${newSize}MB, but it's still over the ${MAX_FILE_SIZE_MB}MB limit. Please use a smaller or lower-resolution image.`
        );
        return null;
      }
      toast.success(`Compressed from ${originalSize}MB to ${newSize}MB`);
      return compressed;
    } catch (error) {
      console.error("Image compression error:", error);
      toast.error(
        `File is too large (${fileSizeMB.toFixed(1)}MB). Maximum size is ${MAX_FILE_SIZE_MB}MB. Compression failed — please use a smaller file.`
      );
      return null;
    } finally {
      setIsCompressing(false);
    }
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    toast.error(
      `File is too large. Maximum size is ${MAX_FILE_SIZE_MB}MB. Your file is ${(file.size / (1024 * 1024)).toFixed(1)}MB.`
    );
    return null;
  }

  return file;
}

async function parseReceiptFile(file: File): Promise<Receipt> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("sessionId", getSessionId());

  const response = await fetch("/api/parse-receipt", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    if (response.status === 413) {
      throw new Error(
        `File is too large. Maximum size is ${MAX_FILE_SIZE_MB}MB. Please compress your image or use a smaller file.`
      );
    }
    const errorData = await response.json();
    throw new Error(errorData.error || "Failed to parse receipt");
  }

  return response.json();
}

/**
 * Persist the per-receipt thumbnail after an accepted parse.
 * `receiptId` is the id returned by onReceiptParsed; thumbnails are keyed by
 * it so each accepted receipt keeps its own preview across refresh.
 */
async function persistAcceptedThumbnail(
  file: File,
  receiptId: string | undefined
): Promise<void> {
  if (file.type.startsWith("image/") && receiptId) {
    const thumbnail = await createReceiptThumbnail(file);
    if (thumbnail) persistReceiptThumbnail(receiptId, thumbnail);
  }
  safeRemoveItem(RECEIPT_IMAGE_STORAGE_KEY);
}

export function ReceiptUploader({
  onReceiptParsed,
  isLoading,
  setIsLoading,
  resetImageTrigger,
  maxRemaining = MAX_RECEIPTS_PER_SESSION,
  hasReceipts = false,
}: ReceiptUploaderProps) {
  const [isCompressing, setIsCompressing] = useState(false);
  const [parseProgress, setParseProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);

  // Reset persisted thumbnails when resetImageTrigger changes (not on initial mount).
  // NOTE: this component must NOT touch the legacy singular image key here.
  // Child passive effects run before parent effects, and Home's restore effect
  // (src/app/page.tsx) performs migrateLegacyImage() with the real newest
  // receipt id once the session is available. Deleting or moving that key
  // here would race ahead of it and silently lose a legacy user's image.
  const prevResetImageTrigger = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (
      prevResetImageTrigger.current !== undefined &&
      prevResetImageTrigger.current !== resetImageTrigger
    ) {
      clearThumbnails();
      safeRemoveItem(RECEIPT_IMAGE_STORAGE_KEY);
    }
    prevResetImageTrigger.current = resetImageTrigger;
  }, [resetImageTrigger]);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) return;

      if (maxRemaining <= 0) {
        toast.error(
          `This split already has ${MAX_RECEIPTS_PER_SESSION} receipts. Remove one to add another.`
        );
        return;
      }

      if (acceptedFiles.length > maxRemaining) {
        toast.error(
          `Only ${maxRemaining} more receipt${maxRemaining === 1 ? "" : "s"} can be added (maximum ${MAX_RECEIPTS_PER_SESSION} per split). Extra files were skipped.`
        );
      }

      const filesToProcess = acceptedFiles.slice(0, maxRemaining);

      setIsLoading(true);
      try {
        for (let i = 0; i < filesToProcess.length; i++) {
          const file = filesToProcess[i];
          setParseProgress({
            current: i + 1,
            total: filesToProcess.length,
          });
          try {
            const prepared = await prepareReceiptFile(file, setIsCompressing);
            if (!prepared) continue;

            const receipt = await parseReceiptFile(prepared);
            const acceptedId = onReceiptParsed(receipt);
            const accepted = acceptedId !== false && acceptedId !== undefined;
            if (!accepted) continue;
            try {
              await persistAcceptedThumbnail(
                prepared,
                typeof acceptedId === "string" ? acceptedId : undefined
              );
            } catch {
              // Thumbnail caching is best-effort and must not block a successful parse
            }
          } catch (error) {
            console.error("Receipt parsing error:", error);
            const errorMessage =
              error instanceof Error
                ? error.message
                : "Failed to parse receipt. Please try again.";
            const prefix =
              filesToProcess.length > 1 ? `${file.name}: ` : "";
            toast.error(`${prefix}${errorMessage}`);
          }
        }
      } finally {
        setParseProgress(null);
        setIsLoading(false);
      }
    },
    [onReceiptParsed, setIsLoading, maxRemaining]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/*": [".jpeg", ".jpg", ".png", ".heif", ".heic", ".webp"],
      "application/pdf": [".pdf"],
    },
    multiple: true,
    disabled: isLoading || isCompressing,
  });

  const isBusy = isLoading || isCompressing;
  const compact = hasReceipts;
  const parsingLabel =
    parseProgress && parseProgress.total > 1
      ? `Parsing receipt ${parseProgress.current} of ${parseProgress.total}...`
      : "Parsing receipt...";

  return (
    <div
      {...getRootProps()}
      className={cn(
        "w-full cursor-pointer rounded-xl border-2 border-dashed bg-card text-center transition-colors hover:border-primary/60 hover:bg-accent/40",
        compact ? "px-4 py-3" : "px-6 py-10 sm:py-14",
        isDragActive ? "border-primary bg-accent/60" : "border-input",
        isBusy && "cursor-not-allowed opacity-60"
      )}
    >
      <input {...getInputProps()} disabled={isBusy} />

      {isBusy ? (
        <div
          className={
            compact
              ? "flex items-center justify-center gap-2"
              : "flex flex-col items-center gap-3"
          }
        >
          <Loader2
            className={cn(
              "animate-spin text-primary",
              compact ? "size-5" : "size-10"
            )}
          />
          <div>
            <p className="font-medium">
              {isCompressing ? "Compressing image..." : parsingLabel}
            </p>
            {!compact && (
              <p className="text-sm text-muted-foreground">
                {isCompressing
                  ? `Reducing file size to under ${MAX_FILE_SIZE_MB}MB`
                  : "This usually takes a few seconds"}
              </p>
            )}
          </div>
        </div>
      ) : compact ? (
        <div className="flex items-center justify-center gap-2 text-sm font-medium">
          <Plus className="size-4 shrink-0 text-primary" />
          <p>Add another receipt</p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4">
          <span className="flex size-14 items-center justify-center rounded-full bg-accent text-primary">
            <Camera className="size-6" />
          </span>
          <div className="flex flex-col gap-1">
            <p className="text-lg font-semibold">Upload a receipt</p>
            <p className="text-sm text-muted-foreground">
              Drag and drop, or tap to take a photo or choose files
            </p>
          </div>
          <span className={buttonVariants()}>
            <UploadCloud />
            Choose files
          </span>
          <p className="text-xs text-muted-foreground">
            JPG, PNG, HEIC, or PDF · up to {MAX_RECEIPTS_PER_SESSION} receipts
          </p>
        </div>
      )}
    </div>
  );
}
