import { type Person, type PersonItem } from '@/types';
import { formatCurrency } from '@/lib/receipt-utils';

interface PersonItemBreakdownProps {
  person: Person;
  currencyCode?: string;
}

interface ReceiptItemGroup {
  id: string;
  name: string;
  items: PersonItem[];
}

function groupItemsByReceipt(items: PersonItem[]): ReceiptItemGroup[] {
  const groups: ReceiptItemGroup[] = [];
  const indexById = new Map<string, number>();

  for (const item of items) {
    const id = item.receiptId ?? item.receiptName ?? "Receipt";
    const name = item.receiptName || "Receipt";
    const existing = indexById.get(id);
    if (existing === undefined) {
      indexById.set(id, groups.length);
      groups.push({ id, name, items: [item] });
    } else {
      groups[existing].items.push(item);
    }
  }

  return groups;
}

function hasReceiptGrouping(items: PersonItem[]): boolean {
  return items.some((item) => Boolean(item.receiptId));
}

function ItemRows({ items, currencyCode }: { items: PersonItem[]; currencyCode?: string }) {
  return (
    <ul className="flex flex-col gap-1">
      {items.map((item, index) => (
        <li key={index} className="flex items-baseline gap-2 text-sm">
          <span className="min-w-0 flex-1 truncate">{item.itemName}</span>
          {item.sharePercentage < 100 && (
            <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
              {Math.round(item.sharePercentage * 100) / 100}%
            </span>
          )}
          <span className="shrink-0 tabular-nums">
            {formatCurrency(item.amount, currencyCode)}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** One person's items plus their share of tax and tip. */
export function PersonItemBreakdown({ person, currencyCode }: PersonItemBreakdownProps) {
  if (person.items.length === 0) {
    return <p className="text-sm text-muted-foreground italic">No items assigned</p>;
  }

  const grouped = hasReceiptGrouping(person.items);
  const summary = [
    { label: "Subtotal", value: person.totalBeforeTax },
    { label: "Tax", value: person.tax },
    { label: "Tip", value: person.tip },
  ];

  return (
    <div className="flex flex-col gap-3">
      {grouped ? (
        groupItemsByReceipt(person.items).map((group) => (
          <div key={group.id} className="flex flex-col gap-1">
            <p
              data-testid="receipt-group-heading"
              className="text-xs font-medium tracking-wide text-muted-foreground uppercase"
            >
              {group.name}
            </p>
            <ItemRows items={group.items} currencyCode={currencyCode} />
          </div>
        ))
      ) : (
        <ItemRows items={person.items} currencyCode={currencyCode} />
      )}
      <dl className="flex flex-col gap-1 border-t pt-2 text-sm text-muted-foreground">
        {summary.map(({ label, value }) => (
          <div key={label} className="flex justify-between gap-2">
            <dt>{label}</dt>
            <dd className="tabular-nums">{formatCurrency(value, currencyCode)}</dd>
          </div>
        ))}
        <div className="flex justify-between gap-2 font-semibold text-foreground">
          <dt>Total</dt>
          <dd className="tabular-nums">{formatCurrency(person.finalTotal, currencyCode)}</dd>
        </div>
      </dl>
    </div>
  );
}
