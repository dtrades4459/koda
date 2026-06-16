// api/_lib/metrics/weeklyRecap.ts
import { getAdminClient } from "../supabaseAdmin.js";

export interface RecapTrade {
  pnl: number;
  rr: number | null;
  outcome: "win" | "loss" | "be";
  strategy: string;
}

export interface WeeklyRecap {
  tradeCount: number;
  netDollar: number;
  winRate: number;       // integer %, excludes break-even
  netR: number | null;   // null when no rr data
  bestSetup: string;     // "" when no named strategy
}

export function computeWeeklyRecap(trades: RecapTrade[]): WeeklyRecap {
  const tradeCount = trades.length;
  const netDollar = trades.reduce((s, t) => s + (t.pnl ?? 0), 0);

  const wins = trades.filter(t => t.outcome === "win").length;
  const losses = trades.filter(t => t.outcome === "loss").length;
  const decided = wins + losses;
  const winRate = decided === 0 ? 0 : Math.round((wins / decided) * 100);

  const rTrades = trades.filter(t => t.rr !== null && t.rr !== undefined);
  const netR = rTrades.length === 0
    ? null
    : Math.round(rTrades.reduce((s, t) => s + (t.rr as number), 0) * 10) / 10;

  const byStrat: Record<string, number> = {};
  for (const t of trades) {
    const s = (t.strategy ?? "").trim();
    if (!s) continue;
    byStrat[s] = (byStrat[s] ?? 0) + (t.pnl ?? 0);
  }
  let bestSetup = "";
  let bestVal = -Infinity;
  for (const [s, v] of Object.entries(byStrat)) {
    if (v > bestVal) { bestVal = v; bestSetup = s; }
  }

  return { tradeCount, netDollar, winRate, netR, bestSetup };
}

/** Fetch a user's trailing-7-day trades and compute their recap. */
export async function fetchWeeklyRecap(userId: string): Promise<WeeklyRecap> {
  const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const admin = getAdminClient();
  const { data } = await admin
    .from("trades")
    .select("pnl, rr, outcome, strategy")
    .eq("user_id", userId)
    .gte("date", since);
  const rows = (data ?? []) as RecapTrade[];
  return computeWeeklyRecap(rows);
}
