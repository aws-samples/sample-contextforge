import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySession, isGateEnabled, AUTH_COOKIE } from "@/lib/auth";

/**
 * Demo access gate (Next 16 `proxy`, formerly `middleware`).
 *
 * Runs on the Node runtime, so it can use the same HMAC session helper as the
 * login route. When the gate is DISABLED (no DEMO_USER — local dev), it's a
 * no-op and the app stays open. When ENABLED (App Runner), every protected
 * route requires a valid signed session cookie, else redirect to /login (pages)
 * or 401 (API). This is what keeps the public URL — and the shared-account COA
 * behind it — from being driven by anyone who simply finds the link.
 *
 * Public (always allowed): /login, /api/auth/*, /api/health, static assets.
 */
export function proxy(request: NextRequest) {
  // Gate off (local dev) → let everything through unchanged.
  if (!isGateEnabled()) return NextResponse.next();

  const { pathname } = request.nextUrl;

  // Always-public paths.
  if (
    pathname === "/login" ||
    pathname.startsWith("/api/auth/") ||
    pathname === "/api/health"
  ) {
    return NextResponse.next();
  }

  const authed = verifySession(request.cookies.get(AUTH_COOKIE)?.value);
  if (authed) return NextResponse.next();

  // Unauthenticated: API → 401 JSON; pages → redirect to /login.
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const loginUrl = new URL("/login", request.url);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  // Run on everything except Next internals and static assets.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|txt|woff2?)$).*)"],
};
