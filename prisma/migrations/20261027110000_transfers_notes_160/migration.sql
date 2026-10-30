-- ═══════════════════════════════════════════════════════════════════════════
--  Notes 160 — transfers: recall a despatch, short voucher numbers  2026-10-27
--
--  B. Menu 192 (Branch Outward) offers CANCEL: POST /stock/transfer/recall is
--     judged on it (um_can_cancel). No user is granted it here — rights are
--     given in User Administration. Same row in prisma/seed/Menu_Master.sql.
--
--  C. fixed.device_master.dev_code — the short code a stock voucher number
--     carries instead of the machine id: TRF/2026-2027/D1/00016, not
--     TRF/2026-2027/44c01ccc-a162-8314-34b0-1dbf2f5c7bab/16.
--       * ONE series across every device (D1, D2, …), not one per branch: a
--         voucher number is unique per DOCUMENT branch and a device posts
--         wherever it is used — the office PC on .106 has no branch and posts
--         in three — so two devices sharing a code would print one number
--         twice in one branch. Unique across the table is unique per branch.
--       * ux_dev_code covers deleted rows too, and is never reused: a new
--         device with an old one's code would print its numbers again.
--       * Backfilled here for live devices, oldest first, after the highest
--         D<n> already given; the device master assigns the next one on
--         registration and lets it be edited. Old documents keep their refno.
--     Grid 31 (DESKTOP - DEVICE MASTER LIST) shows it beside the device name
--     (seeds: Grid_Details.sql / Grid_Columns.sql — on a fresh database the
--     grid comes from the seeds, which run after this, so nothing below
--     touches a grid that is not there yet).
--
--  A (free stock) needs no schema: the balance already carries
--  sbl_free_in_qty / sbl_free_out_qty.
--
--  Re-runnable: every step checks before it writes.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── B. Branch Outward can be cancelled (recalled) ──────────────────────────
UPDATE fixed.menu_master
   SET menu_verbs = array_append(menu_verbs, 'CANCEL'),
       menu_modified_on = now()
 WHERE menu_id = 192
   AND NOT ('CANCEL' = ANY (menu_verbs));

-- ── C. dev_code ─────────────────────────────────────────────────────────────
ALTER TABLE fixed.device_master ADD COLUMN IF NOT EXISTS dev_code varchar(10);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint
                    WHERE conname = 'ck_dev_code'
                      AND conrelid = 'fixed.device_master'::regclass) THEN
        ALTER TABLE fixed.device_master
            ADD CONSTRAINT ck_dev_code CHECK (dev_code IS NULL OR dev_code ~ '^[A-Z0-9_-]{1,10}$');
    END IF;
END $$;

WITH base AS (
    SELECT COALESCE(MAX(substring(upper(dev_code) FROM '^D([0-9]{1,8})$')::int), 0) AS n
      FROM fixed.device_master
),
todo AS (
    SELECT d.dev_id,
           row_number() OVER (ORDER BY d.dev_created_on, d.dev_id) AS rn
      FROM fixed.device_master d
     WHERE d.dev_code IS NULL
       AND d.dev_is_deleted = false
)
UPDATE fixed.device_master d
   SET dev_code = 'D' || (base.n + todo.rn)::text
  FROM todo, base
 WHERE d.dev_id = todo.dev_id;

CREATE UNIQUE INDEX IF NOT EXISTS ux_dev_code
    ON fixed.device_master (upper(dev_code))
 WHERE dev_code IS NOT NULL;

-- ── C. grid 31 shows the code ───────────────────────────────────────────────
UPDATE fixed.grid_details
   SET grid_sql = replace(grid_sql, E'd.dev_device_name,\n', E'd.dev_device_name,\n       d.dev_code,\n'),
       grid_modified_on = now()
 WHERE grid_id = 31
   AND grid_sql NOT LIKE '%dev_code%'
   AND grid_sql LIKE E'%d.dev_device_name,\n%';

INSERT INTO fixed.grid_columns
    (grid_column_id, grid_id, grid_column_number, grid_column_name, grid_column_sql_field_name,
     grid_column_data_type, grid_column_width, grid_column_position, grid_column_alignment,
     grid_column_visibility, grid_column_filter, grid_column_group, grid_column_total,
     grid_column_is_deleted, grid_column_created_by)
SELECT '01a17baf-2aeb-74ac-bb31-f055e53cb471'::uuid, 31, 13, 'Code', 'dev_code',
       'Text', 5.00, 2.50, 'Center',
       true, true, false, false,
       false, 'system'
 WHERE EXISTS (SELECT 1 FROM fixed.grid_details WHERE grid_id = 31 AND grid_sql LIKE '%dev_code%')
   AND NOT EXISTS (SELECT 1 FROM fixed.grid_columns
                    WHERE grid_id = 31 AND grid_column_sql_field_name = 'dev_code'
                      AND grid_column_is_deleted = false);
