// ═══════════════════════════════════════════════════════════════════════════════
// Kōda · multi-account pure logic
//
// "Log once, tick accounts" fans a single logical trade out to one row per
// account (sharing a groupId). Per-account stats reuse the existing stats engine
// by filtering on accountId — this module only adds the account-aware pieces.
//
// Dollar P&L uses `pnlDollar` (parseFloat), matching src/lib/stats.ts.
// ═══════════════════════════════════════════════════════════════════════════════

import type { Account, Trade } from "../types";

/** Net dollar P&L of a trade — same convention as stats.ts (`pnlDollar`). */
const dollarsOf = (t: Trade): number => parseFloat((t.pnlDollar as string) ?? "") || 0;

const uuid = (): string =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;

/** One logical trade + N account ids → N identical rows, each stamped with its
 *  accountId and a shared groupId. Empty accountIds → no rows. */
export function fanOutTrade(base: Trade, accountIds: string[], genId: () => string = uuid): Trade[] {
  if (accountIds.length === 0) return [];
  const groupId = genId();
  return accountIds.map(accountId => ({ ...base, accountId, groupId }));
}

/** Scope a trade list to one account. null → all trades (the "All accounts" view).
 *  Trades with no accountId (logged before multi-account, or never attributed)
 *  belong to `defaultAccountId` if given — so existing history shows under the
 *  default account without rewriting stored trades. */
export function tradesForAccount(
  trades: Trade[],
  accountId: string | null,
  defaultAccountId?: string,
): Trade[] {
  if (!accountId) return trades;
  return trades.filter(
    t => t.accountId === accountId || (!t.accountId && accountId === defaultAccountId),
  );
}

/** Progress toward an eval's profit target. pct is null when no target is set. */
export function evalProgress(account: Account, accountTrades: Trade[]) {
  const netPnl = accountTrades.reduce((s, t) => s + dollarsOf(t), 0);
  const target = account.profitTarget ?? null;
  const pct = target && target > 0 ? (netPnl / target) * 100 : null;
  return { netPnl, target, pct };
}

/** Trailing drawdown from the equity curve (startingBalance + cumulative $ P&L).
 *  pct is null when no drawdown limit is set. */
export function drawdownProximity(account: Account, accountTrades: Trade[]) {
  const start = account.startingBalance ?? account.accountSize ?? 0;
  let equity = start;
  let peak = start;
  for (const t of accountTrades) {
    equity += dollarsOf(t);
    if (equity > peak) peak = equity;
  }
  const limit = account.maxDrawdown ?? null;
  const drawdown = peak - equity;
  const pct = limit && limit > 0 ? (drawdown / limit) * 100 : null;
  return { currentEquity: equity, peakEquity: peak, drawdown, limit, pct };
}

/** Free tier = 1 account; Pro = unlimited. */
export function canAddAccount(accountCount: number, isPro: boolean): boolean {
  return isPro || accountCount < 1;
}
