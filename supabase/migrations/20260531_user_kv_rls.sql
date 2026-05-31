-- ═══════════════════════════════════════════════════════════════════════════════
-- Kōda · Ensure user_kv has Row Level Security enabled
--
-- WHAT THIS DOES
--   Enables RLS on user_kv and creates a single owner-only policy so each
--   authenticated user can only read and write their own rows.
--
-- WHY THIS IS CRITICAL
--   user_kv is the primary data store for the app. It holds koda_profile,
--   koda_trades, koda_stripe_customer (contains Stripe subscription IDs),
--   and all other per-user blobs. Without RLS any authenticated user can
--   read or overwrite every other user's data.
--
-- HOW TO VERIFY (run before this migration)
--   SELECT relrowsecurity, relforcerowsecurity
--   FROM pg_class
--   WHERE relname = 'user_kv';
--   -- Should return t,f once this migration has run.
--
--   SELECT policyname, cmd, qual
--   FROM pg_policies
--   WHERE schemaname = 'public' AND tablename = 'user_kv';
--   -- Should return exactly one row: user_kv_self, ALL.
--
-- SERVICE ROLE NOTE
--   All serverless functions use the service_role client (supabaseAdmin.ts)
--   which bypasses RLS entirely. No changes to server-side code are needed.
--
-- IDEMPOTENT — safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.user_kv ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_kv_self"   ON public.user_kv;
DROP POLICY IF EXISTS "user_kv_select" ON public.user_kv;
DROP POLICY IF EXISTS "user_kv_insert" ON public.user_kv;
DROP POLICY IF EXISTS "user_kv_update" ON public.user_kv;
DROP POLICY IF EXISTS "user_kv_delete" ON public.user_kv;

-- Single all-operations policy: a user may only touch their own rows.
CREATE POLICY "user_kv_self" ON public.user_kv
  FOR ALL TO authenticated
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
