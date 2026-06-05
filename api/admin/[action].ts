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
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
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
// Router
// ──────────────────────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(req, res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const gate = await requireAdmin(req);
  if (!gate.ok) return res.status(gate.status).json({ error: gate.error });

  const action = req.query?.action as string | undefined;
  if (action === "metrics") return handleMetrics(req, res);

  return res.status(404).json({ error: "Unknown admin action" });
}
