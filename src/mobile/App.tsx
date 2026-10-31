"use client";

import { Component, useEffect, useState, type ErrorInfo, type ReactNode } from "react";
import { toast } from "sonner";
import { HomeScreen } from "@/components/home-screen";
import { SplitScreen } from "@/components/split-screen";
import { ThemeProvider } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { consumeDurableStorageNotice } from "@/lib/storage";
import { homeHash, parseMobileHash, type MobileRoute } from "@/mobile/routes";

function readRoute(): MobileRoute {
  if (typeof window === "undefined") return { name: "home" };
  return parseMobileHash(window.location.hash);
}

interface BoundaryProps {
  children: ReactNode;
  onReload?: () => void;
}

interface BoundaryState {
  error: Error | null;
}

/**
 * Last-resort UI for the native shell. Reload does not clear storage:
 * the saved split stays on this device.
 */
export class MobileErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("Mobile shell render failed", error, info.componentStack);
  }

  render(): ReactNode {
    if (!this.state.error) return this.props.children;
    const reload = this.props.onReload ?? (() => window.location.reload());
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-6 text-center">
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          Your saved split is still on this device.
        </p>
        <Button type="button" onClick={reload}>
          Reload
        </Button>
      </div>
    );
  }
}

export function App() {
  const [route, setRoute] = useState<MobileRoute>(readRoute);
  // False until the native storage mirror (bootNative, before this render)
  // is visible to React. HomeScreen will not restore or autosave before that.
  const [storageReady, setStorageReady] = useState(false);

  useEffect(() => {
    setStorageReady(true);
  }, []);

  useEffect(() => {
    const notice = consumeDurableStorageNotice();
    if (notice) toast.warning(notice);
  }, []);

  useEffect(() => {
    const onHashChange = () => setRoute(readRoute());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  return (
    <MobileErrorBoundary>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        {route.name === "split" ? (
          <SplitScreen
            searchParams={route.searchParams}
            onCreateNew={() => {
              window.location.hash = homeHash();
            }}
          />
        ) : (
          <HomeScreen storageReady={storageReady} />
        )}
        <Toaster />
      </ThemeProvider>
    </MobileErrorBoundary>
  );
}
