import { Share, Link2, Check, ChevronDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import Decimal from "decimal.js";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PersonAvatar } from "@/components/person-avatar";
import { PersonItemBreakdown } from "@/components/person-items";
import { type Person } from "@/types";
import { formatCurrency, type ReceiptValidationResult } from "@/lib/receipt-utils";
import {
  generateShareableUrl,
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
  const [expandedPersonId, setExpandedPersonId] = useState<string | null>(null);
  const [shareStatus, setShareStatus] = useState<
    "idle" | "copying" | "success" | "error"
  >("idle");
  // Sort people by final total (highest first)
  const sortedPeople = [...people].sort((a, b) => b.finalTotal - a.finalTotal);
  const showBreakdown = (receiptBreakdown?.length ?? 0) > 1;

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
    (!validationResult || validationResult.isValid);

  if (people.length === 0) {
    return null;
  }

  const dayTotal = people
    .reduce((sum, person) => sum.add(person.finalTotal), new Decimal(0))
    .toNumber();
  const cleanPhoneLength = phoneNumber.replace(/\D/g, "").length;
  const supportsVenmo = (currencyCode ?? "USD") === "USD";

  return (
    <div className="flex w-full flex-col gap-4">
      <Card className="gap-0 overflow-hidden py-0">
        <section
          data-testid={showBreakdown ? "day-total" : undefined}
          aria-labelledby="day-total-heading"
        >
          <h3
            id="day-total-heading"
            className={
              showBreakdown
                ? "border-b px-4 py-3 text-sm font-medium"
                : "sr-only"
            }
          >
            {showBreakdown ? "Day total" : "Totals"}
          </h3>
          <ul className="divide-y">
            {sortedPeople.map((person) => {
              const isExpanded = expandedPersonId === person.id;
              return (
                <li key={person.id}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50"
                    onClick={() =>
                      setExpandedPersonId(isExpanded ? null : person.id)
                    }
                    aria-expanded={isExpanded}
                  >
                    <PersonAvatar name={person.name} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">
                        {person.name}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {formatCurrency(person.totalBeforeTax, currencyCode)}
                        {" + "}
                        {formatCurrency(
                          new Decimal(person.tax).add(person.tip).toNumber(),
                          currencyCode
                        )}{" "}
                        tax & tip
                      </span>
                    </span>
                    <span
                      data-testid="person-total"
                      className="shrink-0 text-lg font-semibold tabular-nums"
                    >
                      {formatCurrency(person.finalTotal, currencyCode)}
                    </span>
                    <ChevronDown
                      aria-hidden="true"
                      className={`size-4 shrink-0 text-muted-foreground transition-transform ${
                        isExpanded ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  {isExpanded && (
                    <div className="bg-muted/40 px-4 py-3 sm:pl-16">
                      <PersonItemBreakdown
                        person={person}
                        currencyCode={currencyCode}
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          <div className="flex items-center justify-between border-t bg-muted/30 px-4 py-3 text-sm">
            <span className="text-muted-foreground">Total</span>
            <span className="font-semibold tabular-nums">
              {formatCurrency(dayTotal, currencyCode)}
            </span>
          </div>
        </section>
      </Card>

      {showBreakdown && receiptBreakdown ? (
        <Card className="gap-0 py-0">
          <section data-testid="receipt-breakdown" aria-labelledby="by-receipt-heading">
            <h3 id="by-receipt-heading" className="border-b px-4 py-3 text-sm font-medium">
              By receipt
            </h3>
            <div className="grid divide-y sm:grid-cols-2 sm:divide-y-0">
              {receiptBreakdown.map((receipt, index) => {
                const sortedReceiptPeople = [...receipt.people].sort(
                  (a, b) => b.finalTotal - a.finalTotal
                );
                return (
                  <div
                    key={`${receipt.name}-${receipt.date ?? "no-date"}-${index}`}
                    className="flex flex-col gap-1.5 px-4 py-3"
                  >
                    <p className="text-sm font-medium">
                      {receipt.name}
                      {receipt.date ? (
                        <span className="font-normal text-muted-foreground">
                          {` · ${receipt.date}`}
                        </span>
                      ) : null}
                    </p>
                    <ul className="flex flex-col gap-1 text-sm">
                      {sortedReceiptPeople.map((person) => (
                        <li key={person.id} className="flex justify-between gap-2">
                          <span className="truncate text-muted-foreground">
                            {person.name}
                          </span>
                          <span className="tabular-nums">
                            {formatCurrency(person.finalTotal, currencyCode)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </section>
        </Card>
      ) : null}

      <Card className="gap-4 py-5">
        <CardHeader className="gap-1 px-4 sm:px-5">
          <CardTitle className="text-base">Send it to the group</CardTitle>
          <CardDescription>
            {supportsVenmo
              ? "Copy a link where everyone sees what they owe and can pay you on Venmo."
              : "Copy a link where everyone sees what they owe."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 px-4 sm:px-5">
          <div className="flex flex-col gap-2">
            <Label htmlFor="venmo-phone">Your phone number on Venmo</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id="venmo-phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="e.g. 555-123-4567"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ""))}
                className="min-h-[44px] flex-1 text-base sm:text-sm"
                aria-describedby="venmo-phone-hint"
              />
              <Button
                className="shrink-0"
                onClick={shareSplit}
                disabled={!canShareSplit || shareStatus === "copying"}
              >
                {shareStatus === "copying" ? (
                  <Loader2 className="animate-spin" />
                ) : shareStatus === "success" ? (
                  <Check />
                ) : (
                  <Link2 />
                )}
                {shareStatus === "copying"
                  ? "Copying..."
                  : shareStatus === "success"
                    ? "Copied!"
                    : "Share Split"}
              </Button>
            </div>
            <p id="venmo-phone-hint" className="text-xs text-muted-foreground">
              {cleanPhoneLength > 0 && cleanPhoneLength < 10
                ? "Enter all 10 digits."
                : "Used only in the link so friends can pay you."}
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            or
            <span className="h-px flex-1 bg-border" />
          </div>
          <Button variant="outline" onClick={shareResults}>
            <Share />
            Share Text
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
