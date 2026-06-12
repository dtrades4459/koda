-- ═══════════════════════════════════════════════════════════════════════════════
-- Kōda · Lock down check_and_increment_rate_limit EXECUTE (L1)
--
-- WHAT THIS DOES
--   Revokes EXECUTE on public.check_and_increment_rate_limit(text,int,bigint)
--   from PUBLIC / anon / authenticated, leaving it granted to service_role only.
--
-- WHY (Security Audit 2026-06-11, Finding L1)
--   The function is SECURITY DEFINER. Postgres grants EXECUTE to PUBLIC by
--   default on every newly created function, and the original migrations
--   (20260523_atomic_rate_limit.sql, 20260531_fix_rate_limit_owner_id.sql)
--   only added `GRANT … TO service_role` — they never revoked the implicit
--   PUBLIC grant. As a result any authenticated (or anon) caller could invoke
--   it via PostgREST `rpc()` with arbitrary p_key / p_limit / p_window_ms,
--   manipulating rate-limit counters and writing rows into shared_kv under the
--   sentinel owner. The limiter is only ever meant to be called server-side by
--   the Vercel functions, which use the service-role client.
--
--   The app's own rate limiting is unaffected: api/_lib/rateLimit.ts calls this
--   RPC through the service-role admin client, whose grant is preserved below.
--
-- HOW TO RUN
--   Supabase dashboard → SQL Editor → paste → Run.
--
-- IDEMPOTENT — safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════════

REVOKE EXECUTE ON FUNCTION public.check_and_increment_rate_limit(text, int, bigint)
  FROM PUBLIC, anon, authenticated;

-- Re-state the intended grant so the function's only caller stays the service role.
GRANT EXECUTE ON FUNCTION public.check_and_increment_rate_limit(text, int, bigint)
  TO service_role;

-- HOW TO VERIFY (run after applying — expect only service_role in the result):
--   select grantee, privilege_type
--   from information_schema.routine_privileges
--   where routine_name = 'check_and_increment_rate_limit'
--     and routine_schema = 'public';
