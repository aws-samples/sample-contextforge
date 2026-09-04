import { NextRequest, NextResponse } from "next/server";
import { checkCredentials, issueSession, isGateEnabled, AUTH_COOKIE } from "@/lib/auth";

/**
 * POST /api/auth/login { email, password }
 *
 * Validates against the demo gate credentials (DEMO_USER / DEMO_PASS) and, on
 * success, sets a signed httpOnly session cookie that middleware checks on every
 * protected route. When the gate is disabled (local dev, no DEMO_USER), any
 * non-empty credentials succeed so the local experience stays frictionless.
 */
export async function POST(request: NextRequest) {
  let body: { email?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON { email, password }" }, { status: 400 });
  }

  const email = (body.email ?? "").trim();
  const password = body.password ?? "";

  if (!email || !password) {
    return NextResponse.json({ error: "Enter your credentials" }, { status: 400 });
  }

  // Local dev (gate disabled): accept any non-empty creds. Hosted: must match.
  const ok = isGateEnabled() ? checkCredentials(email, password) : true;
  if (!ok) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(AUTH_COOKIE, issueSession(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 12 * 60 * 60, // 12h
  });
  return res;
}
