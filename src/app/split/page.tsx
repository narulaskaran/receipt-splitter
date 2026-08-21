"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle, ArrowLeft, Loader2 } from "lucide-react";
import {
  deserializeSplitData,
  validateSplitDataDetailed,
  type SharedSplitData,
} from "@/lib/split-sharing";

import { SplitSummary } from "@/components/split-summary";
import Link from "next/link";

interface SplitPageState {
  splitData: SharedSplitData | null;
  isLoading: boolean;
  error: string | null;
}

function StatusScreen({
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

function SplitPageContent() {
  const searchParams = useSearchParams();
  // Stabilize effect dependencies to avoid reruns from changing object identity
  const search = searchParams.toString();
  const [state, setState] = useState<SplitPageState>({
    splitData: null,
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    try {
      // Parse URL parameters using split-sharing utilities
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

      // Validate the parsed data using enhanced validation
      const validation = validateSplitDataDetailed(splitData);
      if (!validation.isValid) {
        setState({
          splitData: null,
          isLoading: false,
          error: validation.errorMessages.join(" "),
        });
        return;
      }

      // Success - valid split data
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

  if (state.isLoading) {
    return (
      <StatusScreen
        icon={
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        }
        title="Loading split"
      >
        <p className="text-sm text-muted-foreground">
          Getting payment details ready…
        </p>
      </StatusScreen>
    );
  }

  if (state.error) {
    return (
      <StatusScreen
        icon={<AlertCircle className="size-8 text-destructive" />}
        title="Unable to Load Split"
      >
        <p className="text-sm text-muted-foreground">{state.error}</p>
        <div className="flex w-full flex-col gap-2 pt-2">
          <Button variant="outline" asChild>
            <Link href="/">
              <ArrowLeft data-icon="inline-start" />
              Create New Split
            </Link>
          </Button>
          <Button variant="ghost" onClick={() => window.location.reload()}>
            Refresh
          </Button>
        </div>
      </StatusScreen>
    );
  }

  const { splitData } = state;
  if (!splitData) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex w-full max-w-lg flex-col gap-8 px-4 py-6 sm:py-10">
        <Button variant="ghost" size="sm" asChild className="-ml-3 self-start">
          <Link href="/">
            <ArrowLeft data-icon="inline-start" />
            Back
          </Link>
        </Button>
        <SplitSummary splitData={splitData} phoneNumber={splitData.phone} />
      </div>
    </div>
  );
}

export default function SplitPage() {
  return (
    <Suspense
      fallback={
        <StatusScreen
          icon={
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          }
          title="Loading split"
        >
          <p className="text-sm text-muted-foreground">
            Getting payment details ready…
          </p>
        </StatusScreen>
      }
    >
      <SplitPageContent />
    </Suspense>
  );
}
