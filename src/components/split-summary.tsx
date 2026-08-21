import { Button } from "@/components/ui/button";
import { type SharedSplitData } from "@/lib/split-sharing";
import { formatCurrency } from "@/lib/receipt-utils";
import { formatVenmoNote, openVenmoPayment } from "@/lib/venmo-utils";
import { formatDisplayDate } from "@/lib/date-utils";
import Image from "next/image";

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
  canPayWithVenmo,
  onPay,
}: {
  name: string;
  amount: number;
  currency: string;
  canPayWithVenmo: boolean;
  onPay: () => void;
}) {
  const formattedAmount = formatCurrency(amount, currency);

  return (
    <li className="flex items-center gap-3 py-3">
      <div
        className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium"
        aria-hidden="true"
      >
        {name.charAt(0).toUpperCase()}
      </div>
      <span className="min-w-0 flex-1 truncate font-medium">{name}</span>
      <span className="shrink-0 tabular-nums text-sm font-medium">
        {formattedAmount}
      </span>
      {canPayWithVenmo && (
        <Button
          size="sm"
          onClick={onPay}
          aria-label={`Pay ${formattedAmount} for ${name} with Venmo`}
          className="shrink-0 bg-[#008CFF] px-3 text-white hover:bg-[#0074D9]"
        >
          <Image src="/venmo.png" alt="" width={14} height={14} />
          Pay
        </Button>
      )}
    </li>
  );
}

export function SplitSummary({ splitData, phoneNumber }: SplitSummaryProps) {
  const canPayWithVenmo = Boolean(phoneNumber) && splitData.currency === "USD";
  const meta = [
    splitData.date ? formatDisplayDate(splitData.date) : null,
    personCountLabel(splitData.names.length),
  ].filter(Boolean);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-5">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight text-balance">
            {splitData.note}
          </h1>
          <p className="text-sm text-muted-foreground">{meta.join(" · ")}</p>
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-4xl font-semibold tracking-tight tabular-nums">
            {formatCurrency(splitData.total, splitData.currency)}
          </p>
          <p className="text-sm text-muted-foreground">Total</p>
        </div>
      </header>

      <section aria-labelledby="split-amounts-heading">
        <h2 id="split-amounts-heading" className="sr-only">
          Individual amounts
        </h2>
        <ul className="flex flex-col divide-y divide-border border-y">
          {splitData.names.map((name, index) => (
            <SplitPersonRow
              key={`${name}-${index}`}
              name={name}
              amount={splitData.amounts[index]}
              currency={splitData.currency}
              canPayWithVenmo={canPayWithVenmo}
              onPay={() => {
                if (!phoneNumber) return;
                openVenmoPayment(
                  phoneNumber,
                  splitData.amounts[index],
                  formatVenmoNote(splitData.note, name)
                );
              }}
            />
          ))}
        </ul>
      </section>
    </div>
  );
}
