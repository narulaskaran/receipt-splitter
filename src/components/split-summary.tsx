import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { type SharedSplitData } from "@/lib/split-sharing";
import { formatCurrency } from "@/lib/receipt-utils";
import {
  formatVenmoNote,
  generateVenmoLink,
  generateVenmoWebLink,
  isVenmoAppPreferred,
} from "@/lib/venmo-utils";
import { formatDisplayDate } from "@/lib/date-utils";
import Image from "next/image";
import { useEffect, useState } from "react";

interface SplitSummaryProps {
  splitData: SharedSplitData;
  phoneNumber?: string;
}

function personCountLabel(count: number): string {
  return `${count} ${count === 1 ? "person" : "people"}`;
}

function SplitPersonRow({
  name,
  amount,
  currency,
  venmoHref,
}: {
  name: string;
  amount: number;
  currency: string;
  venmoHref: string | null;
}) {
  const formattedAmount = formatCurrency(amount, currency);

  return (
    <li className="flex items-center gap-3 px-5 py-3 sm:px-6">
      <div
        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium"
        aria-hidden="true"
      >
        {name.charAt(0).toUpperCase()}
      </div>
      <span className="min-w-0 flex-1 truncate font-medium">{name}</span>
      <span className="shrink-0 tabular-nums font-medium">
        {formattedAmount}
      </span>
      {venmoHref && (
        <Button
          size="sm"
          asChild
          className="shrink-0 bg-[#008CFF] px-3 text-white hover:bg-[#0074D9]"
        >
          <a
            href={venmoHref}
            aria-label={`Pay ${formattedAmount} for ${name} with Venmo`}
          >
            <Image src="/venmo.png" alt="" width={14} height={14} />
            Pay
          </a>
        </Button>
      )}
    </li>
  );
}

export function SplitSummary({ splitData, phoneNumber }: SplitSummaryProps) {
  const canPayWithVenmo = Boolean(phoneNumber) && splitData.currency === "USD";

  // `navigator` is unavailable during SSR, so default to the native app scheme
  // (matching the server render) and switch desktop browsers to the web
  // compose URL after hydration. Without this, desktop visitors clicking Pay
  // would hit a bare `venmo://` href that the browser cannot handle.
  const [preferNativeApp, setPreferNativeApp] = useState(true);
  useEffect(() => {
    setPreferNativeApp(isVenmoAppPreferred());
  }, []);

  const buildVenmoHref = (name: string, index: number): string | null => {
    if (!canPayWithVenmo || !phoneNumber) {
      return null;
    }
    const note = formatVenmoNote(splitData.note, name);
    return preferNativeApp
      ? generateVenmoLink(phoneNumber, splitData.amounts[index], note)
      : generateVenmoWebLink(phoneNumber, splitData.amounts[index], note);
  };

  const meta = [
    splitData.date ? formatDisplayDate(splitData.date) : null,
    personCountLabel(splitData.names.length),
  ].filter(Boolean);

  return (
    <Card className="gap-0 py-0">
      <CardHeader className="gap-4 px-5 py-5 sm:px-6 sm:py-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight text-balance">
            {splitData.note}
          </h1>
          <CardDescription>{meta.join(" · ")}</CardDescription>
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-3xl font-semibold tracking-tight tabular-nums">
            {formatCurrency(splitData.total, splitData.currency)}
          </p>
          <p className="text-sm text-muted-foreground">Total</p>
        </div>
      </CardHeader>
      <CardContent className="px-0 pb-2">
        <section aria-labelledby="split-amounts-heading">
          <h2 id="split-amounts-heading" className="sr-only">
            Individual amounts
          </h2>
          <ul className="flex flex-col divide-y divide-border border-t">
            {splitData.names.map((name, index) => (
              <SplitPersonRow
                key={`${name}-${index}`}
                name={name}
                amount={splitData.amounts[index]}
                currency={splitData.currency}
                venmoHref={buildVenmoHref(name, index)}
              />
            ))}
          </ul>
        </section>
        {splitData.receipts && splitData.receipts.length > 1 && (
          <section aria-labelledby="receipt-breakdown-heading" className="mt-6">
            <div className="border-t px-5 py-4 sm:px-6">
              <h2 id="receipt-breakdown-heading" className="text-lg font-semibold">
                By receipt
              </h2>
            </div>
            <div className="flex flex-col gap-4 px-0">
              {splitData.receipts.map((receipt, receiptIndex) => (
                <div key={`${receipt.label}-${receiptIndex}`}>
                  <h3 className="px-5 pb-2 text-sm font-semibold text-muted-foreground sm:px-6">
                    {receipt.label}
                  </h3>
                  <ul className="flex flex-col divide-y divide-border border-y">
                    {splitData.names.map((name, personIndex) => (
                      <SplitPersonRow
                        key={`${receiptIndex}-${name}-${personIndex}`}
                        name={name}
                        amount={receipt.amounts[personIndex]}
                        currency={splitData.currency}
                        venmoHref={null}
                      />
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        )}
      </CardContent>
    </Card>
  );
}
