/**
 * Lightweight demo access gate for the hosted public deployment.
 *
 * The local dev experience is open (no gate) — this only kicks in when
 * DEMO_USER / DEMO_PASS are configured (i.e. on App Runner). It protects the
 * shared-account COA behind a single shared credential so a leaked URL alone
 * can't drive live queries.
 *
 * Mechanism: on successful login we set an httpOnly, signed cookie. Middleware
 * verifies the signature on every protected request. Signing uses an HMAC over
 * a fixed payload + expiry with AUTH_SECRET — no external dependency, and the
 * cookie can't be forged without the secret. This is a demo gate, not an IdP;
 * for real multi-user auth use Cognito (already in the stack).
 */
import { createHmac, timingSafeEqual } from "crypto";

export const AUTH_COOKIE = "cf_session";
const DEFAULT_TTL_MS = 12 * 60 * 60 * 1000; // 12h

/** True when a gate is configured. When false, the app is open (local dev). */
export function isGateEnabled(): boolean {
  return Boolean(process.env.DEMO_USER && process.env.DEMO_PASS);
}

function secret(): string {
  const s = process.env.AUTH_SECRET;
  // Fail fast: never sign cookies with a predictable key. If the gate is
  // enabled, AUTH_SECRET must be set to a strong random value — otherwise
  // refuse rather than fall back to any hardcoded default.
  if (!s) {
    if (isGateEnabled()) {
      throw new Error(
        "AUTH_SECRET must be set to a strong random value when the login gate " +
          "(DEMO_USER/DEMO_PASS) is enabled. Refusing to sign session cookies " +
          "with a default key."
      );
    }
    // Gate disabled (open local dev): no cookies are issued, so return a
    // clearly-ephemeral per-process value rather than a shared constant.
    return `ephemeral-${process.pid}-${Date.now()}`;
  }
  return s;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

/** Validate a username/password against the configured demo credentials. */
export function checkCredentials(user: string, pass: string): boolean {
  const U = process.env.DEMO_USER ?? "";
  const P = process.env.DEMO_PASS ?? "";
  if (!U || !P) return false;
  // Constant-time compare to avoid timing leaks.
  const okU = safeEqual(user, U);
  const okP = safeEqual(pass, P);
  return okU && okP;
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/** Create a signed session token: `<expiry>.<sig>`. */
export function issueSession(ttlMs: number = DEFAULT_TTL_MS): string {
  const exp = Date.now() + ttlMs;
  const payload = `v1.${exp}`;
  return `${payload}.${sign(payload)}`;
}

/** Verify a session token's signature and expiry. */
export function verifySession(token: string | undefined | null): boolean {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [v, exp, sig] = parts;
  const payload = `${v}.${exp}`;
  const expected = sign(payload);
  if (!safeEqual(sig, expected)) return false;
  const expMs = Number(exp);
  return Number.isFinite(expMs) && expMs > Date.now();
}
