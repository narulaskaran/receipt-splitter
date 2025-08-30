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
            We encountered an error while loading the receipt split. This could be due to:
          </p>
          <ul className="text-sm text-muted-foreground mb-6 space-y-1">
            <li>• Invalid or corrupted URL parameters</li>
            <li>• Network connectivity issues</li>
            <li>• Temporary server problems</li>
          </ul>
          <div className="flex flex-col gap-3 w-full">
            <Button 
              onClick={reset} 
              className="w-full h-11 text-base transition-all duration-200 active:scale-95"
            >
              <RotateCcw className="h-5 w-5 mr-2" />
              Try Again
            </Button>
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