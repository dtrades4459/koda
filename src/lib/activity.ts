// src/lib/activity.ts
import { supabase } from "./supabase";

const KEY = "koda_last_active_ping";

/** Update profiles.last_active_at at most once per calendar day per device. */
export async function pingLastActive(userId: string): Promise<void> {
  try {
    const today = new Date().toISOString().slice(0, 10);
    if (localStorage.getItem(KEY) === today) return;
    localStorage.setItem(KEY, today);
    await supabase.from("profiles").update({ last_active_at: new Date().toISOString() }).eq("user_id", userId);
  } catch {
    /* best-effort; never block the app */
  }
}
