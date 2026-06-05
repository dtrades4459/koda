// ═══════════════════════════════════════════════════════════════════════════════
// Kōda · /api/admin/metrics  (founder dashboard)
//
// Single dynamic route — Vercel passes the path segment as req.query.action.
// Mounted at api/admin/[action].ts so future admin endpoints can be added
// without burning new Vercel-function slots (Hobby plan = 12).
//
// SECURITY MODEL
//   1. Caller must present a valid Supabase JWT in `Authorization: Bearer …`.
//   2. The decoded user's email must appear in the ADMIN_EMAILS env var
//      (comma-separated). Both checks are server-side; no client gate is trusted.
//   3. SUPABASE_SERVICE_ROLE_KEY bypasses RLS — it only lives here, never the
//      client bundle.
//
// ENV VARS REQUIRED
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  (already set for the rest of /api)
//   ADMIN_EMAILS                              (comma-separated email allowlist)
// ═══════════════════════════════════════════════════════════════════════════════

export const config = { runtime: "nodejs" };

import { getAdminClient } from "../lib/supabaseAdmin.js";
import { sendEmail, announcementEmailHtml } from "../lib/email.js";

type VercelRequest  = { method?: string; headers: Record<string, string | string[] | undefined>; body: Record<string, unknown>; query: Record<string, string | string[] | undefined> };
type VercelResponse = { status(n: number): VercelResponse; json(d: unknown): VercelResponse; end(): void; setHeader(k: string, v: string): void };

const APP_URL = process.env.APP_URL ?? "https://kodatrade.co.uk";
const ALLOWED_ORIGINS = new Set([
  APP_URL,
  APP_URL.replace("://", "://www."),
  "http://localhost:5173",
  "http://localhost:4173",
]);

function cors(req: VercelRequest, res: VercelResponse) {
  const origin = (req.headers["origin"] as string) ?? "";
  const allowed = ALLOWED_ORIGINS.has(origin) ? origin : APP_URL;
  res.setHeader("Access-Control-Allow-Origin", allowed);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

function parseAllowlist(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);
}

async function requireAdmin(req: VercelRequest): Promise<{ ok: true; email: string } | { ok: false; status: number; error: string }> {
  const auth = req.headers["authorization"];
  const header = Array.isArray(auth) ? auth[0] : auth;
  if (!header?.startsWith("Bearer ")) {
    return { ok: false, status: 401, error: "Not authenticated" };
  }
  const token = header.slice(7);

  const admin = getAdminClient();
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user?.email) {
    return { ok: false, status: 401, error: "Not authenticated" };
  }

  const allowlist = parseAllowlist();
  if (allowlist.length === 0) {
    console.error("[admin/metrics] ADMIN_EMAILS env var is not set — refusing all requests");
    return { ok: false, status: 503, error: "Admin allowlist not configured" };
  }

  const email = data.user.email.toLowerCase();
  if (!allowlist.includes(email)) {
    return { ok: false, status: 403, error: "Forbidden" };
  }

  return { ok: true, email };
}

// ──────────────────────────────────────────────────────────────────────────────
// Action: metrics — returns the founder dashboard JSON blob
// ──────────────────────────────────────────────────────────────────────────────

async function handleMetrics(_req: VercelRequest, res: VercelResponse) {
  const admin = getAdminClient();
  const { data, error } = await admin.rpc("get_founder_metrics");
  if (error) {
    console.error("[admin/metrics] rpc:", error);
    return res.status(500).json({ error: error.message });
  }
  // Cache for 60s on Vercel's edge so repeat refreshes are cheap. The data
  // is per-deployment private to admins — safe to cache.
  res.setHeader("Cache-Control", "private, max-age=60");
  return res.status(200).json(data);
}

// ──────────────────────────────────────────────────────────────────────────────
// Action: broadcast — send the announcement email to all (or a tagged subset)
//   POST /api/admin/broadcast
//   Body: { headline, accent?, body, ctaLabel?, ctaUrl, dryRun?, audience? }
//     audience defaults to "all" (every user_kv koda_profile with an email)
//
// Throttled to a sane chunk-per-second so we don't burst Resend. The handler
// reports back { sent, skipped, failed, dryRun, audience }.
// ──────────────────────────────────────────────────────────────────────────────

interface BroadcastBody {
  headline:  string;
  accent?:   string;
  body:      string;
  ctaLabel?: string;
  ctaUrl:    string;
  dryRun?:   boolean;
  audience?: "all";
}

async function handleBroadcast(req: VercelRequest, res: VercelResponse, sender: string) {
  const body = req.body as unknown as BroadcastBody | undefined;
  if (!body?.headline?.trim() || !body.body?.trim() || !body.ctaUrl?.trim()) {
    return res.status(400).json({ error: "headline, body, and ctaUrl are required" });
  }

  const admin = getAdminClient();
  const { data: rows, error } = await admin
    .from("user_kv")
    .select("user_id, value")
    .eq("key", "koda_profile");

  if (error) {
    console.error("[admin/broadcast] fetch profiles:", error);
    return res.status(500).json({ error: error.message });
  }

  const recipients: { uid: string; email: string }[] = [];
  for (const r of rows ?? []) {
    try {
      const profile = typeof r.value === "string" ? JSON.parse(r.value) : r.value;
      const email = (profile?.email as string | undefined)?.trim();
      if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        recipients.push({ uid: r.user_id as string, email });
      }
    } catch { /* skip malformed rows */ }
  }

  if (body.dryRun) {
    return res.status(200).json({
      dryRun: true,
      audience: body.audience ?? "all",
      recipients: recipients.length,
      sender,
    });
  }

  const html = announcementEmailHtml({
    headline: body.headline,
    accent: body.accent,
    body: body.body,
    ctaLabel: body.ctaLabel ?? "See how it works",
    ctaUrl: body.ctaUrl,
  });

  let sent = 0;
  let failed = 0;
  const subject = body.headline;
  const CHUNK = 20;
  for (let i = 0; i < recipients.length; i += CHUNK) {
    const batch = recipients.slice(i, i + CHUNK);
    await Promise.all(batch.map(async ({ email }) => {
      try {
        await sendEmail({ to: email, subject, html });
        sent++;
      } catch (e) {
        console.error("[admin/broadcast] send failed", email, e);
        failed++;
      }
    }));
    // 1s between chunks to stay polite to Resend
    if (i + CHUNK < recipients.length) await new Promise(r => setTimeout(r, 1000));
  }

  console.log(`[admin/broadcast] sender=${sender} sent=${sent} failed=${failed}`);
  return res.status(200).json({ sent, failed, audience: body.audience ?? "all" });
}

// ──────────────────────────────────────────────────────────────────────────────
// Router
// ──────────────────────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(req, res);
  if (req.method === "OPTIONS") return res.status(200).end();

  const gate = await requireAdmin(req);
  if (!gate.ok) return res.status(gate.status).json({ error: gate.error });

  const action = req.query?.action as string | undefined;

  if (action === "metrics") {
    if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
    return handleMetrics(req, res);
  }

  if (action === "broadcast") {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    return handleBroadcast(req, res, gate.email);
  }

  if (action === "promote-waitlister") {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    return handlePromoteWaitlister(req, res, gate.email);
  }

  return res.status(404).json({ error: "Unknown admin action" });
}

// ──────────────────────────────────────────────────────────────────────────────
// Action: promote-waitlister — POST { email }
//
// Marks the waitlist row as promoted (sets `promoted_at = now()` via the
// promote_waitlister RPC). Every active waitlister behind them shifts up
// by 1 in the active-queue position. The next waitlist-positions cron will
// email anyone whose visible position moved.
// ──────────────────────────────────────────────────────────────────────────────

async function handlePromoteWaitlister(req: VercelRequest, res: VercelResponse, sender: string) {
  const body = req.body as unknown as { email?: string } | undefined;
  const email = body?.email?.trim().toLowerCase();
  if (!email) return res.status(400).json({ error: "email required" });

  const admin = getAdminClient();
  const { error } = await admin.rpc("promote_waitlister", { target_email: email });
  if (error) {
    console.error("[admin/promote-waitlister] rpc:", error);
    return res.status(500).json({ error: error.message });
  }
  console.log(`[admin/promote-waitlister] sender=${sender} promoted=${email}`);
  return res.status(200).json({ ok: true, email });
}
