-- ═══════════════════════════════════════════════════════════════════════════
--  Sticker printing S-P1, step P1-2 follow-up (wording)              2026-11-25
--  Folder: prisma/migrations/20261126100100_sticker_sp1_wording/ (share copy:
--  Shared/Prathap/admin/sql/sticker-sp1-wording-migration.sql). NOT applied yet:
--  review fixes may add rows here before the user runs it.
--
--  Two refusals the sticker line builder raises that 20261126100000 §7g did not
--  word: a job line keeps the barcode in varchar(50) and the batch in
--  varchar(60) (inventory.label_job_line), while item_ean_codes.ean_code (64),
--  item_master.item_default_barcode (200) and stock_lot.slt_batch_no (100) allow
--  more. A longer value is the line's problem (resolve) or a 422 (print), never
--  a truncated sticker. prisma/seed/Error_Messages.json carries the same rows
--  (catalogue 2026-11-25.2).
--
--  Review fix SF1 (2026-11-26): /stickers/jobs/resend is also refused while a
--  resend of the same failed job is still SENT (on its way, not marked Printed
--  or Failed yet), not only once one PRINTED. Same code, STICKER_ALREADY_RESENT
--  (409), with the variant rule=SENT for that case; the plain row stays the
--  printed one. Catalogue 2026-11-26.1 (the seed file carries the same row).
--  Also STICKER_PRINT_WARNINGS (Qt SF3, 2026-11-26): the Continue / Stop box shown
--  before a job with render warnings goes to the printer; the server's warning
--  texts are shown under it.
--
--  Section 2 (db-schema, 2026-11-25, the main session's follow-up): dropdown 82
--  "DEVICES - THIS BRANCH" (Printed jobs Counter filter) also lists a counter
--  that has no branch of its own but printed sticker jobs at this branch. Live
--  fact: D8 (VKPOS1, 81 jobs at Acme CBE) and D1 / D6 / D7 / D14 have
--  dev_branch_id NULL, so the filter could not offer D8. Still live + active
--  devices only; ibranch_id compared as text; no comment marker in the SQL.
--  prisma/seed/Dropdown_Details.sql carries the new row.
--
--  Idempotent and re-runnable: ON CONFLICT DO NOTHING on the rows, and the
--  catalogue version only moves forward; dropdown 82 moves only while it holds
--  the text 20261126100000 shipped (white space folded). Data only: no DDL.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── plain wording rows (notes 120), catalogue 2026-11-26.1 ─────────────────
INSERT INTO fixed.error_message
    (erm_code, erm_variant, erm_lang, erm_title, erm_line, erm_todo)
VALUES
     ('STICKER_BARCODE_TOO_LONG', '', 'en', 'Barcode too long', 'This item''s barcode is longer than a sticker can keep (50 characters).', 'Shorten the barcode on the item card.')
    ,('STICKER_BATCH_TOO_LONG', '', 'en', 'Batch too long', 'This batch number is longer than a sticker can keep (60 characters).', 'Pick another batch, or shorten the batch number.')
    ,('STICKER_ALREADY_RESENT', 'rule=SENT', 'en', 'Already sent again', 'This failed job was already sent again. That new job is not marked Printed or Failed yet.', 'The counter that sent it marks it Printed or Failed in Printed jobs first.')
    ,('STICKER_PRINT_WARNINGS', '', 'en', 'Labels may print wrong', 'The design does not fit these labels well, for example a barcode wider than its box.', 'Stop, and fix the design in the Print Designer. Or Continue to print anyway.')
ON CONFLICT (erm_code, erm_variant, erm_lang) DO NOTHING;
UPDATE fixed.error_message_catalogue
   SET emc_version   = '2026-11-26.1',
       emc_row_count = (SELECT count(*) FROM fixed.error_message WHERE erm_is_active),
       emc_loaded_on = now()
 WHERE emc_id = 1
   AND emc_version < '2026-11-26.1';

-- ── 2 · dropdown 82: + counters with no branch that printed jobs here ──────
-- Each field moves only while it holds the text 20261126100000 shipped (white
-- space folded): already the new text = nothing to do; row absent (a fresh
-- database: dropdowns are seeded after the migrations and Dropdown_Details.sql
-- carries the new row) = skipped; any other text (edited on this site) = left
-- as is, with a notice. Never raises (P3009). dropdown_columns are unchanged.
DO $mig$
DECLARE
    v_old_sql  text := $old$SELECT d.dev_id,
       COALESCE(d.dev_code, '') AS dev_code,
       COALESCE(d.dev_device_name, '') AS dev_device_name
  FROM fixed.device_master d
 WHERE d.dev_is_deleted = false
   AND d.dev_is_active = true
   AND d.dev_branch_id::text = 'ibranch_id'
 ORDER BY d.dev_device_name, d.dev_code$old$;
    v_new_sql  text := $new$SELECT d.dev_id,
       COALESCE(d.dev_code, '') AS dev_code,
       COALESCE(d.dev_device_name, '') AS dev_device_name
  FROM fixed.device_master d
 WHERE d.dev_is_deleted = false
   AND d.dev_is_active = true
   AND (d.dev_branch_id::text = 'ibranch_id'
        OR EXISTS (SELECT 1
                     FROM inventory.label_job j
                    WHERE j.lbj_device_id = d.dev_id
                      AND j.lbj_branch_id::text = 'ibranch_id'))
 ORDER BY d.dev_device_name, d.dev_code$new$;
    v_old_desc text := 'Sticker Printing Printed jobs Counter filter: live, active devices (counters) of this branch, by name. Param ibranch_id, always sent; compared as text, never cast.';
    v_new_desc text := 'Sticker Printing Printed jobs Counter filter: live, active devices (counters) of this branch, and the counters with no branch of their own (or another one) that printed sticker jobs at this branch, by name. Param ibranch_id, always sent; compared as text, never cast.';
    r          fixed.dropdown_details%ROWTYPE;
    v_sql      text;
    v_desc     text;
BEGIN
    SELECT * INTO r
      FROM fixed.dropdown_details d
     WHERE d.dropdown_id = 82
       FOR UPDATE;
    IF NOT FOUND THEN
        RAISE NOTICE '20261126100100: dropdown 82 is not here (fresh database: Dropdown_Details.sql carries the new row). Skipped.';
        RETURN;
    END IF;
    IF r.dropdown_name IS DISTINCT FROM 'DEVICES - THIS BRANCH' THEN
        RAISE NOTICE '20261126100100: dropdown 82 is "%", not DEVICES - THIS BRANCH. Left as is.', r.dropdown_name;
        RETURN;
    END IF;

    v_sql  := r.dropdown_sql;
    v_desc := r.dropdown_description;
    IF regexp_replace(coalesce(v_sql, ''), '\s+', ' ', 'g') = regexp_replace(v_new_sql, '\s+', ' ', 'g') THEN
        NULL;
    ELSIF regexp_replace(coalesce(v_sql, ''), '\s+', ' ', 'g') = regexp_replace(v_old_sql, '\s+', ' ', 'g') THEN
        v_sql := v_new_sql;
    ELSE
        RAISE NOTICE '20261126100100: dropdown 82 SQL is not the text 20261126100000 shipped (edited since?). Left as is.';
    END IF;
    IF v_desc = v_old_desc THEN
        v_desc := v_new_desc;
    END IF;

    IF v_sql IS DISTINCT FROM r.dropdown_sql
    OR v_desc IS DISTINCT FROM r.dropdown_description THEN
        UPDATE fixed.dropdown_details
           SET dropdown_sql         = v_sql,
               dropdown_description = v_desc,
               dropdown_modified_by = 'system',
               dropdown_modified_on = now()
         WHERE dropdown_id = 82;
    END IF;
END
$mig$;
