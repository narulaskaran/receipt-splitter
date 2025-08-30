'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, ArrowLeft, Loader2 } from 'lucide-react';
import { deserializeSplitData, validateSplitData, type SharedSplitData } from '@/lib/split-sharing';
import { SplitSummary } from '@/components/split-summary';
import { PaymentCardsList } from '@/components/payment-card';
import { shareVenmoPayment, formatVenmoNote } from '@/lib/venmo-utils';
import Link from 'next/link';

interface SplitPageState {
  splitData: SharedSplitData | null;
  isLoading: boolean;
  error: string | null;
  paymentLoading: string | null; // personName currently processing payment
}

function SplitPageContent() {
  const searchParams = useSearchParams();
  const [state, setState] = useState<SplitPageState>({
    splitData: null,
    isLoading: true,
    error: null,
    paymentLoading: null,
  });

  useEffect(() => {
    try {
      // Parse URL parameters using split-sharing utilities
      const splitData = deserializeSplitData(searchParams);
      
      if (!splitData) {
        setState({
          splitData: null,
          isLoading: false,
          error: 'Invalid or missing split data in URL. The link may be corrupted or incomplete.',
          paymentLoading: null,
        });
        return;
      }

      // Validate the parsed data using enhanced validation
      if (!validateSplitData(splitData)) {
        setState({
          splitData: null,
          isLoading: false,
          error: 'The split data is invalid. The amounts may not add up correctly or contain invalid values.',
          paymentLoading: null,
        });
        return;
      }

      // Success - valid split data
      setState({
        splitData,
        isLoading: false,
        error: null,
        paymentLoading: null,
      });
    } catch {
      setState({
        splitData: null,
        isLoading: false,
        error: 'An unexpected error occurred while processing the split data. Please check the link and try again.',
        paymentLoading: null,
      });
    }
  }, [searchParams]);

  // Handle Venmo payment with enhanced mobile UX
  const handlePayment = async (personName: string, amount: number) => {
    if (!state.splitData?.phone) {
      alert('No phone number available for Venmo payments. Please check the split link.');
      return;
    }

    setState(prev => ({ ...prev, paymentLoading: personName }));

    try {
      const note = formatVenmoNote(state.splitData.note, personName);
      await shareVenmoPayment(state.splitData.phone, amount, note, personName);
    } catch (error) {
      console.error('Payment error:', error);
      alert('Failed to open Venmo payment. Please check the phone number and try again.');
    } finally {
      setState(prev => ({ ...prev, paymentLoading: null }));
    }
  };

  // Loading state with enhanced design
  if (state.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
          <CardContent className="flex flex-col items-center justify-center py-8 px-6">
            <div className="relative mb-6">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <div className="absolute inset-0 h-12 w-12 animate-ping rounded-full bg-primary/20" />
            </div>
            <h2 className="text-xl font-semibold mb-3 text-center">Loading Split Details</h2>
            <p className="text-sm text-muted-foreground text-center leading-relaxed">
              Processing your receipt split and payment information...
            </p>
            <div className="mt-4 w-full bg-muted/50 rounded-full h-1">
              <div className="bg-primary h-1 rounded-full animate-pulse" style={{ width: '60%' }} />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state with enhanced design and helpful information
  if (state.error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
          <CardContent className="flex flex-col items-center justify-center py-8 px-6">
            <div className="relative mb-6">
              <AlertCircle className="h-16 w-16 text-destructive" />
              <div className="absolute inset-0 h-16 w-16 animate-pulse rounded-full bg-destructive/10" />
            </div>
            <h2 className="text-xl font-semibold mb-3 text-center">
              Unable to Load Split
            </h2>
            <p className="text-sm text-muted-foreground text-center mb-6 leading-relaxed">
              {state.error}
            </p>
            
            {/* Help Tips */}
            <div className="w-full mb-6 p-4 bg-muted/50 rounded-lg">
              <p className="text-xs font-medium text-muted-foreground mb-2">Common solutions:</p>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• Check if the URL was copied completely</li>
                <li>• Ensure the original split was created successfully</li>
                <li>• Try refreshing the page</li>
              </ul>
            </div>
            
            <div className="flex flex-col gap-3 w-full">
              <Button 
                variant="outline" 
                asChild 
                className="w-full h-11 text-base transition-all duration-200 hover:bg-muted active:scale-95"
              >
                <Link href="/">
                  <ArrowLeft className="h-5 w-5 mr-2" />
                  Create New Split
                </Link>
              </Button>
              
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => window.location.reload()}
                className="w-full transition-all duration-200"
              >
                Try Refreshing Page
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Success state - split data loaded
  const { splitData } = state;
  if (!splitData) {
    return null; // This shouldn't happen, but TypeScript safety
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/20">
      <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8 max-w-4xl">
        {/* Header with enhanced mobile design */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-6 mb-8 animate-in fade-in-0 slide-in-from-top-4 duration-500">
          <Button 
            variant="ghost" 
            size="default" 
            asChild 
            className="self-start h-12 sm:h-10 px-4 sm:px-3 text-base sm:text-sm transition-all duration-200 hover:bg-muted active:scale-95 touch-manipulation"
          >
            <Link href="/">
              <ArrowLeft className="h-5 w-5 sm:h-4 sm:w-4 mr-3 sm:mr-2" />
              Back to App
            </Link>
          </Button>
          <div className="flex-1 text-center sm:text-left">
            <h1 className="text-3xl sm:text-4xl font-bold mb-2 bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">
              Receipt Split
            </h1>
            <p className="text-base sm:text-lg text-muted-foreground">
              Review the split details and pay your amount
            </p>
          </div>
        </div>

        {/* Content Container with enhanced mobile animations */}
        <div className="space-y-8">
          {/* Split Summary Component */}
          <div className="animate-in fade-in-0 slide-in-from-left-4 duration-700">
            <SplitSummary splitData={splitData} />
          </div>

          {/* Payment Cards with staggered animations */}
          <div className="animate-in fade-in-0 slide-in-from-right-4 duration-700 delay-300">
            <PaymentCardsList 
              names={splitData.names}
              amounts={splitData.amounts}
              onPaymentClick={handlePayment}
              isPaymentEnabled={!state.paymentLoading}
              paymentButtonText={
                state.paymentLoading 
                  ? 'Processing...' 
                  : 'Pay with Venmo'
              }
            />
          </div>
        </div>

        {/* Footer with enhanced mobile payment status */}
        <div className="animate-in fade-in-0 slide-in-from-bottom-6 duration-700 delay-500">
          <div className="mt-8 p-6 bg-gradient-to-r from-green-50/80 to-blue-50/40 dark:from-green-950/30 dark:to-blue-950/10 rounded-2xl border border-green-200/50 dark:border-green-800/50 shadow-sm">
            <div className="text-center space-y-3">
              <div className="flex items-center justify-center gap-3">
                <div className="h-3 w-3 rounded-full bg-green-500 animate-pulse" />
                <p className="text-base sm:text-lg font-semibold text-green-700 dark:text-green-300">
                  ✓ Ready for Venmo Payments
                </p>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Tap any &quot;Pay with Venmo&quot; button to send payment
                </p>
                <div className="bg-background/60 rounded-lg px-4 py-2 border">
                  <p className="text-xs text-muted-foreground">
                    Payments go to: <span className="font-mono text-primary">{splitData.phone}</span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SplitPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md mx-4">
          <CardContent className="flex flex-col items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <h2 className="text-lg font-semibold mb-2">Loading Split Details</h2>
            <p className="text-sm text-muted-foreground text-center">
              Processing your receipt split...
            </p>
          </CardContent>
        </Card>
      </div>
    }>
      <SplitPageContent />
    </Suspense>
  );
}