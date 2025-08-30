import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { User, DollarSign, CreditCard } from 'lucide-react';
import { formatCurrency } from '@/lib/receipt-utils';

interface PaymentCardProps {
  name: string;
  amount: number;
  onPaymentClick?: () => void;
  isPaymentEnabled?: boolean;
  paymentButtonText?: string;
  className?: string;
}

export function PaymentCard({ 
  name, 
  amount, 
  onPaymentClick,
  isPaymentEnabled = false,
  paymentButtonText = 'Pay Now',
  className = ''
}: PaymentCardProps) {
  return (
    <Card className={`w-full transition-all duration-200 hover:shadow-md ${className}`}>
      <CardContent className="p-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          {/* Person Info */}
          <div className="flex items-center gap-3 flex-1">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">{name}</h3>
              <p className="text-sm text-muted-foreground">Amount owed</p>
            </div>
          </div>

          {/* Amount Display */}
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <span className="text-2xl font-bold text-primary">
                  {formatCurrency(amount)}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Including tax & tip
              </p>
            </div>

            {/* Payment Button */}
            {onPaymentClick && (
              <Button
                onClick={onPaymentClick}
                disabled={!isPaymentEnabled}
                className="min-w-[120px] flex items-center gap-2"
                size="lg"
              >
                <CreditCard className="h-4 w-4" />
                {paymentButtonText}
              </Button>
            )}
          </div>
        </div>

        {/* Additional Info Bar */}
        <div className="mt-4 pt-4 border-t border-border/50">
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">
              Payment for {name}
            </span>
            <div className="flex items-center gap-2 text-muted-foreground">
              <div className="h-2 w-2 rounded-full bg-green-500" />
              <span>Ready to pay</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface PaymentCardsListProps {
  names: string[];
  amounts: number[];
  onPaymentClick?: (name: string, amount: number) => void;
  isPaymentEnabled?: boolean;
  paymentButtonText?: string;
}

export function PaymentCardsList({ 
  names, 
  amounts, 
  onPaymentClick,
  isPaymentEnabled = false,
  paymentButtonText = 'Pay Now'
}: PaymentCardsListProps) {
  if (names.length !== amounts.length) {
    console.error('PaymentCardsList: names and amounts arrays must have the same length');
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <CreditCard className="h-5 w-5" />
        <h2 className="text-lg font-semibold">Individual Payments</h2>
      </div>
      
      {names.map((name, index) => (
        <PaymentCard
          key={`${name}-${index}`}
          name={name}
          amount={amounts[index]}
          onPaymentClick={onPaymentClick ? () => onPaymentClick(name, amounts[index]) : undefined}
          isPaymentEnabled={isPaymentEnabled}
          paymentButtonText={paymentButtonText}
        />
      ))}
      
      {/* Summary Footer */}
      <div className="mt-6 p-4 bg-muted/50 rounded-lg">
        <div className="flex justify-between items-center">
          <span className="font-medium">Total for all payments:</span>
          <span className="font-bold text-lg">
            {formatCurrency(amounts.reduce((sum, amount) => sum + amount, 0))}
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Each person pays their individual amount directly
        </p>
      </div>
    </div>
  );
}