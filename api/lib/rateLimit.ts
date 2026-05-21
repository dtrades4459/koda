// ═══════════════════════════════════════════════════════════════════════════════
// TRADR · api/lib/rateLimit.ts
//
// Supabase-backed IP rate limiter — survives Vercel cold starts because state
// lives in shared_kv, not in memory.
//
// Usage:
//   import { checkRateLimit, hashIp } from "../lib/rateLimit";
//   const ip = req.headers["x-forwarded-for"]?.split(",")[0].trim() || "unknown";
//   const allowed = await checkRateLimit("connect", ip, { limit: 5, windowMs: 600_000 });
//   if (!allowed) return res.status(429).json({ error: "Too many requests" });
// ═══════════════════════════════════════════════════════════════════════════════

import { getAdminClient } from "./supabaseAdmin";

/** Stable 8-char hex derived from the IP — avoids storing raw IPs in the DB. */
export function hashIp(ip: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < ip.length; i++) {
    h ^= ip.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

export interface RateLimitOptions {
  /** Max requests allowed within the window. Default: 5 */
  limit?: number;
  /** Window duration in ms. Default: 60_000 (1 minute) */
  windowMs?: number;
}

/**
 * Check (and increment) a rate limit counter for a given action + IP.
 * Returns true if the request is allowed, false if it should be blocked.
 *
 * The counter is stored in shared_kv as `tradr_rl_{action}_{hashedIp}`.
 * The upsert is fire-and-forget so it doesn't block the response path.
 */
export async function checkRateLimit(
  action: string,
  ip: string,
  options: RateLimitOptions = {}
): Promise<boolean> {
  const { limit = 5, windowMs = 60_000 } = options;
  const admin = getAdminClient();
  const key = `tradr_rl_${action}_${hashIp(ip)}`;
  const now = Date.now();

  const { data } = await admin
    .from("shared_kv")
    .select("value")
    .eq("key", key)
    .maybeSingle();

  let count = 1;
  let resetAt = now + windowMs;

  if (data?.value) {
    try {
      const parsed = JSON.parse(data.value);
      if (now < parsed.resetAt) {
        // Still inside the current window
        if (parsed.count >= limit) return false;
        count = parsed.count + 1;
        resetAt = parsed.resetAt;
      }
      // Window expired → start fresh (count=1, new resetAt)
    } catch { /* malformed value — start fresh */ }
  }

  // Upsert fire-and-forget; don't let a DB write block the happy path.
  void admin
    .from("shared_kv")
    .upsert({ key, value: JSON.stringify({ count, resetAt }) })
    .then(() => {}, () => {});

  return true;
}

/** Extract the client IP from a Vercel request, falling back to "unknown". */
export function getClientIp(req: any): string {
  return (req.headers["x-forwarded-for"] as string | undefined)
    ?.split(",")[0].trim() || "unknown";
}
