import { supabase } from "../lib/supabase";

export async function markChatRead(circleCode: string): Promise<void> {
  const { data } = await supabase.auth.getUser();
  const uid = data.user?.id;
  if (!uid) return;
  await supabase.from("chat_reads").upsert(
    {
      user_id: uid,
      circle_code: circleCode,
      last_read_at: new Date().toISOString(),
    },
    { onConflict: "user_id,circle_code" }
  );
}

/**
 * Returns a map of circle_code → unread message count for the current user.
 * Counts messages in each requested circle whose created_at is after the
 * user's last_read_at, or all messages if no last_read row exists.
 */
export async function getUnreadCounts(
  circleCodes: string[]
): Promise<Record<string, number>> {
  if (circleCodes.length === 0) return {};
  const { data: userResp } = await supabase.auth.getUser();
  const uid = userResp.user?.id;
  if (!uid) return {};

  const { data: reads } = await supabase
    .from("chat_reads")
    .select("circle_code, last_read_at")
    .eq("user_id", uid)
    .in("circle_code", circleCodes);

  const lastRead: Record<string, string> = {};
  for (const r of reads ?? []) lastRead[r.circle_code] = r.last_read_at;

  // One round-trip per circle keeps the SQL simple; circle counts per user
  // are small (typically <10), so the cost is negligible.
  const result: Record<string, number> = {};
  await Promise.all(
    circleCodes.map(async (code) => {
      let q = supabase
        .from("circle_messages")
        .select("id", { count: "exact", head: true })
        .eq("circle_code", code);
      const since = lastRead[code];
      if (since) q = q.gt("created_at", since);
      const { count } = await q;
      result[code] = count ?? 0;
    })
  );
  return result;
}
