import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

// Optimistic check only (cookie present). The (auth) layout re-checks the
// session on the server before trusting it.
//
// /admin: without a session cookie it is a plain 404 (the area's existence isn't
// revealed). With one, the admin layout checks the role, and every admin server
// action checks it again (lib/admin.ts: assertAdmin).
export function proxy(request: NextRequest) {
  const hasSession = !!getSessionCookie(request);
  if (request.nextUrl.pathname.startsWith("/admin")) {
    return hasSession ? NextResponse.next() : NextResponse.rewrite(new URL("/404", request.url));
  }
  if (hasSession) {
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
    "/admin/:path*",
  ],
};
