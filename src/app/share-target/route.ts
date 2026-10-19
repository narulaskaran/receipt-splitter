import { NextResponse } from "next/server";
import { SHARE_TARGET_ERROR, SHARE_TARGET_PARAM } from "@/lib/share-target";

// Normally the service worker answers POSTs to this path (see src/app/sw.ts).
// If one reaches the server instead (worker bypassed or not yet active), land
// on the app rather than an error page. The shared file is not recoverable, so
// the home page tells the user to choose it again.
export function POST(request: Request) {
  return NextResponse.redirect(
    new URL(`/?${SHARE_TARGET_PARAM}=${SHARE_TARGET_ERROR}`, request.url),
    303
  );
}
