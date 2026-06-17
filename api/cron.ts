// ═══════════════════════════════════════════════════════════════════════════════
// Kōda · GET /api/cron?job=complete-challenges | sync
//
// Merges api/cron/complete-challenges.ts + api/cron/sync.ts into one function
// to stay within the Vercel Hobby 12-function limit.
//
// Auth:
//   GET  — Vercel cron: Authorization: Bearer <CRON_SECRET>
//   POST — manual trigger from UI: Authorization: Bearer <supabase-jwt>
// ═══════════════════════════════════════════════════════════════════════════════

export const config = { runtime: "nodejs" };

import { tryDecrypt, encrypt } from "./_lib/cryptoUtils.js";
import { getAdminClient, getUserIdFromJwt } from "./_lib/supabaseAdmin.js";
import { checkRateLimit, getClientIp } from "./_lib/rateLimit.js";
import { deliverNotification } from "./push.js";
import { sendEmail, weeklyRecapHtml, buildUnsubscribeUrl, winbackEmailHtml } from "./_lib/email.js";
import { fetchWeeklyRecap } from "./_lib/metrics/weeklyRecap.js";
import { isWinbackCandidate } from "./_lib/retention/winback.js";

type Req = { method?: string; headers: Record<string, string | string[] | undefined>; body: Record<string, unknown>; query: Record<string, string | string[] | undefined> };
type Res = { status(n: number): Res; json(d: unknown): Res; end(): void; setHeader(k: string, v: string): void };

const APP_URL = process.env.APP_URL ?? "https://kodatrade.co.uk";
const ALLOWED_ORIGINS = new Set([
  APP_URL,
  APP_URL.replace("://", "://www."),
  "http://localhost:5173",
  "http://localhost:4173",
]);

function cors(req: Req, res: Res) {
  const origin = (req.headers["origin"] as string | undefined) ?? "";
  const allowed = ALLOWED_ORIGINS.has(origin) ? origin : APP_URL;
  res.setHeader("Access-Control-Allow-Origin", allowed);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
}

// ── Cron auth helpers ─────────────────────────────────────────────────────────

function isCronAuthed(req: Req): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;
  const auth = req.headers["authorization"] as string | undefined;
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : "";
  return token === cronSecret;
}

// ══════════════════════════════════════════════════════════════════════════════
// Job: complete-challenges
// ══════════════════════════════════════════════════════════════════════════════

const METRIC_LABELS: Record<string, string> = {
  dollar: "$ P&L", r: "R-multiple", winrate: "Win Rate", trades: "Trades", avgr: "Avg R",
};

function formatValue(metric: string, value: number): string {
  if (metric === "dollar") return `${value >= 0 ? "+" : ""}$${Math.abs(value).toFixed(0)}`;
  if (metric === "winrate") return `${value.toFixed(1)}%`;
  if (metric === "trades") return `${Math.round(value)}`;
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}R`;
}

function getMetricValue(entry: Record<string, number>, metric: string): number {
  if (metric === "dollar")  return entry.totalPnLDollar ?? entry.totalPnL ?? 0;
  if (metric === "r")       return entry.totalPnL ?? 0;
  if (metric === "winrate") return entry.winRate ?? 0;
  if (metric === "trades")  return entry.total ?? 0;
  if (metric === "avgr")    return entry.avgRR ?? 0;
  return 0;
}

async function handleCompleteChallenges(req: Req, res: Res) {
  res.setHeader("Access-Control-Allow-Origin", process.env.APP_URL ?? "https://kodatrade.co.uk");
  res.setHeader("Vary", "Origin");

  if (req.method === "GET") {
    if (!isCronAuthed(req)) return res.status(401).json({ error: "Unauthorized" });
  } else if (req.method === "POST") {
    const userId = await getUserIdFromJwt(req.headers["authorization"] as string | undefined);
    if (!userId) return res.status(401).json({ error: "Not authenticated" });
  } else {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const admin = getAdminClient();

  const { data: expired, error: expErr } = await admin
    .from("circle_challenges")
    .select("*")
    .eq("status", "active")
    .lt("ends_at", new Date().toISOString());

  if (expErr) {
    console.error("[complete-challenges] fetch error:", expErr);
    return res.status(500).json({ error: "fetch failed" });
  }
  if (!expired || expired.length === 0) {
    return res.status(200).json({ completed: 0 });
  }

  let completed = 0;

  for (const challenge of expired) {
    try {
      const { data: entries } = await admin
        .from("shared_kv")
        .select("key, value")
        .like("key", `koda_circle_entry_${challenge.circle_code}_%`);

      if (!entries || entries.length === 0) {
        await admin.from("circle_challenges").update({ status: "completed" }).eq("id", challenge.id);
        completed++;
        continue;
      }

      const parsed = entries
        .map((e: { key: string; value: unknown }) => {
          if (e.value === null || e.value === undefined) return null;
          if (typeof e.value === "object") return e.value;
          if (typeof e.value === "string") {
            try { return JSON.parse(e.value); } catch { return null; }
          }
          return null;
        })
        .filter(Boolean) as Record<string, number>[];

      if (parsed.length === 0) {
        await admin.from("circle_challenges").update({ status: "completed" }).eq("id", challenge.id);
        completed++;
        continue;
      }

      let winner = parsed[0];
      let winnerVal = getMetricValue(winner, challenge.metric);
      for (const entry of parsed.slice(1)) {
        const val = getMetricValue(entry, challenge.metric);
        if (val > winnerVal) { winner = entry; winnerVal = val; }
      }

      await admin.from("circle_challenge_results").insert({
        challenge_id:   challenge.id,
        circle_code:    challenge.circle_code,
        winner_code:    winner.memberCode ?? "",
        winner_name:    winner.name ?? "",
        winner_handle:  winner.handle ?? "",
        winning_value:  winnerVal,
      });

      await admin.from("circle_challenges").update({ status: "completed" }).eq("id", challenge.id);

      const handle = winner.handle ? `@${winner.handle}` : (winner.name ?? "Unknown");
      const metricLabel = METRIC_LABELS[challenge.metric] ?? challenge.metric;
      const valStr = formatValue(challenge.metric, winnerVal);
      await admin.from("circle_messages").insert({
        circle_code:   challenge.circle_code,
        sender_name:   "Kōda",
        sender_handle: "koda",
        text: `🏆 Challenge over — ${handle} wins "${challenge.title}" · ${metricLabel}: ${valStr}`,
      });

      completed++;
    } catch (err) {
      console.error(`[complete-challenges] failed for challenge ${challenge.id}:`, err);
    }
  }

  return res.status(200).json({ completed });
}

// ══════════════════════════════════════════════════════════════════════════════
// Job: sync  (Tradovate broker sync)
// ══════════════════════════════════════════════════════════════════════════════

const DEMO_BASE = "https://demo.tradovateapi.com/v1";
const LIVE_BASE = "https://live.tradovateapi.com/v1";

function tvBase(env: string) {
  return env === "live" ? LIVE_BASE : DEMO_BASE;
}

async function tvGet(url: string, token: string): Promise<any> {
  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  if (!r.ok) throw new Error(`Tradovate ${r.status} at ${url}`);
  return r.json();
}

async function refreshTradovateToken(
  refreshTokenPlain: string,
  env: string
): Promise<{ accessToken: string; expirationTime: string } | null> {
  try {
    const r = await fetch(`${tvBase(env)}/auth/renewaccesstoken`, {
      method:  "POST",
      headers: { Authorization: `Bearer ${refreshTokenPlain}`, "Content-Type": "application/json" },
    });
    if (!r.ok) return null;
    const data = (await r.json()) as any;
    return data?.accessToken ? data : null;
  } catch {
    return null;
  }
}

async function resolveSymbols(
  ids: number[],
  token: string,
  base: string
): Promise<Record<number, string>> {
  if (!ids.length) return {};
  try {
    const unique = [...new Set(ids)].join(",");
    const data: any[] = await tvGet(`${base}/contract/ldeps?masterids=${unique}`, token);
    return Object.fromEntries((data ?? []).map((c: any) => [c.id, c.name ?? `#${c.id}`]));
  } catch {
    return {};
  }
}

function fillsToTradeRows(fills: any[], symbols: Record<number, string>, userId: string): any[] {
  const byContract: Record<number, any[]> = {};
  for (const f of fills) {
    (byContract[f.contractId] ??= []).push(f);
  }

  const rows: any[] = [];

  for (const contractFills of Object.values(byContract)) {
    const sorted = [...contractFills].sort((a, b) =>
      (a.timestamp ?? "").localeCompare(b.timestamp ?? "")
    );

    const longQ:  { fill: any; remaining: number }[] = [];
    const shortQ: { fill: any; remaining: number }[] = [];

    for (const fill of sorted) {
      let toMatch = fill.qty ?? 1;
      const isBuy = fill.action === "Buy";

      if (isBuy) {
        while (toMatch > 0 && shortQ.length > 0) {
          const head    = shortQ[0];
          const matched = Math.min(toMatch, head.remaining);
          const rawPnl  = (head.fill.price - fill.price) * matched;
          rows.push(makeRow(head.fill, fill, matched, rawPnl, symbols, userId));
          head.remaining -= matched;
          toMatch        -= matched;
          if (head.remaining === 0) shortQ.shift();
        }
        if (toMatch > 0) longQ.push({ fill, remaining: toMatch });
      } else {
        while (toMatch > 0 && longQ.length > 0) {
          const head    = longQ[0];
          const matched = Math.min(toMatch, head.remaining);
          const rawPnl  = (fill.price - head.fill.price) * matched;
          rows.push(makeRow(head.fill, fill, matched, rawPnl, symbols, userId));
          head.remaining -= matched;
          toMatch        -= matched;
          if (head.remaining === 0) longQ.shift();
        }
        if (toMatch > 0) shortQ.push({ fill, remaining: toMatch });
      }
    }
  }

  return rows;
}

function makeRow(
  entry: any,
  exit: any,
  qty: number,
  rawPnl: number,
  symbols: Record<number, string>,
  userId: string
): any {
  const symbol    = symbols[entry.contractId] ?? `#${entry.contractId}`;
  const pnl       = parseFloat(rawPnl.toFixed(2));
  const outcome   = pnl > 0 ? "win" : pnl < 0 ? "loss" : "be";
  const entryDate = (entry.timestamp ?? "").split("T")[0] || new Date().toISOString().split("T")[0];
  const externalId = `tv-${entry.id}-${exit.id}`;

  return {
    user_id:       userId,
    pair:          symbol,
    side:          entry.action === "Buy" ? "long" : "short",
    date:          entryDate,
    strategy:      "",
    outcome,
    entry_price:   entry.price ?? null,
    pnl,
    notes:         `${qty} contract${qty !== 1 ? "s" : ""} · auto-imported from Tradovate`,
    screenshots:   [],
    reactions:     {},
    external_id:   externalId,
    source:        "api",
    broker:        "tradovate",
    raw_data:      { entryFill: entry, exitFill: exit, qty },
    review_status: "draft",
  };
}

async function syncConnection(conn: any): Promise<{
  connectionId: string;
  tradesFound: number;
  tradesNew: number;
  error: string | null;
}> {
  const admin        = getAdminClient();
  const connectionId = conn.id as string;
  const userId       = conn.user_id as string;
  const env          = conn.env ?? "live";
  const base         = tvBase(env);

  const { data: claimed } = await admin
    .from("broker_connections")
    .update({ sync_status: "syncing", updated_at: new Date().toISOString() })
    .eq("id", connectionId)
    .in("sync_status", ["connected", "error"])
    .select("id")
    .single();

  if (!claimed) return { connectionId, tradesFound: 0, tradesNew: 0, error: null };

  const eventStart = new Date().toISOString();

  try {
    let accessToken = tryDecrypt(conn.access_token_enc);
    if (!accessToken) throw new Error("Could not decrypt access token");

    const expiresAt = conn.token_expires_at ? new Date(conn.token_expires_at).getTime() : 0;
    if (Date.now() > expiresAt - 10 * 60 * 1000) {
      const refreshToken = tryDecrypt(conn.refresh_token_enc);
      if (refreshToken) {
        const refreshed = await refreshTradovateToken(refreshToken, env);
        if (refreshed) {
          accessToken = refreshed.accessToken;
          const newEnc = encrypt(refreshed.accessToken);
          await admin
            .from("broker_connections")
            .update({ access_token_enc: newEnc, token_expires_at: refreshed.expirationTime })
            .eq("id", connectionId);
        } else if (Date.now() > expiresAt) {
          throw new Error("Access token expired and refresh failed — please reconnect your account");
        } else {
          await admin
            .from("broker_connections")
            .update({ sync_status: "error", sync_error: "Token refresh failed — please reconnect your account" })
            .eq("id", connectionId);
          throw new Error("Token refresh failed — please reconnect your account");
        }
      }
    }

    const MAX_FILLS = 5_000;
    const rawFills  = await tvGet(`${base}/fill/list`, accessToken);
    if (!Array.isArray(rawFills)) throw new Error("Unexpected response from Tradovate fill/list");

    const allFills = rawFills.length > MAX_FILLS
      ? rawFills.sort((a, b) => (b.timestamp ?? "").localeCompare(a.timestamp ?? "")).slice(0, MAX_FILLS)
      : rawFills;

    const lastSync = conn.last_sync_at;
    const since    = lastSync ?? new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const newFills = allFills.filter(f => (f.timestamp ?? "") > since);
    const tradesFound = newFills.length;

    if (newFills.length === 0) {
      await admin
        .from("broker_connections")
        .update({ sync_status: "connected", last_sync_at: new Date().toISOString(), sync_error: null })
        .eq("id", connectionId);

      await admin.from("sync_events").insert({
        user_id: userId, connection_id: connectionId, broker: "tradovate",
        started_at: eventStart, completed_at: new Date().toISOString(),
        trades_found: 0, trades_new: 0,
      });

      return { connectionId, tradesFound: 0, tradesNew: 0, error: null };
    }

    const contractIds = [...new Set(newFills.map(f => f.contractId as number))];
    const symbols     = await resolveSymbols(contractIds, accessToken, base);
    const tradeRows   = fillsToTradeRows(newFills, symbols, userId);

    let tradesNew = 0;
    if (tradeRows.length > 0) {
      const { error: insertErr, data: inserted } = await admin
        .from("trades")
        .upsert(tradeRows, { onConflict: "user_id,external_id", ignoreDuplicates: true })
        .select("id");

      if (insertErr) throw new Error("DB insert failed: " + insertErr.message);
      tradesNew = inserted?.length ?? 0;
    }

    await admin
      .from("broker_connections")
      .update({ sync_status: "connected", last_sync_at: new Date().toISOString(), sync_error: null })
      .eq("id", connectionId);

    await admin.from("sync_events").insert({
      user_id:       userId,
      connection_id: connectionId,
      broker:        "tradovate",
      started_at:    eventStart,
      completed_at:  new Date().toISOString(),
      trades_found:  tradesFound,
      trades_new:    tradesNew,
    });

    return { connectionId, tradesFound, tradesNew, error: null };

  } catch (err: any) {
    const message = err?.message ?? "Unknown error";

    await admin
      .from("broker_connections")
      .update({ sync_status: "error", sync_error: message })
      .eq("id", connectionId);

    await admin.from("sync_events").insert({
      user_id:       userId,
      connection_id: connectionId,
      broker:        "tradovate",
      started_at:    eventStart,
      completed_at:  new Date().toISOString(),
      trades_found:  0,
      trades_new:    0,
      error:         message,
    });

    return { connectionId, tradesFound: 0, tradesNew: 0, error: message };
  }
}

async function runWithConcurrency<T>(
  tasks: (() => Promise<T>)[],
  limit: number
): Promise<T[]> {
  const results: T[] = [];
  let index = 0;

  async function worker() {
    while (index < tasks.length) {
      const i = index++;
      results[i] = await tasks[i]();
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
  return results;
}

async function handleSync(req: Req, res: Res) {
  const admin = getAdminClient();

  if (req.method === "POST") {
    const userId = await getUserIdFromJwt(req.headers["authorization"] as string | undefined);
    if (!userId) return res.status(401).json({ error: "Not authenticated" });

    const ip      = getClientIp(req);
    const allowed = await checkRateLimit("manual_sync", ip, { limit: 10, windowMs: 600_000 });
    if (!allowed) return res.status(429).json({ error: "Too many sync requests — try again in a few minutes" });

    const { data: conns, error } = await admin
      .from("broker_connections")
      .select("*")
      .eq("user_id", userId)
      .in("sync_status", ["connected", "error"]);

    if (error) return res.status(500).json({ error: error.message });
    if (!conns?.length) return res.status(200).json({ ok: true, results: [], message: "No connected accounts" });

    const results = await runWithConcurrency(
      (conns ?? []).map((conn: unknown) => () => syncConnection(conn as Parameters<typeof syncConnection>[0])),
      5
    );

    return res.status(200).json({ ok: true, results });
  }

  if (req.method === "GET") {
    if (!process.env.CRON_SECRET) return res.status(500).json({ error: "CRON_SECRET not configured" });
    if (!isCronAuthed(req)) return res.status(401).json({ error: "Invalid cron secret" });

    const { data: conns, error } = await admin
      .from("broker_connections")
      .select("*")
      .in("sync_status", ["connected", "error"]);

    if (error) return res.status(500).json({ error: error.message });
    if (!conns?.length) return res.status(200).json({ ok: true, synced: 0 });

    const results = (await runWithConcurrency(
      (conns ?? []).map((conn: unknown) => () => syncConnection(conn as Parameters<typeof syncConnection>[0])),
      10
    )) as { tradesNew: number; error?: unknown }[];

    const totalNew = results.reduce((s, r) => s + (r.tradesNew ?? 0), 0);
    const errored  = results.filter(r => r.error);

    return res.status(200).json({
      ok: true, synced: conns.length, tradesNew: totalNew, errors: errored.length,
    });
  }

  return res.status(405).json({ error: "GET or POST required" });
}

// ══════════════════════════════════════════════════════════════════════════════
// Job: news-calendar  (ForexFactory → news_cache)
//
// Reverted from Finnhub 2026-06-11: Finnhub removed /calendar/economic from
// the free tier — every call 403s (key still valid; invalid keys get 401).
// Trade-off: the free FF feed never populates `actual`, so released events
// show forecast/previous only. The client already renders actual:null fine.
// ══════════════════════════════════════════════════════════════════════════════

const FF_URLS = [
  "https://nfs.faireconomy.media/ff_calendar_thisweek.json",
  "https://nfs.faireconomy.media/ff_calendar_nextweek.json",
];

type FFEvent = {
  title?: string;
  country?: string;   // currency codes already (USD, EUR, …) or "All"
  date?: string;      // ISO with offset, e.g. "2026-06-07T05:15:00-04:00"
  impact?: string;
  forecast?: string;
  previous?: string;
};

function kebab(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function normaliseFFEvent(raw: FFEvent): Record<string, unknown> | null {
  if (!raw.title || !raw.country || !raw.date) return null;
  const time = raw.date;
  const impactRaw = (raw.impact ?? "").toLowerCase();
  const impact = ["high", "medium", "low", "holiday"].includes(impactRaw)
    ? impactRaw
    : "low";
  const day = time.slice(0, 10);
  const id = `ff-${kebab(raw.title)}-${day}`;
  return {
    id,
    title: raw.title,
    country: raw.country,
    time,
    impact,
    forecast: raw.forecast || null,
    previous: raw.previous || null,
    actual: null,
  };
}

async function fetchFFWeek(url: string): Promise<FFEvent[]> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10_000);
  try {
    const upstream = await fetch(url, { signal: ctrl.signal });
    if (!upstream.ok) {
      console.error("[news-calendar] upstream non-200:", upstream.status, url);
      return [];
    }
    const raw = (await upstream.json()) as unknown;
    if (!Array.isArray(raw)) {
      console.error("[news-calendar] invalid response shape:", url);
      return [];
    }
    return raw as FFEvent[];
  } catch (err) {
    console.error("[news-calendar] fetch failed:", url, err);
    return [];
  } finally {
    clearTimeout(timer);
  }
}

async function handleNewsCalendar(req: Req, res: Res) {
  if (!isCronAuthed(req)) return res.status(401).json({ error: "Unauthorized" });

  try {
    // This week + next week; tolerate one feed failing.
    const weeks = await Promise.all(FF_URLS.map(fetchFFWeek));

    // Dedupe the overlap between the two feeds on id+time (NOT id alone —
    // the same title can legitimately recur at different times in one day).
    const seen = new Set<string>();
    const events: Record<string, unknown>[] = [];
    for (const item of weeks.flat()) {
      const ev = normaliseFFEvent(item);
      const dedupeKey = ev ? `${ev.id}|${ev.time}` : "";
      if (ev && !seen.has(dedupeKey)) {
        seen.add(dedupeKey);
        events.push(ev);
      }
    }
    if (events.length === 0) {
      console.error("[news-calendar] no valid events after normalization");
      return res.status(200).json({ ok: false, reason: "no valid events" });
    }

    const admin = getAdminClient();
    const value = { fetched_at: new Date().toISOString(), events };
    const { error } = await admin.from("news_cache").upsert({
      key: "koda_news_calendar",
      value,
      updated_at: new Date().toISOString(),
    });
    if (error) {
      console.error("[news-calendar] upsert error:", error);
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ ok: true, count: events.length });
  } catch (err) {
    console.error("[news-calendar] failed:", err);
    return res.status(200).json({ ok: false, reason: "exception" });
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Job: news-headlines  (Marketaux → shared_kv)
// ══════════════════════════════════════════════════════════════════════════════

const MARKETAUX_URL = "https://api.marketaux.com/v1/news/all";

type MarketauxArticle = {
  uuid?: string;
  title?: string;
  description?: string;
  url?: string;
  source?: string;
  published_at?: string;
};

function normaliseMarketauxArticle(raw: MarketauxArticle): Record<string, unknown> | null {
  if (!raw.title || !raw.url || !raw.source || !raw.published_at) return null;
  return {
    id: raw.uuid ?? `${raw.source}-${raw.published_at}`,
    title: raw.title,
    source: raw.source,
    url: raw.url,
    published_at: raw.published_at,
    snippet: raw.description ?? null,
  };
}

async function handleNewsHeadlines(req: Req, res: Res) {
  if (!isCronAuthed(req)) return res.status(401).json({ error: "Unauthorized" });

  const apiKey = process.env.MARKETAUX_API_KEY;
  if (!apiKey) {
    console.error("[news-headlines] MARKETAUX_API_KEY not set");
    return res.status(200).json({ ok: false, reason: "no api key" });
  }

  try {
    const url = `${MARKETAUX_URL}?countries=us&language=en&limit=20&api_token=${apiKey}`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10_000);
    const upstream = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);

    if (!upstream.ok) {
      console.error("[news-headlines] upstream non-200:", upstream.status);
      return res.status(200).json({ ok: false, reason: `upstream ${upstream.status}` });
    }
    const body = (await upstream.json()) as unknown;
    if (
      typeof body !== "object" ||
      body === null ||
      !Array.isArray((body as { data?: unknown[] }).data)
    ) {
      console.error("[news-headlines] invalid response shape");
      return res.status(200).json({ ok: false, reason: "bad shape" });
    }
    const rawArticles = (body as { data: MarketauxArticle[] }).data;

    const articles: Record<string, unknown>[] = [];
    for (const item of rawArticles) {
      const a = normaliseMarketauxArticle(item);
      if (a) articles.push(a);
    }
    if (articles.length === 0) {
      console.error("[news-headlines] no valid articles after normalization");
      return res.status(200).json({ ok: false, reason: "no valid articles" });
    }

    const admin = getAdminClient();
    const value = { fetched_at: new Date().toISOString(), articles };
    const { error } = await admin.from("news_cache").upsert({
      key: "koda_news_headlines",
      value,
      updated_at: new Date().toISOString(),
    });
    if (error) {
      console.error("[news-headlines] upsert error:", error);
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ ok: true, count: articles.length });
  } catch (err) {
    console.error("[news-headlines] failed:", err);
    return res.status(200).json({ ok: false, reason: "exception" });
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Job: weekly-digest  (Sunday 18:00 UTC — consolidates the past 7 days)
// ══════════════════════════════════════════════════════════════════════════════

/** Real deliverable email for a user: recovery_email from auth metadata, or null. */
async function recoveryEmailForUid(admin: ReturnType<typeof getAdminClient>, uid: string): Promise<string | null> {
  const { data } = await admin.schema("auth").from("users")
    .select("raw_user_meta_data").eq("id", uid).maybeSingle();
  const meta = (data as { raw_user_meta_data?: { recovery_email?: string } } | null)?.raw_user_meta_data;
  const email = meta?.recovery_email?.trim();
  return email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

/** Batched recovery emails for many uids → Map<uid, email>. */
async function recoveryEmailsForUids(admin: ReturnType<typeof getAdminClient>, uids: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (uids.length === 0) return out;
  const { data } = await admin.schema("auth").from("users")
    .select("id, raw_user_meta_data").in("id", uids);
  for (const row of (data ?? []) as { id: string; raw_user_meta_data?: { recovery_email?: string } }[]) {
    const email = row.raw_user_meta_data?.recovery_email?.trim();
    if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) out.set(row.id, email);
  }
  return out;
}

async function handleWeeklyDigest(req: Req, res: Res) {
  if (!isCronAuthed(req)) return res.status(401).json({ error: "Unauthorized" });
  const admin = getAdminClient();

  let userCount = 0;

  // 1. Pull notifications from the past 7 days that haven't been aggregated yet
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  const { data: rows, error: rowsErr } = await admin
    .from("notification_feed")
    .select("user_id, kind, data, id")
    .gte("created_at", sevenDaysAgo)
    .is("aggregated_at", null);
  if (rowsErr) {
    console.error("[weekly-digest] fetch error:", rowsErr);
    // Do not return — social digest failure must not block the recap pass.
  }

  if (rows && rows.length) {
    // 2. Group by user_id, count by kind
    const byUser: Record<string, { ids: string[]; counts: Record<string, number> }> = {};
    for (const r of rows) {
      const uid = r.user_id as string;
      if (!byUser[uid]) byUser[uid] = { ids: [], counts: {} };
      byUser[uid].ids.push(r.id as string);
      const kind = r.kind as string;
      byUser[uid].counts[kind] = (byUser[uid].counts[kind] ?? 0) + 1;
    }

    // 3. For each user: deliver summary, mark rows aggregated
    userCount = Object.keys(byUser).length;
    for (const [uid, agg] of Object.entries(byUser)) {
      const parts: string[] = [];
      if (agg.counts.follow)      parts.push(`${agg.counts.follow} new follower${agg.counts.follow > 1 ? "s" : ""}`);
      if (agg.counts.circle_join) parts.push(`${agg.counts.circle_join} circle join${agg.counts.circle_join > 1 ? "s" : ""}`);
      if (agg.counts.reaction)    parts.push(`${agg.counts.reaction} reaction${agg.counts.reaction > 1 ? "s" : ""}`);
      if (agg.counts.idea_like)   parts.push(`${agg.counts.idea_like} idea like${agg.counts.idea_like > 1 ? "s" : ""}`);

      if (parts.length === 0) continue; // nothing useful to summarise (only digest rows or unknown kinds)

      const body = `This week: ${parts.join(" · ")}`;

      try {
        await deliverNotification({
          targetUid: uid,
          kind: "digest",
          title: "Your Kōda week",
          body,
          data: { counts: agg.counts },
        });
      } catch (err) {
        console.error("[weekly-digest] deliver failed for user", uid, err);
        // Don't mark aggregated if delivery failed — try again next week
        continue;
      }

      await admin
        .from("notification_feed")
        .update({ aggregated_at: new Date().toISOString() })
        .in("id", agg.ids);
    }
  }

  // ── Weekly trading recap email (separate from the social digest above) ──
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setUTCDate(now.getUTCDate() - now.getUTCDay()); // back to Sunday
  weekStart.setUTCHours(0, 0, 0, 0);
  const weekStartIso = weekStart.toISOString();
  const weekLabel = `${weekStart.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}–${now.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`;

  const { data: optedIn } = await admin
    .from("profiles")
    .select("user_id, name, unsubscribe_token, last_weekly_recap_at")
    .eq("weekly_recap_opt_in", true);

  let recapsSent = 0;
  for (const p of optedIn ?? []) {
    const prof = p as { user_id: string; name: string; unsubscribe_token: string; last_weekly_recap_at: string | null };
    if (prof.last_weekly_recap_at && prof.last_weekly_recap_at >= weekStartIso) continue; // already sent this week

    const recap = await fetchWeeklyRecap(prof.user_id);
    if (recap.tradeCount < 1) continue; // empty week → win-back's job, not the recap's

    const email = await recoveryEmailForUid(admin, prof.user_id);
    if (!email) continue; // no deliverable address → skip (push handled elsewhere)

    try {
      await sendEmail({
        to: email,
        subject: `Your Kōda week: ${recap.netDollar >= 0 ? "+" : "-"}$${Math.abs(Math.round(recap.netDollar))}`,
        html: weeklyRecapHtml({
          name: prof.name || "Trader",
          netDollar: recap.netDollar, winRate: recap.winRate, netR: recap.netR,
          bestSetup: recap.bestSetup, tradeCount: recap.tradeCount, weekLabel,
          unsubscribeUrl: buildUnsubscribeUrl(prof.unsubscribe_token, "weekly"),
        }),
      });
      await admin.from("profiles").update({ last_weekly_recap_at: new Date().toISOString() }).eq("user_id", prof.user_id);
      recapsSent++;
    } catch (err) {
      console.error("[weekly-digest] recap email failed for", prof.user_id, err);
      // leave last_weekly_recap_at untouched → retried next run
    }
  }

  return res.status(200).json({ ok: true, users: userCount, recapsSent });
}

// ══════════════════════════════════════════════════════════════════════════════
// Job: winback  (daily — re-engage users idle 7–14 days)
// ══════════════════════════════════════════════════════════════════════════════

async function handleWinback(req: Req, res: Res) {
  if (!isCronAuthed(req)) return res.status(401).json({ error: "Unauthorized" });
  const admin = getAdminClient();

  const nowMs = Date.now();
  const idleMinIso  = new Date(nowMs - 14 * 24 * 3600 * 1000).toISOString(); // active no earlier than 14d ago
  const idleMaxIso  = new Date(nowMs -  7 * 24 * 3600 * 1000).toISOString(); // active no later than 7d ago
  const cooldownIso = new Date(nowMs - 30 * 24 * 3600 * 1000).toISOString();

  const { data: profiles } = await admin
    .from("profiles")
    .select("user_id, name, unsubscribe_token, last_active_at, winback_opt_in, last_winback_at")
    .eq("winback_opt_in", true)
    .gte("last_active_at", idleMinIso)
    .lte("last_active_at", idleMaxIso)
    .or(`last_winback_at.is.null,last_winback_at.lt.${cooldownIso}`);

  // Belt-and-suspenders: apply in-memory guard after DB filter
  const candidates = (profiles ?? []).filter(row => {
    const p = row as {
      last_active_at: string | null; winback_opt_in: boolean; last_winback_at: string | null;
    };
    return isWinbackCandidate(
      { last_active_at: p.last_active_at, winback_opt_in: p.winback_opt_in, last_winback_at: p.last_winback_at },
    );
  }) as {
    user_id: string; name: string; unsubscribe_token: string;
    last_active_at: string | null; winback_opt_in: boolean; last_winback_at: string | null;
  }[];

  // Batch-fetch all recovery emails in one query
  const emailMap = await recoveryEmailsForUids(admin, candidates.map(c => c.user_id));

  let sent = 0;
  for (const p of candidates) {
    const email = emailMap.get(p.user_id) ?? null;

    try {
      if (email) {
        await sendEmail({
          to: email,
          subject: "Your Kōda edge is waiting",
          html: winbackEmailHtml({
            firstName: p.name || "Trader",
            unsubscribeUrl: buildUnsubscribeUrl(p.unsubscribe_token, "winback"),
          }),
        });
      }
      // Best-effort push too (no-op if not subscribed)
      await deliverNotification({
        targetUid: p.user_id,
        kind: "digest",
        title: "Your edge is waiting",
        body: "It's been a minute — log a trade and pick the thread back up.",
        data: { reason: "winback" },
      }).catch(() => {});

      await admin.from("profiles").update({ last_winback_at: new Date().toISOString() }).eq("user_id", p.user_id);
      sent++;
    } catch (err) {
      console.error("[winback] failed for", p.user_id, err);
      // leave last_winback_at untouched → retried next run
    }
  }

  return res.status(200).json({ ok: true, sent });
}

// ══════════════════════════════════════════════════════════════════════════════
// Router
// ══════════════════════════════════════════════════════════════════════════════

export default async function handler(req: Req, res: Res) {
  cors(req, res);
  if (req.method === "OPTIONS") return res.status(200).end();

  const job = req.query?.job as string | undefined;

  if (job === "complete-challenges") return handleCompleteChallenges(req, res);
  if (job === "sync")                return handleSync(req, res);
  if (job === "news-calendar")       return handleNewsCalendar(req, res);
  if (job === "news-headlines")      return handleNewsHeadlines(req, res);
  if (job === "weekly-digest")       return handleWeeklyDigest(req, res);
  if (job === "winback")             return handleWinback(req, res);

  if (job === 'daily-digest') {
    if (!isCronAuthed(req)) return res.status(401).json({ error: 'Unauthorized' });
    const { sendDailyDigest } = await import('./_lib/metrics/digest.js');
    await sendDailyDigest();
    return res.status(200).json({ ok: true });
  }

  return res.status(400).json({ error: "?job= required: complete-challenges | sync | daily-digest | news-calendar | news-headlines | weekly-digest | winback" });
}
