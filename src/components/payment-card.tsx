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
    <Card className={`w-full transition-all duration-300 hover:shadow-lg active:scale-[0.98] ${className}`}>
      <CardContent className="p-4 sm:p-6">
        <div className="flex flex-col gap-4">
          {/* Person Info */}
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 transition-colors">
              <User className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-lg truncate">{name}</h3>
              <p className="text-sm text-muted-foreground">Amount owed</p>
            </div>
          </div>

          {/* Amount and Payment Section */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            {/* Amount Display */}
            <div className="flex-1">
              <div className="flex items-center gap-2 justify-center sm:justify-start">
                <DollarSign className="h-5 w-5 text-muted-foreground" />
                <span className="text-3xl sm:text-2xl font-bold text-primary">
                  {formatCurrency(amount)}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1 text-center sm:text-left">
                Including tax & tip
              </p>
            </div>

            {/* Payment Button */}
            {onPaymentClick && (
              <Button
                onClick={onPaymentClick}
                disabled={!isPaymentEnabled}
                className="w-full sm:w-auto min-w-[140px] h-12 sm:h-10 text-base sm:text-sm font-semibold transition-all duration-200 shadow-md hover:shadow-lg active:scale-95"
                size="lg"
              >
                <CreditCard className="h-5 w-5 sm:h-4 sm:w-4" />
                {paymentButtonText}
              </Button>
            )}
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
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-primary/10">
          <CreditCard className="h-6 w-6 text-primary" />
        </div>
        <h2 className="text-xl font-semibold">Individual Payments</h2>
      </div>
      
      <div className="space-y-4">
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
      </div>
      
      {/* Summary Footer */}
      <div className="mt-8 p-4 sm:p-6 bg-gradient-to-r from-muted/60 to-muted/40 rounded-xl border border-border/50">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
          <span className="font-medium text-center sm:text-left">Total for all payments:</span>
          <span className="font-bold text-xl text-primary text-center sm:text-right">
            {formatCurrency(amounts.reduce((sum, amount) => sum + amount, 0))}
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-2 text-center sm:text-left">
          Each person pays their individual amount directly
        </p>
      </div>
    </div>
  );
}