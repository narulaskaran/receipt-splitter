"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle, ArrowLeft, Loader2 } from "lucide-react";
import {
  deserializeSplitData,
  validateSplitDataDetailed,
  type SharedSplitData,
} from "@/lib/split-sharing";

import { SplitSummary } from "@/components/split-summary";
import { SupportBanner } from "@/components/support-links";

interface SplitPageState {
  splitData: SharedSplitData | null;
  isLoading: boolean;
  error: string | null;
}

export function SplitStatusScreen({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="flex w-full max-w-sm flex-col items-center gap-4 text-center">
        {icon}
        <div className="flex flex-col gap-2">
          <h1 className="text-lg font-semibold">{title}</h1>
          {children}
        </div>
      </div>
    </div>
  );
}

export type HomeLinkRender = (props: {
  children: ReactNode;
  className?: string;
}) => React.ReactElement;

export function SplitScreen({
  searchParams,
  onCreateNew,
  renderHomeLink,
}: {
  searchParams: URLSearchParams;
  /** Hash-router navigation back to the home screen (native shell). */
  onCreateNew?: () => void;
  /** Web adapter renders these actions as a next/link (or any anchor). */
  renderHomeLink?: HomeLinkRender;
}) {
  // Stabilize effect dependencies to avoid reruns from changing object identity
  const search = searchParams.toString();
  const [state, setState] = useState<SplitPageState>({
    splitData: null,
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    try {
      const splitData = deserializeSplitData(searchParams);

      if (!splitData) {
        setState({
          splitData: null,
          isLoading: false,
          error:
            "Invalid or missing split data in URL. The link may be corrupted or incomplete.",
        });
        return;
      }

      const validation = validateSplitDataDetailed(splitData);
      if (!validation.isValid) {
        setState({
          splitData: null,
          isLoading: false,
          error: validation.errorMessages.join(" "),
        });
        return;
      }

      setState({
        splitData,
        isLoading: false,
        error: null,
      });
    } catch {
      setState({
        splitData: null,
        isLoading: false,
        error:
          "An unexpected error occurred while processing the split data. Please check the link and try again.",
      });
    }
    // Using the serialized query string keeps dependency stable across renders
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const homeLink = (children: ReactNode) => {
    if (renderHomeLink) {
      return renderHomeLink({ children });
    }
    return (
      <button type="button" onClick={onCreateNew}>
        {children}
      </button>
    );
  };

  if (state.isLoading) {
    return (
      <SplitStatusScreen
        icon={
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        }
        title="Loading split"
      >
        <p className="text-sm text-muted-foreground">
          Getting payment details ready…
        </p>
      </SplitStatusScreen>
    );
  }

  if (state.error) {
    return (
      <SplitStatusScreen
        icon={<AlertCircle className="size-8 text-destructive" />}
        title="Unable to Load Split"
      >
        <p className="text-sm text-muted-foreground">{state.error}</p>
        <div className="flex w-full flex-col gap-2 pt-2">
          <Button variant="outline" asChild>
            {homeLink(
              <>
                <ArrowLeft data-icon="inline-start" />
                Create New Split
              </>
            )}
          </Button>
          <Button variant="ghost" onClick={() => window.location.reload()}>
            Refresh
          </Button>
        </div>
      </SplitStatusScreen>
    );
  }

  const { splitData } = state;
  if (!splitData) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-6 sm:py-10">
        <Button variant="ghost" size="sm" asChild className="-ml-3 self-start">
          {homeLink(
            <>
              <ArrowLeft data-icon="inline-start" />
              Back
            </>
          )}
        </Button>
        <SupportBanner />
        <SplitSummary splitData={splitData} phoneNumber={splitData.phone} />
      </div>
    </div>
  );
}
