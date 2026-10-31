import { Share, Link2, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { type Person } from "@/types";
import { formatCurrency, type ReceiptValidationResult } from "@/lib/receipt-utils";
import { parseDateString } from "@/lib/date-utils";
import { DEFAULT_CURRENCY } from "@/lib/currency";
import { getPublicShareOrigin } from "@/lib/app-config";
import { getPlatform } from "@/lib/platform";
import {
  generateShareableUrl,
  isValidPhoneNumber,
  validateSerializationInput,
  type SharedReceiptBreakdown,
} from "@/lib/split-sharing";

import { useState } from "react";

export interface ReceiptBreakdown {
  name: string;
  date: string | null;
  people: Person[];
}

interface ResultsSummaryProps {
  people: Person[];
  receiptName: string | null;
  receiptDate: string | null;
  currencyCode?: string;
  validationResult?: ReceiptValidationResult;
  receiptBreakdown?: ReceiptBreakdown[];
}

function receiptLabel(receipt: ReceiptBreakdown): string {
  return receipt.date ? `${receipt.name} · ${receipt.date}` : receipt.name;
}

export function ResultsSummary({
  people,
  receiptName,
  receiptDate,
  currencyCode,
  validationResult,
  receiptBreakdown,
}: ResultsSummaryProps) {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [shareStatus, setShareStatus] = useState<
    "idle" | "copying" | "success" | "error"
  >("idle");
  // Sort people by final total (highest first)
  const sortedPeople = [...people].sort((a, b) => b.finalTotal - a.finalTotal);
  const showBreakdown = (receiptBreakdown?.length ?? 0) > 1;
  const showFees = people.some((person) => !!person.fees);

  // Create a shareable text summary matching on-screen order:
  // Day total (people amounts), then By receipt (restaurant + date).
  const createShareText = (): string => {
    let text = "";

    if (showBreakdown) {
      text += "Day total\n";
      sortedPeople.forEach((person) => {
        text += `${person.name}: ${formatCurrency(person.finalTotal, currencyCode)}\n`;
      });

      if (receiptBreakdown) {
        text += "\nBy receipt\n";
        receiptBreakdown.forEach((receipt) => {
          text += `${receiptLabel(receipt)}:\n`;
          [...receipt.people]
            .sort((a, b) => b.finalTotal - a.finalTotal)
            .forEach((person) => {
              text += `  ${person.name}: ${formatCurrency(person.finalTotal, currencyCode)}\n`;
            });
        });
      }

      return text;
    }

    if (receiptName) {
      text += `Receipt for ${receiptName}\n`;
    }

    if (receiptDate) {
      text += `Date: ${parseDateString(receiptDate)?.toLocaleDateString() ?? receiptDate}\n`;
    }

    text += "\nAmount owed by each person:\n";

    sortedPeople.forEach((person) => {
      text += `${person.name}: ${formatCurrency(person.finalTotal, currencyCode)}\n`;
    });

    return text;
  };

  const shareCurrency = currencyCode || DEFAULT_CURRENCY;
  const cleanPhone = phoneNumber.replace(/\D/g, "");
  const showPhoneField = shareCurrency === "USD";
  // A partial or non-US number is kept and blocks the link. It is never dropped.
  const phoneInvalid =
    showPhoneField && cleanPhone.length > 0 && !isValidPhoneNumber(cleanPhone);

  // Share results via the platform share sheet, or the clipboard when that
  // is unsupported (the same fallback the web UI used with navigator.share).
  const shareResults = async () => {
    const text = createShareText();
    const outcome = await getPlatform().shareText({
      title: "Receipt Split Results",
      text,
    });
    if (outcome === "unsupported") {
      await copyToClipboard(text);
    }
  };

  const copyToClipboard = async (text: string) => {
    const copied = await getPlatform().copyText(text);
    if (copied) {
      toast.success("Results copied to clipboard!");
    } else {
      toast.error("Failed to copy results. Please try again.");
    }
  };

  const failShare = (message: string) => {
    setShareStatus("error");
    toast.error(message);
    setTimeout(() => setShareStatus("idle"), 2000);
  };

  const buildShareableUrl = (): string | null => {
    const note = receiptName || "Receipt Split";
    const includePhone = showPhoneField && cleanPhone.length > 0;

    if (validationResult && !validationResult.isValid) {
      failShare(
        "Cannot share split with validation errors. Please fix the issues shown above before sharing."
      );
      return null;
    }

    if (includePhone && !isValidPhoneNumber(cleanPhone)) {
      failShare(
        "Enter a valid US phone number, or leave it blank to share without payment buttons."
      );
      return null;
    }

    const validation = validateSerializationInput(
      people,
      note,
      includePhone ? cleanPhone : null,
      receiptDate
    );
    if (!validation.isValid) {
      failShare(`Cannot share split: ${validation.errorMessages.join(", ")}`);
      return null;
    }

    try {
      return generateShareableUrl(
        getPublicShareOrigin(),
        people,
        note,
        includePhone ? cleanPhone : null,
        shareCurrency,
        receiptDate,
        showBreakdown
          ? receiptBreakdown?.map<SharedReceiptBreakdown>((receipt) => ({
              label: receiptLabel(receipt),
              amounts: people.map(
                (person) =>
                  receipt.people.find((receiptPerson) => receiptPerson.id === person.id)
                    ?.finalTotal ?? 0
              ),
            }))
          : undefined
      );
    } catch (error) {
      console.error("Error sharing split:", error);
      failShare("Failed to copy share link. Please try again.");
      return null;
    }
  };

  const copyShareLink = async (shareableUrl: string) => {
    setShareStatus("copying");
    try {
      const copied = await getPlatform().copyText(shareableUrl);
      if (!copied) {
        failShare("Failed to copy share link. Please try again.");
        return;
      }
      setShareStatus("success");
      setTimeout(() => setShareStatus("idle"), 3000);
    } catch (error) {
      console.error("Error sharing split:", error);
      failShare("Failed to copy share link. Please try again.");
    }
  };

  // Copy the split link. The button stays labeled "Share Split" on web so
  // existing flows keep finding it.
  const shareSplit = async () => {
    const shareableUrl = buildShareableUrl();
    if (!shareableUrl) return;
    await copyShareLink(shareableUrl);
  };

  // Native share sheet for the link. Unsupported hosts fall back to copy.
  const shareSplitLink = async () => {
    const shareableUrl = buildShareableUrl();
    if (!shareableUrl) return;
    const outcome = await getPlatform().shareText({
      title: receiptName || "Receipt Split",
      url: shareableUrl,
    });
    if (outcome === "unsupported") {
      await copyShareLink(shareableUrl);
    }
  };

  // Positive totals and a clean receipt are required. An empty phone is fine;
  // a phone that was typed but is not a US number disables only the link.
  const canShareSplit =
    people.length > 0 &&
    people.every((person) => person.finalTotal > 0) &&
    !phoneInvalid &&
    (!validationResult || validationResult.isValid);

  if (people.length === 0) {
    return null;
  }

  const shareLinkButtons = (
    <>
      <Button
        variant={shareStatus === "success" ? "default" : "outline"}
        className="flex items-center justify-center gap-2 text-base sm:text-sm font-medium transition-all duration-200 hover:shadow-md active:scale-95 whitespace-nowrap"
        onClick={shareSplit}
        disabled={!canShareSplit || shareStatus === "copying"}
      >
        {shareStatus === "copying" && (
          <div className="h-5 w-5 sm:h-4 sm:w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        )}
        {shareStatus === "success" && (
          <Check className="h-5 w-5 sm:h-4 sm:w-4" />
        )}
        {(shareStatus === "idle" || shareStatus === "error") && (
          <Link2 className="h-5 w-5 sm:h-4 sm:w-4" />
        )}
        <span>
          {shareStatus === "copying" && "Copying..."}
          {shareStatus === "success" && "Copied!"}
          {(shareStatus === "idle" || shareStatus === "error") &&
            "Share Split"}
        </span>
      </Button>
      {getPlatform().isNative && (
        <Button
          variant="outline"
          className="flex items-center justify-center gap-2 text-base sm:text-sm font-medium transition-all duration-200 hover:shadow-md active:scale-95 whitespace-nowrap"
          onClick={shareSplitLink}
          disabled={!canShareSplit}
        >
          <Share className="h-5 w-5 sm:h-4 sm:w-4" />
          <span>Share Link</span>
        </Button>
      )}
    </>
  );

  return (
    <div className="w-full flex flex-col gap-4">
      <Card className="w-full">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <CardTitle className="text-xl sm:text-2xl">Results Summary</CardTitle>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
            <Button
              variant="outline"
              className="flex items-center justify-center gap-2 text-base sm:text-sm font-medium transition-all duration-200 hover:bg-muted active:scale-95"
              onClick={shareResults}
            >
              <Share className="h-5 w-5 sm:h-4 sm:w-4" />
              <span>Share Text</span>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="flex flex-col gap-6">
          <div
            data-testid={showBreakdown ? "day-total" : undefined}
            className="flex flex-col gap-2"
          >
            {showBreakdown ? (
              <h2 className="font-semibold text-base sm:text-lg">Day total</h2>
            ) : null}

          {/* Mobile-friendly responsive table */}
          <div className="w-full min-w-0 max-w-full overflow-x-auto">
            <Table className="[&_td]:px-[8px] [&_th]:px-[8px] sm:[&_td]:px-2 sm:[&_th]:px-2">
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-0 sm:min-w-[100px]">Person</TableHead>
                  <TableHead className="text-right min-w-[80px] hidden sm:table-cell">
                    Subtotal
                  </TableHead>
                  <TableHead className="text-right min-w-[60px] hidden sm:table-cell">
                    Tax
                  </TableHead>
                  {showFees && (
                    <TableHead className="text-right min-w-[60px] hidden sm:table-cell">
                      Fees
                    </TableHead>
                  )}
                  <TableHead className="text-right min-w-[60px] hidden sm:table-cell">
                    Tip
                  </TableHead>
                  <TableHead className="w-px whitespace-nowrap text-right font-semibold sm:w-auto sm:min-w-[80px]">
                    Total
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedPeople.map((person) => (
                  <TableRow
                    key={person.id}
                    className="group transition-colors hover:bg-muted/50"
                  >
                    <TableCell className="py-4 font-medium whitespace-normal sm:whitespace-nowrap">
                      <div className="flex min-w-0 flex-col">
                        <span className="break-words font-semibold">{person.name}</span>
                        <div className="mt-1 space-y-0.5 text-xs leading-snug text-muted-foreground sm:hidden">
                          <p className="break-words">Subtotal: {formatCurrency(person.totalBeforeTax, currencyCode)}</p>
                          <p className="break-words">Tax: {formatCurrency(person.tax, currencyCode)}</p>
                          {showFees ? (
                            <p className="break-words">Fees: {formatCurrency(person.fees ?? 0, currencyCode)}</p>
                          ) : null}
                          <p className="break-words">Tip: {formatCurrency(person.tip, currencyCode)}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right py-4 hidden sm:table-cell">
                      {formatCurrency(person.totalBeforeTax, currencyCode)}
                    </TableCell>
                    <TableCell className="text-right py-4 hidden sm:table-cell">
                      {formatCurrency(person.tax, currencyCode)}
                    </TableCell>
                    {showFees && (
                      <TableCell className="text-right py-4 hidden sm:table-cell">
                        {formatCurrency(person.fees ?? 0, currencyCode)}
                      </TableCell>
                    )}
                    <TableCell className="text-right py-4 hidden sm:table-cell">
                      {formatCurrency(person.tip, currencyCode)}
                    </TableCell>
                    <TableCell className="w-px py-4 text-right align-top whitespace-nowrap sm:w-auto sm:align-middle">
                      <span className="text-lg font-bold tabular-nums text-primary">
                        {formatCurrency(person.finalTotal, currencyCode)}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          </div>

          {showBreakdown && receiptBreakdown ? (
            <div
              data-testid="receipt-breakdown"
              className="flex flex-col gap-4"
            >
              <h2 className="font-semibold text-base sm:text-lg">By receipt</h2>
              {receiptBreakdown.map((receipt, index) => {
                const sortedReceiptPeople = [...receipt.people].sort(
                  (a, b) => b.finalTotal - a.finalTotal
                );
                return (
                  <div key={`${receipt.name}-${receipt.date ?? "no-date"}-${index}`} className="flex flex-col gap-2">
                    <div className="break-words text-sm font-medium sm:text-base">
                      <span>{receipt.name}</span>
                      {receipt.date ? (
                        <span className="text-muted-foreground font-normal">
                          {` · ${receipt.date}`}
                        </span>
                      ) : null}
                    </div>
                    <div className="w-full min-w-0 max-w-full overflow-x-auto">
                      <Table className="[&_td]:px-[8px] [&_th]:px-[8px] sm:[&_td]:px-2 sm:[&_th]:px-2">
                        <TableHeader>
                          <TableRow>
                            <TableHead className="min-w-0 sm:min-w-[100px]">Person</TableHead>
                            <TableHead className="w-px whitespace-nowrap text-right font-semibold sm:w-auto sm:min-w-[80px]">
                              Total
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {sortedReceiptPeople.map((person) => (
                            <TableRow key={person.id}>
                              <TableCell className="py-2 font-medium whitespace-normal break-words">
                                {person.name}
                              </TableCell>
                              <TableCell className="w-px py-2 text-right tabular-nums whitespace-nowrap sm:w-auto">
                                {formatCurrency(person.finalTotal, currencyCode)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
          </div>
        </CardContent>
      </Card>

      <Card className="w-full">
        <CardContent className="flex flex-col gap-3">
          {showPhoneField ? (
            <>
              <label
                htmlFor="venmo-phone"
                className="font-medium text-sm sm:text-base"
              >
                Your phone number (optional, US Venmo only)
              </label>
              <p id="venmo-phone-help" className="text-sm text-muted-foreground">
                Leave blank to share without payment buttons.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  id="venmo-phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="e.g. 555-123-4567"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ""))}
                  aria-invalid={phoneInvalid || undefined}
                  aria-describedby={
                    phoneInvalid ? "venmo-phone-error" : "venmo-phone-help"
                  }
                  className="flex-1 min-h-[44px] border rounded-lg px-4 py-2 text-base sm:text-sm transition-all duration-200 focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
                {shareLinkButtons}
              </div>
              {phoneInvalid && (
                <p id="venmo-phone-error" role="alert" className="text-sm text-destructive">
                  Enter a valid 10-digit US number, or leave this blank.
                </p>
              )}
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                No payment details are needed to share this split.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row">
                {shareLinkButtons}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
