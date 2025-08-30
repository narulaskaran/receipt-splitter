'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, ArrowLeft, Loader2 } from 'lucide-react';
import { deserializeSplitData, validateSplitData, type SharedSplitData } from '@/lib/split-sharing';

import { SplitSummary } from '@/components/split-summary';
import Link from 'next/link';

interface SplitPageState {
  splitData: SharedSplitData | null;
  isLoading: boolean;
  error: string | null;
}

function SplitPageContent() {
  const searchParams = useSearchParams();
  const [state, setState] = useState<SplitPageState>({
    splitData: null,
    isLoading: true,
    error: null,
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
        });
        return;
      }

      // Validate the parsed data using enhanced validation
      if (!validateSplitData(splitData)) {
        setState({
          splitData: null,
          isLoading: false,
          error: 'The split data is invalid. The amounts may not add up correctly or contain invalid values.',
        });
        return;
      }

      // Success - valid split data
      setState({
        splitData,
        isLoading: false,
        error: null,
      });
    } catch {
      setState({
        splitData: null,
        isLoading: false,
        error: 'An unexpected error occurred while processing the split data. Please check the link and try again.',
      });
    }
  }, [searchParams]);

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
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8 max-w-4xl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-8">
          <Button 
            variant="ghost" 
            size="sm" 
            asChild 
            className="self-start h-10 px-3 transition-all duration-200 hover:bg-muted active:scale-95"
          >
            <Link href="/">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to App
            </Link>
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl sm:text-3xl font-bold mb-1">Receipt Split</h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              Review the split details and pay your amount
            </p>
          </div>
        </div>

        {/* Split Summary */}
        <SplitSummary splitData={splitData} phoneNumber={splitData.phone} />


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