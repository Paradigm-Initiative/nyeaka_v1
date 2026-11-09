import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

// Optimistic check only (cookie present). The (auth) layout re-checks the
// session on the server before trusting it.
export function proxy(request: NextRequest) {
  if (getSessionCookie(request)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/sign-in",
    "/sign-up",
    "/forgot-password",
    "/reset-password",
    "/verify-email",
  ],
};
