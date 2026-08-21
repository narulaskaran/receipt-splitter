import { useState, useCallback, useEffect, useRef } from "react";
import { useDropzone } from "react-dropzone";
import { UploadCloud, Loader2, FileText } from "lucide-react";
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
import {
  clearThumbnails,
  getLatestThumbnailId,
  getThumbnails,
  migrateLegacyImage,
} from "@/lib/receipt-thumbnails";
import {
  createReceiptThumbnail,
  persistReceiptThumbnail,
} from "@/lib/receipt-thumbnail-image";

interface ReceiptUploaderProps {
  /**
   * Called after a file is parsed. Return `false` to reject the receipt
   * (currency mismatch, session cap). Return the new receipt's id on accept
   * so the uploader can key the persisted thumbnail to that receipt.
   * Preview/thumbnail updates only happen on accept.
   */
  onReceiptParsed: (receipt: Receipt) => string | false | void;
  isLoading: boolean;
  setIsLoading: (isLoading: boolean) => void;
  resetImageTrigger?: number;
  /** How many more receipts the session can accept. Defaults to the session cap. */
  maxRemaining?: number;
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

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Failed to read file"));
      }
    };
    reader.onerror = () => {
      reject(reader.error ?? new Error("Failed to read file"));
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Update the dropzone preview and persist the per-receipt thumbnail.
 * `receiptId` is the id returned by onReceiptParsed; thumbnails are keyed by
 * it so each accepted receipt keeps its own preview across refresh.
 */
async function updatePreview(
  file: File,
  receiptId: string | undefined,
  setPreviewUrl: (url: string) => void
): Promise<void> {
  if (file.type.startsWith("image/")) {
    if (receiptId) {
      // Compressed thumbnail, persisted under this receipt's id (best-effort).
      const thumbnail = await createReceiptThumbnail(file);
      if (thumbnail) persistReceiptThumbnail(receiptId, thumbnail);
    }
    // Dropzone keeps showing the full-size preview for the last accepted file.
    const dataUrl = await readFileAsDataUrl(file);
    safeRemoveItem(RECEIPT_IMAGE_STORAGE_KEY);
    setPreviewUrl(dataUrl);
    return;
  }

  setPreviewUrl("pdf-placeholder");
  safeRemoveItem(RECEIPT_IMAGE_STORAGE_KEY);
}

export function ReceiptUploader({
  onReceiptParsed,
  isLoading,
  setIsLoading,
  resetImageTrigger,
  maxRemaining = MAX_RECEIPTS_PER_SESSION,
}: ReceiptUploaderProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [parseProgress, setParseProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);

  // Restore the last accepted receipt's preview from the thumbnail cache on
  // mount, migrating away from the legacy singular image key if present.
  useEffect(() => {
    migrateLegacyImage(null);
    const latestId = getLatestThumbnailId();
    if (latestId) {
      const thumbnails = getThumbnails();
      setPreviewUrl(thumbnails[latestId]);
    }
  }, []);

  // Reset preview when resetImageTrigger changes (not on initial mount)
  const prevResetImageTrigger = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (
      prevResetImageTrigger.current !== undefined &&
      prevResetImageTrigger.current !== resetImageTrigger
    ) {
      setPreviewUrl(null);
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
              await updatePreview(
                prepared,
                typeof acceptedId === "string" ? acceptedId : undefined,
                setPreviewUrl
              );
            } catch {
              // Preview caching is best-effort and must not block a successful parse
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
  const parsingLabel =
    parseProgress && parseProgress.total > 1
      ? `Parsing receipt ${parseProgress.current} of ${parseProgress.total}...`
      : "Parsing receipt...";

  return (
    <Card className="w-full">
      <CardContent className="p-6">
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
            isDragActive ? "border-primary bg-primary/5" : "border-input"
          } ${isBusy ? "opacity-60 cursor-not-allowed" : ""}`}
        >
          <input {...getInputProps()} disabled={isBusy} />

          {isCompressing ? (
            <div className="flex flex-col items-center">
              <Loader2 className="h-10 w-10 mb-4 animate-spin text-primary" />
              <p className="mb-1 font-medium">Compressing image...</p>
              <p className="text-sm text-muted-foreground">
                Reducing file size to under {MAX_FILE_SIZE_MB}MB
              </p>
            </div>
          ) : previewUrl ? (
            <div className="flex flex-col items-center">
              {previewUrl === "pdf-placeholder" ? (
                <FileText className="h-32 w-32 mb-4 text-muted-foreground" />
              ) : (
                <img
                  src={previewUrl}
                  alt="Receipt preview"
                  className="max-h-64 max-w-full mb-4 rounded-md"
                />
              )}
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <p>{parsingLabel}</p>
                </div>
              ) : (
                <p>Click or drag to add another receipt</p>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center">
              {isLoading ? (
                <>
                  <Loader2 className="h-12 w-12 mb-4 animate-spin text-primary" />
                  <p className="mb-1 font-medium">{parsingLabel}</p>
                </>
              ) : (
                <>
                  <UploadCloud className="h-12 w-12 mb-4 text-muted-foreground" />
                  <p className="mb-1 font-medium">Upload your receipts</p>
                  <p className="text-sm text-muted-foreground">
                    Drag and drop or click to select one or more files
                  </p>
                </>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
