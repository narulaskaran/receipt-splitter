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
      // Parse URL parameters
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

      // Validate the parsed data
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

  // Handle Venmo payment
  const handlePayment = async (personName: string, amount: number) => {
    if (!state.splitData?.phone) {
      alert('No phone number available for Venmo payments. Please check the split link.');
      return;
    }

    setState(prev => ({ ...prev, paymentLoading: personName }));

    try {
      const note = formatVenmoNote(state.splitData.restaurant, personName);
      await shareVenmoPayment(state.splitData.phone, amount, note, personName);
    } catch (error) {
      console.error('Payment error:', error);
      alert('Failed to open Venmo payment. Please check the phone number and try again.');
    } finally {
      setState(prev => ({ ...prev, paymentLoading: null }));
    }
  };

  // Loading state
  if (state.isLoading) {
    return (
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
    );
  }

  // Error state
  if (state.error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md mx-4">
          <CardContent className="flex flex-col items-center justify-center py-8">
            <AlertCircle className="h-12 w-12 text-destructive mb-4" />
            <h2 className="text-lg font-semibold mb-2 text-center">
              Unable to Load Split
            </h2>
            <p className="text-sm text-muted-foreground text-center mb-6">
              {state.error}
            </p>
            <div className="flex flex-col gap-3 w-full">
              <Button variant="outline" asChild className="w-full">
                <Link href="/">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Create New Split
                </Link>
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
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Receipt Split</h1>
            <p className="text-sm text-muted-foreground">
              Review the split details and pay your amount
            </p>
          </div>
        </div>

        {/* Split Summary Component */}
        <div className="mb-8">
          <SplitSummary splitData={splitData} />
        </div>

        {/* Payment Cards */}
        <PaymentCardsList 
          names={splitData.names}
          amounts={splitData.amounts}
          onPaymentClick={splitData.phone ? handlePayment : undefined}
          isPaymentEnabled={!!splitData.phone && !state.paymentLoading}
          paymentButtonText={
            state.paymentLoading 
              ? 'Processing...' 
              : splitData.phone 
                ? 'Pay with Venmo' 
                : 'Phone Required'
          }
        />

        {/* Footer with info */}
        <div className="mt-8 p-4 bg-muted rounded-lg">
          {splitData.phone ? (
            <div className="text-center">
              <p className="text-sm text-muted-foreground">
                ✓ Venmo payments enabled
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Payments will be sent to: {splitData.phone}
              </p>
            </div>
          ) : (
            <div className="text-center">
              <p className="text-sm text-muted-foreground">
                ⚠️ No phone number provided in this split link
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Venmo payments require a phone number to be included when sharing the split
              </p>
            </div>
          )}
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