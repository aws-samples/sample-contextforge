/**
 * Cached COA graph answers for the scripted demo (hero) questions.
 *
 * COA's Tier-3 synthesis has variable latency (~16-30s) and sits right at the
 * API Gateway 29s cap, so a live graph query can intermittently time out and
 * fall back to vector — which, mid-demo, looks like the graph panel "broke".
 *
 * To make scripted demos bulletproof, we capture REAL COA answers for the hero
 * questions (see scripts/capture-hero-answers.mjs) into src/data/coa-cache/ and
 * serve them instantly. These are genuine COA outputs, not fabrications — the
 * same content a live query produces, just pre-captured. Any non-scripted
 * question still goes fully live.
 *
 * Opt out at runtime with COA_DISABLE_CACHE=1 (e.g. to demo the live path).
 */
import fs from "fs";
import path from "path";
import type { Vertical } from "./types";

interface CachedAnswer {
  answer: string;
  tier?: number;
  confidence?: number;
  supportingContent?: Array<Record<string, unknown>>;
  capturedMs?: number;
  capturedAt?: string;
}

const CACHE_DIR = path.join(process.cwd(), "src/data/coa-cache");
const memo = new Map<string, Record<string, CachedAnswer>>();

/** Normalize a question for cache lookup — collapse whitespace, drop any
 *  brevity directive we append before sending to COA, lowercase. */
function normalizeQuestion(q: string): string {
  return q
    .replace(/answer concisely in under \d+ words.*/i, "")
    .replace(/answer in under \d+ words.*/i, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function loadVertical(vertical: Vertical): Record<string, CachedAnswer> {
  if (memo.has(vertical)) return memo.get(vertical)!;
  let data: Record<string, CachedAnswer> = {};
  try {
    const file = path.join(CACHE_DIR, `${vertical}.json`);
    if (fs.existsSync(file)) data = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    data = {};
  }
  memo.set(vertical, data);
  return data;
}

/**
 * Look up a cached hero answer for this question, if one exists and caching is
 * enabled. Returns the cached record or null (→ caller goes live).
 */
export function getCachedAnswer(vertical: Vertical, question: string): CachedAnswer | null {
  if (process.env.COA_DISABLE_CACHE === "1") return null;
  const table = loadVertical(vertical);
  const key = normalizeQuestion(question);
  // Exact normalized match first, then a lenient contains-match so small
  // punctuation differences in the scripted question still hit.
  if (table[key]) return table[key];
  for (const [k, v] of Object.entries(table)) {
    if (k === key) return v;
    if ((k.includes(key) || key.includes(k)) && Math.abs(k.length - key.length) < 15) return v;
  }
  return null;
}
