// ═══════════════════════════════════════════════════════════════════════════════
// Kōda · POST /api/broker/disconnect
//
// Deletes the broker connection for the authenticated user.
// Body: { broker: "tradovate", env: "demo"|"live" }
// Auth: Supabase JWT in Authorization header
//
// Rate limit: 10 disconnects per 10 minutes per IP (generous — disconnect is
// a benign action, but still cap it to prevent DB churn).
// ═══════════════════════════════════════════════════════════════════════════════

export const config = { runtime: "nodejs" };

import { getAdminClient, getUserIdFromJwt } from "../lib/supabaseAdmin.js";
import { checkRateLimit, getClientIp } from "../lib/rateLimit.js";

const ALLOWED_ORIGINS = new Set([
  "https://tradrjournal.xyz",
  "https://www.tradrjournal.xyz",
  "http://localhost:5173",
  "http://localhost:4173",
]);

function cors(req: any, res: any) {
  const origin = req.headers["origin"] ?? "";
  const allowed = ALLOWED_ORIGINS.has(origin) ? origin : "https://tradrjournal.xyz";
  res.setHeader("Access-Control-Allow-Origin", allowed);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

export default async function handler(req: any, res: any) {
  cors(req, res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  // ── Auth ────────────────────────────────────────────────────────────────────
  const userId = await getUserIdFromJwt(req.headers["authorization"]);
  if (!userId) return res.status(401).json({ error: "Not authenticated" });

  // ── Rate limit ──────────────────────────────────────────────────────────────
  const ip = getClientIp(req);
  const allowed = await checkRateLimit("broker_disconnect", ip, { limit: 10, windowMs: 600_000 });
  if (!allowed) {
    return res.status(429).json({ error: "Too many requests" });
  }

  const { broker = "tradovate", env = "demo" } = req.body || {};

  const admin = getAdminClient();
  const { error } = await admin
    .from("broker_connections")
    .delete()
    .eq("user_id", userId)
    .eq("broker", broker)
    .eq("env", env);

  if (error) {
    console.error("[broker/disconnect] DB error:", error);
    return res.status(500).json({ error: "Failed to disconnect" });
  }

  return res.status(200).json({ ok: true });
}
