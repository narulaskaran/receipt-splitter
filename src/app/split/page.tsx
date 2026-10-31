"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { SplitScreen, SplitStatusScreen } from "@/components/split-screen";

function SplitPageContent() {
  const searchParams = useSearchParams();
  return (
    <SplitScreen
      searchParams={searchParams}
      renderHomeLink={({ children, className }) => (
        <Link href="/" className={className}>
          {children}
        </Link>
      )}
    />
  );
}

export default function SplitPage() {
  return (
    <Suspense
      fallback={
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
      }
    >
      <SplitPageContent />
    </Suspense>
  );
}
