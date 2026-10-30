-- ═══════════════════════════════════════════════════════════════════════════
--  Expense voucher (ExpV) — the menu its rights are judged on      2026-10-08
--
--  till/plan-till-receipt-payment-expense.md §4 (and REV 2 §2.16): an expense
--  paid by one or more tenders, posted by its own routes (/api/v1/expenses/*,
--  src/modules/accountsModule/expense). 48 (20261008110000_till_money_docs)
--  made the voucher type, its number series and the EXPENSE tender rows legal;
--  nothing made a menu, and every route is judged on a public.user_menus flag.
--
--    277  Expense Voucher   under Accounts (5), after Bill-wise Payment (100)
--                           VIEW get · validate · quick reasons · ledger pick
--                           CREATE / EDIT  the draft
--                           POST · CANCEL  (no AMEND: cancel + re-enter)
--
--  HIDDEN until the client screen ships (flip menu_visiblity then), the way
--  20261008140000 shipped the till menus. Rights work on a hidden menu.
--
--  The id is PINNED and the same row is in prisma/seed/Menu_Master.sql. 265-270
--  were handed out by the sequence on live boxes, 271-276 are the till's; an id
--  already taken by a DIFFERENT menu stops the migration.
--
--  Also: ExpV names its menu (vchr_menu_id), and txn_status_log accepts
--  EXPENSE steps (the voucher's DRAFT → POSTED → CANCELLED trail).
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
    v_clash text;
BEGIN
    SELECT format('%s (%s)', m.menu_id, m.menu_name)
      INTO v_clash
      FROM fixed.menu_master m
     WHERE m.menu_id = 277 AND m.menu_name <> 'Expense Voucher';
    IF v_clash IS NOT NULL THEN
        RAISE EXCEPTION 'Expense voucher menu: id already taken by another menu: %. Pick a free id here and in Menu_Master.sql.', v_clash;
    END IF;
END $$;

INSERT INTO fixed.menu_master
       (menu_id, menu_parent, menu_name, menu_visiblity, menu_position, menu_is_active,
        menu_separator, menu_verbs, menu_created_on, menu_modified_on)
SELECT 277, 5, 'Expense Voucher', false, 11.50, true, false,
       '{VIEW,CREATE,EDIT,DELETE,PRINT,EXPORT,POST,CANCEL}'::text[], now(), now()
 WHERE EXISTS (SELECT 1 FROM fixed.menu_master WHERE menu_id = 5)
   AND NOT EXISTS (SELECT 1 FROM fixed.menu_master WHERE menu_id = 277);

SELECT setval('fixed.menu_master_menu_id_seq',
              GREATEST((SELECT COALESCE(max(menu_id), 0) FROM fixed.menu_master),
                       (SELECT last_value FROM fixed.menu_master_menu_id_seq)));

UPDATE accounts.acc_voucher_types
   SET vchr_menu_id = 277
 WHERE vchr_type_code = 'ExpV'
   AND vchr_menu_id IS NULL
   AND EXISTS (SELECT 1 FROM fixed.menu_master WHERE menu_id = 277);

ALTER TABLE public.txn_status_log DROP CONSTRAINT IF EXISTS ck_tsl_src_doc_type;
ALTER TABLE public.txn_status_log ADD CONSTRAINT ck_tsl_src_doc_type CHECK (tsl_src_doc_type::text = ANY (ARRAY[
    'QUOTATION'::text, 'SALES_ORDER'::text, 'DELIVERY_CHALLAN'::text, 'DC_RETURN'::text, 'SALE_BILL'::text,
    'SALE_RETURN'::text, 'PURCHASE_ORDER'::text, 'PURCHASE_BILL'::text, 'PURCHASE_RETURN'::text,
    'STOCK_TRANSFER'::text, 'STOCK_ADJUSTMENT'::text, 'OPENING_STOCK'::text, 'PHYSICAL_STOCK'::text,
    'RECEIPT'::text, 'PAYMENT'::text, 'JOURNAL'::text, 'EXPENSE'::text,
    'CHEQUE_RECEIVED'::text, 'CHEQUE_ISSUED'::text, 'TEMP_CREDIT'::text, 'OTHER'::text]));
