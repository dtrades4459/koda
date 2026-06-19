// ═══════════════════════════════════════════════════════════════════════════════
// Kōda · circle message reactions — data helpers (Phase 2)
//
// Pairs with migrations/20260620_circle_chat_upgrades.sql.
// Place at: src/data/circleMessageReactions.ts
// ═══════════════════════════════════════════════════════════════════════════════
import { supabase } from "../lib/supabase";

/** emoji → list of user ids who reacted with it */
export type ReactionMap = Record<string, string[]>;

interface ReactionRow {
  message_id: string;
  user_id: string;
  emoji: string;
}

/**
 * Fetch reactions for a batch of message ids, grouped per message.
 * Returns: { [messageId]: { [emoji]: userId[] } }
 */
export async function fetchReactions(
  messageIds: string[]
): Promise<Record<string, ReactionMap>> {
  if (messageIds.length === 0) return {};
  const { data, error } = await supabase
    .from("circle_message_reactions")
    .select("message_id, user_id, emoji")
    .in("message_id", messageIds);
  if (error) {
    console.error("[KODA][reactions.fetch]", error);
    return {};
  }
  const out: Record<string, ReactionMap> = {};
  for (const r of (data ?? []) as ReactionRow[]) {
    (out[r.message_id] ??= {});
    (out[r.message_id][r.emoji] ??= []).push(r.user_id);
  }
  return out;
}

/**
 * Add the reaction if the user hasn't used it on this message, else remove it.
 * Atomic + membership-checked server-side. Returns "added" | "removed" | null.
 */
export async function toggleReaction(
  messageId: string,
  circleCode: string,
  emoji: string
): Promise<"added" | "removed" | null> {
  const { data, error } = await supabase.rpc("toggle_message_reaction", {
    p_message_id: messageId,
    p_circle_code: circleCode,
    p_emoji: emoji,
  });
  if (error) {
    console.error("[KODA][reactions.toggle]", error);
    return null;
  }
  return (data as "added" | "removed") ?? null;
}

/** Optimistic local toggle so the UI updates before the round-trip lands. */
export function applyOptimisticToggle(
  map: ReactionMap | undefined,
  emoji: string,
  myId: string
): ReactionMap {
  const next: ReactionMap = { ...(map ?? {}) };
  const users = next[emoji] ?? [];
  next[emoji] = users.includes(myId)
    ? users.filter((u) => u !== myId)
    : [...users, myId];
  if (next[emoji].length === 0) delete next[emoji];
  return next;
}

/** The quick-react palette shown on long-press / hover. */
export const REACTION_PALETTE = ["🔥", "💎", "👏", "💯", "😂", "👀"] as const;
