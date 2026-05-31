-- ═══════════════════════════════════════════════════════════════════════════════
-- Kōda · Pre-launch security fixes (2026-05-31)
--
-- Addresses four findings from the pre-beta security audit:
--
--   H1  circle_shared_trades INSERT — was WITH CHECK (true), allowing any
--       authenticated user to post to any circle as any author.
--       Fix: require author_uid = auth.uid() so a user can only post as
--       themselves.
--
--   H3  circle_shared_trades UPDATE — "OR author_uid IS NULL" escape hatch
--       allowed any user to mutate every row inserted before the 20260527
--       migration. Fix: remove the IS NULL arm; reactions still work through
--       the SECURITY DEFINER toggle_trade_reaction function.
--
--   H2  JWT plan claim — tradr_plan_jwt_hook read plan from user_kv which
--       is user-writable. A free user could write plan:"pro" to their own
--       profile blob and get a JWT claiming Pro status.
--       Fix: read plan exclusively from app_metadata, which is admin-API-only
--       (set by the Stripe webhook via admin.auth.admin.updateUserById).
--
--   M3  toggle_trade_reaction accepted a caller-supplied p_member_code,
--       allowing any user to react as any member.
--       Fix: derive member_code inside the function from the authenticated
--       caller's profile row; drop the 3-arg signature.
--
-- IDEMPOTENT — safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════════


-- ── Pre-requisite: add author_uid column if 20260527 was never run ────────────
-- The 20260527_fix_circle_reactions_rls.sql migration adds this column; if it
-- was skipped in prod this step adds it now so the policies below work.
-- IF NOT EXISTS makes this idempotent whether or not 20260527 ran.

ALTER TABLE public.circle_shared_trades
  ADD COLUMN IF NOT EXISTS author_uid uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Back-fill from profiles where the author's member_code matches (best-effort).
UPDATE public.circle_shared_trades cst
SET    author_uid = p.user_id
FROM   public.profiles p
WHERE  p.member_code = cst.author_code
  AND  cst.author_uid IS NULL;


-- ── H1: Tighten circle_shared_trades INSERT ───────────────────────────────────
-- Before: WITH CHECK (true) — anyone can post anything to any circle.
-- After:  author_uid must equal the authenticated caller's UID.
--
-- The client (src/data/circlesSharedTrades.ts) already sets
-- author_uid = user.id on every insert, so legitimate shares continue to work.

DROP POLICY IF EXISTS "circle_shared_trades_insert" ON public.circle_shared_trades;

CREATE POLICY "circle_shared_trades_insert" ON public.circle_shared_trades
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = author_uid);


-- ── H3: Remove IS NULL escape from circle_shared_trades UPDATE ───────────────
-- Before: USING (auth.uid() = author_uid OR author_uid IS NULL)
--   → every row with author_uid = NULL (all rows before 20260527) was editable
--     by any authenticated user.
-- After:  only the original poster (author_uid = auth.uid()) may update.
--
-- Reactions are unaffected: toggle_trade_reaction is SECURITY DEFINER and
-- bypasses this policy entirely.

DROP POLICY IF EXISTS "circle_shared_trades_update" ON public.circle_shared_trades;

CREATE POLICY "circle_shared_trades_update" ON public.circle_shared_trades
  FOR UPDATE TO authenticated
  USING  (auth.uid() = author_uid)
  WITH CHECK (auth.uid() = author_uid);

-- (author_uid back-fill already done above in the pre-requisite step)


-- ── H2: Fix JWT plan hook — read from app_metadata, not user_kv ──────────────
-- app_metadata is admin-API-only (written by stripe-webhook.ts via
-- admin.auth.admin.updateUserById). It cannot be forged by a client user.
-- user_kv.koda_profile.plan was user-writable, creating a UI-level plan bypass.

CREATE OR REPLACE FUNCTION public.tradr_plan_jwt_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _plan   text;
  _claims jsonb;
BEGIN
  -- Read plan from app_metadata, which is set exclusively by the Stripe webhook
  -- via admin.auth.admin.updateUserById — not writable by the authenticated user.
  -- New users (no purchase yet) will have no plan in app_metadata; default free.
  _plan := COALESCE(event->'claims'->'app_metadata'->>'plan', 'free');

  -- Reject any value that isn't a known tier (guards against future corruption).
  IF _plan NOT IN ('free', 'pro', 'elite') THEN
    _plan := 'free';
  END IF;

  _claims := COALESCE(event->'claims', '{}'::jsonb)
    || jsonb_build_object(
        'app_metadata',
        COALESCE(event->'claims'->'app_metadata', '{}'::jsonb)
          || jsonb_build_object('plan', _plan)
       );

  RETURN jsonb_set(event, '{claims}', _claims);
EXCEPTION WHEN OTHERS THEN
  -- Never break auth — return the event unchanged if anything goes wrong.
  RETURN event;
END;
$$;

-- Permissions unchanged from migration 004 — re-stated here for clarity.
GRANT   EXECUTE ON FUNCTION public.tradr_plan_jwt_hook(jsonb) TO supabase_auth_admin;
REVOKE  EXECUTE ON FUNCTION public.tradr_plan_jwt_hook(jsonb) FROM public, anon, authenticated;


-- ── M3: Fix toggle_trade_reaction — derive member_code from profiles ──────────
-- Before: accepted p_member_code from the caller — any user could react as
--         any member.
-- After:  looks up the authenticated caller's member_code from public.profiles
--         inside the function. Drops the 3-arg signature to prevent callers
--         from reaching the old behaviour.

-- Drop the old 3-argument version that accepted a caller-supplied member code.
DROP FUNCTION IF EXISTS public.toggle_trade_reaction(uuid, text, text);

CREATE OR REPLACE FUNCTION public.toggle_trade_reaction(
  p_trade_id  uuid,
  p_emoji     text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member_code text;
  v_current     jsonb;
BEGIN
  -- Resolve the caller's member code from their profile.
  -- If the user has no profile row yet, do nothing (can't react without a code).
  SELECT member_code INTO v_member_code
  FROM   public.profiles
  WHERE  user_id = auth.uid();

  IF NOT FOUND OR v_member_code IS NULL THEN RETURN; END IF;

  SELECT reactions INTO v_current
  FROM   public.circle_shared_trades
  WHERE  id = p_trade_id
  FOR    UPDATE;

  IF NOT FOUND THEN RETURN; END IF;

  UPDATE public.circle_shared_trades
  SET reactions = jsonb_set(
    COALESCE(reactions, '{}'::jsonb),
    ARRAY[p_emoji],
    CASE
      WHEN COALESCE(v_current -> p_emoji, '[]'::jsonb) ? v_member_code
      THEN COALESCE(v_current -> p_emoji, '[]'::jsonb) - v_member_code
      ELSE COALESCE(v_current -> p_emoji, '[]'::jsonb) || to_jsonb(v_member_code)
    END
  )
  WHERE id = p_trade_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.toggle_trade_reaction(uuid, text) TO authenticated;
