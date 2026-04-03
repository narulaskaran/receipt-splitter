import { useState, useCallback, useEffect, useRef } from "react";
import { useDropzone } from "react-dropzone";
import { UploadCloud, Loader2, FileText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { type Receipt } from "@/types";
import { MAX_FILE_SIZE_MB, MAX_FILE_SIZE_BYTES } from "@/lib/constants";
import imageCompression from "browser-image-compression";

interface ReceiptUploaderProps {
  onReceiptParsed: (receipt: Receipt) => void;
  isLoading: boolean;
  setIsLoading: (isLoading: boolean) => void;
  resetImageTrigger?: number;
}

const MAX_COMPRESSION_FILE_SIZE_MB = 50;
const COMPRESSION_TARGET_SIZE_MB = 4;

export function ReceiptUploader({
  onReceiptParsed,
  isLoading,
  setIsLoading,
  resetImageTrigger,
}: ReceiptUploaderProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const IMAGE_STORAGE_KEY = "receiptSplitterImage";

  // Restore preview image from localStorage on mount
  useEffect(() => {
    const savedImage = localStorage.getItem(IMAGE_STORAGE_KEY);
    if (savedImage) {
      setPreviewUrl(savedImage);
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
      localStorage.removeItem(IMAGE_STORAGE_KEY);
    }
    prevResetImageTrigger.current = resetImageTrigger;
  }, [resetImageTrigger]);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) return;

      // Get the first file
      let file = acceptedFiles[0];

      // Check file type
      if (!file.type.startsWith("image/") && file.type !== "application/pdf") {
        toast.error("Please upload an image or PDF file");
        return;
      }

      const fileSizeMB = file.size / (1024 * 1024);

      // Attempt client-side compression for images that exceed the upload limit
      if (file.type.startsWith("image/") && file.size > MAX_FILE_SIZE_BYTES) {
        if (fileSizeMB > MAX_COMPRESSION_FILE_SIZE_MB) {
          toast.error(
            `File is too large to compress (${fileSizeMB.toFixed(1)}MB). Maximum is ${MAX_COMPRESSION_FILE_SIZE_MB}MB.`
          );
          return;
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
          toast.success(
            `Compressed from ${originalSize}MB to ${newSize}MB`
          );
          file = compressed;
        } catch (error) {
          console.error("Image compression error:", error);
          toast.error(
            `File is too large (${fileSizeMB.toFixed(1)}MB). Maximum size is ${MAX_FILE_SIZE_MB}MB. Compression failed — please use a smaller file.`
          );
          return;
        } finally {
          setIsCompressing(false);
        }
      }

      // Final size check (after potential compression)
      if (file.size > MAX_FILE_SIZE_BYTES) {
        toast.error(
          `File is too large. Maximum size is ${MAX_FILE_SIZE_MB}MB. Your file is ${(file.size / (1024 * 1024)).toFixed(1)}MB.`
        );
        return;
      }

      // Convert image to Base64 and store in localStorage (skip for PDFs)
      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = () => {
          if (reader.result) {
            localStorage.setItem(IMAGE_STORAGE_KEY, reader.result as string);
            setPreviewUrl(reader.result as string);
          }
        };
        reader.readAsDataURL(file);
      } else {
        // For PDFs, just set a placeholder preview
        setPreviewUrl("pdf-placeholder");
        localStorage.removeItem(IMAGE_STORAGE_KEY);
      }

      // Parse receipt
      try {
        setIsLoading(true);

        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch("/api/parse-receipt", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          // Handle 413 specifically - the server may not return JSON for this error
          if (response.status === 413) {
            throw new Error(
              `File is too large. Maximum size is ${MAX_FILE_SIZE_MB}MB. Please compress your image or use a smaller file.`
            );
          }
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to parse receipt");
        }

        const receiptData = await response.json();
        onReceiptParsed(receiptData);
      } catch (error) {
        console.error("Receipt parsing error:", error);
        const errorMessage =
          error instanceof Error
            ? error.message
            : "Failed to parse receipt. Please try again.";
        toast.error(errorMessage);
      } finally {
        setIsLoading(false);
      }
    },
    [onReceiptParsed, setIsLoading]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/*": [".jpeg", ".jpg", ".png", ".heif", ".heic", ".webp"],
      "application/pdf": [".pdf"],
    },
    maxFiles: 1,
    disabled: isLoading || isCompressing,
  });

  const isBusy = isLoading || isCompressing;

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
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={previewUrl}
                  alt="Receipt preview"
                  className="max-h-64 max-w-full mb-4 rounded-md"
                />
              )}
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <p>Parsing receipt...</p>
                </div>
              ) : (
                <p>Click or drag to upload a different receipt</p>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <UploadCloud className="h-12 w-12 mb-4 text-muted-foreground" />
              <p className="mb-1 font-medium">Upload your receipt</p>
              <p className="text-sm text-muted-foreground">
                Drag and drop or click to select
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
