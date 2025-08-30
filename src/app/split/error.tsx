'use client';

import { useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, ArrowLeft, RotateCcw } from 'lucide-react';
import Link from 'next/link';

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function SplitError({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    // Log the error for debugging
    console.error('Split page error:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="w-full max-w-md mx-4">
        <CardContent className="flex flex-col items-center justify-center py-8">
          <AlertCircle className="h-12 w-12 text-destructive mb-4" />
          <h2 className="text-lg font-semibold mb-2 text-center">
            Something went wrong
          </h2>
          <p className="text-sm text-muted-foreground text-center mb-6">
            We encountered an error while loading the receipt split. This could be due to:
          </p>
          <ul className="text-sm text-muted-foreground mb-6 space-y-1">
            <li>• Invalid or corrupted URL parameters</li>
            <li>• Network connectivity issues</li>
            <li>• Temporary server problems</li>
          </ul>
          <div className="flex flex-col gap-3 w-full">
            <Button onClick={reset} className="w-full">
              <RotateCcw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
            <Button variant="outline" asChild className="w-full">
              <Link href="/">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Create New Split
              </Link>
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