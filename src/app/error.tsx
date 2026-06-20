'use client';

import { useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, RotateCcw } from 'lucide-react';

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function RootError({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    // Log the error for debugging
    console.error('Root error:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
        <CardContent className="flex flex-col items-center justify-center py-8 px-6">
          <div className="relative mb-6">
            <AlertCircle className="h-16 w-16 text-destructive" />
            <div className="absolute inset-0 h-16 w-16 animate-pulse rounded-full bg-destructive/10" />
          </div>
          <h2 className="text-xl font-semibold mb-3 text-center">
            Something went wrong
          </h2>
          <p className="text-sm text-muted-foreground text-center mb-6 leading-relaxed">
            We encountered an unexpected error. Please try again or start a new
            split.
          </p>
          <div className="flex flex-col gap-3 w-full">
            <Button
              onClick={reset}
              className="w-full h-11 text-base transition-all duration-200 active:scale-95"
            >
              <RotateCcw className="h-5 w-5 mr-2" />
              Try Again
            </Button>
          </div>
          {process.env.NODE_ENV === 'development' && (
            <details className="mt-4 w-full">
              <summary className="text-xs text-muted-foreground cursor-pointer">
                Error details (development only)
              </summary>
              <pre className="text-xs bg-muted p-2 rounded mt-2 overflow-auto">
                {error.message}
                {error.stack && `\n\n${error.stack}`}
              </pre>
            </details>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
