import { Share } from 'lucide-react';
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

interface ResultsSummaryProps {
  people: Person[];
  receiptName: string | null;
  receiptDate: string | null;
}

export function ResultsSummary({ people, receiptName, receiptDate }: ResultsSummaryProps) {
  // Sort people by final total (highest first)
  const sortedPeople = [...people].sort((a, b) => b.finalTotal - a.finalTotal);
  
  // Create a shareable text summary
  const createShareText = (): string => {
    let text = '';
    
    // Add receipt info
    if (receiptName) {
      text += `Receipt for ${receiptName}\n`;
    }
    
    if (receiptDate) {
      text += `Date: ${new Date(receiptDate).toLocaleDateString()}\n`;
    }
    
    text += '\nAmount owed by each person:\n';
    
    // Add each person's total
    sortedPeople.forEach(person => {
      text += `${person.name}: ${formatCurrency(person.finalTotal)}\n`;
    });
    
    return text;
  };
  
  // Share results via native sharing API or fallback to clipboard
  const shareResults = async () => {
    const text = createShareText();
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Receipt Split Results',
          text: text,
        });
      } catch (error) {
        console.error('Error sharing results:', error);
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
      alert('Results copied to clipboard!');
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      alert('Failed to copy results. Please try again.');
    }
  };

  if (people.length === 0) {
    return null;
  }

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-xl">Results Summary</CardTitle>
        <Button 
          variant="outline" 
          size="sm" 
          className="flex items-center gap-1"
          onClick={shareResults}
        >
          <Share className="h-4 w-4" />
          <span>Share</span>
        </Button>
      </CardHeader>
      
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Person</TableHead>
              <TableHead className="text-right">Subtotal</TableHead>
              <TableHead className="text-right">Tax</TableHead>
              <TableHead className="text-right">Tip</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedPeople.map((person) => (
              <TableRow key={person.id}>
                <TableCell className="font-medium">{person.name}</TableCell>
                <TableCell className="text-right">{formatCurrency(person.totalBeforeTax)}</TableCell>
                <TableCell className="text-right">{formatCurrency(person.tax)}</TableCell>
                <TableCell className="text-right">{formatCurrency(person.tip)}</TableCell>
                <TableCell className="text-right font-bold">{formatCurrency(person.finalTotal)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}