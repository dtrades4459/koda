// src/data/notifications.ts
// Shared notification helpers — thin wrappers around POST /api/push
// Kept separate so feed + circles files stay lean.
// Task 12 will extend this module with notifyLike.

import { supabase } from "../lib/supabase";

async function getToken(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}

export async function notifyReaction(opts: {
  targetUid: string;
  surface: "feed_trade" | "shared_trade";
  emoji: string;
  contextLabel?: string;
  currentUid: string;
}): Promise<void> {
  if (opts.targetUid === opts.currentUid) return; // no self-notify
  try {
    const token = await getToken();
    if (!token) return;
    await fetch("/api/push?action=notify-reaction", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        targetUid: opts.targetUid,
        surface: opts.surface,
        emoji: opts.emoji,
        contextLabel: opts.contextLabel,
      }),
    });
  } catch { /* best-effort */ }
}
