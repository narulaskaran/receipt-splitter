import type { PlatformAdapter } from "./types";

/** Browser/PWA implementation: the pre-existing web behaviour. */
export const webPlatform: PlatformAdapter = {
  kind: "web",
  isNative: false,
  tips: null,
  showKofi: true,

  async shareText(content) {
    if (typeof navigator === "undefined" || !navigator.share) return "unsupported";
    try {
      await navigator.share(content);
      return "shared";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return "cancelled";
      }
      console.error("Error sharing:", error);
      return "unsupported";
    }
  },

  async copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (error) {
      console.error("Failed to copy to clipboard:", error);
      return false;
    }
  },

  async readClipboardText() {
    try {
      return (await navigator.clipboard.readText()) ?? null;
    } catch {
      return null;
    }
  },

  async openExternalUrl(url) {
    try {
      if (/^https?:/i.test(url)) {
        window.open(url, "_blank", "noopener,noreferrer");
      } else {
        // Custom schemes (venmo://) must be a top-level navigation from a user gesture.
        window.open(url, "_self");
      }
      return "opened";
    } catch (error) {
      console.error("Failed to open URL:", error);
      return "unavailable";
    }
  },
};
