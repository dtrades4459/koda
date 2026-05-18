// ═══════════════════════════════════════════════════════════════════════════════
// TRADR · Password Reset API
//
// POST { username }
// → Finds the user by username
// → Generates a Supabase recovery link (admin API)
// → Sends the link to the founder's Telegram so they can forward it
// → Returns { ok: true, hasRecoveryEmail: boolean }
//
// This approach works for the beta without needing a transactional email service.
// To upgrade: swap the Telegram forward for a SendGrid/Resend call.
//
// Required Vercel environment variables:
//   SUPABASE_URL               same value as VITE_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY  Supabase → Settings → API → service_role key
//   APP_URL                    https://tradrjournal.xyz
//   TELEGRAM_BOT_TOKEN         (same as feedback endpoint)
//   TELEGRAM_CHAT_ID           (same as feedback endpoint)
// ═══════════════════════════════════════════════════════════════════════════════

import { createClient } from "@supabase/supabase-js";

export const config = { runtime: "nodejs" };

const APP_URL = process.env.APP_URL ?? "https://tradrjournal.xyz";
const USERNAME_DOMAIN = "users.tradr.app";

// ── CORS ─────────────────────────────────────────────────────────────────────
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
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

export default async function handler(req: any, res: any) {
  cors(req, res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { username } = req.body as { username?: string };
  if (!username?.trim()) return res.status(400).json({ error: "username required" });

  const u = username.toLowerCase().trim();
  const syntheticEmail = `${u}@${USERNAME_DOMAIN}`;

  const admin = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // 1. Find user by synthetic email
  const { data: { users }, error: listErr } = await (admin.auth.admin as any).listUsers({ perPage: 1000 });
  if (listErr) {
    console.error("[reset-password] listUsers:", listErr);
    return res.status(500).json({ error: "Internal error" });
  }

  const user = (users as any[]).find(
    (u: any) => u.email === syntheticEmail || u.user_metadata?.username === username.toLowerCase().trim()
  );

  // Always return the same success response to prevent username enumeration
  if (!user) return res.status(200).json({ ok: true, hasRecoveryEmail: false });

  const recoveryEmail: string = user.user_metadata?.recovery_email ?? "";

  // 2. Generate Supabase recovery link
  let resetLink = "";
  try {
    const { data, error: linkErr } = await (admin.auth.admin as any).generateLink({
      type: "recovery",
      email: syntheticEmail,
      options: { redirectTo: APP_URL },
    });
    if (linkErr) throw linkErr;
    resetLink = data?.properties?.action_link ?? data?.action_link ?? "";
  } catch (e) {
    console.error("[reset-password] generateLink:", e);
    return res.status(500).json({ error: "Failed to generate reset link" });
  }

  if (!resetLink) return res.status(500).json({ error: "No reset link generated" });

  // 3. Forward via Telegram (founder manually emails/messages the user)
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (token && chatId) {
    const text = [
      "🔑 *Password Reset Request*",
      "",
      `👤 @${u}`,
      recoveryEmail ? `📧 Recovery email: ${recoveryEmail}` : "⚠️ No recovery email on file",
      "",
      `🔗 Forward this link to the user:`,
      `${resetLink}`,
      "",
      `⏰ Expires in 1 hour`,
    ].join("\n");

    fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" }),
    }).catch(e => console.error("[reset-password] Telegram:", e));
  }

  return res.status(200).json({ ok: true, hasRecoveryEmail: !!recoveryEmail });
}
