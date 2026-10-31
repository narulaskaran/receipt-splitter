import React from "react";
import { Coffee, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TipJar } from "@/components/tip-jar";
import { getPublicShareOrigin } from "@/lib/app-config";
import { getPlatform } from "@/lib/platform";

export const KOFI_URL = "https://ko-fi.com/Y8Y21CC8IA";

function AboutLinks() {
  const privacy = `${getPublicShareOrigin()}/privacy`;
  const support = `${getPublicShareOrigin()}/support`;
  const native = getPlatform().isNative;
  const className = "inline-flex min-h-11 min-w-11 items-center px-2";

  if (native) {
    return (
      <>
        <button
          type="button"
          className={className}
          onClick={() => void getPlatform().openExternalUrl(privacy)}
        >
          Privacy
        </button>
        <button
          type="button"
          className={className}
          onClick={() => void getPlatform().openExternalUrl(support)}
        >
          Support
        </button>
      </>
    );
  }

  return (
    <>
      {/* Root-relative on web: same origin as the page (previews, offline
          shell) and identical on server and client, unlike the public origin. */}
      <a className={className} href="/privacy">
        Privacy
      </a>
      <a className={className} href="/support">
        Support
      </a>
    </>
  );
}

export const SupportFooter: React.FC<{ children?: React.ReactNode }> = ({ children }) => (
  <footer className="w-full mt-12 pt-6 border-t border-border/60 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
    <span>Free to use. No sign-up.</span>
    <div className="flex flex-wrap items-center justify-center gap-2">
      <AboutLinks />
      {children}
    </div>
  </footer>
);

export const SupportBanner: React.FC<{ children?: React.ReactNode }> = ({
  children = "Free to use. A coffee helps cover our costs.",
}) => {
  const showKofi = getPlatform().showKofi;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-card px-[16px] py-3">
      <div className="flex min-w-[min(100%,10rem)] flex-1 items-start gap-2.5">
        <Heart className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <p className="min-w-0 break-words text-sm text-muted-foreground">{children}</p>
      </div>
      {showKofi ? (
        <Button variant="outline" size="sm" asChild className="flex-shrink-0">
          <a href={KOFI_URL} target="_blank" rel="noopener noreferrer">
            <Coffee className="h-4 w-4" />
            Tip
          </a>
        </Button>
      ) : (
        <TipJar />
      )}
    </div>
  );
};
