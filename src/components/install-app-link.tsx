"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useInstallPrompt } from "@/lib/use-install-prompt";

// A quiet footer link, like the Ko-fi one. Renders nothing when the app is
// already installed or the browser has no install flow.
export function InstallAppLink() {
  const { method, promptInstall } = useInstallPrompt();
  const [showInstructions, setShowInstructions] = useState(false);

  if (!method) return null;

  return (
    <>
      <button
        type="button"
        onClick={() =>
          method === "prompt" ? void promptInstall() : setShowInstructions(true)
        }
        className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors"
      >
        <Download className="h-3.5 w-3.5" aria-hidden="true" />
        Install app
      </button>

      <Dialog open={showInstructions} onOpenChange={setShowInstructions}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Add to Home Screen</DialogTitle>
            <DialogDescription>
              Open your browser&apos;s Share menu, then choose &quot;Add to
              Home Screen&quot;. Receipt Splitter will open like an app and
              work offline. If you opened this link inside another app (such
              as an email or social app), open it in Safari first.
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </>
  );
}
