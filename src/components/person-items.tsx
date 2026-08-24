import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Table, 
  TableHeader, 
  TableBody, 
  TableRow, 
  TableHead, 
  TableCell 
} from '@/components/ui/table';
import { type Person, type PersonItem } from '@/types';
import { formatCurrency } from '@/lib/receipt-utils';
import { type SessionCurrencyTotals } from '@/lib/receipt-utils';

interface PersonItemsProps {
  people: Person[];
  currencyCode?: string;
  currencyGroups?: SessionCurrencyTotals[];
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

function renderItemRows(items: PersonItem[], currencyCode?: string, keyPrefix = "") {
  return items.map((item, index) => (
    <TableRow key={`${keyPrefix}${index}`}>
      <TableCell>{item.itemName}</TableCell>
      <TableCell className="text-right">{item.sharePercentage}%</TableCell>
      <TableCell className="text-right">{formatCurrency(item.amount, currencyCode)}</TableCell>
    </TableRow>
  ));
}

export function PersonItems({ people, currencyCode, currencyGroups }: PersonItemsProps) {
  const [expandedPerson, setExpandedPerson] = useState<string | null>(null);
  
  // Toggle the expanded/collapsed state
  const toggleExpand = (personId: string) => {
    if (expandedPerson === personId) {
      setExpandedPerson(null);
    } else {
      setExpandedPerson(personId);
    }
  };
  
  if (people.length === 0) {
    return null;
  }

  const displayGroups = currencyGroups?.length
    ? currencyGroups
    : [{ currency: currencyCode ?? "USD", people }];

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-xl">Item Breakdown</CardTitle>
      </CardHeader>
      
      <CardContent>
        <div className="flex flex-col gap-6">
          {displayGroups.map((currencyGroup) => (
            <section key={currencyGroup.currency} className="flex flex-col gap-4">
              {displayGroups.length > 1 ? (
                <h2 className="font-semibold">{currencyGroup.currency}</h2>
              ) : null}
              {currencyGroup.people.map(person => {
            const displayCurrency = currencyGroup.currency;
            const grouped = hasReceiptGrouping(person.items);
            const groups = grouped ? groupItemsByReceipt(person.items) : [];

            return (
            <div key={`${currencyGroup.currency}-${person.id}`} className="border rounded-md">
              <div 
                className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-muted"
                onClick={() => toggleExpand(person.id)}
              >
                <div className="font-medium">{person.name}</div>
                <div className="flex items-center gap-3">
                  <span className="font-bold">{formatCurrency(person.finalTotal, displayCurrency)}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="p-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleExpand(person.id);
                    }}
                  >
                    {expandedPerson === person.id ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
              
              {expandedPerson === person.id && (
                <div className="px-4 pb-4">
                  {person.items.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic">No items assigned</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Item</TableHead>
                          <TableHead className="text-right">Share</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {grouped
                          ? groups.flatMap((group) => [
                              <TableRow key={`${group.id}-heading`}>
                                <TableCell
                                  colSpan={3}
                                  data-testid="receipt-group-heading"
                                  className="font-medium bg-muted/50"
                                >
                                  {group.name}
                                </TableCell>
                              </TableRow>,
                              ...renderItemRows(group.items, displayCurrency, `${group.id}-`),
                            ])
                          : renderItemRows(person.items, displayCurrency)}
                        <TableRow>
                          <TableCell colSpan={2} className="font-medium">Subtotal</TableCell>
                          <TableCell className="text-right">{formatCurrency(person.totalBeforeTax, displayCurrency)}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell colSpan={2} className="font-medium">Tax</TableCell>
                          <TableCell className="text-right">{formatCurrency(person.tax, displayCurrency)}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell colSpan={2} className="font-medium">Tip</TableCell>
                          <TableCell className="text-right">{formatCurrency(person.tip, displayCurrency)}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell colSpan={2} className="font-medium">Total</TableCell>
                          <TableCell className="text-right font-bold">{formatCurrency(person.finalTotal, displayCurrency)}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  )}
                </div>
              )}
            </div>
              );
            })}
            </section>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
