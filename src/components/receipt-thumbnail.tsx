import { FileText } from "lucide-react";

interface ReceiptThumbnailProps {
  src?: string;
  alt: string;
  variant: "row" | "details";
}

export function ReceiptThumbnail({ src, alt, variant }: ReceiptThumbnailProps) {
  if (variant === "row") {
    if (src) {
      return (
        <img
          src={src}
          alt={alt}
          className="h-12 w-12 rounded object-cover border shrink-0"
        />
      );
    }
    return (
      <FileText
        aria-hidden="true"
        className="h-6 w-6 mt-0.5 shrink-0 text-muted-foreground"
      />
    );
  }

  if (src) {
    return (
      <img
        src={src}
        alt={alt}
        className="max-h-48 max-w-full w-auto rounded-md border object-contain shrink-0 mx-auto sm:mx-0"
      />
    );
  }

  return (
    <div
      className="flex h-40 w-28 items-center justify-center rounded-md border bg-muted/40 shrink-0 mx-auto sm:mx-0"
      aria-hidden="true"
    >
      <FileText className="h-12 w-12 text-muted-foreground" />
    </div>
  );
}
