"use client";

import { useEffect, useState } from "react";
import { HomeScreen } from "@/components/home-screen";
import { SplitScreen } from "@/components/split-screen";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { homeHash, parseMobileHash, type MobileRoute } from "@/mobile/routes";

function readRoute(): MobileRoute {
  if (typeof window === "undefined") return { name: "home" };
  return parseMobileHash(window.location.hash);
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
    const onHashChange = () => setRoute(readRoute());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  return (
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
  );
}
