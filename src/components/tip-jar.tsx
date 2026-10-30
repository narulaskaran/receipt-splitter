"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { getPlatform } from "@/lib/platform";
import type { TipJar as TipJarApi, TipProduct } from "@/lib/platform";

type Phase = "idle" | "loading" | "purchasing" | "success" | "pending";

const UNAVAILABLE = "Tips aren't available right now";

function TipJarPanel({ tips }: { tips: TipJarApi }) {
  const [open, setOpen] = useState(false);
  const [products, setProducts] = useState<TipProduct[] | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setPhase("loading");
    setNotice(null);
    void tips.loadProducts().then((loaded) => {
      if (cancelled) return;
      setProducts(loaded);
      setPhase("idle");
    });
    return () => {
      cancelled = true;
    };
  }, [open, tips]);

  const busy = phase === "loading" || phase === "purchasing";

  async function onPurchase(productId: string) {
    setPhase("purchasing");
    setNotice(null);
    const result = await tips.purchase(productId);
    if (result.status === "success") {
      setPhase("success");
      setNotice("Thank you!");
      return;
    }
    if (result.status === "pending") {
      setPhase("pending");
      setNotice("Waiting for approval…");
      return;
    }
    if (result.status === "cancelled") {
      setPhase("idle");
      return;
    }
    if (result.status === "unavailable") {
      setPhase("idle");
      setNotice(UNAVAILABLE);
      return;
    }
    setPhase("idle");
    toast.error(result.message);
  }

  const showUnavailable = products !== null && products.length === 0 && phase !== "loading";

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="min-h-[44px] flex-shrink-0">
          Leave a tip
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <SheetHeader>
          <SheetTitle>Leave a tip</SheetTitle>
          <SheetDescription>
            Optional, and you can tip again anytime. Tips don&apos;t unlock anything. The app stays free.
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-2 px-4">
          {phase === "loading" && (
            <p role="status" className="text-sm text-muted-foreground">
              Loading prices…
            </p>
          )}
          {(showUnavailable || notice === UNAVAILABLE) && phase !== "loading" && (
            <p role="status" className="text-sm text-muted-foreground">
              {UNAVAILABLE}
            </p>
          )}
          {notice && notice !== UNAVAILABLE && (
            <p role="status" className="text-sm text-foreground">
              {notice}
            </p>
          )}
          {products?.map((product) => (
            <Button
              key={product.id}
              type="button"
              variant="outline"
              className="min-h-[44px] w-full justify-between"
              disabled={busy}
              onClick={() => void onPurchase(product.id)}
            >
              <span>{product.displayName}</span>
              <span>{product.displayPrice}</span>
            </Button>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** Renders nothing where the platform has no tip jar (the web Ko-fi link). */
export function TipJar() {
  const tips = getPlatform().tips;
  if (!tips) return null;
  return <TipJarPanel tips={tips} />;
}
