"use client";

import type { MouseEvent } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getPublicShareOrigin } from "@/lib/app-config";
import { getPlatform } from "@/lib/platform";

export function AiConsentDialog({
  open,
  onAccept,
  onDecline,
}: {
  open: boolean;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const origin = getPublicShareOrigin();
  // On iOS target="_blank" links are not reliable inside the WebView; hand
  // them to the system browser instead.
  const openLink = (url: string) => (event: MouseEvent) => {
    const platform = getPlatform();
    if (!platform.isNative) return;
    event.preventDefault();
    void platform.openExternalUrl(url);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onDecline();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send this receipt to be read?</DialogTitle>
          <DialogDescription>
            The receipt image, PDF, or pasted link is sent to our server and
            read by an AI provider (Anthropic by default). For a pasted link, a
            screenshot of the page is taken by a third-party service
            (Firecrawl). The server may keep a copy for about 90 days and may
            forward the receipt details to the operator. An approximate
            location is derived from your IP address.
          </DialogDescription>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          <a
            href={`${origin}/privacy`}
            onClick={openLink(`${origin}/privacy`)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 min-w-11 items-center underline underline-offset-4"
          >
            Privacy policy
          </a>
          {" · "}
          <a
            href={`${origin}/support`}
            onClick={openLink(`${origin}/support`)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 min-w-11 items-center underline underline-offset-4"
          >
            Support
          </a>
        </p>
        <DialogFooter>
          <Button type="button" variant="outline" className="min-h-11" onClick={onDecline}>
            Don&apos;t send
          </Button>
          <Button type="button" className="min-h-11" onClick={onAccept}>
            Agree and continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
