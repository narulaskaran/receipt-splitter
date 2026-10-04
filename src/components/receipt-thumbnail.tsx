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
          className="size-10 rounded-md object-cover border shrink-0"
        />
      );
    }
    return (
      <span
        aria-hidden="true"
        className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground"
      >
        <FileText className="size-5" />
      </span>
    );
  }

  if (src) {
    return (
      <img
        src={src}
        alt={alt}
        className="max-h-40 max-w-full w-auto rounded-md border object-contain shrink-0 mx-auto sm:mx-0"
      />
    );
  }

  return (
    <div
      className="hidden h-28 w-20 items-center justify-center rounded-md border bg-card shrink-0 sm:flex"
      aria-hidden="true"
    >
      <FileText className="size-8 text-muted-foreground" />
    </div>
  );
}
