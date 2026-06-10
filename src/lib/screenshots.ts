// ═══════════════════════════════════════════════════════════════════════════════
// Kōda · screenshot URL resolver (Runbook B — private bucket migration)
//
// Stored screenshot values are permanent public-CDN URLs from the era when
// trade-screenshots was a public bucket. Once the bucket flips to private
// those URLs stop serving, but they still encode the storage path — so we
// keep them in the data as-is and resolve them to short-lived signed URLs
// at render time. Works in both bucket modes: signed URLs are valid on
// public buckets too, which lets the code deploy BEFORE the flip.
//
// Non-bucket values (base64 data: URIs, external URLs) pass through untouched.
// ═══════════════════════════════════════════════════════════════════════════════

import { supabase } from "./supabase";
import { log } from "./log";

const BUCKET = "trade-screenshots";
const SIGN_TTL_SECONDS = 60 * 60;
// Re-sign 5 minutes before the URL actually expires.
const CACHE_TTL_MS = (SIGN_TTL_SECONDS - 5 * 60) * 1000;

const cache = new Map<string, { url: string; expires: number }>();
const inflight = new Map<string, Promise<string>>();

/** Extract the storage object path from a stored screenshot URL.
 *  Returns null for anything that isn't a trade-screenshots bucket URL. */
export function extractStoragePath(stored: string): string | null {
  const m = stored.match(/\/object\/(?:public|sign)\/trade-screenshots\/([^?]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

/** Resolve a stored screenshot value to a displayable URL.
 *  Bucket URLs → short-lived signed URL (cached). Everything else → unchanged.
 *  On signing failure, falls back to the stored value so a public bucket
 *  keeps working and a private one shows a broken image rather than crashing. */
export async function resolveScreenshotUrl(stored: string): Promise<string> {
  if (!stored) return stored;
  const path = extractStoragePath(stored);
  if (!path) return stored;

  const hit = cache.get(path);
  if (hit && hit.expires > Date.now()) return hit.url;

  const pending = inflight.get(path);
  if (pending) return pending;

  const p = (async () => {
    try {
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(path, SIGN_TTL_SECONDS);
      if (error || !data?.signedUrl) throw error ?? new Error("no signedUrl returned");
      cache.set(path, { url: data.signedUrl, expires: Date.now() + CACHE_TTL_MS });
      return data.signedUrl;
    } catch (e) {
      log.error("screenshots.resolveSignedUrl", e, { path });
      return stored;
    } finally {
      inflight.delete(path);
    }
  })();
  inflight.set(path, p);
  return p;
}
