import { NextResponse } from "next/server";

// Normally the service worker answers POSTs to this path (see src/app/sw.ts).
// If one reaches the server instead (worker bypassed or not yet active), land
// on the app rather than an error page; the shared file is not recoverable.
export function POST(request: Request) {
  return NextResponse.redirect(new URL("/", request.url), 303);
}
