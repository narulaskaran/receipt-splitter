import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Receipt, Users, Calendar, DollarSign, CreditCard } from 'lucide-react';
import { type SharedSplitData } from '@/lib/split-sharing';
import { formatCurrency } from '@/lib/receipt-utils';
import { generateVenmoLink } from '@/lib/venmo-utils';

interface SplitSummaryProps {
  splitData: SharedSplitData;
  phoneNumber?: string;
}

export function SplitSummary({ splitData, phoneNumber }: SplitSummaryProps) {
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
                <div className="flex items-center gap-3">
                  <span className="font-bold text-xl text-primary">{formatCurrency(splitData.amounts[index])}</span>
                  {phoneNumber && (
                    <Button
                      onClick={() => {
                        const note = `${splitData.note} - ${name}`;
                        const venmoLink = generateVenmoLink(phoneNumber, splitData.amounts[index], note);
                        if (venmoLink) {
                          window.open(venmoLink, '_blank', 'noopener,noreferrer');
                        }
                      }}
                      size="sm"
                      className="h-8 px-3 text-xs font-medium transition-all duration-200 hover:shadow-md active:scale-95"
                    >
                      <CreditCard className="h-3 w-3 mr-1" />
                      Venmo
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>


      </CardContent>
    </Card>
  );
}