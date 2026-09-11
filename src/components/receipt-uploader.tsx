import { useCallback, useEffect, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import { UploadCloud, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
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
    <Card className={`w-full ${compact ? "py-3" : ""}`}>
      <CardContent className={compact ? "px-4" : "p-6"}>
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg text-center cursor-pointer transition-colors ${
            compact ? "px-4 py-3" : "p-8"
          } ${
            isDragActive ? "border-primary bg-primary/5" : "border-input"
          } ${isBusy ? "opacity-60 cursor-not-allowed" : ""}`}
        >
          <input {...getInputProps()} disabled={isBusy} />

          {isCompressing ? (
            <div
              className={
                compact
                  ? "flex items-center justify-center gap-2"
                  : "flex flex-col items-center"
              }
            >
              <Loader2
                className={
                  compact
                    ? "h-5 w-5 animate-spin text-primary"
                    : "h-10 w-10 mb-4 animate-spin text-primary"
                }
              />
              <p className={compact ? "font-medium" : "mb-1 font-medium"}>
                Compressing image...
              </p>
              {!compact && (
                <p className="text-sm text-muted-foreground">
                  Reducing file size to under {MAX_FILE_SIZE_MB}MB
                </p>
              )}
            </div>
          ) : isLoading ? (
            <div
              className={
                compact
                  ? "flex items-center justify-center gap-2"
                  : "flex flex-col items-center"
              }
            >
              <Loader2
                className={
                  compact
                    ? "h-5 w-5 animate-spin text-primary"
                    : "h-12 w-12 mb-4 animate-spin text-primary"
                }
              />
              <p className={compact ? undefined : "mb-1 font-medium"}>
                {parsingLabel}
              </p>
            </div>
          ) : compact ? (
            <div className="flex items-center justify-center gap-2">
              <UploadCloud className="h-5 w-5 shrink-0 text-muted-foreground" />
              <p>Click or drag to add another receipt</p>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <UploadCloud className="h-12 w-12 mb-4 text-muted-foreground" />
              <p className="mb-1 font-medium">Upload your receipts</p>
              <p className="text-sm text-muted-foreground">
                Drag and drop or click to select one or more files
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
