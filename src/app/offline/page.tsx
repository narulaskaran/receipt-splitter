"use client";

import Link from "next/link";
import { WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";

// Precached by the service worker and shown when a page isn't available
// offline. Shared split links fall back to the /split shell instead.
export default function OfflinePage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="flex w-full max-w-sm flex-col items-center gap-4 text-center">
        <WifiOff className="h-10 w-10 text-muted-foreground" />
        <div className="flex flex-col gap-2">
          <h1 className="text-lg font-semibold">You&apos;re offline</h1>
          <p className="text-sm text-muted-foreground">
            This page isn&apos;t saved on your device yet. Reconnect and try
            again. Your current split is saved here and will still be waiting.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/">Back to your split</Link>
          </Button>
          <Button onClick={() => window.location.reload()}>Try again</Button>
        </div>
      </div>
    </div>
  );
}
