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
// Job: news-calendar  (Finnhub → news_cache)
//
// Finnhub's free-tier economic calendar provides actuals once events release,
// unlike ForexFactory's free JSON feed which never populates the actual field.
// ══════════════════════════════════════════════════════════════════════════════

const FINNHUB_CALENDAR_URL = "https://finnhub.io/api/v1/calendar/economic";

type FinnhubEvent = {
  actual?: number | null;
  country?: string;
  estimate?: number | null;
  event?: string;
  impact?: string;
  prev?: number | null;
  time?: string;
  unit?: string;
};

// Finnhub uses ISO 3166 two-letter country codes; our app filters on currency
// codes (USD, EUR, etc.) so map the common ones we care about.
const COUNTRY_TO_CURRENCY: Record<string, string> = {
  US: "USD", GB: "GBP", JP: "JPY", AU: "AUD", CA: "CAD", CH: "CHF",
  NZ: "NZD", CN: "CNY",
  DE: "EUR", FR: "EUR", IT: "EUR", ES: "EUR", NL: "EUR", BE: "EUR",
  AT: "EUR", IE: "EUR", FI: "EUR", PT: "EUR", GR: "EUR", EU: "EUR",
};

function kebab(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function withUnit(val: number | null | undefined, unit: string | undefined): string | null {
  if (val === null || val === undefined) return null;
  return `${val}${unit ?? ""}`;
}

function normaliseFinnhubEvent(raw: FinnhubEvent): Record<string, unknown> | null {
  if (!raw.event || !raw.country || !raw.time) return null;
  // Finnhub time is "YYYY-MM-DD HH:mm:ss" in UTC; convert to ISO with Z.
  const time = `${raw.time.replace(" ", "T")}Z`;
  const impactRaw = (raw.impact ?? "").toLowerCase();
  const impact = ["high", "medium", "low", "holiday"].includes(impactRaw)
    ? impactRaw
    : "low";
  const day = time.slice(0, 10);
  const id = `ec-${kebab(raw.event)}-${day}`;
  const country = COUNTRY_TO_CURRENCY[raw.country] ?? raw.country;
  return {
    id,
    title: raw.event,
    country,
    time,
    impact,
    forecast: withUnit(raw.estimate ?? null, raw.unit),
    previous: withUnit(raw.prev ?? null, raw.unit),
    actual:   withUnit(raw.actual ?? null, raw.unit),
  };
}

async function handleNewsCalendar(req: Req, res: Res) {
  if (!isCronAuthed(req)) return res.status(401).json({ error: "Unauthorized" });

  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) {
    console.error("[news-calendar] FINNHUB_API_KEY not set");
    return res.status(200).json({ ok: false, reason: "no api key" });
  }

  try {
    // Window: 7 days back (capture actuals as they fill in) to 14 days ahead.
    const now = new Date();
    const from = new Date(now); from.setUTCDate(from.getUTCDate() - 7);
    const to   = new Date(now); to.setUTCDate(to.getUTCDate() + 14);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    const url = `${FINNHUB_CALENDAR_URL}?from=${fmt(from)}&to=${fmt(to)}&token=${apiKey}`;

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10_000);
    const upstream = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);

    if (!upstream.ok) {
      console.error("[news-calendar] upstream non-200:", upstream.status);
      return res.status(200).json({ ok: false, reason: `upstream ${upstream.status}` });
    }
    const body = (await upstream.json()) as unknown;
    if (
      typeof body !== "object" ||
      body === null ||
      !Array.isArray((body as { economicCalendar?: unknown[] }).economicCalendar)
    ) {
      console.error("[news-calendar] invalid response shape");
      return res.status(200).json({ ok: false, reason: "bad shape" });
    }
    const rawEvents = (body as { economicCalendar: FinnhubEvent[] }).economicCalendar;

    const events: Record<string, unknown>[] = [];
    for (const item of rawEvents) {
      const ev = normaliseFinnhubEvent(item);
      if (ev) events.push(ev);
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

async function handleWeeklyDigest(req: Req, res: Res) {
  if (!isCronAuthed(req)) return res.status(401).json({ error: "Unauthorized" });
  const admin = getAdminClient();

  // 1. Pull notifications from the past 7 days that haven't been aggregated yet
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  const { data: rows, error: rowsErr } = await admin
    .from("notification_feed")
    .select("user_id, kind, data, id")
    .gte("created_at", sevenDaysAgo)
    .is("aggregated_at", null);
  if (rowsErr) {
    console.error("[weekly-digest] fetch error:", rowsErr);
    return res.status(500).json({ error: rowsErr.message });
  }
  if (!rows?.length) return res.status(200).json({ ok: true, users: 0 });

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
  const userCount = Object.keys(byUser).length;
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

  return res.status(200).json({ ok: true, users: userCount });
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

  if (job === 'daily-digest') {
    if (!isCronAuthed(req)) return res.status(401).json({ error: 'Unauthorized' });
    const { sendDailyDigest } = await import('./_lib/metrics/digest.js');
    await sendDailyDigest();
    return res.status(200).json({ ok: true });
  }

  return res.status(400).json({ error: "?job= required: complete-challenges | sync | daily-digest | news-calendar | news-headlines | weekly-digest" });
}
