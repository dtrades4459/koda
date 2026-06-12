// Kōda · referral capture (share-card growth loop)
//
// Call captureRef() on page load (before auth redirect), like captureUtm().
// Persists to localStorage — NOT sessionStorage — because a referral click
// often converts days later, and it must survive the OAuth round-trip and
// PWA installs alike.
//
// applyRefAttribution() runs once post-login and stamps the ref onto the auth
// user's metadata, where it's queryable in SQL:
//   select raw_user_meta_data->>'ref', count(*) from auth.users group by 1;
// That answers "which circle (or which sharer) recruits" without new tables.

import { supabase } from "./supabase";

const STORE_KEY = "koda_ref";
const APPLIED_KEY = "koda_ref_applied";

// Public circle codes (NAME6-XXXX, KODA-GLOBAL, 50K-EVAL-2026) or personal
// refs (u_<memberCode>). Anything else is dropped at the door.
const REF_RE = /^(?:u_)?[A-Za-z0-9][A-Za-z0-9_-]{1,39}$/;

export interface CapturedRef {
  ref: string;
  at: string;
}

export function captureRef(): void {
  try {
    const ref = new URLSearchParams(window.location.search).get("ref");
    if (!ref || !REF_RE.test(ref)) return;
    // First-touch wins: a stored ref is the one that actually brought them in.
    if (localStorage.getItem(STORE_KEY)) return;
    localStorage.setItem(
      STORE_KEY,
      JSON.stringify({ ref, at: new Date().toISOString() } satisfies CapturedRef),
    );
  } catch { /* storage unavailable — non-fatal */ }
}

export function readRef(): CapturedRef | null {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CapturedRef;
    return REF_RE.test(parsed.ref ?? "") ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * One-time, best-effort: write the captured ref into auth user_metadata.
 * Safe for every auth method (incl. Google OAuth, where signUp options.data
 * never runs). First-touch: never overwrites an existing ref on the user.
 */
export async function applyRefAttribution(): Promise<void> {
  try {
    if (localStorage.getItem(APPLIED_KEY)) return;
    const captured = readRef();
    if (!captured) return;

    const { data } = await supabase.auth.getSession();
    const user = data.session?.user;
    if (!user) return; // not signed in yet — try again next load

    if (!user.user_metadata?.ref) {
      const { error } = await supabase.auth.updateUser({
        data: { ref: captured.ref, ref_at: captured.at },
      });
      if (error) return; // transient — retry on a future load
    }
    localStorage.setItem(APPLIED_KEY, "1");
  } catch { /* best-effort — attribution must never break login */ }
}
