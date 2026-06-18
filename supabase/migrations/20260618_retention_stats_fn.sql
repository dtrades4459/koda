-- Day-21 logging retention for the Steve /retention command.
-- Cohort = users old enough to have reached day 21 (created >= 21 days ago).
-- Retained = of that cohort, those who logged a trade in the last 7 days
--            (Kōda is bursty/trade-day use, so "still logging this week" is the
--             honest "still alive at ~week 3+" signal — not DAU).
CREATE OR REPLACE FUNCTION public.get_retention_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  cohort   int;
  retained int;
BEGIN
  SELECT COUNT(*) INTO cohort
    FROM auth.users
   WHERE created_at <= NOW() - INTERVAL '21 days';

  SELECT COUNT(*) INTO retained
    FROM auth.users u
   WHERE u.created_at <= NOW() - INTERVAL '21 days'
     AND EXISTS (
       SELECT 1 FROM public.trades t
        WHERE t.user_id = u.id
          AND t.date >= CURRENT_DATE - 7
     );

  RETURN jsonb_build_object(
    'cohort',   cohort,
    'retained', retained,
    'rate',     CASE WHEN cohort > 0 THEN ROUND(retained::numeric / cohort * 100) ELSE NULL END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_retention_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_retention_stats() TO service_role;
