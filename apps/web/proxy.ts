import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

// Optimistic check only (cookie present), and only for /admin.
//
// /admin: without a session cookie it is a plain 404 (the area's existence isn't revealed).
// With one, the admin layout checks the session and the staff role, and every admin server
// action checks the tier again (lib/admin.ts: assertStaff / assertAdminOnly).
//
// The sign-in, sign-up and password pages are NOT handled here. A cookie can be stale (the
// session was deleted: sign-out elsewhere, removal from staff, a two-factor reset, expiry).
// Redirecting on the cookie alone sent such people from /sign-in to /dashboard, and /dashboard
// (which checks the real session) back to /sign-in, forever. The (auth) layout checks the real
// session and redirects only people who are actually signed in.
export function proxy(request: NextRequest) {
  const hasSession = !!getSessionCookie(request);
  return hasSession ? NextResponse.next() : NextResponse.rewrite(new URL("/404", request.url));
}

export const config = {
  matcher: ["/admin/:path*"],
};
