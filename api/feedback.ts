// ═══════════════════════════════════════════════════════════════════════════════
// TRADR · Feedback API
//
// POST { feedback, name, handle }
// → Supabase-backed rate limit (5 req / 60 s per IP) — survives cold starts
// → Forwards message to Telegram bot
//
// Required Vercel environment variables:
//   TELEGRAM_BOT_TOKEN
//   TELEGRAM_CHAT_ID
//   SUPABASE_URL               same value as VITE_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY  Supabase → Settings → API → service_role key
// ═══════════════════════════════════════════════════════════════════════════════

import { createClient } from "@supabase/supabase-js";

export const config = { runtime: "nodejs" };

const RATE_LIMIT = 5;       // max requests
const RATE_WINDOW = 60_000; // per 60 seconds

// Stable 8-char hex derived from the IP — we don't want to store raw IPs.
function hashIp(ip: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < ip.length; i++) {
    h ^= ip.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

// Check + increment rate limit counter stored in Supabase shared_kv.
// Returns true if the request is allowed.
async function checkRateLimit(ip: string): Promise<boolean> {
  const db = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const key = `tradr_rl_feedback_${hashIp(ip)}`;
  const now = Date.now();

  const { data } = await db
    .from("shared_kv")
    .select("value")
    .eq("key", key)
    .maybeSingle();

  let count = 1;
  let resetAt = now + RATE_WINDOW;

  if (data?.value) {
    try {
      const parsed = JSON.parse(data.value);
      if (now < parsed.resetAt) {
        // Still in the current window
        if (parsed.count >= RATE_LIMIT) return false;
        count = parsed.count + 1;
        resetAt = parsed.resetAt;
      }
      // else: window expired, start fresh (count=1, new resetAt)
    } catch { /* malformed — start fresh */ }
  }

  // Upsert the updated counter (fire-and-forget; don't block the response)
  db.from("shared_kv")
    .upsert({ key, value: JSON.stringify({ count, resetAt }) })
    .then(() => {})
    .catch(() => {});

  return true;
}

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

  const ip = (req.headers["x-forwarded-for"] as string | undefined)
    ?.split(",")[0].trim() || "unknown";

  const allowed = await checkRateLimit(ip);
  if (!allowed) return res.status(429).json({ error: "Too many requests" });

  const { feedback, name, handle } = req.body || {};
  if (!feedback?.trim()) return res.status(400).json({ error: "Feedback is required" });

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return res.status(500).json({ error: "Telegram not configured" });

  const who = [name, handle ? `@${handle.replace(/^@/, "")}` : null]
    .filter(Boolean).join(" · ") || "Anonymous";

  const text = [
    "📬 *New TRADR Feedback*", "",
    `👤 ${who}`, "",
    `💬 ${feedback.trim()}`, "",
    `🕐 ${new Date().toLocaleString("en-GB", { timeZone: "Europe/London", dateStyle: "short", timeStyle: "short" })}`,
  ].join("\n");

  try {
    const tgRes = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" }),
      }
    );
    if (!tgRes.ok) {
      const err = await tgRes.json();
      console.error("[feedback] Telegram error:", err);
      return res.status(500).json({ error: "Failed to send" });
    }
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("[feedback]", err);
    return res.status(500).json({ error: "Internal error" });
  }
}
