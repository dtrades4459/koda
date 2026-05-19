// ═══════════════════════════════════════════════════════════════════════════════
// TRADR · POST /api/broker/disconnect
//
// Removes a broker connection for the authenticated user.
// Body: { connectionId: string }
// ═══════════════════════════════════════════════════════════════════════════════

export const config = { runtime: "nodejs" };

import { getAdminClient, getUserIdFromJwt } from "../lib/supabaseAdmin";

const ALLOWED_ORIGINS = new Set([
  "https://tradrjournal.xyz",
  "https://www.tradrjournal.xyz",
  "http://localhost:5173",
  "http://localhost:4173",
]);

function cors(req: any, res: any) {
  const origin  = req.headers["origin"] ?? "";
  const allowed = ALLOWED_ORIGINS.has(origin) ? origin : "https://tradrjournal.xyz";
  res.setHeader("Access-Control-Allow-Origin", allowed);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

export default async function handler(req: any, res: any) {
  cors(req, res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")    return res.status(405).json({ error: "POST required" });

  const userId = await getUserIdFromJwt(req.headers["authorization"]);
  if (!userId) return res.status(401).json({ error: "Not authenticated" });

  const { connectionId } = req.body ?? {};
  if (!connectionId) return res.status(400).json({ error: "connectionId required" });

  const admin = getAdminClient();

  // RLS isn't active on the admin client — filter by user_id explicitly so
  // a user can only disconnect their own connections.
  const { error } = await admin
    .from("broker_connections")
    .delete()
    .eq("id", connectionId)
    .eq("user_id", userId);

  if (error) return res.status(500).json({ error: error.message });

  return res.status(200).json({ ok: true });
}
