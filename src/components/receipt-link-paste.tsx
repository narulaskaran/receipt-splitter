import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowRight, ClipboardPaste, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { normalizeReceiptUrl } from "@/lib/receipt-url";
import { getPlatform } from "@/lib/platform";

const INVALID_HINT_DELAY_MS = 600;

interface ReceiptLinkPasteProps {
  /** Compact row shown once the split has receipts. */
  compact: boolean;
  /** Whether the URL field is showing instead of the "Paste receipt link" button. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: string;
  onValueChange: (value: string) => void;
  /** Called with a normalized http(s) URL. */
  onSubmitUrl: (url: string) => void;
  /** Opens the file picker (compact row only). */
  onAddFile: () => void;
}

/**
 * Pasting a receipt link: a button that reads the clipboard (on a phone there's
 * no keyboard shortcut) and falls back to a URL field when the clipboard can't
 * be read or doesn't hold a link. The field's arrow stays disabled until the
 * text is a valid link.
 */
export function ReceiptLinkPaste({
  compact,
  open,
  onOpenChange,
  value,
  onValueChange,
  onSubmitUrl,
  onAddFile,
}: ReceiptLinkPasteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [clipboardNotice, setClipboardNotice] = useState<string | null>(null);
  // The value the user paused on; the invalid hint waits for it to settle
  const [settledValue, setSettledValue] = useState("");

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    const timer = setTimeout(() => setSettledValue(value), INVALID_HINT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [value]);

  const url = normalizeReceiptUrl(value);
  const showInvalidHint = value.trim() !== "" && !url && settledValue === value;
  const hint = showInvalidHint
    ? "That doesn't look like a link"
    : clipboardNotice;

  async function pasteFromClipboard() {
    setClipboardNotice(null);
    const text = await getPlatform().readClipboardText();
    // null = blocked or unavailable. Fall back to the field without claiming
    // the clipboard was empty.
    if (text === null) {
      onOpenChange(true);
      return;
    }
    const trimmed = text.trim();
    const clipboardUrl = normalizeReceiptUrl(trimmed);
    if (clipboardUrl) {
      onSubmitUrl(clipboardUrl);
      return;
    }
    setClipboardNotice(
      trimmed
        ? "Your clipboard doesn't have a link. Copy the receipt link first."
        : "Your clipboard is empty. Copy the receipt link first."
    );
    onOpenChange(true);
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (url) onSubmitUrl(url);
  }

  if (open) {
    return (
      <form onSubmit={handleSubmit} noValidate className="w-full text-left">
        <div className="flex min-h-11 items-center gap-2 rounded-full border border-input bg-background py-1 pl-4 pr-1 focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50">
          <input
            ref={inputRef}
            type="url"
            inputMode="url"
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            aria-label="Receipt link"
            aria-invalid={showInvalidHint || undefined}
            placeholder="Paste a receipt link"
            value={value}
            onChange={(event) => {
              setClipboardNotice(null);
              onValueChange(event.target.value);
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                onValueChange("");
                onOpenChange(false);
              }
            }}
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <button
            type="submit"
            disabled={!url}
            aria-label="Read receipt from link"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors disabled:bg-muted disabled:text-muted-foreground"
          >
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
        <p
          role={hint ? "status" : undefined}
          className={`mt-2 min-h-4 text-center text-xs ${
            hint ? "text-destructive" : "text-muted-foreground"
          }`}
        >
          {hint ?? "Paste a link, then tap the arrow"}
        </p>
      </form>
    );
  }

  if (compact) {
    return (
      <div className="mx-auto flex max-w-md gap-2">
        <Button type="button" variant="outline" className="flex-1" onClick={onAddFile}>
          <UploadCloud />
          Add file
        </Button>
        <Button type="button" variant="outline" className="flex-1" onClick={pasteFromClipboard}>
          <ClipboardPaste />
          Paste link
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full">
      <Button type="button" className="w-full" onClick={pasteFromClipboard}>
        <ClipboardPaste />
        Paste receipt link
      </Button>
      <p className="mt-2 text-xs text-muted-foreground">
        Copy a link from a text or email, then tap
      </p>
    </div>
  );
}
