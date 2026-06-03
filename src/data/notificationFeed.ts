// src/data/notificationFeed.ts
// ═══════════════════════════════════════════════════════════════════════════════
// Kōda · notification_feed data layer
//
// Reads from the notification_feed table (populated by engagement-loop backend
// tasks 7–13). Provides list + mark-read helpers.
// ═══════════════════════════════════════════════════════════════════════════════

import { supabase } from "../lib/supabase";

export interface FeedNotif {
  id: string;
  kind: "follow" | "circle_join" | "reaction" | "idea_like" | "digest";
  data: { title?: string; body?: string; [k: string]: unknown };
  created_at: string;
  read_at: string | null;
}

export async function listNotifications(limit = 30): Promise<{ items: FeedNotif[]; error: boolean }> {
  const { data, error } = await supabase
    .from("notification_feed")
    .select("id, kind, data, created_at, read_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return { items: [], error: true };
  return { items: (data ?? []) as FeedNotif[], error: false };
}

export async function markNotificationsRead(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await supabase
    .from("notification_feed")
    .update({ read_at: new Date().toISOString() })
    .in("id", ids)
    .is("read_at", null);
}
