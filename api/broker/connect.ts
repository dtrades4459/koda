// ═══════════════════════════════════════════════════════════════════════════════
// TRADR · POST /api/broker/connect
//
// Connects a user's Tradovate account to TRADR auto-sync.
//
// Flow:
//   1. Verify caller's Supabase JWT → get user_id
//   2. Call Tradovate auth (via our own proxy logic, credentials never stored)
//   3. Encrypt access + refresh tokens with AES-256-GCM
//   4. Upsert into broker_connections
//   5. Return account info so the UI can show "Connected as APEX-247831"
//
// Body (JSON):
//   { name: string, password: string, env: "demo" | "live" }
//
// ENV VARS (Vercel):
//   TRADOVATE_APP_ID, TRADOVATE_APP_VERSION, TRADOVATE_CID, TRADOVATE_SEC
//   TRADR_ENCRYPTION_KEY
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// ═══════════════════════════════════════════════════════════════════════════════

export const config = { runtime: "nodejs" };

import { encrypt }          from "../lib/cryptoUtils";
import { getAdminClient, getUserIdFromJwt } from "../lib/supabaseAdmin";

const DEMO_BASE = "https://demo.tradovateapi.com/v1";
const LIVE_BASE = "https://live.tradovateapi.com/v1";

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

  // ── 1. Auth ────────────────────────────────────────────────────────────────
  const userId = await getUserIdFromJwt(req.headers["authorization"]);
  if (!userId) return res.status(401).json({ error: "Not authenticated" });

  // ── 2. Validate body ───────────────────────────────────────────────────────
  const { name, password, env = "live" } = req.body ?? {};
  if (!name || !password)
    return res.status(400).json({ error: "name and password are required" });
  if (env !== "demo" && env !== "live")
    return res.status(400).json({ error: "env must be 'demo' or 'live'" });

  const base       = env === "live" ? LIVE_BASE : DEMO_BASE;
  const appId      = process.env.TRADOVATE_APP_ID      ?? "TRADR";
  const appVersion = process.env.TRADOVATE_APP_VERSION ?? "1.0";
  const cid        = parseInt(process.env.TRADOVATE_CID ?? "0", 10);
  const sec        = process.env.TRADOVATE_SEC         ?? "";

  if (!cid || !sec)
    return res.status(500).json({ error: "Tradovate app credentials not configured (TRADOVATE_CID / TRADOVATE_SEC)" });

  // ── 3. Authenticate with Tradovate ─────────────────────────────────────────
  let authData: any;
  try {
    const r = await fetch(`${base}/auth/accesstokenrequest`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ name, password, appId, appVersion, cid, sec }),
    });
    authData = await r.json();
    if (!r.ok || authData?.errorText)
      return res.status(401).json({ error: authData?.errorText ?? "Tradovate auth failed. Check your credentials." });
  } catch (e: any) {
    return res.status(502).json({ error: "Could not reach Tradovate: " + (e?.message ?? "network error") });
  }

  const { accessToken, refreshToken, expirationTime, userId: tvUserId } = authData;
  if (!accessToken)
    return res.status(401).json({ error: "No access token returned from Tradovate" });

  // ── 4. Fetch the account info (so we have a human-readable account name) ───
  let accountId: string | null   = null;
  let accountName: string | null = null;
  try {
    const r = await fetch(`${base}/account/list`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (r.ok) {
      const accounts: any[] = await r.json();
      if (Array.isArray(accounts) && accounts.length > 0) {
        accountId   = String(accounts[0].id);
        accountName = accounts[0].name ?? null;
      }
    }
  } catch {
    // Non-fatal — we can still sync without the account name
  }

  // ── 5. Encrypt tokens ──────────────────────────────────────────────────────
  let accessTokenEnc: string;
  let refreshTokenEnc: string | null = null;
  try {
    accessTokenEnc  = encrypt(accessToken);
    if (refreshToken) refreshTokenEnc = encrypt(refreshToken);
  } catch (e: any) {
    return res.status(500).json({ error: "Token encryption failed. Is TRADR_ENCRYPTION_KEY set? " + (e?.message ?? "") });
  }

  // ── 6. Upsert broker_connections ──────────────────────────────────────────
  const admin = getAdminClient();
  const { data: conn, error: upsertErr } = await admin
    .from("broker_connections")
    .upsert(
      {
        user_id:           userId,
        broker:            "tradovate",
        env,
        account_id:        accountId,
        account_name:      accountName,
        access_token_enc:  accessTokenEnc,
        refresh_token_enc: refreshTokenEnc,
        token_expires_at:  expirationTime ?? null,
        sync_status:       "connected",
        sync_error:        null,
        last_sync_at:      null,
      },
      { onConflict: "user_id,broker,account_id" }
    )
    .select("id, account_id, account_name, env, sync_status, created_at")
    .single();

  if (upsertErr)
    return res.status(500).json({ error: "DB write failed: " + upsertErr.message });

  // ── 7. Log the connection event ────────────────────────────────────────────
  await admin.from("sync_events").insert({
    user_id:       userId,
    connection_id: conn.id,
    broker:        "tradovate",
    trades_found:  0,
    trades_new:    0,
    error:         null,
  });

  return res.status(200).json({
    ok:          true,
    connectionId: conn.id,
    accountId,
    accountName,
    env,
    tvUserId,
    message: `Connected${accountName ? ` as ${accountName}` : ""}. Sync will begin within 5 minutes.`,
  });
}
