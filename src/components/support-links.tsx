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
  const className = "min-h-[44px] inline-flex items-center px-2";

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
      <a className={className} href={privacy}>
        Privacy
      </a>
      <a className={className} href={support}>
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
    <div className="rounded-2xl bg-card px-4 py-3 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2.5 min-w-0">
        <Heart className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        <p className="text-sm text-muted-foreground">{children}</p>
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
