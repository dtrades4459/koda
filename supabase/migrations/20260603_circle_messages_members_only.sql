-- ═══════════════════════════════════════════════════════════════════════════════
-- Kōda · circle_messages SELECT — restrict to circle members only
--
-- WHAT THIS DOES
--   Replaces the SELECT policy on circle_messages so a row is only readable by
--   users who are members of the same circle (matched via circle_members).
--
-- WHY THIS IS CRITICAL
--   The prior policy was `USING (true)`, which let any authenticated user
--   read every row in the table — i.e. dump the chat history of every Trading
--   Circle, regardless of membership. The sibling policy on circle_members
--   (`cm_read_member` in 002_v2_schema_additive.sql) already uses this
--   membership pattern; circle_messages was inconsistent with it.
--
--   See: .gstack/security-reports/2026-06-03-cso-audit.md — Finding 1.
--
-- HOW TO VERIFY
--   From a user NOT in some circle X:
--     SELECT count(*) FROM public.circle_messages WHERE circle_code = 'X';
--   Should return 0 after this migration. Before, it returned every row in X.
--
--   Or via the JS client from the browser console:
--     await window.supabase
--       .from('circle_messages').select('circle_code').neq('circle_code','KODA-GLOBAL');
--   Returns 0 rows when run from an account that only belongs to KODA-GLOBAL.
--
-- SERVICE ROLE NOTE
--   All serverless functions use the service_role client (supabaseAdmin.ts)
--   which bypasses RLS entirely. INSERTs from /api/* are unaffected.
--
-- IDEMPOTENT — safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "circle_messages_select" ON public.circle_messages;
CREATE POLICY "circle_messages_select" ON public.circle_messages
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.circle_members cm
      WHERE cm.circle_code = circle_messages.circle_code
        AND cm.user_id = auth.uid()
    )
  );

NOTIFY pgrst, 'reload schema';
