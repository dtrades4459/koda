-- Seeds the 50K Eval Challenge circle into shared_kv and creates its
-- challenge row. ON CONFLICT / WHERE NOT EXISTS make both inserts safely
-- re-runnable without creating duplicate rows.

INSERT INTO shared_kv (key, value, owner_id)
VALUES (
  'koda_circle_50K-EVAL-2026',
  '{"id":2,"code":"50K-EVAL-2026","name":"50K Eval Challenge","description":"30-day prop eval challenge. Best R-multiple wins.","strategy":"","privacy":"public","emoji":"⚡","metric":"r","createdBy":"Kōda","createdAt":"2026-06-15T00:00:00.000Z"}',
  '00000000-0000-0000-0000-000000000000'::uuid
)
ON CONFLICT (key) DO NOTHING;

INSERT INTO circle_challenges (circle_code, title, metric, started_at, ends_at, created_by, status)
SELECT
  '50K-EVAL-2026',
  '50K Eval — June 2026',
  'r',
  '2026-06-15T00:00:00.000Z'::timestamptz,
  '2026-07-15T23:59:59.000Z'::timestamptz,
  'Kōda',
  'active'
WHERE NOT EXISTS (
  SELECT 1 FROM circle_challenges WHERE circle_code = '50K-EVAL-2026'
);
