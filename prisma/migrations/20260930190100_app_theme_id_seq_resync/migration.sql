-- 20260930190000_app_theme_tokens set app_theme_master_thm_id_seq from max(thm_id)
-- BEFORE it inserted the seed rows 1 MAROON, 2 YELLOW, 3 BLUE with explicit ids.
-- On a database that did not hold those rows yet (no seed file creates them; the
-- live box is seeded separately), the sequence stayed at 1 and the first
-- POST /app-themes/save create would collide on thm_id 1. Catch it up again.
-- Idempotent: on a database that already had the rows this changes nothing.
SELECT setval('public.app_theme_master_thm_id_seq',
              COALESCE((SELECT max(thm_id) FROM public.app_theme_master), 0) + 1,
              false);
