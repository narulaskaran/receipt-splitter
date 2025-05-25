import { useState, useCallback, useEffect, useRef } from "react";
import { useDropzone } from "react-dropzone";
import { UploadCloud, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { type Receipt } from "@/types";

interface ReceiptUploaderProps {
  onReceiptParsed: (receipt: Receipt) => void;
  isLoading: boolean;
  setIsLoading: (isLoading: boolean) => void;
  resetImageTrigger?: number;
}

export function ReceiptUploader({
  onReceiptParsed,
  isLoading,
  setIsLoading,
  resetImageTrigger,
}: ReceiptUploaderProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
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
      const file = acceptedFiles[0];

      // Check file type
      if (!file.type.startsWith("image/")) {
        toast.error("Please upload an image file");
        return;
      }

      // Convert image to Base64 and store in localStorage
      const reader = new FileReader();
      reader.onload = () => {
        if (reader.result) {
          localStorage.setItem(IMAGE_STORAGE_KEY, reader.result as string);
          setPreviewUrl(reader.result as string);
        }
      };
      reader.readAsDataURL(file);

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
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to parse receipt");
        }

        const receiptData = await response.json();
        onReceiptParsed(receiptData);
      } catch (error) {
        console.error("Receipt parsing error:", error);
        toast.error("Failed to parse receipt. Please try again.");
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
    },
    maxFiles: 1,
    disabled: isLoading,
  });

  return (
    <Card className="w-full">
      <CardContent className="p-6">
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
            isDragActive ? "border-primary bg-primary/5" : "border-input"
          } ${isLoading ? "opacity-60 cursor-not-allowed" : ""}`}
        >
          <input {...getInputProps()} disabled={isLoading} />

          {previewUrl ? (
            <div className="flex flex-col items-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt="Receipt preview"
                className="max-h-64 max-w-full mb-4 rounded-md"
              />
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
