import { useCallback, useEffect, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import { UploadCloud, Loader2, WifiOff } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { ReceiptLinkPaste } from "@/components/receipt-link-paste";
import { toast } from "sonner";
import { type Receipt } from "@/types";
import {
  MAX_FILE_SIZE_MB,
  MAX_FILE_SIZE_BYTES,
  MAX_RECEIPTS_PER_SESSION,
} from "@/lib/constants";
import imageCompression from "browser-image-compression";
import { getSessionId } from "@/lib/session";
import { useOnlineStatus } from "@/lib/use-online-status";
import { normalizeReceiptUrl } from "@/lib/receipt-url";
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
  /** Files delivered from outside the dropzone (the Web Share Target). Processed like a drop. */
  incomingFiles?: File[];
  /** Called as soon as `incomingFiles` is picked up, so the parent can clear it. */
  onIncomingFilesHandled?: () => void;
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

async function postReceipt(formData: FormData): Promise<Receipt> {
  formData.append("sessionId", getSessionId());

  let response: Response;
  try {
    response = await fetch("/api/parse-receipt", {
      method: "POST",
      body: formData,
    });
  } catch (error) {
    // fetch rejects with a TypeError when the request never reached the server
    if (error instanceof TypeError) {
      console.error("Receipt upload request failed:", error);
      throw new Error(
        "Couldn't reach the server. Check your connection and try again."
      );
    }
    throw error;
  }

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

function parseReceiptFile(file: File): Promise<Receipt> {
  const formData = new FormData();
  formData.append("file", file);
  return postReceipt(formData);
}

function parseReceiptUrl(url: string): Promise<Receipt> {
  const formData = new FormData();
  formData.append("url", url);
  return postReceipt(formData);
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
  incomingFiles,
  onIncomingFilesHandled,
}: ReceiptUploaderProps) {
  const isOnline = useOnlineStatus();
  const [isCompressing, setIsCompressing] = useState(false);
  const [parseProgress, setParseProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);
  // Pasted-link UI state lives here, not in ReceiptLinkPaste, because that
  // component unmounts while a parse is in flight and a failed link should stay
  // in the field for the user to fix.
  const [linkFieldOpen, setLinkFieldOpen] = useState(false);
  const [linkValue, setLinkValue] = useState("");
  const [linkHost, setLinkHost] = useState<string | null>(null);

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

  const processUrl = useCallback(
    async (url: string) => {
      if (maxRemaining <= 0) {
        toast.error(
          `This split already has ${MAX_RECEIPTS_PER_SESSION} receipts. Remove one to add another.`
        );
        return;
      }

      setLinkHost(new URL(url).hostname.replace(/^www\./, ""));
      setIsLoading(true);
      try {
        const receipt = await parseReceiptUrl(url);
        const acceptedId = onReceiptParsed(receipt);
        if (acceptedId !== false && acceptedId !== undefined) {
          setLinkValue("");
          setLinkFieldOpen(false);
        }
      } catch (error) {
        console.error("Receipt link error:", error);
        toast.error(
          error instanceof Error
            ? error.message
            : "Failed to read that link. Please try again."
        );
        // Leave the link in the field so it can be fixed or retried
        setLinkValue(url);
        setLinkFieldOpen(true);
      } finally {
        setLinkHost(null);
        setIsLoading(false);
      }
    },
    [onReceiptParsed, setIsLoading, maxRemaining]
  );

  // Guard against re-processing the same files (React strict mode re-runs
  // effects on mount).
  const handledIncomingFiles = useRef<File[] | undefined>(undefined);
  useEffect(() => {
    if (!incomingFiles || incomingFiles.length === 0) return;
    // Wait for any parse in flight instead of interleaving with it; the effect
    // re-runs when the uploader goes idle.
    if (isLoading || isCompressing) return;
    if (handledIncomingFiles.current === incomingFiles) return;
    handledIncomingFiles.current = incomingFiles;
    onIncomingFilesHandled?.();
    if (!isOnline) {
      toast.error("You're offline. Reconnect, then share the receipt again.");
      return;
    }
    void onDrop(incomingFiles);
  }, [
    incomingFiles,
    onIncomingFilesHandled,
    onDrop,
    isLoading,
    isCompressing,
    isOnline,
  ]);

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    // The compact row has its own buttons (Add file / Paste link); the row
    // itself only accepts drops.
    noClick: hasReceipts,
    noKeyboard: hasReceipts,
    accept: {
      "image/*": [".jpeg", ".jpg", ".png", ".heif", ".heic", ".webp"],
      "application/pdf": [".pdf"],
    },
    multiple: true,
    disabled: isLoading || isCompressing || !isOnline,
  });

  const isBusy = isLoading || isCompressing;
  const isDisabled = isBusy || !isOnline;

  // Pasting a link anywhere on the page (not into a text field) reads it
  // straight away. Requires an explicit scheme so stray pasted text like
  // "notes.txt" isn't mistaken for a link.
  useEffect(() => {
    if (isDisabled) return;
    const onPaste = (event: ClipboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable]")) return;
      const text = event.clipboardData?.getData("text").trim() ?? "";
      if (!/^https?:\/\//i.test(text)) return;
      const url = normalizeReceiptUrl(text);
      if (!url) return;
      event.preventDefault();
      void processUrl(url);
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [isDisabled, processUrl]);
  const compact = hasReceipts;
  const parsingLabel = linkHost
    ? `Reading ${linkHost}...`
    : parseProgress && parseProgress.total > 1
      ? `Parsing receipt ${parseProgress.current} of ${parseProgress.total}...`
      : "Parsing receipt...";

  // Clicks on the link controls must not reach the dropzone and open the picker
  const stopPropagation = (event: { stopPropagation: () => void }) =>
    event.stopPropagation();
  const linkPaste = (
    <ReceiptLinkPaste
      compact={compact}
      open={linkFieldOpen}
      onOpenChange={setLinkFieldOpen}
      value={linkValue}
      onValueChange={setLinkValue}
      onSubmitUrl={(url) => void processUrl(url)}
      onAddFile={open}
    />
  );

  return (
    <Card className={`w-full ${compact ? "py-3" : ""}`}>
      <CardContent className={compact ? "px-4" : "p-6"}>
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg text-center cursor-pointer transition-colors ${
            compact ? "px-4 py-3" : "p-8"
          } ${
            isDragActive ? "border-primary bg-primary/5" : "border-input"
          } ${isDisabled ? "opacity-60 cursor-not-allowed" : ""}`}
        >
          <input {...getInputProps()} disabled={isDisabled} />

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
          ) : !isOnline ? (
            compact ? (
              <div className="flex items-center justify-center gap-2">
                <WifiOff className="h-5 w-5 shrink-0 text-muted-foreground" />
                <p>You&apos;re offline. Reconnect to add another receipt.</p>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <WifiOff className="h-12 w-12 mb-4 text-muted-foreground" />
                <p className="mb-1 font-medium">You&apos;re offline</p>
                <p className="text-sm text-muted-foreground">
                  Reading a receipt needs a connection. Reconnect to upload one.
                  Your split so far is saved on this device.
                </p>
              </div>
            )
          ) : compact ? (
            <div onClick={stopPropagation}>{linkPaste}</div>
          ) : (
            <div className="flex flex-col items-center">
              <UploadCloud className="h-12 w-12 mb-4 text-muted-foreground" />
              <p className="mb-1 font-medium">Upload your receipts</p>
              <p className="text-sm text-muted-foreground">
                Drag and drop or click to select one or more files
              </p>
              <div
                className="mt-4 flex w-full max-w-sm flex-col items-center gap-3"
                onClick={stopPropagation}
              >
                {!linkFieldOpen && (
                  <div className="flex w-full items-center gap-3 text-xs text-muted-foreground">
                    <span className="h-px flex-1 bg-border" />
                    or
                    <span className="h-px flex-1 bg-border" />
                  </div>
                )}
                {linkPaste}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
