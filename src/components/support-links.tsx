import React from "react";
import { Coffee, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";

export const KOFI_URL = "https://ko-fi.com/Y8Y21CC8IA";

export const SupportFooter: React.FC = () => (
  <footer className="w-full mt-12 pt-6 border-t border-border/60 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
    <span>Free to use. No sign-up.</span>
    <a
      href={KOFI_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors"
    >
      <Coffee className="h-3.5 w-3.5" />
      Support on Ko-fi
    </a>
  </footer>
);

export const SupportCard: React.FC = () => (
  <div className="rounded-2xl bg-card p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
    <div className="flex items-start gap-3">
      <Heart className="h-5 w-5 mt-0.5 text-muted-foreground flex-shrink-0" />
      <div>
        <p className="text-sm font-medium">Saved you some math?</p>
        <p className="text-sm text-muted-foreground">
          Receipt Splitter is free. A coffee helps cover the AI costs.
        </p>
      </div>
    </div>
    <Button variant="outline" size="sm" asChild>
      <a href={KOFI_URL} target="_blank" rel="noopener noreferrer">
        <Coffee className="h-4 w-4" />
        Buy me a coffee
      </a>
    </Button>
  </div>
);
