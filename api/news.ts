export const config = { runtime: "nodejs" };

import { getAdminClient } from "./_lib/supabaseAdmin.js";

type Req = { method?: string; headers: Record<string, string | string[] | undefined> };
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
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
}

const STALE_HEADLINES_MS = 15 * 60 * 1000;
const STALE_CALENDAR_MS  = 15 * 60 * 1000; // 15min — picks up actual values shortly after release

export default async function handler(req: Req, res: Res) {
  cors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();

  const db = getAdminClient();
  const { data: rows } = await db
    .from("news_cache")
    .select("key, value, updated_at")
    .in("key", ["koda_news_calendar", "koda_news_headlines"]);

  const byKey = Object.fromEntries((rows ?? []).map((r) => [r.key, r]));
  const now = Date.now();
  const age = (row: { updated_at: string } | undefined) =>
    row ? now - new Date(row.updated_at).getTime() : Infinity;

  const calStale = age(byKey["koda_news_calendar"]) > STALE_CALENDAR_MS;
  const hlStale  = age(byKey["koda_news_headlines"]) > STALE_HEADLINES_MS;

  if (calStale || hlStale) {
    const baseUrl = process.env.APP_URL ?? "https://kodatrade.co.uk";
    const headers = { Authorization: `Bearer ${process.env.CRON_SECRET ?? ""}` };

    await Promise.all([
      calStale && fetch(`${baseUrl}/api/cron?job=news-calendar`,  { headers }).catch(() => {}),
      hlStale  && fetch(`${baseUrl}/api/cron?job=news-headlines`, { headers }).catch(() => {}),
    ].filter(Boolean));

    const { data: fresh } = await db
      .from("news_cache")
      .select("key, value")
      .in("key", ["koda_news_calendar", "koda_news_headlines"]);

    const freshMap = Object.fromEntries((fresh ?? []).map((r) => [r.key, r.value]));
    return res.json({
      calendar:  freshMap["koda_news_calendar"]  ?? byKey["koda_news_calendar"]?.value  ?? null,
      headlines: freshMap["koda_news_headlines"] ?? byKey["koda_news_headlines"]?.value ?? null,
    });
  }

  return res.json({
    calendar:  byKey["koda_news_calendar"]?.value  ?? null,
    headlines: byKey["koda_news_headlines"]?.value ?? null,
  });
}
