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
import { type Person } from '@/types';
import { formatCurrency } from '@/lib/receipt-utils';

interface PersonItemsProps {
  people: Person[];
}

export function PersonItems({ people }: PersonItemsProps) {
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

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-xl">Item Breakdown</CardTitle>
      </CardHeader>
      
      <CardContent>
        <div className="space-y-4">
          {people.map(person => (
            <div key={person.id} className="border rounded-md">
              <div 
                className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-muted"
                onClick={() => toggleExpand(person.id)}
              >
                <div className="font-medium">{person.name}</div>
                <div className="flex items-center gap-3">
                  <span className="font-bold">{formatCurrency(person.finalTotal)}</span>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-7 w-7 p-0" 
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
                        {person.items.map((item, index) => (
                          <TableRow key={index}>
                            <TableCell>{item.itemName}</TableCell>
                            <TableCell className="text-right">{item.sharePercentage}%</TableCell>
                            <TableCell className="text-right">{formatCurrency(item.amount)}</TableCell>
                          </TableRow>
                        ))}
                        <TableRow>
                          <TableCell colSpan={2} className="font-medium">Subtotal</TableCell>
                          <TableCell className="text-right">{formatCurrency(person.totalBeforeTax)}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell colSpan={2} className="font-medium">Tax</TableCell>
                          <TableCell className="text-right">{formatCurrency(person.tax)}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell colSpan={2} className="font-medium">Tip</TableCell>
                          <TableCell className="text-right">{formatCurrency(person.tip)}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell colSpan={2} className="font-medium">Total</TableCell>
                          <TableCell className="text-right font-bold">{formatCurrency(person.finalTotal)}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}