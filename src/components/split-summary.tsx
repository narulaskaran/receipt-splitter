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
import { getPlatform } from "@/lib/platform";
import { formatDisplayDate } from "@/lib/date-utils";
import Image from "next/image";
import { toast } from "sonner";
import { useEffect, useState, type MouseEvent } from "react";

const PAYMENT_DETAILS_OMITTED_NOTE =
  "Payment details weren't included — pay however you prefer.";

const VENMO_APP_MISSING_TOAST =
  "Venmo app not found — opening Venmo on the web";

interface SplitSummaryProps {
  splitData: SharedSplitData;
  phoneNumber?: string;
}

function personCountLabel(count: number): string {
  return `${count} ${count === 1 ? "person" : "people"}`;
}

async function openNativeVenmoPayment(
  href: string,
  webHref: string | null
): Promise<void> {
  const outcome = await getPlatform().openExternalUrl(href);
  if (outcome === "unavailable" && href.startsWith("venmo://") && webHref) {
    toast.info(VENMO_APP_MISSING_TOAST);
    await getPlatform().openExternalUrl(webHref);
  }
}

function SplitPersonRow({
  name,
  amount,
  currency,
  venmoHref,
  venmoWebHref,
}: {
  name: string;
  amount: number;
  currency: string;
  venmoHref: string | null;
  venmoWebHref: string | null;
}) {
  const formattedAmount = formatCurrency(amount, currency);

  const onPayClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!getPlatform().isNative || !venmoHref) return;
    event.preventDefault();
    void openNativeVenmoPayment(venmoHref, venmoWebHref);
  };

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 px-[20px] py-3 sm:flex-nowrap sm:px-6">
      <div className="flex min-w-[min(100%,8rem)] flex-1 items-center gap-3">
        <div
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium"
          aria-hidden="true"
        >
          {name.charAt(0).toUpperCase()}
        </div>
        <span className="min-w-0 break-words font-medium">{name}</span>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <span className="tabular-nums font-medium">{formattedAmount}</span>
        {venmoHref && (
        <Button
          size="sm"
          asChild
          className="shrink-0 bg-[#005A9E] px-3 text-white hover:bg-[#004E8C]"
        >
          <a
            href={venmoHref}
            aria-label={`Pay ${formattedAmount} for ${name} with Venmo`}
            onClick={onPayClick}
          >
            <Image src="/venmo.png" alt="" width={14} height={14} />
            Pay
          </a>
        </Button>
        )}
      </div>
    </li>
  );
}

export function SplitSummary({ splitData, phoneNumber }: SplitSummaryProps) {
  const paymentPhone = phoneNumber?.trim() ? phoneNumber.trim() : undefined;
  const canPayWithVenmo = Boolean(paymentPhone) && splitData.currency === "USD";

  // `navigator` is unavailable during SSR, so default to the native app scheme
  // (matching the server render) and switch desktop browsers to the web
  // compose URL after hydration. Without this, desktop visitors clicking Pay
  // would hit a bare `venmo://` href that the browser cannot handle.
  const [preferNativeApp, setPreferNativeApp] = useState(true);
  useEffect(() => {
    setPreferNativeApp(isVenmoAppPreferred());
  }, []);

  const venmoLinksFor = (
    name: string,
    index: number
  ): { href: string | null; webHref: string | null } => {
    if (!canPayWithVenmo || !paymentPhone) {
      return { href: null, webHref: null };
    }
    const note = formatVenmoNote(splitData.note, name);
    const amount = splitData.amounts[index];
    const appHref = generateVenmoLink(paymentPhone, amount, note);
    const webHref = generateVenmoWebLink(paymentPhone, amount, note);
    return {
      href: preferNativeApp ? appHref : webHref,
      webHref,
    };
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
            {splitData.names.map((name, index) => {
              const links = venmoLinksFor(name, index);
              return (
                <SplitPersonRow
                  key={`${name}-${index}`}
                  name={name}
                  amount={splitData.amounts[index]}
                  currency={splitData.currency}
                  venmoHref={links.href}
                  venmoWebHref={links.webHref}
                />
              );
            })}
          </ul>
          {!paymentPhone && (
            <p className="px-5 pt-3 pb-1 text-sm text-muted-foreground sm:px-6">
              {PAYMENT_DETAILS_OMITTED_NOTE}
            </p>
          )}
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
                        venmoWebHref={null}
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
