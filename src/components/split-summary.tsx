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
    <Card className="w-full transition-all duration-300 hover:shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-3 text-xl sm:text-2xl">
          <div className="p-2 rounded-lg bg-primary/10">
            <Receipt className="h-6 w-6 text-primary" />
          </div>
          Split Summary
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Info Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
          {/* Note/Description Info - Always displayed since it's required */}
          <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-xl transition-all duration-200 hover:bg-muted/70">
            <div className="p-2 rounded-lg bg-background">
              <Receipt className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-muted-foreground mb-1">Description</p>
              <p className="font-semibold truncate">{splitData.note}</p>
            </div>
          </div>
          
          {/* Date Info - Optional field */}
          {splitData.date && (
            <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-xl transition-all duration-200 hover:bg-muted/70">
              <div className="p-2 rounded-lg bg-background">
                <Calendar className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-muted-foreground mb-1">Date</p>
                <p className="font-semibold">{formatDate(splitData.date)}</p>
              </div>
            </div>
          )}
          
          {/* Total Amount */}
          <div className="flex items-center gap-4 p-4 bg-gradient-to-br from-primary/10 to-primary/5 rounded-xl border border-primary/20 transition-all duration-200 hover:border-primary/30">
            <div className="p-2 rounded-lg bg-primary/20">
              <DollarSign className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-muted-foreground mb-1">Total Bill</p>
              <p className="font-bold text-xl text-primary">{formatCurrency(splitData.total)}</p>
            </div>
          </div>
          
          {/* People Count */}
          <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-xl transition-all duration-200 hover:bg-muted/70">
            <div className="p-2 rounded-lg bg-background">
              <Users className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-muted-foreground mb-1">Split Among</p>
              <p className="font-semibold">
                {splitData.names.length} {splitData.names.length === 1 ? 'person' : 'people'}
              </p>
            </div>
          </div>
        </div>

        {/* Individual Breakdown */}
        <div className="space-y-4">
          <h3 className="font-semibold text-lg flex items-center gap-3">
            <div className="p-1 rounded-lg bg-primary/10">
              <Users className="h-5 w-5 text-primary" />
            </div>
            Individual Breakdown
          </h3>
          <div className="space-y-3">
            {splitData.names.map((name, index) => (
              <div 
                key={`${name}-${index}`}
                className="flex justify-between items-center py-4 px-4 bg-gradient-to-r from-muted/40 to-muted/20 rounded-xl hover:from-muted/60 hover:to-muted/40 transition-all duration-200 active:scale-[0.98]"
              >
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-sm font-semibold text-primary">{name[0]}</span>
                  </div>
                  <span className="font-semibold text-base">{name}</span>
                </div>
                <span className="font-bold text-xl text-primary">{formatCurrency(splitData.amounts[index])}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Verification Note */}
        <div className="p-4 bg-gradient-to-r from-blue-50/80 to-blue-50/40 dark:from-blue-950/30 dark:to-blue-950/10 rounded-xl border border-blue-200/50 dark:border-blue-800/50">
          <p className="text-sm text-blue-700 dark:text-blue-300 text-center">
            <strong>✓ Verification:</strong> Individual amounts add up to {formatCurrency(splitData.amounts.reduce((sum, amount) => sum + amount, 0))}
            {Math.abs(splitData.amounts.reduce((sum, amount) => sum + amount, 0) - splitData.total) < 0.01 && 
              ' (matches total bill)'
            }
          </p>
        </div>
      </CardContent>
    </Card>
  );
}