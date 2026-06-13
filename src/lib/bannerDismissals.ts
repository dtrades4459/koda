import { supabase } from "./supabase";

// ═══════════════════════════════════════════════════════════════════════════
// Cross-device banner dismissals.
//
// Backs banner dismissal with the `banner_dismissals` table so a dismissal on
// one device shows on all of them. localStorage stays the fast/offline path;
// these helpers are best-effort and degrade silently when the user is signed
// out, offline, or the table hasn't been created yet (deploy-safe).
//
// banner_key examples: "comp_2026", "announcement:<announcement-id>".
// ═══════════════════════════════════════════════════════════════════════════

/** Load every banner_key this user has dismissed. Empty set on any failure. */
export async function loadDismissedBannerKeys(): Promise<Set<string>> {
  try {
    const { data, error } = await supabase
      .from("banner_dismissals")
      .select("banner_key");
    if (error || !data) return new Set();
    return new Set(data.map((r) => r.banner_key as string));
  } catch {
    return new Set();
  }
}

/** Persist a dismissal for this user. Best-effort; localStorage already holds it. */
export async function recordBannerDismissal(userId: string, bannerKey: string): Promise<void> {
  if (!userId) return;
  try {
    await supabase
      .from("banner_dismissals")
      .upsert({ user_id: userId, banner_key: bannerKey }, { onConflict: "user_id,banner_key" });
  } catch {
    /* swallow — per-device localStorage dismissal still applies */
  }
}
