import { NextResponse } from "next/server";

/** GET /api/health — App Runner health check. Public (see proxy allowlist). */
export async function GET() {
  return NextResponse.json({ status: "ok" });
}
