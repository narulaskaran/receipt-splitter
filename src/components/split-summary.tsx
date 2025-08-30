import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Receipt, Users, Calendar, DollarSign } from 'lucide-react';
import { type SharedSplitData } from '@/lib/split-sharing';
import { formatCurrency } from '@/lib/receipt-utils';

interface SplitSummaryProps {
  splitData: SharedSplitData;
}

export function SplitSummary({ splitData }: SplitSummaryProps) {
  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      // Check if the date is valid
      if (isNaN(date.getTime())) {
        return dateString; // Fallback to original string if invalid
      }
      return date.toLocaleDateString('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return dateString; // Fallback to original string if parsing fails
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Receipt className="h-5 w-5" />
          Split Summary
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Restaurant Info */}
          {splitData.restaurant && (
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
              <Receipt className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Restaurant</p>
                <p className="font-medium">{splitData.restaurant}</p>
              </div>
            </div>
          )}
          
          {/* Date Info */}
          {splitData.date && (
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Date</p>
                <p className="font-medium">{formatDate(splitData.date)}</p>
              </div>
            </div>
          )}
          
          {/* Total Amount */}
          <div className="flex items-center gap-3 p-3 bg-primary/10 rounded-lg">
            <DollarSign className="h-4 w-4 text-primary" />
            <div>
              <p className="text-sm text-muted-foreground">Total Bill</p>
              <p className="font-bold text-lg">{formatCurrency(splitData.total)}</p>
            </div>
          </div>
          
          {/* People Count */}
          <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
            <Users className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">Split Among</p>
              <p className="font-medium">
                {splitData.names.length} {splitData.names.length === 1 ? 'person' : 'people'}
              </p>
            </div>
          </div>
        </div>

        {/* Individual Breakdown */}
        <div className="mt-6">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <Users className="h-4 w-4" />
            Individual Breakdown
          </h3>
          <div className="space-y-2">
            {splitData.names.map((name, index) => (
              <div 
                key={`${name}-${index}`}
                className="flex justify-between items-center py-2 px-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors"
              >
                <span className="font-medium">{name}</span>
                <span className="font-bold text-lg">{formatCurrency(splitData.amounts[index])}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Verification Note */}
        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <p className="text-sm text-blue-700 dark:text-blue-300">
            <strong>Verification:</strong> Individual amounts add up to {formatCurrency(splitData.amounts.reduce((sum, amount) => sum + amount, 0))}
            {Math.abs(splitData.amounts.reduce((sum, amount) => sum + amount, 0) - splitData.total) < 0.01 && 
              ' ✓ (matches total bill)'
            }
          </p>
        </div>
      </CardContent>
    </Card>
  );
}