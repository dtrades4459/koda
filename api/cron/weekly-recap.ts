// ═══════════════════════════════════════════════════════════════════════════════
// Kōda · GET /api/cron/weekly-recap
//
// Runs every Monday at 07:00 UTC (recap of the previous Mon–Sun trading week).
// For each user with weeklyRecap enabled in their koda_profile, computes
// net R, win rate, trade count, and best setup, then sends a Resend email.
//
// Auth: must include header  x-cron-secret: <CRON_SECRET>
// ENV: CRON_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY
// ═══════════════════════════════════════════════════════════════════════════════

export const config = { runtime: "nodejs" };

import { createClient } from "@supabase/supabase-js";
import { sendEmail, weeklyRecapHtml } from "../lib/email.js";

function getDb() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

function weekRange(): { start: string; end: string; label: string } {
  const now = new Date();
  // Monday of the previous week (relative to today, which is Monday)
  const dayOfWeek = now.getDay() === 0 ? 7 : now.getDay(); // ISO: Mon=1 … Sun=7
  const monday = new Date(now);
  monday.setDate(now.getDate() - dayOfWeek - 6); // last Monday
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  const fmt = (d: Date) => d.toISOString().split("T")[0];
  const label = `${fmt(monday)} – ${fmt(sunday)}`;
  return { start: monday.toISOString(), end: sunday.toISOString(), label };
}

type Req = { method?: string; headers: Record<string, string | string[] | undefined> };
type Res = { status(n: number): Res; json(d: unknown): Res; end(): void };

export default async function handler(req: Req, res: Res) {
  if (req.method !== "GET" && req.method !== "POST") return res.status(405).end();

  const secret = req.headers["x-cron-secret"];
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: "Unauthorised" });
  }

  const db = getDb();
  const { start, end, label } = weekRange();

  // Fetch all profiles with weekly recap enabled
  const { data: profiles, error: pErr } = await db
    .from("user_kv")
    .select("user_id, value")
    .eq("key", "koda_profile");

  if (pErr || !profiles) {
    console.error("[weekly-recap] profile fetch error:", pErr?.message);
    return res.status(500).json({ error: "Profile fetch failed" });
  }

  let sent = 0;
  let skipped = 0;

  await Promise.allSettled(
    profiles.map(async (row) => {
      let profile: Record<string, unknown>;
      try {
        profile = JSON.parse(row.value as string);
      } catch {
        return;
      }

      if (!profile.weeklyRecap || !profile.email || typeof profile.email !== "string") {
        skipped++;
        return;
      }

      // Fetch trades for the week
      const { data: trades } = await db
        .from("trades")
        .select("pnl, outcome, strategy")
        .eq("user_id", row.user_id)
        .gte("date", start)
        .lte("date", end);

      if (!trades || trades.length === 0) {
        skipped++;
        return;
      }

      const wins = trades.filter((t) => t.outcome === "Win").length;
      const netR = trades.reduce((sum, t) => sum + (parseFloat(t.pnl) || 0), 0);
      const winRate = Math.round((wins / trades.length) * 100);

      // Best setup = strategy with highest net R
      const stratMap: Record<string, number> = {};
      for (const t of trades) {
        if (t.strategy) stratMap[t.strategy] = (stratMap[t.strategy] ?? 0) + (parseFloat(t.pnl) || 0);
      }
      const bestSetup = Object.entries(stratMap).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";

      const name = (profile.name as string | undefined)?.split(" ")[0] ?? "Trader";

      try {
        await sendEmail({
          to: profile.email as string,
          subject: `Your Kōda weekly recap — ${label}`,
          html: weeklyRecapHtml({
            name,
            netR,
            winRate,
            bestSetup,
            tradeCount: trades.length,
            weekLabel: label,
          }),
        });
        sent++;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[weekly-recap] email failed for user:", row.user_id, msg);
      }
    }),
  );

  console.log(`[weekly-recap] sent=${sent} skipped=${skipped} week=${label}`);
  return res.status(200).json({ ok: true, sent, skipped, week: label });
}
