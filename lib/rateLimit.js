// Lightweight in-memory rate limiter for Next.js API routes.
//
// This works because Encompass runs as a single long-lived Render web
// service (not serverless/edge functions with per-request cold starts),
// so the counts persist between requests on that one instance. If this
// app is ever scaled to multiple instances, swap the Map below for a
// shared store (Upstash Redis, Supabase table, etc.) — the function
// signature can stay the same.
//
// Usage inside a route handler:
//   import { rateLimit } from "@/lib/rateLimit";
//   const limited = rateLimit(request, { limit: 5, windowMs: 60_000 });
//   if (limited) return limited; // a 429 Response, already built

const buckets = new Map();

// Periodically drop old buckets so this doesn't grow forever.
const SWEEP_INTERVAL_MS = 5 * 60_000;
let lastSweep = Date.now();

function sweep(now) {
  if (now - lastSweep < SWEEP_INTERVAL_MS) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    if (now - bucket.windowStart > SWEEP_INTERVAL_MS) buckets.delete(key);
  }
}

function getClientIp(request) {
  // Render (and most platforms behind a proxy) set x-forwarded-for.
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return request.headers.get("x-real-ip") || "unknown";
}

/**
 * @param {Request} request
 * @param {{ limit?: number, windowMs?: number, keyPrefix?: string }} options
 * @returns {Response|null} a 429 Response if the caller is over the limit, otherwise null
 */
export function rateLimit(request, options = {}) {
  const { limit = 10, windowMs = 60_000, keyPrefix = "" } = options;
  const now = Date.now();
  sweep(now);

  const key = `${keyPrefix}:${getClientIp(request)}`;
  const bucket = buckets.get(key);

  if (!bucket || now - bucket.windowStart > windowMs) {
    buckets.set(key, { count: 1, windowStart: now });
    return null;
  }

  bucket.count += 1;
  if (bucket.count > limit) {
    const retryAfterSec = Math.ceil((bucket.windowStart + windowMs - now) / 1000);
    return Response.json(
      { error: "Too many requests — please slow down and try again shortly." },
      { status: 429, headers: { "Retry-After": String(Math.max(retryAfterSec, 1)) } }
    );
  }
  return null;
}
