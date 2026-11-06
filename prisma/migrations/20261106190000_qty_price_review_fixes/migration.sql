-- ═══════════════════════════════════════════════════════════════════════════
--  Qty-wise Prices (menu 244): review fixes, wording rows  2026-11-06
--  Plan: Shared/Prathap/inventory/plan-qty-price-card-rate-one-form.md §4.5,
--  addendum-1 (D16: everyone but head office saves slabs for their own branch
--  only), addendum-2 (no React). Code review 2026-11-06, the user: "fix all".
--  Seed data only: no table, column, CHECK, function or trigger.
--
--  fixed.error_message: 11 rows, catalogue 2026-11-06.2.
--
--  1 · NEW code ITEM_QTY_PRICE_OTHER_BRANCH (403): a user who is not head
--      office creates, changes, removes or restores a slab of ANOTHER branch
--      (D16). Thrown by items-qty-price-master beside _CHAIN_HQ_ONLY.
--
--  2 · Backfill: codes the server already throws with no wording row.
--      - STOCK_PRICE_OVERLAP: ex_ipm_overlap, when menu 30 (or another 244)
--        saves the same price row at the same moment. The card save can hit it.
--      - STOCK_PRICE_NEGATIVE / _BUCKET_MRP_MISMATCH / _BUCKET_MRP_ZERO /
--        _BUCKET_SP_ZERO: the other item_price_master CHECKs, worded by the
--        selling-price-bulk filter 244 extends. The three bucket checks guard
--        values the app echoes from the load and never lets the user type, so
--        they get the "app sent a wrong request" wording, as
--        STOCK_PRICE_DUPLICATE_BUCKET does.
--      - STOCK_PRICE_FROM_IN_PAST / _FROM_TOO_FAR (the Price from day) and
--        STOCK_PRICE_SCHEDULE_NOT_FOUND / _SCHEDULE_STARTED (cancel a
--        scheduled price): menu 30's save and its Scheduled list. The 244 card
--        save starts today, so it never sends a day of its own.
--      - VALUE_TOO_LARGE: the house 422 every module filter answers a numeric
--        overflow with (244's included). Worded for any screen.
--
--  Not added: VALIDATION_ARRAY_UNIQUE. The VALIDATION_* prefix row already
--  words it ("The app sent a wrong request"), which fits both places that
--  throw it (a slab id sent twice on 244, a lineNo twice on menu 298).
--
--  The same rows are in prisma/seed/Error_Messages.json (version 2026-11-06.2).
--  Re-runnable: ON CONFLICT DO NOTHING, and the catalogue moves forward only.
--  No sequences (erm_id is a uuid), no sync calls.
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO fixed.error_message
    (erm_code, erm_variant, erm_lang, erm_title, erm_line, erm_todo)
VALUES
     ('ITEM_QTY_PRICE_OTHER_BRANCH', '', 'en', 'Your branch only', 'Only head office can change a slab for another branch.', 'Leave that slab, or ask head office.')
    ,('STOCK_PRICE_OVERLAP', '', 'en', 'Changed by someone else', 'Another price for this unit and these days was saved a moment ago.', 'Load the prices again, then type your change.')
    ,('STOCK_PRICE_NEGATIVE', '', 'en', 'Wrong amount', 'A price or a cost is below zero.', 'Type zero or more.')
    ,('STOCK_PRICE_BUCKET_MRP_MISMATCH', '', 'en', 'Something went wrong', 'The app sent a wrong request.', 'Send a photo of this to support.')
    ,('STOCK_PRICE_BUCKET_MRP_ZERO', '', 'en', 'Something went wrong', 'The app sent a wrong request.', 'Send a photo of this to support.')
    ,('STOCK_PRICE_BUCKET_SP_ZERO', '', 'en', 'Something went wrong', 'The app sent a wrong request.', 'Send a photo of this to support.')
    ,('STOCK_PRICE_FROM_IN_PAST', '', 'en', 'Wrong date', 'New prices can''t start before today. Bills already made keep their prices.', 'Pick today or a later day.')
    ,('STOCK_PRICE_FROM_TOO_FAR', '', 'en', 'Wrong date', 'The prices would start more than a year from now.', 'Check the year.')
    ,('STOCK_PRICE_SCHEDULE_NOT_FOUND', '', 'en', 'Price not found', 'This scheduled price is not there now.', 'Open the scheduled prices again.')
    ,('STOCK_PRICE_SCHEDULE_STARTED', '', 'en', 'Price already started', 'This price is already in force, so bills may carry it.', 'Save a new price instead.')
    ,('VALUE_TOO_LARGE', '', 'en', 'Number too big', 'A figure is too big to save. It is probably mistyped.', 'Check the figures you typed.')
ON CONFLICT (erm_code, erm_variant, erm_lang) DO NOTHING;

UPDATE fixed.error_message_catalogue
   SET emc_version   = '2026-11-06.2',
       emc_row_count = (SELECT count(*) FROM fixed.error_message WHERE erm_is_active),
       emc_loaded_on = now()
 WHERE emc_id = 1
   AND emc_version < '2026-11-06.2';
