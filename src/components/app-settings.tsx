"use client";

import { Settings } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { getPublicShareOrigin } from "@/lib/app-config";
import { getPlatform } from "@/lib/platform";

const ROW_CLASS = "flex min-h-11 w-full items-center justify-between text-sm";

/**
 * Native app only: theme and the legal links that the website keeps in its
 * footer. App Store review wants the privacy policy and a contact reachable
 * from inside the app; a settings sheet keeps them off the main screens.
 */
export function AppSettings() {
  const origin = getPublicShareOrigin();
  const open = (path: string) => () => void getPlatform().openExternalUrl(`${origin}${path}`);

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Settings"
          className="h-11 w-11 shrink-0 text-muted-foreground"
        >
          <Settings className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-2xl pb-8">
        <SheetHeader>
          <SheetTitle>Settings</SheetTitle>
          <SheetDescription className="sr-only">
            Theme, privacy policy, and support.
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col px-4">
          <div className={ROW_CLASS}>
            <span>Theme</span>
            <ThemeToggle />
          </div>
          <button type="button" className={ROW_CLASS} onClick={open("/privacy")}>
            Privacy policy
          </button>
          <button type="button" className={ROW_CLASS} onClick={open("/support")}>
            Support
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
