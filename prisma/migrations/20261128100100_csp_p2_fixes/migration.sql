-- ═══════════════════════════════════════════════════════════════════════════
--  Change Selling Price P2, cost after a purchase: review fixes, DB part  2026-11-27
--  Folder: prisma/migrations/20261128100100_csp_p2_fixes/
--  (share copy: Shared/Prathap/admin/sql/csp-p2-fixes-migration.sql, run by
--  run-csp-p2-fixes-apply.sh, checked by csp-p2-fixes-assert.sql).
--
--  Fix batch: Shared/Prathap/inventory/review-fix-batch-csp-p2-2026-11-26.md,
--  section "DB" (wording, S6). The words follow the codes, variants and params
--  the server sends, as listed in Shared/Prathap/inventory/csp-p2-keys-2026-11-26.md
--  rev 3 §4. Sorts after 20261128100000_change_selling_price_p2_after_purchase.
--  Every name below was read from the live dev DB on 2026-11-27.
--
--   1 · wording (notes 120), catalogue 2026-11-28.2 (1,026 -> 1,036 rows on dev).
--       How a row is picked: the note's `rule` picks the variant row
--       rule=<value>, else the plain row. A {name} with no value is dropped with
--       the one space before it, and " ({name})" whole. So a param the server
--       sends only sometimes sits either alone in brackets or as a bare word
--       the sentence reads right without; no label word stands before it.
--       New rows (10):
--         PUR_PRICE_NO_LINE         rule=PLAIN       a plain item's unit or a sale-price key
--                                                    with no line ({salePrice} only on a
--                                                    sale-price key; {price} is not used:
--                                                    no place reads right without it)
--         PUR_PRICE_NOT_WRITTEN     rule=BELOW_MIN   {min}
--         PUR_PRICE_NOT_WRITTEN     rule=BELOW_COST  {cost} (the judged cost; {lineCost} /
--                                                    {stockCost} are not used: {stockCost}
--                                                    is sometimes absent)
--         PUR_PRICE_NOT_WRITTEN     rule=NEW_LINE_ABOVE_MRP   a Q9 new line refused, one rule per
--                                   rule=NEW_LINE_BELOW_MIN   limit (server 2026-11-27; there is no
--                                   rule=NEW_LINE_BELOW_COST  plain NEW_LINE): {mrp} / {min} / {cost},
--                                                    each "…, so no price line was made", never
--                                                    "its cost moved"
--         PUR_PRICE_KEPT_NEWER      rule=CHAIN       N9: the chain unit kept with its bought
--                                                    unit ({who} sometimes absent)
--         PUR_PRICE_RESTORED        rule=ONE         exactly 1 row put back
--         PUR_PRICE_KEPT_ON_CANCEL  rule=SCHEDULED   N4: a scheduled row ({from})
--         PUR_PRICE_REVIEW_KEPT     (plain)          cancel of a bill whose prices were saved
--                                                    on Change Selling Price ({bill})
--       Reworded (3), titles kept:
--         PUR_PRICE_NO_LINE         (plain, an MRP key) reads right without {price}
--         PUR_PRICE_KEPT_NEWER      (plain) with {source} ({who}) and ({when}); all
--                                   three may be absent (N1 race), {who} often is
--         PUR_PRICE_KEPT_ON_CANCEL  (plain) with {source} ({who}) and ({when})
--       Unchanged: PUR_PRICE_RESTORED plain (reads right for 2 or more; rule=ONE
--       takes 1), PUR_PRICE_NOT_WRITTEN plain + rule=ABOVE_MRP, PUR_PRICE_LATER_BILL,
--       PUR_PRICE_TO_REVIEW, PUR_PRICE_BELOW_NEW_COST, the STOCK_PRICE_ refusals.
--       Each row is written while its words differ (the seed file owns the
--       wording); the catalogue version only moves forward.
--
--   2 · S6 offline: the P2 fixed-id purchase.price_update rows (asv_id =
--       md5('csp-p2-price-update|' || comp_id), made by 20261128100000 on every
--       server) get asv_sync_date = now() while they are untouched since that
--       migration and not pushed yet, so a branch never pushes its own copy over
--       a newer choice made on the cloud. Untouched = still exactly what
--       20261128100000 wrote: live, created_by 'system', never modified (every
--       save or reset through the settings API sets asv_modified_on and
--       asv_modified_by), and the value with its own remark (NONE + "...was
--       off)" or UPDATE_PRICES + "...was on, mode the old default)"). Not pushed
--       yet = asv_sync_date IS NULL (a pushed row is already the cloud's copy;
--       stamping it again changes nothing, and the dirty trigger would read a
--       same-transaction now() as "no change" and clear it). A touched row is
--       a real local choice: it stays as it is and goes up as usual. The
--       explicit new value passes zz_sync_mark_dirty (it only clears a sync
--       date an UPDATE leaves unchanged). On a server that runs both
--       migrations in one deploy, the rows 20261128100000 inserts (sync date
--       NULL) are stamped here; on an empty database there is no company yet,
--       so neither migration writes a row.
--
--  No table, column, index, CHECK, function or trigger; no db_table_master row;
--  no Prisma change. prisma/seed/Error_Messages.json carries the same rows
--  (version 2026-11-28.2). The settings have no seed file. Re-runnable: applied
--  twice in one transaction the second run changes nothing.
-- ═══════════════════════════════════════════════════════════════════════════


-- ── 1 · wording rows, catalogue 2026-11-28.2 ──────────────────────────────
INSERT INTO fixed.error_message AS e
    (erm_code, erm_variant, erm_lang, erm_title, erm_line, erm_todo)
VALUES
     ('PUR_PRICE_NO_LINE', '', 'en', 'No price yet', 'Line {n}: {item} MRP {mrp} has no price line yet, so it sells at the other-MRPs price, if any ({price}).', 'Set its price on Change Selling Price.')
    ,('PUR_PRICE_NO_LINE', 'rule=PLAIN', 'en', 'No price line', 'Line {n}: {item} {unit} {salePrice} has no price line yet, so this bill could not price it.', 'Set its price on Change Selling Price.')
    ,('PUR_PRICE_NOT_WRITTEN', 'rule=BELOW_MIN', 'en', 'Price not changed', 'Line {n}: {level} {price} of {item} {unit} would be below its minimum price {min}, so its prices were kept; its cost moved.', 'Check it on Change Selling Price.')
    ,('PUR_PRICE_NOT_WRITTEN', 'rule=BELOW_COST', 'en', 'Price not changed', 'Line {n}: {level} {price} of {item} {unit} would be below the cost {cost}, so its prices were kept; its cost moved.', 'Check it on Change Selling Price.')
    ,('PUR_PRICE_NOT_WRITTEN', 'rule=NEW_LINE_ABOVE_MRP', 'en', 'No price line made', 'Line {n}: {level} {price} of {item} {unit} would be above its MRP {mrp}, so no price line was made.', 'Set its price on Change Selling Price.')
    ,('PUR_PRICE_NOT_WRITTEN', 'rule=NEW_LINE_BELOW_MIN', 'en', 'No price line made', 'Line {n}: {level} {price} of {item} {unit} would be below its minimum price {min}, so no price line was made.', 'Set its price on Change Selling Price.')
    ,('PUR_PRICE_NOT_WRITTEN', 'rule=NEW_LINE_BELOW_COST', 'en', 'No price line made', 'Line {n}: {level} {price} of {item} {unit} would be below the cost {cost}, so no price line was made.', 'Set its price on Change Selling Price.')
    ,('PUR_PRICE_KEPT_NEWER', '', 'en', 'Price not changed', 'Line {n}: {item} {unit} price not updated — {source} ({who}) changed it later ({when}); the bill keeps its own price as history.', 'Nothing to do: the later change stands.')
    ,('PUR_PRICE_KEPT_NEWER', 'rule=CHAIN', 'en', 'Price not changed', 'Line {n}: {item} {unit} price not updated — {source} ({who}) changed {item} {boughtUnit} later ({when}), so its unit chain was kept too; the bill keeps its own price as history.', 'Nothing to do: the later change stands.')
    ,('PUR_PRICE_RESTORED', 'rule=ONE', 'en', 'Prices put back', '1 price line went back to its figures before {bill}.', 'Nothing to do.')
    ,('PUR_PRICE_KEPT_ON_CANCEL', '', 'en', 'Prices kept', '{item} {unit}: {source} ({who}) changed it after {bill} ({when}), so its old prices were not put back.', 'Check it on Change Selling Price.')
    ,('PUR_PRICE_KEPT_ON_CANCEL', 'rule=SCHEDULED', 'en', 'Scheduled price kept', '{item} {unit} (its price from {from}): {source} ({who}) changed it after {bill} ({when}), so it was not put back.', 'Check it on Change Selling Price.')
    ,('PUR_PRICE_REVIEW_KEPT', '', 'en', 'Reviewed prices stay', 'Prices saved on Change Selling Price from {bill} stay as they are.', 'If they should go back too, change them on Change Selling Price.')
ON CONFLICT (erm_code, erm_variant, erm_lang) DO UPDATE
   SET erm_title       = EXCLUDED.erm_title,
       erm_line        = EXCLUDED.erm_line,
       erm_todo        = EXCLUDED.erm_todo,
       erm_is_active   = true,
       erm_modified_on = now()
 WHERE (e.erm_title, e.erm_line, e.erm_todo, e.erm_is_active)
       IS DISTINCT FROM (EXCLUDED.erm_title, EXCLUDED.erm_line, EXCLUDED.erm_todo, true);

UPDATE fixed.error_message_catalogue
   SET emc_version   = '2026-11-28.2',
       emc_row_count = (SELECT count(*) FROM fixed.error_message WHERE erm_is_active),
       emc_loaded_on = now()
 WHERE emc_id = 1
   AND emc_version < '2026-11-28.2';


-- ── 2 · S6: untouched P2 fixed-id rows count as synced ────────────────────
-- One definition of "untouched" (fx.untouched), used for the stamp and for the
-- notice. A row whose sync date is already set is left alone.
DO $$
DECLARE
    v_all       int;
    v_untouched int;
    v_stamped   int;
BEGIN
    WITH fx AS (
        SELECT v.asv_id,
               COALESCE(v.asv_setting_key = 'purchase.price_update'
                        AND v.asv_scope = 'COMPANY'
                        AND v.asv_company_id = c.comp_id
                        AND v.asv_is_deleted = false
                        AND v.asv_created_by = 'system'
                        AND v.asv_modified_on IS NULL
                        AND v.asv_modified_by IS NULL
                        AND (v.asv_value, v.asv_remarks) IN (
                                ('NONE'::text, 'P2: kept as before (purchase.allow_price_update was off)'::varchar),
                                ('UPDATE_PRICES', 'P2: kept as before (purchase.allow_price_update was on, mode the old default)')),
                        false) AS untouched
          FROM public.app_setting_value v
          JOIN public.companys c ON v.asv_id = md5('csp-p2-price-update|' || c.comp_id::text)::uuid),
    st AS (
        UPDATE public.app_setting_value v
           SET asv_sync_date = now()
          FROM fx
         WHERE v.asv_id = fx.asv_id
           AND fx.untouched
           AND v.asv_sync_date IS NULL
        RETURNING v.asv_id)
    SELECT (SELECT count(*) FROM fx), (SELECT count(*) FROM fx WHERE fx.untouched), (SELECT count(*) FROM st)
      INTO v_all, v_untouched, v_stamped;

    RAISE NOTICE 'S6: % P2 fixed-id rows; % untouched since 20261128100000 (% stamped now, % already carried a sync date); % touched (left as they are)',
                 v_all, v_untouched, v_stamped, v_untouched - v_stamped, v_all - v_untouched;
END $$;


-- Checks after deploy (read-only): Shared/Prathap/admin/sql/csp-p2-fixes-assert.sql
