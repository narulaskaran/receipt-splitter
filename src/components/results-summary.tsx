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
import {
  formatCurrency,
  type ReceiptValidationResult,
  type SessionCurrencyTotals,
} from "@/lib/receipt-utils";
import {
  generateShareableUrl,
  validateSerializationInput,
} from "@/lib/split-sharing";

import { useState } from "react";

export interface ReceiptBreakdown {
  name: string;
  date: string | null;
  currency?: string;
  people: Person[];
}

interface ResultsSummaryProps {
  people: Person[];
  receiptName: string | null;
  receiptDate: string | null;
  currencyCode?: string;
  validationResult?: ReceiptValidationResult;
  receiptBreakdown?: ReceiptBreakdown[];
  /** All currency groups in the session, used to gate Venmo sharing. */
  currencyGroups?: SessionCurrencyTotals[];
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
  currencyGroups,
}: ResultsSummaryProps) {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [shareStatus, setShareStatus] = useState<
    "idle" | "copying" | "success" | "error"
  >("idle");
  // Sort people by final total (highest first)
  const sortedPeople = [...people].sort((a, b) => b.finalTotal - a.finalTotal);
  const showBreakdown = (receiptBreakdown?.length ?? 0) > 1;
  const isSingleCurrency = (currencyGroups?.length ?? 1) === 1;
  const showDayTotalHeading = showBreakdown || !isSingleCurrency;

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
      text += `Date: ${new Date(receiptDate).toLocaleDateString()}\n`;
    }

    text += "\nAmount owed by each person:\n";

    sortedPeople.forEach((person) => {
      text += `${person.name}: ${formatCurrency(person.finalTotal, currencyCode)}\n`;
    });

    return text;
  };

  // Share results via native sharing API or fallback to clipboard
  const shareResults = async () => {
    const text = createShareText();

    if (navigator.share) {
      try {
        await navigator.share({
          title: "Receipt Split Results",
          text: text,
        });
      } catch (error) {
        console.error("Error sharing results:", error);
        copyToClipboard(text);
      }
    } else {
      copyToClipboard(text);
    }
  };

  // Fallback to clipboard
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Results copied to clipboard!");
    } catch (error) {
      console.error("Failed to copy to clipboard:", error);
      toast.error("Failed to copy results. Please try again.");
    }
  };



  // Share split functionality
  const shareSplit = async () => {
    const note = receiptName || "Receipt Split";
    const cleanPhone = phoneNumber.replace(/\D/g, "");

    setShareStatus("copying");

    try {
      // Check validation errors first
      if (validationResult && !validationResult.isValid) {
        setShareStatus("error");
        toast.error(
          "Cannot share split with validation errors. Please fix the issues shown above before sharing."
        );
        setTimeout(() => setShareStatus("idle"), 2000);
        return;
      }

      // Validate that we have required data to share
      if (!cleanPhone) {
        setShareStatus("error");
        toast.error(
          "Phone number is required to share splits with Venmo payment functionality."
        );
        setTimeout(() => setShareStatus("idle"), 2000);
        return;
      }

      const validation = validateSerializationInput(
        people,
        note,
        cleanPhone,
        receiptDate
      );
      if (!validation.isValid) {
        setShareStatus("error");
        toast.error(`Cannot share split: ${validation.errorMessages.join(", ")}`);
        setTimeout(() => setShareStatus("idle"), 2000);
        return;
      }

      // Generate shareable URL
      const baseUrl =
        typeof window !== "undefined"
          ? window.location.origin
          : "https://receipt-splitter.app";
      const shareableUrl = generateShareableUrl(
        baseUrl,
        people,
        note,
        cleanPhone,
        currencyCode,
        receiptDate
      );

      // Copy to clipboard
      await navigator.clipboard.writeText(shareableUrl);
      setShareStatus("success");

      setTimeout(() => setShareStatus("idle"), 3000);
    } catch (error) {
      console.error("Error sharing split:", error);
      setShareStatus("error");
      toast.error("Failed to copy share link. Please try again.");
      setTimeout(() => setShareStatus("idle"), 2000);
    }
  };

  // Check if split is ready to share
  const canShareSplit =
    people.length > 0 &&
    people.every((person) => person.finalTotal > 0) &&
    phoneNumber.replace(/\D/g, "").length >= 10 &&
    isSingleCurrency &&
    (!validationResult || validationResult.isValid);

  if (people.length === 0) {
    return null;
  }

  return (
    <div className="w-full flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <label
          htmlFor="venmo-phone"
          className="font-medium text-sm sm:text-base"
        >
          Your Phone Number (for Venmo):
        </label>
        <div className="flex gap-3">
          <input
            id="venmo-phone"
            type="tel"
            placeholder="e.g. 555-123-4567"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ""))}
            className="flex-1 min-h-[44px] border rounded-lg px-4 py-2 text-base sm:text-sm transition-all duration-200 focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
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
            {shareStatus === "idle" && (
              <Link2 className="h-5 w-5 sm:h-4 sm:w-4" />
            )}
            {shareStatus === "error" && (
              <Link2 className="h-5 w-5 sm:h-4 sm:w-4" />
            )}
            <span>
              {shareStatus === "copying" && "Copying..."}
              {shareStatus === "success" && "Copied!"}
              {(shareStatus === "idle" || shareStatus === "error") &&
                "Share Split"}
            </span>
          </Button>
        </div>
      </div>



      <Card className="w-full">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <CardTitle className="text-xl sm:text-2xl">
            Results Summary
            {currencyGroups && currencyGroups.length > 1 && currencyCode
              ? ` · ${currencyCode}`
              : ""}
          </CardTitle>
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
        {!isSingleCurrency ? (
          <p className="px-6 text-sm text-muted-foreground">
            Venmo sharing is available only for single-currency splits.
          </p>
        ) : null}
        <CardContent className="p-6">
          <div className="flex flex-col gap-6">
          <div
            data-testid={showBreakdown ? "day-total" : undefined}
            className="flex flex-col gap-2"
          >
            {showDayTotalHeading ? (
              <h2 className="font-semibold text-base sm:text-lg">
                Day total{!isSingleCurrency && currencyCode ? ` · ${currencyCode}` : ""}
              </h2>
            ) : null}

          {/* Mobile-friendly responsive table */}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[100px]">Person</TableHead>
                  <TableHead className="text-right min-w-[80px] hidden sm:table-cell">
                    Subtotal
                  </TableHead>
                  <TableHead className="text-right min-w-[60px] hidden sm:table-cell">
                    Tax
                  </TableHead>
                  <TableHead className="text-right min-w-[60px] hidden sm:table-cell">
                    Tip
                  </TableHead>
                  <TableHead className="text-right min-w-[80px] font-semibold">
                    Total
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedPeople.map((person) => (
                  <TableRow
                    key={person.id}
                    className="group hover:bg-muted/50 transition-colors"
                  >
                    <TableCell className="font-medium py-4">
                      <div className="flex flex-col">
                        <span className="font-semibold">{person.name}</span>
                        {/* Mobile-only breakdown */}
                        <div className="text-xs text-muted-foreground mt-1 sm:hidden">
                          Subtotal: {formatCurrency(person.totalBeforeTax, currencyCode)} •
                          Tax: {formatCurrency(person.tax, currencyCode)} • Tip:{" "}
                          {formatCurrency(person.tip, currencyCode)}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right py-4 hidden sm:table-cell">
                      {formatCurrency(person.totalBeforeTax, currencyCode)}
                    </TableCell>
                    <TableCell className="text-right py-4 hidden sm:table-cell">
                      {formatCurrency(person.tax, currencyCode)}
                    </TableCell>
                    <TableCell className="text-right py-4 hidden sm:table-cell">
                      {formatCurrency(person.tip, currencyCode)}
                    </TableCell>
                    <TableCell className="text-right py-4">
                      <span className="font-bold text-lg text-primary">
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
                    <div className="font-medium text-sm sm:text-base">
                      <span>{receipt.name}</span>
                      {receipt.date ? (
                        <span className="text-muted-foreground font-normal">
                          {` · ${receipt.date}`}
                        </span>
                      ) : null}
                    </div>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="min-w-[100px]">Person</TableHead>
                            <TableHead className="text-right min-w-[80px] font-semibold">
                              Total
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {sortedReceiptPeople.map((person) => (
                            <TableRow key={person.id}>
                              <TableCell className="font-medium py-2">
                                {person.name}
                              </TableCell>
                              <TableCell className="text-right py-2">
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
    </div>
  );
}
