// ═══════════════════════════════════════════════════════════════════════════════
// Kōda · Supabase admin client (server-side only)
//
// Uses the service role key — bypasses Row Level Security entirely.
// ONLY import this in Vercel serverless functions (api/**).
// NEVER import this in src/ (browser code).
//
// ENV VARS REQUIRED (Vercel dashboard → Settings → Environment Variables)
//   SUPABASE_URL              — your project URL (same as VITE_SUPABASE_URL)
//   SUPABASE_SERVICE_ROLE_KEY — from Supabase dashboard → Settings → API → service_role
// ═══════════════════════════════════════════════════════════════════════════════

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _admin: SupabaseClient | null = null;

export function getAdminClient(): SupabaseClient {
  if (_admin) return _admin;
  const url = process.env.SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !key) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in Vercel env vars"
    );
  }
  _admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _admin;
}

/**
 * Verify a Supabase JWT and return the user_id.
 * Returns null if the token is missing, expired, or invalid.
 */
export async function getUserIdFromJwt(authHeader: string | undefined): Promise<string | null> {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  const admin = getAdminClient();
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user?.id) return null;
  return data.user.id;
}
