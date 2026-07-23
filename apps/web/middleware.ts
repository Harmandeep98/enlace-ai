import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Better Auth's session cookie name defaults to "better-auth.session_token" — a presence
// check here is a fast, non-authoritative redirect; the actual session validity is still
// checked server-side by apps/api on every real request via auth.api.getSession.
const SESSION_COOKIE = "better-auth.session_token";

export function middleware(request: NextRequest) {
  const hasSession = request.cookies.has(SESSION_COOKIE);
  const isAuthRoute = request.nextUrl.pathname.startsWith("/sign-in") || request.nextUrl.pathname.startsWith("/sign-up");

  if (!hasSession && !isAuthRoute) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"]
};
