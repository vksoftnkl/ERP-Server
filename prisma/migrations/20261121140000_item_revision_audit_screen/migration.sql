-- Item master (menu 29) History step 2, user 2026-11-21 ("history as a revision"): every item save
-- writes ONE audit row holding the whole item before and after (notes 89 logDocumentRevision,
-- log_rev_no), shown on the card like a transaction's revisions.
--   170 Item Revision (transaction-style, item_master) - a screen of its own, so History reads
--   only the revisions; the per-row "Item Master" rows (screen 25 and its child screens) stay.
-- Fixed id so the Qt card can name it (house pattern: 168 / 169). Re-runnable.

-- ── 0 · guard: the id / name are free, or already ours ───────────────────────────────────────
DO $$
DECLARE clash text;
BEGIN
    SELECT string_agg(format('audit screen %s (%s)', s.screen_id, s.screen_name), ', ')
      INTO clash
      FROM audit.audit_screen s
     WHERE (s.screen_id = 170 OR lower(s.screen_name) = lower('Item Revision'))
       AND (s.screen_id, s.screen_name) IS DISTINCT FROM (170, 'Item Revision');
    IF clash IS NOT NULL THEN
        RAISE EXCEPTION 'audit screen id / name already used by another row: %', clash;
    END IF;
END $$;

-- ── 1 · the audit screen ──────────────────────────────────────────────────────────────────────
INSERT INTO audit.audit_screen (screen_id, screen_name, screen_type, screen_status, screen_module)
SELECT 170, 'Item Revision', 'transaction'::audit.audit_screen_type, true, 'INVENTORY'
 WHERE NOT EXISTS (SELECT 1 FROM audit.audit_screen s WHERE s.screen_id = 170);

SELECT setval('audit.audit_screen_screen_id_seq',
              GREATEST((SELECT COALESCE(max(screen_id), 1) FROM audit.audit_screen),
                       (SELECT last_value FROM audit.audit_screen_screen_id_seq)));
