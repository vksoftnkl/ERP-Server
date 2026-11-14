-- ═══════════════════════════════════════════════════════════════════════════
--  Sale Return (menu 13), phase P1 (DB)                             2026-11-13
--  Plan: Shared/Prathap/sales/plan-sale-return-qt-2026-11-13-v5.md §5 (the
--  user's GO for P1, 2026-11-13); mockups sale_return_ui_mockup_v5.png,
--  sale_return_popups_ui_mockup_v5.png, popups 25 / B / F of
--  sale_return_popups_ui_mockup_v4.png, claims v3. Sorts after
--  20261113100000_item_ledger_layouts.
--
--  No new table (so neither db_table_master rows nor
--  public.ensure_acc_year_partitions change: it already creates the
--  sale_return / sale_return_item partitions). No function, no trigger. Every
--  new CHECK is row-local (offline-safe).
--
--   1 · sales.sale_return: sr_return_kind (RETURN | CLAIM, D23), sr_gst_mode
--       (GST | FINANCIAL, server only, D8), sr_freight_calc_type /
--       sr_loading_calc_type (as the bill's, D20), sr_points_back /
--       sr_points_back_amt / sr_voucher_share_amt (D48).
--       ck_sr_return_kind, ck_sr_gst_mode, ck_sr_points_share (new);
--       ck_sr_settle_sum replaced: no +0.01 epsilon, the points share added,
--       and only a non-DRAFT row has to balance. Section 0 proves no
--       non-draft row breaks it first (0 posted / cancelled rows on 11-13).
--   2 · indexes on the parent (attached on every partition):
--       ux_sr_counter_slno -> ux_sr_device_slno (company, branch, year,
--       device, slno; numbers are per device, D16); ux_sr_refno kept;
--       ix_sr_salesman_gin (D49), partial on sr_is_deleted = false like
--       ix_sb_salesman_gin / ix_so_salesman_gin / ix_sq_salesman_gin.
--   3 · sales.sale_return_item: 24 columns. The bill line's money parts with
--       sale_bill_item's own types (per-qty discounts, bill scheme perc / qty,
--       addl disc 1 / 2, cash disc, net gross, extra cess, loyalty pv, promo
--       usage, qty price, COGS), the rate source of a no-bill line (D56) and
--       v4's two claim columns. ck_sri_claim_goods, ck_sri_rate_source.
--   4 · stock.stock_reason_master: srm_refund_charges, srm_default_condition
--       (+ ck_srm_default_condition, the ck_sri_condition list) and the 8
--       shared SALE_RETURN reasons (D12, D40), direction IN, sort 410-480.
--   5 · menu 13 "Sales Return" re-added from
--       Shared/Prathap/admin/menu-cleanup-20261030/readd-menus.sql, now
--       visible and right after 12 Sales Bill (15.00); each live menu-12
--       grant copied to 13 with the same flags, RETENDER off (13 has no such
--       verb) (D41); db_table_master 630 / 631 -> menu 13.
--   6 · till approval: ck_tar_event / ck_tap_event widened with SALE_RETURN
--       and SALE_CLAIM; 4 shipped company-NULL rules, all blocking the till
--       (D26, D67).
--   7 · settings sales.return_default_kind (DEVICE, D25) and
--       sales.return_expired_lot_days (COMPANY, D57 / D75).
--   8 · grids 207-211 (Desktop). Tokens are compared as text and never
--       cast; the two that need a date / a number (grid 211) are cast only
--       behind a regex guard, so an unbound token cannot fail the run. Grid
--       SQL holds no comment marker. Timestamps leave as IST 12-hour text.
--   9 · ui_tables 74-77 + their columns; ui_table 22 column 100 "Returned"
--       placed right after Bill Qty (D62).
--         74 SALE RETURN - LINES: its own enum (visible 0..18 in mockup v5
--            order, hidden 19..37).
--         75 SALE RETURN - CHARGES: ChargeCols 0..32 (as tables 21 / 69) +
--            33 "On the bill" and 34 "Back before", which ChargeCols does
--            not have yet.
--         76 SALE RETURN - ADJUST BILLS: ReceiptBillCols 0..23 (as table 32),
--            so ReceiptBillDelegate can be reused.
--         77 SALE RETURN - REFUND TENDERS: ReceiptTenderCols 0..17 (as table
--            43), so PaymentTenderDelegate can be reused; "Ledger it posts
--            to" sits on 5 (BankName), which a Cash / UPI / Bank refund
--            never uses for a bank.
--  10 · dropdown 78 "SALE RETURN REASONS" (param icompany_id, always sent).
--  11 · fixed.error_message: 16 new codes; catalogue 2026-11-13.1.
--
--  Ids are PINNED; the same rows are in prisma/seed (Menu_Master.sql,
--  Stock_Reason_Master.sql, Ui_Tables.sql, Ui_Table_Columns.sql,
--  Dropdown_Details.sql, Dropdown_Columns.sql, Sale_Return_Grids_207_211.sql,
--  Error_Messages.json). An id or name already held by something else stops
--  the migration. Re-runnable: every statement is guarded.
-- ═══════════════════════════════════════════════════════════════════════════


-- ── 0 · pinned ids and names must be free (or already ours) ────────────────
DO $$
DECLARE
    v_clash text;
    v_bad   integer;
BEGIN
    SELECT string_agg(x, '; ') INTO v_clash FROM (
        SELECT format('menu 13 is "%s" under %s', m.menu_name, m.menu_parent) AS x
          FROM fixed.menu_master m
         WHERE m.menu_id = 13 AND (m.menu_name, m.menu_parent) IS DISTINCT FROM ('Sales Return'::varchar, 1)
        UNION ALL
        SELECT format('grid %s (%s)', g.grid_id, g.grid_name)
          FROM fixed.grid_details g
          JOIN (VALUES (207::bigint, 'MAIN LIST - SALE RETURNS'::text),
                       (208, 'POPUP - SALE RETURN BILLS'),
                       (209, 'POPUP - SALE RETURN APPROVALS'),
                       (210, 'POPUP - SALE RETURN CREDIT USES'),
                       (211, 'POPUP - SALE RETURN LAST SALES')
               ) v(id, name) ON v.id = g.grid_id OR upper(v.name) = upper(g.grid_name)
         WHERE (g.grid_id, g.grid_name) IS DISTINCT FROM (v.id, v.name)
        UNION ALL
        SELECT format('ui_table %s (%s)', t.ui_tbl_id, t.ui_tbl_name)
          FROM fixed.ui_tables t
          JOIN (VALUES (74::bigint, 'SALE RETURN - LINES'::text),
                       (75, 'SALE RETURN - CHARGES'),
                       (76, 'SALE RETURN - ADJUST BILLS'),
                       (77, 'SALE RETURN - REFUND TENDERS')
               ) v(id, name) ON v.id = t.ui_tbl_id OR upper(v.name) = upper(t.ui_tbl_name)
         WHERE (t.ui_tbl_id, t.ui_tbl_name) IS DISTINCT FROM (v.id, v.name)
        UNION ALL
        SELECT format('ui_table_column %s (table %s no %s)', c.ui_tbl_clm_id, c.ui_tbl_clm_table_id, c.ui_tbl_clm_no)
          FROM fixed.ui_table_columns c
          JOIN (VALUES (74::bigint, 2509::bigint, 38), (75, 2547, 35), (76, 2582, 24), (77, 2606, 18)
               ) v(tbl, first_id, cnt) ON c.ui_tbl_clm_id BETWEEN v.first_id AND v.first_id + v.cnt - 1
         WHERE (c.ui_tbl_clm_table_id, c.ui_tbl_clm_no) IS DISTINCT FROM (v.tbl, c.ui_tbl_clm_id - v.first_id)
        UNION ALL
        SELECT format('ui_table_column %s (table %s no %s)', c.ui_tbl_clm_id, c.ui_tbl_clm_table_id, c.ui_tbl_clm_no)
          FROM fixed.ui_table_columns c
         WHERE c.ui_tbl_clm_id = 2624
           AND (c.ui_tbl_clm_table_id, c.ui_tbl_clm_no) IS DISTINCT FROM (22::bigint, 100::bigint)
        UNION ALL
        SELECT format('ui_table_column %s (table %s no %s, not one of ours)', c.ui_tbl_clm_id, c.ui_tbl_clm_table_id, c.ui_tbl_clm_no)
          FROM fixed.ui_table_columns c
         WHERE c.ui_tbl_clm_is_deleted = false
           AND ((c.ui_tbl_clm_table_id IN (74, 75, 76, 77) AND c.ui_tbl_clm_id NOT BETWEEN 2509 AND 2623)
             OR (c.ui_tbl_clm_table_id = 22 AND c.ui_tbl_clm_no = 100 AND c.ui_tbl_clm_id <> 2624))
        UNION ALL
        SELECT format('ui_table 22 is "%s"', t.ui_tbl_name)
          FROM fixed.ui_tables t
         WHERE t.ui_tbl_id = 22 AND t.ui_tbl_name <> 'SALE BILL - LINES'
        UNION ALL
        SELECT format('dropdown %s (%s)', d.dropdown_id, d.dropdown_name)
          FROM fixed.dropdown_details d
         WHERE (d.dropdown_id = 78 AND d.dropdown_name IS DISTINCT FROM 'SALE RETURN REASONS')
            OR (upper(d.dropdown_name) = 'SALE RETURN REASONS' AND d.dropdown_id <> 78)
        UNION ALL
        SELECT format('dropdown column %s (dropdown %s no %s)', c.dropdown_columns_id, c.dropdown_columns_dropdown_id, c.dropdown_columns_no)
          FROM fixed.dropdown_columns c
         WHERE c.dropdown_columns_id IN ('01a1b2c0-7800-7000-8000-000000000780'::uuid,
                                         '01a1b2c0-7800-7000-8000-000000000781'::uuid,
                                         '01a1b2c0-7800-7000-8000-000000000782'::uuid,
                                         '01a1b2c0-7800-7000-8000-000000000783'::uuid,
                                         '01a1b2c0-7800-7000-8000-000000000784'::uuid)
           AND (c.dropdown_columns_dropdown_id, c.dropdown_columns_no)
               IS DISTINCT FROM (78, right(c.dropdown_columns_id::text, 1)::int)
        UNION ALL
        SELECT format('grid column %s (grid %s no %s)', c.grid_column_id, c.grid_id, c.grid_column_number)
          FROM fixed.grid_columns c
         WHERE c.grid_column_id::text ~ '^01a1b2c0-2[01][0-9]0-7000-8000-00000002[01][0-9][0-9]{2}$'
           AND (c.grid_id NOT BETWEEN 207 AND 211
                OR c.grid_column_id::text <> format('01a1b2c0-%s0-7000-8000-%s%s', c.grid_id, lpad(c.grid_id::text, 10, '0'), lpad(c.grid_column_number::text, 2, '0')))
        UNION ALL
        SELECT format('app setting %s (%s)', s.asd_key, s.asd_max_scope)
          FROM public.app_setting_def s
         WHERE (s.asd_key = 'sales.return_default_kind' AND s.asd_max_scope <> 'DEVICE')
            OR (s.asd_key = 'sales.return_expired_lot_days' AND s.asd_max_scope <> 'COMPANY')
        UNION ALL
        SELECT format('stock reason %s already shared for %s', r.srm_code, r.srm_allowed_txn_types)
          FROM stock.stock_reason_master r
         WHERE r.srm_company_id IS NULL AND r.srm_is_deleted = false
           AND r.srm_code IN ('SR_DAMAGED', 'SR_EXPIRED', 'SR_WRONG_ITEM', 'SR_QUALITY',
                              'SR_EXCESS', 'SR_CHANGED_MIND', 'SR_EXPIRED_SHOP', 'SR_DAMAGED_SHOP')
           AND NOT (r.srm_allowed_txn_types && ARRAY['SALE_RETURN'])
    ) c;
    IF v_clash IS NOT NULL THEN
        RAISE EXCEPTION 'Sale Return P1: ids or names already taken: %. Pick free ones here, in the seed files and in the server / Qt code.', v_clash;
    END IF;

    -- The replaced ck_sr_settle_sum: every row that is not a DRAFT must balance.
    SELECT count(*) INTO v_bad
      FROM sales.sale_return
     WHERE sr_status <> 'DRAFT'
       AND sr_refund_amt + sr_adjusted_amt + sr_credit_amt <> sr_return_amt;
    IF v_bad > 0 THEN
        RAISE EXCEPTION 'Sale Return P1: % non-draft sale_return rows do not balance (refund + adjusted + credit <> return amount); the new ck_sr_settle_sum would refuse them.', v_bad;
    END IF;
END $$;


-- ── 1 · sales.sale_return: columns and CHECKs ──────────────────────────────
ALTER TABLE sales.sale_return
    ADD COLUMN IF NOT EXISTS sr_return_kind       varchar(10)   NOT NULL DEFAULT 'RETURN',
    ADD COLUMN IF NOT EXISTS sr_gst_mode          varchar(10)   NOT NULL DEFAULT 'GST',
    ADD COLUMN IF NOT EXISTS sr_freight_calc_type varchar(12),
    ADD COLUMN IF NOT EXISTS sr_loading_calc_type varchar(12),
    ADD COLUMN IF NOT EXISTS sr_points_back       numeric(18,4) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS sr_points_back_amt   numeric(15,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS sr_voucher_share_amt numeric(15,2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN sales.sale_return.sr_return_kind IS 'RETURN = goods come back; CLAIM = damaged / expired at the shop, each line Back or Destroyed (D23).';
COMMENT ON COLUMN sales.sale_return.sr_gst_mode IS 'GST = a GST credit note; FINANCIAL = past the credit-note cut-off, no GST cut, no IRN (D8). Set by the server only.';
COMMENT ON COLUMN sales.sale_return.sr_points_back IS 'Loyalty points given back for the share of the note the bill paid by points (D48).';
COMMENT ON COLUMN sales.sale_return.sr_points_back_amt IS 'Money value of sr_points_back; part of the note, never refunded in money (D48).';
COMMENT ON COLUMN sales.sale_return.sr_voucher_share_amt IS 'Share of the note the bill paid by gift voucher; stays inside credit / adjusted, out of the refund cap (D48).';

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'sales.sale_return'::regclass AND conname = 'ck_sr_return_kind') THEN
        ALTER TABLE sales.sale_return
          ADD CONSTRAINT ck_sr_return_kind CHECK (sr_return_kind IN ('RETURN', 'CLAIM'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'sales.sale_return'::regclass AND conname = 'ck_sr_gst_mode') THEN
        ALTER TABLE sales.sale_return
          ADD CONSTRAINT ck_sr_gst_mode CHECK (sr_gst_mode IN ('GST', 'FINANCIAL'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'sales.sale_return'::regclass AND conname = 'ck_sr_points_share') THEN
        ALTER TABLE sales.sale_return
          ADD CONSTRAINT ck_sr_points_share
              CHECK (sr_points_back >= 0 AND sr_points_back_amt >= 0 AND sr_voucher_share_amt >= 0);
    END IF;
END $$;

-- Replaced, not added to: the old one allowed +0.01 and ignored the points.
ALTER TABLE sales.sale_return DROP CONSTRAINT IF EXISTS ck_sr_settle_sum;
ALTER TABLE sales.sale_return
    ADD CONSTRAINT ck_sr_settle_sum
        CHECK (sr_status = 'DRAFT'
               OR sr_refund_amt + sr_adjusted_amt + sr_credit_amt + sr_points_back_amt = sr_return_amt);


-- ── 2 · sales.sale_return: indexes (parent; Postgres attaches one per partition)
DROP INDEX IF EXISTS sales.ux_sr_counter_slno;
CREATE UNIQUE INDEX IF NOT EXISTS ux_sr_device_slno
    ON sales.sale_return (sr_company_id, sr_branch_id, sr_acc_year, sr_device_id, sr_return_slno);
CREATE INDEX IF NOT EXISTS ix_sr_salesman_gin
    ON sales.sale_return USING gin (sr_salesman_id) WHERE sr_is_deleted = false;


-- ── 3 · sales.sale_return_item: 24 columns and CHECKs ──────────────────────
ALTER TABLE sales.sale_return_item
    ADD COLUMN IF NOT EXISTS sri_claim_goods       varchar(10),
    ADD COLUMN IF NOT EXISTS sri_supplier_claim    boolean       NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS sri_item_disc_qty     numeric(15,3) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS sri_spl_disc_qty      numeric(15,3) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS sri_sch_disc_qty      numeric(15,3) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS sri_bill_sch_perc     numeric(15,4) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS sri_bill_sch_qty      numeric(15,3) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS sri_addl_disc1_perc   numeric(15,4) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS sri_addl_disc1_amt    numeric(15,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS sri_addl_disc2_perc   numeric(15,4) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS sri_addl_disc2_amt    numeric(15,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS sri_cash_disc_perc    numeric(15,4) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS sri_cash_disc_amt     numeric(15,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS sri_net_gross         numeric(17,4),
    ADD COLUMN IF NOT EXISTS sri_acess_perc        numeric(15,4) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS sri_acess_per_unit    numeric(15,4) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS sri_acess_amt         numeric(15,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS sri_loyalty_pv        numeric(18,4) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS sri_promo_usage_id    uuid,
    ADD COLUMN IF NOT EXISTS sri_qty_price_id      uuid,
    ADD COLUMN IF NOT EXISTS sri_cogs_amt          numeric(15,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS sri_rate_source       varchar(12),
    ADD COLUMN IF NOT EXISTS sri_rate_src_item_id  uuid,
    ADD COLUMN IF NOT EXISTS sri_rate_src_acc_year character(9);

COMMENT ON COLUMN sales.sale_return_item.sri_claim_goods IS 'Claim line: BACK (stock into EXPIRED / DAMAGED, for the supplier claim) or DESTROYED (at the shop, no stock). A CLAIM line must say one: a server check (D23).';
COMMENT ON COLUMN sales.sale_return_item.sri_supplier_claim IS 'True on a claim line that came BACK, for the later Purchase Return claim link (SR-25).';
COMMENT ON COLUMN sales.sale_return_item.sri_cogs_amt IS 'The COGS taken back: the bill line''s own cost per base unit, or today''s average (D54, D69).';
COMMENT ON COLUMN sales.sale_return_item.sri_rate_source IS 'Where the rate came from: BILL, LAST_SALE (the customer''s last sale of the item) or TODAY_PRICE (D56). A LAST_SALE line naming its source is a server check.';
COMMENT ON COLUMN sales.sale_return_item.sri_rate_src_item_id IS 'The sale_bill_item whose rate a no-bill line used (grid 211); no FK, the bill may be another branch''s (D78).';

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'sales.sale_return_item'::regclass AND conname = 'ck_sri_claim_goods') THEN
        ALTER TABLE sales.sale_return_item
          ADD CONSTRAINT ck_sri_claim_goods
              CHECK (sri_claim_goods IS NULL OR sri_claim_goods IN ('BACK', 'DESTROYED'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'sales.sale_return_item'::regclass AND conname = 'ck_sri_rate_source') THEN
        ALTER TABLE sales.sale_return_item
          ADD CONSTRAINT ck_sri_rate_source
              CHECK (sri_rate_source IS NULL OR sri_rate_source IN ('BILL', 'LAST_SALE', 'TODAY_PRICE'));
    END IF;
END $$;


-- ── 4 · stock.stock_reason_master: 2 columns + the 8 sale-return reasons ───
ALTER TABLE stock.stock_reason_master
    ADD COLUMN IF NOT EXISTS srm_refund_charges    boolean,
    ADD COLUMN IF NOT EXISTS srm_default_condition varchar(10);

COMMENT ON COLUMN stock.stock_reason_master.srm_refund_charges IS 'SALE_RETURN reasons: give the bill''s after-tax additions back by default. NULL on every other reason.';
COMMENT ON COLUMN stock.stock_reason_master.srm_default_condition IS 'SALE_RETURN reasons: the line Condition a new line takes (RESTOCK / DAMAGED / EXPIRED / SCRAP, as ck_sri_condition).';

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'stock.stock_reason_master'::regclass AND conname = 'ck_srm_default_condition') THEN
        ALTER TABLE stock.stock_reason_master
          ADD CONSTRAINT ck_srm_default_condition
              CHECK (srm_default_condition IS NULL
                     OR srm_default_condition IN ('RESTOCK', 'DAMAGED', 'EXPIRED', 'SCRAP'));
    END IF;
END $$;

-- Shared (company NULL), IN, named only for SALE_RETURN, so no adjustment,
-- count or purchase-return picker offers them. SR_ prefix: DAMAGE, EXPIRY and
-- PRET_* are already shared codes. Same NOT EXISTS guard as
-- 20261029130000; prisma/seed/Stock_Reason_Master.sql carries them too.
INSERT INTO stock.stock_reason_master
    (srm_company_id, srm_code, srm_name, srm_direction, srm_allowed_txn_types,
     srm_require_remarks, srm_sort_order, srm_remarks, srm_default_condition, srm_refund_charges,
     srm_created_by)
SELECT v.company, v.code, v.name, 'IN', ARRAY['SALE_RETURN']::text[],
       false, v.sort_order, v.note, v.cond, v.charges, 'system'
  FROM (VALUES
    (NULL::uuid, 'SR_DAMAGED'::varchar,      'Damaged / leaking'::varchar,           410, 'DAMAGED'::varchar, true,
     'Sale return: came back damaged or leaking.'::varchar),
    (NULL, 'SR_EXPIRED',      'Expired / near expiry',        420, 'EXPIRED', true,
     'Sale return: past or near its expiry date.'),
    (NULL, 'SR_WRONG_ITEM',   'Wrong item sent',              430, 'RESTOCK', true,
     'Sale return: we sent the wrong item.'),
    (NULL, 'SR_QUALITY',      'Quality complaint',            440, 'DAMAGED', true,
     'Sale return: the customer complained about the quality.'),
    (NULL, 'SR_EXCESS',       'Excess / not ordered',         450, 'RESTOCK', false,
     'Sale return: more than the customer ordered, or not ordered.'),
    (NULL, 'SR_CHANGED_MIND', 'Customer changed mind',        460, 'RESTOCK', false,
     'Sale return: good stock the customer no longer wants.'),
    (NULL, 'SR_EXPIRED_SHOP', 'Expired at the shop (claim)',  470, 'EXPIRED', true,
     'Claim: expired on the customer''s shelf.'),
    (NULL, 'SR_DAMAGED_SHOP', 'Damaged at the shop (claim)',  480, 'DAMAGED', true,
     'Claim: damaged at the customer''s shop.')
  ) AS v(company, code, name, sort_order, cond, charges, note)
 WHERE NOT EXISTS (
        SELECT 1 FROM stock.stock_reason_master e
         WHERE e.srm_company_id IS NULL
           AND e.srm_code       = v.code
           AND e.srm_is_deleted = false);


-- ── 5 · menu 13 "Sales Return" + its rights + the table registry ──────────
INSERT INTO fixed.menu_master
       (menu_id, menu_parent, menu_name, menu_alias, menu_visiblity, menu_position,
        menu_icon_location_desktop, menu_icon_location_web, menu_icon_location_mobile,
        menu_is_active, menu_separator, menu_verbs, menu_created_on, menu_modified_on)
SELECT 13, 1, 'Sales Return', 'CTRL+R', true, 15.00,
       '0', NULL, NULL, true, false,
       '{VIEW,CREATE,EDIT,DELETE,PRINT,EXPORT,POST,CANCEL,AMEND,OVERRIDE}'::text[], now(), now()
 WHERE EXISTS (SELECT 1 FROM fixed.menu_master WHERE menu_id = 1)
   AND NOT EXISTS (SELECT 1 FROM fixed.menu_master WHERE menu_id = 13);

SELECT setval('fixed.menu_master_menu_id_seq',
              GREATEST((SELECT COALESCE(max(menu_id), 0) FROM fixed.menu_master),
                       (SELECT last_value FROM fixed.menu_master_menu_id_seq)));

-- Each live Sales Bill (12) row -> a 13 row with the same flags (D41).
INSERT INTO public.user_menus
       (um_user_id, um_menu_id, um_can_view, um_can_create, um_can_edit, um_can_delete,
        um_can_print, um_can_export, um_visibility, um_is_favourite, um_is_pinned,
        um_sort_order, um_is_deleted, um_created_by, um_can_post, um_can_cancel,
        um_can_amend, um_can_override, um_can_retender)
SELECT u.um_user_id, 13, u.um_can_view, u.um_can_create, u.um_can_edit, u.um_can_delete,
       u.um_can_print, u.um_can_export, u.um_visibility, false, false,
       0, false, u.um_created_by, u.um_can_post, u.um_can_cancel,
       u.um_can_amend, u.um_can_override, false
  FROM public.user_menus u
 WHERE u.um_menu_id = 12
   AND u.um_is_deleted = false
   AND EXISTS (SELECT 1 FROM fixed.menu_master m WHERE m.menu_id = 13 AND m.menu_name = 'Sales Return')
ON CONFLICT (um_user_id, um_menu_id) DO NOTHING;

UPDATE public.db_table_master
   SET dtm_menu_id = 13, dtm_modified_on = now()
 WHERE dtm_id IN (630, 631)
   AND dtm_schema = 'sales'
   AND dtm_table IN ('sale_return', 'sale_return_item')
   AND dtm_menu_id IS NULL
   AND EXISTS (SELECT 1 FROM fixed.menu_master m WHERE m.menu_id = 13);


-- ── 6 · till approval: two new events + the four shipped return rules ──────
-- The lists restate 20261008130000's 31 events + SALE_RETURN, SALE_CLAIM.
ALTER TABLE accounts.till_approval_rule DROP CONSTRAINT IF EXISTS ck_tar_event;
ALTER TABLE accounts.till_approval_rule
    ADD CONSTRAINT ck_tar_event CHECK (tar_event_code::text = ANY (ARRAY[
        'FLOAT_MISMATCH','CASH_VARIANCE','NONCASH_VARIANCE','EXPENSE','CASH_PAYMENT','PAID_IN','PICKUP','TOP_UP',
        'NO_SALE','CASH_LIMIT_OVERRIDE','SUSPEND_LONG','FORCE_CLOSE','SESSION_REOPEN','SESSION_VOID',
        'MOVEMENT_VOID','RECOUNT','DAY_CLOSE_EXCEPTION','DAY_REOPEN','SAFE_VARIANCE','REMITTANCE',
        'VOID_BILL','VOID_LINE','PRICE_OVERRIDE','DISCOUNT_OVER','RETURN_NO_RECEIPT','REFUND_CASH',
        'REPRINT','RETENDER','COUNTER_RELINK','NONCASH_WRITE_OFF','SETTLEMENT_RESOLVE',
        'SALE_RETURN','SALE_CLAIM']::text[]));

ALTER TABLE accounts.till_approval DROP CONSTRAINT IF EXISTS ck_tap_event;
ALTER TABLE accounts.till_approval
    ADD CONSTRAINT ck_tap_event CHECK (tap_event_code::text = ANY (ARRAY[
        'FLOAT_MISMATCH','CASH_VARIANCE','NONCASH_VARIANCE','EXPENSE','CASH_PAYMENT','PAID_IN','PICKUP','TOP_UP',
        'NO_SALE','CASH_LIMIT_OVERRIDE','SUSPEND_LONG','FORCE_CLOSE','SESSION_REOPEN','SESSION_VOID',
        'MOVEMENT_VOID','RECOUNT','DAY_CLOSE_EXCEPTION','DAY_REOPEN','SAFE_VARIANCE','REMITTANCE',
        'VOID_BILL','VOID_LINE','PRICE_OVERRIDE','DISCOUNT_OVER','RETURN_NO_RECEIPT','REFUND_CASH',
        'REPRINT','RETENDER','COUNTER_RELINK','NONCASH_WRITE_OFF','SETTLEMENT_RESOLVE',
        'SALE_RETURN','SALE_CLAIM']::text[]));

-- Company-NULL rules, each skipped when a shipped one exists. All block the
-- till, so a device whose till.approval_gate is REFUSE holds the return (D67).
INSERT INTO accounts.till_approval_rule
    (tar_event_code, tar_mode, tar_threshold_amount, tar_channel, tar_min_role,
     tar_blocks_till, tar_remarks, tar_created_by)
SELECT v.event, v.mode, v.amount, v.channel, v.role, true, v.remarks, 'system'
  FROM (VALUES
    ('RETURN_NO_RECEIPT'::varchar, 'ALWAYS'::varchar,      0.00::numeric, 'EITHER'::varchar,  'SUPERVISOR'::varchar,
     'every sale return with no bill (D5)'::varchar),
    ('REFUND_CASH',                'OVER_AMOUNT',       2000.00,          'COUNTER',          'SUPERVISOR',
     'a sale return''s refund paid in CASH over the threshold (cash part only)'),
    ('SALE_RETURN',                'NEVER',                0.00,          'EITHER',           'STORE_MANAGER',
     'every sale return: recorded, nobody asked; set ALWAYS to ask a store manager'),
    ('SALE_CLAIM',                 'ALWAYS',               0.00,          'EITHER',           'STORE_MANAGER',
     'every claim (Kind = Claim) at Post')
  ) AS v(event, mode, amount, channel, role, remarks)
 WHERE NOT EXISTS (
         SELECT 1 FROM accounts.till_approval_rule r
          WHERE r.tar_event_code = v.event AND r.tar_company_id IS NULL
            AND r.tar_branch_id IS NULL AND r.tar_is_deleted = false);


-- ── 7 · settings ───────────────────────────────────────────────────────────
INSERT INTO public.app_setting_def
    (asd_key, asd_module, asd_group, asd_data_type, asd_default_value, asd_allowed_values,
     asd_min_value, asd_max_value, asd_max_scope, asd_label, asd_description, asd_sort_order, asd_created_by)
VALUES
    ('sales.return_default_kind', 'SALES', 'Return', 'TEXT', 'RETURN', '["RETURN","CLAIM"]'::jsonb,
     NULL, NULL, 'DEVICE', 'Sale Return opens as',
     'RETURN = the Sale Return screen opens as a return (goods come back). CLAIM = it opens as a claim (damaged / expired at the shop), for a claims desk. The operator can still change the Kind on the screen.',
     33, 'system'),
    ('sales.return_expired_lot_days', 'SALES', 'Return', 'INT', '0', NULL,
     0, NULL, 'COMPANY', 'Warn on a returned lot expired more than (days)',
     'A sale return of a lot that expired more than this many days before the return date warns SALES_RETURN_LOT_EXPIRED (passed with the Override right, logged). 0 = warn on any expired lot.',
     34, 'system')
ON CONFLICT (asd_key) DO NOTHING;


-- ── 8 · grids 207-211 ──────────────────────────────────────────────────────
INSERT INTO fixed.grid_details
       (grid_id, grid_name, grid_description, grid_sort_column, grid_sort_order, grid_device_type,
        grid_status, grid_is_deleted, grid_created_by, grid_sql)
VALUES
(207, 'MAIN LIST - SALE RETURNS',
 'Sale Return list (menu 13, TxnMainView). Tokens (send every one; '''' = no bound / all): icompany_id, ibranch_id, ifrom_date, ito_date (yyyy-MM-dd), ikind ('''' / RETURN / CLAIM), ifilter ('''' / CLAIMS_WAITING = claims still DRAFT / AWAITING_APPROVAL = latest till_approval PENDING). Status text adds AWAITING APPROVAL, DRAFT · REJECTED, DRAFT · CLAIM WAITING, POSTED · REVIEW REJECTED from the latest till_approval row of the return. Newest first.',
 'sr_return_date', 'Descending', 'Desktop', true, false, 'system',
$mig$SELECT sr.sr_id, sr.sr_company_id, sr.sr_branch_id, sr.sr_acc_year,
       sr.sr_return_refno, sr.sr_return_date,
       CASE sr.sr_return_kind WHEN 'CLAIM' THEN 'Claim' ELSE 'Return' END AS sr_kind_text,
       sr.sr_cust_name,
       CASE WHEN sr.sr_is_against_bill THEN COALESCE(sr.sr_bill_refno, '') ELSE 'no bill' END AS sr_against,
       sr.sr_tot_items, sr.sr_return_amt,
       CASE sr.sr_settle_mode WHEN 'CASH' THEN 'Refund' WHEN 'ADJUST' THEN 'Adjust'
                              WHEN 'ADVANCE' THEN 'Credit note' ELSE sr.sr_settle_mode END AS sr_settle_by,
       sr.sr_settle_status,
       CASE WHEN sr.sr_status = 'DRAFT' AND ap.tap_status = 'PENDING' THEN 'AWAITING APPROVAL'
            WHEN sr.sr_status = 'DRAFT' AND ap.tap_status = 'REJECTED' THEN 'DRAFT · REJECTED'
            WHEN sr.sr_status = 'DRAFT' AND sr.sr_return_kind = 'CLAIM' THEN 'DRAFT · CLAIM WAITING'
            WHEN sr.sr_status = 'POSTED' AND ap.tap_status = 'REJECTED' THEN 'POSTED · REVIEW REJECTED'
            ELSE sr.sr_status END AS sr_status_text,
       CASE WHEN sr.sr_status = 'DRAFT' THEN ''
            WHEN ei.gde_status = 'NA' THEN 'N/A'
            WHEN ei.gde_status = 'CANCELED' THEN 'CANCELLED'
            WHEN ei.gde_status IS NOT NULL THEN ei.gde_status
            WHEN sr.sr_gst_mode = 'FINANCIAL' THEN 'N/A'
            ELSE 'NOT SENT' END AS sr_irn_status,
       COALESCE(rm.srm_name, sr.sr_return_reason, '') AS sr_reason_text,
       sr.sr_status, sr.sr_return_kind, sr.sr_settle_mode,
       COALESCE(ap.tap_status, '') AS sr_approval_status,
       sr.sr_bill_id, sr.sr_bill_acc_year, sr.sr_cust_id, sr.sr_return_slno, sr.sr_gst_mode
  FROM sales.sale_return sr
  LEFT JOIN stock.stock_reason_master rm ON rm.srm_id = sr.sr_reason_id
  LEFT JOIN LATERAL (SELECT a.tap_status
                       FROM accounts.till_approval a
                      WHERE a.tap_src_doc_type = 'SALE_RETURN'
                        AND a.tap_src_doc_id = sr.sr_id
                        AND a.tap_is_deleted = false
                      ORDER BY a.tap_requested_on DESC
                      LIMIT 1) ap ON true
  LEFT JOIN LATERAL (SELECT e.gde_status::text AS gde_status
                       FROM accounts.acc_voucher_doc_register g
                       JOIN accounts.acc_voucher_doc_einvoice e ON e.gde_gdr_id = g.gdr_id AND e.gde_is_deleted = false
                      WHERE g.gdr_source_doc_id = sr.sr_id
                        AND g.gdr_acc_year = sr.sr_acc_year
                        AND g.gdr_is_deleted = false
                      ORDER BY e.gde_created_on DESC
                      LIMIT 1) ei ON true
 WHERE sr.sr_is_deleted = false
   AND sr.sr_company_id::text = 'icompany_id'
   AND (NULLIF('ibranch_id', '') IS NULL OR sr.sr_branch_id::text = 'ibranch_id')
   AND (NULLIF('ifrom_date', '') IS NULL OR sr.sr_return_date::text >= 'ifrom_date')
   AND (NULLIF('ito_date', '') IS NULL OR sr.sr_return_date::text <= 'ito_date')
   AND (NULLIF('ikind', '') IS NULL OR sr.sr_return_kind = 'ikind')
   AND (NULLIF('ifilter', '') IS NULL
        OR ('ifilter' = 'CLAIMS_WAITING' AND sr.sr_return_kind = 'CLAIM' AND sr.sr_status = 'DRAFT')
        OR ('ifilter' = 'AWAITING_APPROVAL' AND ap.tap_status = 'PENDING' AND sr.sr_status <> 'CANCELLED'))
 ORDER BY sr.sr_return_date DESC, sr.sr_return_slno DESC$mig$),
(208, 'POPUP - SALE RETURN BILLS',
 'Sale Return bill picker (menu 13, popup A): POSTED bills with their line count, lines with qty left (base units, D68: the line''s own factor when > 0, else the unit conversion, else 1; POSTED returns only), bill value, returned, still due and age. Tokens (send every one; '''' = no bound / all): icompany_id, ibranch_id, icust_id ('''' = every customer), iall_branches (''true'' = every branch of the company, D14), ihide_full (''true'' = hide bills with no qty left), ifrom_date, ito_date (yyyy-MM-dd). Searches bill no, bill value, customer name and phone.',
 'sb_bill_date', 'Descending', 'Desktop', true, false, 'system',
$mig$SELECT b.sb_id, b.sb_acc_year, b.sb_branch_id, b.sb_cust_id,
       b.sb_bill_refno, b.sb_bill_date,
       COALESCE(b.sb_pay_mode, '') AS sb_paid_by,
       ls.line_count AS sb_line_count,
       ls.open_lines AS sb_open_lines,
       b.sb_bill_amt, b.sb_returned_amt,
       COALESCE(bal.pending, 0) AS sb_still_due,
       (CURRENT_DATE - b.sb_bill_date) AS sb_age_days,
       b.sb_cust_name,
       COALESCE(b.sb_cust_phone, '') AS sb_cust_phone,
       COALESCE(br.br_name, '') AS sb_branch_name,
       COALESCE(b.sb_return_status, '') AS sb_return_status,
       b.sb_company_id
  FROM sales.sale_bill b
  LEFT JOIN public.branch_master br ON br.br_id = b.sb_branch_id
  LEFT JOIN LATERAL (SELECT SUM(a.abl_pending_amount) AS pending
                       FROM accounts.acc_bill_balance a
                      WHERE a.abl_src_doc_type = 'SALE_BILL'
                        AND a.abl_src_doc_id = b.sb_id
                        AND a.abl_acc_year = b.sb_acc_year
                        AND a.abl_is_deleted = false
                        AND a.abl_is_active = true) bal ON true
  CROSS JOIN LATERAL (SELECT count(*) AS line_count,
                             count(*) FILTER (WHERE q.bill_base > q.back_base) AS open_lines
                        FROM (SELECT bi.sbi_bill_qty
                                     * CASE WHEN bi.sbi_to_base_factor > 0 THEN bi.sbi_to_base_factor
                                            ELSE COALESCE(NULLIF(bu.iuc_to_base_factor, 0), 1) END AS bill_base,
                                     COALESCE((SELECT SUM((ri.sri_return_qty + ri.sri_free_qty)
                                                          * CASE WHEN ri.sri_to_base_factor > 0 THEN ri.sri_to_base_factor
                                                                 ELSE COALESCE(NULLIF(ru.iuc_to_base_factor, 0), 1) END)
                                                 FROM sales.sale_return_item ri
                                                 JOIN sales.sale_return r ON r.sr_id = ri.sri_return_id AND r.sr_acc_year = ri.sri_acc_year
                                                 LEFT JOIN inventory.item_unit_conversion ru ON ru.iuc_id = ri.sri_item_unit_id
                                                WHERE ri.sri_bill_item_id = bi.sbi_id
                                                  AND ri.sri_bill_acc_year = bi.sbi_acc_year
                                                  AND ri.sri_is_deleted = false
                                                  AND r.sr_is_deleted = false
                                                  AND r.sr_status = 'POSTED'), 0) AS back_base
                                FROM sales.sale_bill_item bi
                                LEFT JOIN inventory.item_unit_conversion bu ON bu.iuc_id = bi.sbi_item_unit_id
                               WHERE bi.sbi_bill_id = b.sb_id
                                 AND bi.sbi_acc_year = b.sb_acc_year
                                 AND bi.sbi_is_deleted = false) q) ls
 WHERE b.sb_is_deleted = false
   AND b.sb_status = 'POSTED'
   AND b.sb_company_id::text = 'icompany_id'
   AND ('iall_branches' = 'true' OR b.sb_branch_id::text = 'ibranch_id')
   AND (NULLIF('icust_id', '') IS NULL OR b.sb_cust_id::text = 'icust_id')
   AND (NULLIF('ifrom_date', '') IS NULL OR b.sb_bill_date::text >= 'ifrom_date')
   AND (NULLIF('ito_date', '') IS NULL OR b.sb_bill_date::text <= 'ito_date')
   AND ('ihide_full' <> 'true' OR ls.open_lines > 0)
 ORDER BY b.sb_bill_date DESC, b.sb_bill_slno DESC$mig$),
(209, 'POPUP - SALE RETURN APPROVALS',
 'Sale Return History, Approvals tab (D55, D72): the till_approval rows of one return (tap_src_doc_type SALE_RETURN), newest first; times as IST 12-hour text. Tokens: icompany_id, idoc_id (sr_id), iacc_year (accepted, not filtered: an approval is filed in the session''s year, which may be the next one).',
 'tap_sort', 'Descending', 'Desktop', true, false, 'system',
$mig$SELECT a.tap_id, a.tap_acc_year, a.tap_event_code,
       to_char(a.tap_requested_on AT TIME ZONE 'Asia/Kolkata', 'DD-MM-YYYY HH12:MI AM') AS tap_asked_at,
       COALESCE(NULLIF(rq.usr_display_name, ''), rq.usr_login_name, '') AS tap_asked_by,
       COALESCE(a.tap_request_note, '') AS tap_request_note,
       a.tap_status,
       CASE WHEN a.tap_decided_on IS NULL THEN ''
            ELSE to_char(a.tap_decided_on AT TIME ZONE 'Asia/Kolkata', 'DD-MM-YYYY HH12:MI AM') END AS tap_decided_at,
       COALESCE(NULLIF(dc.usr_display_name, ''), dc.usr_login_name, '') AS tap_decided_by,
       COALESCE(a.tap_decision_note, '') AS tap_decision_note,
       a.tap_amount, a.tap_channel, a.tap_required_role,
       to_char(a.tap_requested_on AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD HH24:MI:SS') AS tap_sort
  FROM accounts.till_approval a
  LEFT JOIN public.user_master rq ON rq.usr_id = a.tap_requested_by
  LEFT JOIN public.user_master dc ON dc.usr_id = a.tap_decided_by
 WHERE a.tap_is_deleted = false
   AND a.tap_src_doc_type = 'SALE_RETURN'
   AND a.tap_company_id::text = 'icompany_id'
   AND a.tap_src_doc_id::text = 'idoc_id'
 ORDER BY a.tap_requested_on DESC$mig$),
(210, 'POPUP - SALE RETURN CREDIT USES',
 'Sale Return History, Used on tab (D55): where the credit note went. The live NOTE_ADJUST / ADVANCE_ADJUST rows on the note''s balance row (abl_src_doc_type SALE_RETURN), reversed rows and the rows they reverse left out. How: Receipt (a RECEIPT voucher), Adjust at Post (no voucher, written with the note itself), Bill F4 (no voucher, later). Tokens: icompany_id, idoc_id (sr_id), iacc_year (the return''s year).',
 'cu_date', 'Ascending', 'Desktop', true, false, 'system',
$mig$SELECT a.abj_id, a.abj_acc_year,
       CASE WHEN vt.vchr_nature = 'RECEIPT' THEN COALESCE(h.avh_voucher_refno, o.abl_doc_refno, '')
            ELSE COALESCE(o.abl_doc_refno, '') END AS cu_document,
       a.abj_adj_date AS cu_date,
       CASE WHEN vt.vchr_nature = 'RECEIPT' THEN 'Receipt'
            WHEN a.abj_voucher_id IS NULL
                 AND a.abj_created_on BETWEEN n.abl_created_on - interval '5 seconds'
                                          AND n.abl_created_on + interval '5 seconds' THEN 'Adjust at Post'
            WHEN a.abj_voucher_id IS NULL THEN 'Bill F4'
            ELSE COALESCE(vt.vchr_type_name, initcap(replace(a.abj_adj_type, '_', ' '))) END AS cu_how,
       a.abj_amount AS cu_amount,
       COALESCE(o.abl_doc_refno, '') AS cu_bill_refno,
       COALESCE(o.abl_src_doc_type, '') AS cu_bill_doc_type,
       o.abl_src_doc_id AS cu_bill_doc_id,
       o.abl_src_acc_year AS cu_bill_acc_year,
       COALESCE(h.avh_voucher_refno, '') AS cu_voucher_refno,
       a.abj_adj_type,
       n.abl_pending_amount AS cu_note_left
  FROM accounts.acc_bill_balance n
  JOIN accounts.acc_bill_adjustment a ON a.abj_bill_id = n.abl_id AND a.abj_bill_acc_year = n.abl_acc_year
  LEFT JOIN accounts.acc_bill_balance o ON o.abl_id = a.abj_against_bill_id
  LEFT JOIN accounts.acc_voucher_header h ON h.avh_voucher_id = a.abj_voucher_id
                                         AND h.avh_acc_year = a.abj_voucher_acc_year
  LEFT JOIN accounts.acc_voucher_types vt ON vt.vchr_type_id = h.avh_voucher_type_id
 WHERE n.abl_is_deleted = false
   AND n.abl_src_doc_type = 'SALE_RETURN'
   AND n.abl_company_id::text = 'icompany_id'
   AND n.abl_src_doc_id::text = 'idoc_id'
   AND n.abl_src_acc_year::text = 'iacc_year'
   AND a.abj_is_deleted = false
   AND a.abj_adj_type IN ('NOTE_ADJUST', 'ADVANCE_ADJUST')
   AND a.abj_reversal_of_id IS NULL
   AND NOT EXISTS (SELECT 1 FROM accounts.acc_bill_adjustment x
                    WHERE x.abj_reversal_of_id = a.abj_id AND x.abj_is_deleted = false)
 ORDER BY a.abj_adj_date, a.abj_created_on$mig$),
(211, 'POPUP - SALE RETURN LAST SALES',
 'Sale Return popup N, a no-bill line (D56, D78): one customer''s POSTED bill lines of one item in every branch of the company, newest first. Billed in the line''s unit, Left = billed less POSTED returns (base units, D68) in the line''s unit, Rate paid = the line''s taxable value per BASE unit (after discounts, before tax), GST %, age at the return date, In window Y / N (0 = any date). Tokens (send every one): icompany_id, icust_id, iitem_id, iwindow_days (sales.return_window_days), ireturn_date (yyyy-MM-dd; '''' = today).',
 'sb_bill_date', 'Descending', 'Desktop', true, false, 'system',
$mig$SELECT bi.sbi_id, bi.sbi_acc_year, b.sb_id, b.sb_branch_id,
       b.sb_bill_refno, b.sb_bill_date,
       COALESCE(br.br_name, '') AS sb_branch_name,
       COALESCE(um.unit_name, '') AS unit_name,
       bi.sbi_bill_qty,
       round(GREATEST(f.bill_base - rt.back_base, 0) / f.factor, 3) AS sbi_left_qty,
       CASE WHEN f.bill_base > 0 THEN round(bi.sbi_taxable_amt / f.bill_base, 4) ELSE 0 END AS rate_paid_base,
       bi.sbi_tax_perc,
       (p.return_date - b.sb_bill_date) AS age_days,
       CASE WHEN p.window_days = 0 OR (p.return_date - b.sb_bill_date) <= p.window_days THEN 'Y' ELSE 'N' END AS in_window,
       COALESCE(bum.unit_name, '') AS base_unit_name,
       bi.sbi_item_unit_id, f.factor AS to_base_factor, bi.sbi_tax_id, bi.sbi_lot_id
  FROM sales.sale_bill_item bi
  JOIN sales.sale_bill b ON b.sb_id = bi.sbi_bill_id AND b.sb_acc_year = bi.sbi_acc_year
  LEFT JOIN public.branch_master br ON br.br_id = b.sb_branch_id
  LEFT JOIN inventory.item_unit_conversion bu ON bu.iuc_id = bi.sbi_item_unit_id
  LEFT JOIN inventory.item_unit_master um ON um.unit_id = bu.iuc_unit_id
  LEFT JOIN inventory.item_unit_master bum ON bum.unit_id = bu.iuc_base_unit_id
  CROSS JOIN LATERAL (SELECT x.factor, bi.sbi_bill_qty * x.factor AS bill_base
                        FROM (SELECT CASE WHEN bi.sbi_to_base_factor > 0 THEN bi.sbi_to_base_factor
                                          ELSE COALESCE(NULLIF(bu.iuc_to_base_factor, 0), 1) END AS factor) x) f
  CROSS JOIN LATERAL (SELECT COALESCE(SUM((ri.sri_return_qty + ri.sri_free_qty)
                                          * CASE WHEN ri.sri_to_base_factor > 0 THEN ri.sri_to_base_factor
                                                 ELSE COALESCE(NULLIF(ru.iuc_to_base_factor, 0), 1) END), 0) AS back_base
                        FROM sales.sale_return_item ri
                        JOIN sales.sale_return r ON r.sr_id = ri.sri_return_id AND r.sr_acc_year = ri.sri_acc_year
                        LEFT JOIN inventory.item_unit_conversion ru ON ru.iuc_id = ri.sri_item_unit_id
                       WHERE ri.sri_bill_item_id = bi.sbi_id
                         AND ri.sri_bill_acc_year = bi.sbi_acc_year
                         AND ri.sri_is_deleted = false
                         AND r.sr_is_deleted = false
                         AND r.sr_status = 'POSTED') rt
  CROSS JOIN (SELECT CASE WHEN 'ireturn_date' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
                          THEN ('ireturn_date'::text)::date ELSE CURRENT_DATE END AS return_date,
                     CASE WHEN 'iwindow_days' ~ '^[0-9]{1,6}$'
                          THEN ('iwindow_days'::text)::integer ELSE 0 END AS window_days) p
 WHERE b.sb_is_deleted = false
   AND bi.sbi_is_deleted = false
   AND b.sb_status = 'POSTED'
   AND b.sb_company_id::text = 'icompany_id'
   AND b.sb_cust_id::text = 'icust_id'
   AND bi.sbi_item_id::text = 'iitem_id'
 ORDER BY b.sb_bill_date DESC, b.sb_bill_slno DESC, bi.sbi_line_no$mig$)
ON CONFLICT (grid_id) DO NOTHING;

INSERT INTO fixed.grid_columns
       (grid_column_id, grid_id, grid_column_number, grid_column_name, grid_column_sql_field_name,
        grid_column_data_type, grid_column_width, grid_column_position, grid_column_alignment,
        grid_column_visibility, grid_column_filter, grid_column_group, grid_column_total,
        grid_column_is_deleted, grid_column_created_by)
SELECT v.id, v.grid, v.no, v.name, v.fld, v.typ, v.width, v.no, v.align, v.visible, v.filter,
       false, false, false, 'system'
  FROM (VALUES
    -- 207 MAIN LIST - SALE RETURNS (mockup v4 F; visible widths add up to 100)
    ('01a1b2c0-2070-7000-8000-000000020701'::uuid, 207::bigint,  1::integer, '#'::text,          'sr_id'::text,              'Text'::text,      0.00::numeric, 'Left'::text,   false::boolean, false::boolean),
    ('01a1b2c0-2070-7000-8000-000000020702', 207,  2, 'Company',      'sr_company_id',      'Text',      0.00, 'Left',   false, false),
    ('01a1b2c0-2070-7000-8000-000000020703', 207,  3, 'Branch',       'sr_branch_id',       'Text',      0.00, 'Left',   false, false),
    ('01a1b2c0-2070-7000-8000-000000020704', 207,  4, 'Year',         'sr_acc_year',        'Text',      0.00, 'Left',   false, false),
    ('01a1b2c0-2070-7000-8000-000000020705', 207,  5, 'Return No',    'sr_return_refno',    'Text',     12.00, 'Left',   true,  true),
    ('01a1b2c0-2070-7000-8000-000000020706', 207,  6, 'Date',         'sr_return_date',     'Date',      7.00, 'Left',   true,  false),
    ('01a1b2c0-2070-7000-8000-000000020707', 207,  7, 'Kind',         'sr_kind_text',       'Text',      5.00, 'Left',   true,  true),
    ('01a1b2c0-2070-7000-8000-000000020708', 207,  8, 'Customer',     'sr_cust_name',       'Text',     15.00, 'Left',   true,  true),
    ('01a1b2c0-2070-7000-8000-000000020709', 207,  9, 'Against',      'sr_against',         'Text',      8.00, 'Left',   true,  true),
    ('01a1b2c0-2070-7000-8000-000000020710', 207, 10, 'Lines',        'sr_tot_items',       'Number',    4.00, 'Right',  true,  false),
    ('01a1b2c0-2070-7000-8000-000000020711', 207, 11, 'Credit note',  'sr_return_amt',      'Currency',  8.00, 'Right',  true,  true),
    ('01a1b2c0-2070-7000-8000-000000020712', 207, 12, 'Settled by',   'sr_settle_by',       'Text',      7.00, 'Left',   true,  false),
    ('01a1b2c0-2070-7000-8000-000000020713', 207, 13, 'Settle',       'sr_settle_status',   'Text',      7.00, 'Center', true,  false),
    ('01a1b2c0-2070-7000-8000-000000020714', 207, 14, 'Status',       'sr_status_text',     'Text',     12.00, 'Center', true,  true),
    ('01a1b2c0-2070-7000-8000-000000020715', 207, 15, 'IRN',          'sr_irn_status',      'Text',      6.00, 'Center', true,  false),
    ('01a1b2c0-2070-7000-8000-000000020716', 207, 16, 'Reason',       'sr_reason_text',     'Text',      9.00, 'Left',   true,  true),
    ('01a1b2c0-2070-7000-8000-000000020717', 207, 17, 'Status code',  'sr_status',          'Text',      0.00, 'Left',   false, false),
    ('01a1b2c0-2070-7000-8000-000000020718', 207, 18, 'Kind code',    'sr_return_kind',     'Text',      0.00, 'Left',   false, false),
    ('01a1b2c0-2070-7000-8000-000000020719', 207, 19, 'Settle mode',  'sr_settle_mode',     'Text',      0.00, 'Left',   false, false),
    ('01a1b2c0-2070-7000-8000-000000020720', 207, 20, 'Approval',     'sr_approval_status', 'Text',      0.00, 'Left',   false, false),
    ('01a1b2c0-2070-7000-8000-000000020721', 207, 21, 'Bill id',      'sr_bill_id',         'Text',      0.00, 'Left',   false, false),
    ('01a1b2c0-2070-7000-8000-000000020722', 207, 22, 'Bill year',    'sr_bill_acc_year',   'Text',      0.00, 'Left',   false, false),
    ('01a1b2c0-2070-7000-8000-000000020723', 207, 23, 'Customer id',  'sr_cust_id',         'Text',      0.00, 'Left',   false, false),
    ('01a1b2c0-2070-7000-8000-000000020724', 207, 24, 'Slno',         'sr_return_slno',     'Number',    0.00, 'Right',  false, false),
    ('01a1b2c0-2070-7000-8000-000000020725', 207, 25, 'GST mode',     'sr_gst_mode',        'Text',      0.00, 'Left',   false, false),
    -- 208 POPUP - SALE RETURN BILLS (mockup v5 A)
    ('01a1b2c0-2080-7000-8000-000000020801', 208,  1, '#',            'sb_id',              'Text',      0.00, 'Left',   false, false),
    ('01a1b2c0-2080-7000-8000-000000020802', 208,  2, 'Year',         'sb_acc_year',        'Text',      0.00, 'Left',   false, false),
    ('01a1b2c0-2080-7000-8000-000000020803', 208,  3, 'Branch id',    'sb_branch_id',       'Text',      0.00, 'Left',   false, false),
    ('01a1b2c0-2080-7000-8000-000000020804', 208,  4, 'Customer id',  'sb_cust_id',         'Text',      0.00, 'Left',   false, false),
    ('01a1b2c0-2080-7000-8000-000000020805', 208,  5, 'Bill No',      'sb_bill_refno',      'Text',     16.00, 'Left',   true,  true),
    ('01a1b2c0-2080-7000-8000-000000020806', 208,  6, 'Date',         'sb_bill_date',       'Date',     12.00, 'Left',   true,  false),
    ('01a1b2c0-2080-7000-8000-000000020807', 208,  7, 'Paid by',      'sb_paid_by',         'Text',     10.00, 'Left',   true,  false),
    ('01a1b2c0-2080-7000-8000-000000020808', 208,  8, 'Lines',        'sb_line_count',      'Number',    7.00, 'Right',  true,  false),
    ('01a1b2c0-2080-7000-8000-000000020809', 208,  9, 'Open',         'sb_open_lines',      'Number',    7.00, 'Right',  true,  false),
    ('01a1b2c0-2080-7000-8000-000000020810', 208, 10, 'Bill value',   'sb_bill_amt',        'Currency', 14.00, 'Right',  true,  true),
    ('01a1b2c0-2080-7000-8000-000000020811', 208, 11, 'Returned',     'sb_returned_amt',    'Currency', 13.00, 'Right',  true,  false),
    ('01a1b2c0-2080-7000-8000-000000020812', 208, 12, 'Still due',    'sb_still_due',       'Currency', 14.00, 'Right',  true,  false),
    ('01a1b2c0-2080-7000-8000-000000020813', 208, 13, 'Age',          'sb_age_days',        'Number',    7.00, 'Right',  true,  false),
    ('01a1b2c0-2080-7000-8000-000000020814', 208, 14, 'Customer',     'sb_cust_name',       'Text',      0.00, 'Left',   false, true),
    ('01a1b2c0-2080-7000-8000-000000020815', 208, 15, 'Phone',        'sb_cust_phone',      'Text',      0.00, 'Left',   false, true),
    ('01a1b2c0-2080-7000-8000-000000020816', 208, 16, 'Branch',       'sb_branch_name',     'Text',      0.00, 'Left',   false, false),
    ('01a1b2c0-2080-7000-8000-000000020817', 208, 17, 'Return status','sb_return_status',   'Text',      0.00, 'Left',   false, false),
    ('01a1b2c0-2080-7000-8000-000000020818', 208, 18, 'Company',      'sb_company_id',      'Text',      0.00, 'Left',   false, false),
    -- 209 POPUP - SALE RETURN APPROVALS (mockup v5 H, Approvals)
    ('01a1b2c0-2090-7000-8000-000000020901', 209,  1, '#',            'tap_id',             'Text',      0.00, 'Left',   false, false),
    ('01a1b2c0-2090-7000-8000-000000020902', 209,  2, 'Year',         'tap_acc_year',       'Text',      0.00, 'Left',   false, false),
    ('01a1b2c0-2090-7000-8000-000000020903', 209,  3, 'Rule',         'tap_event_code',     'Text',     16.00, 'Left',   true,  true),
    ('01a1b2c0-2090-7000-8000-000000020904', 209,  4, 'Asked',        'tap_asked_at',       'Text',     14.00, 'Left',   true,  false),
    ('01a1b2c0-2090-7000-8000-000000020905', 209,  5, 'By',           'tap_asked_by',       'Text',     10.00, 'Left',   true,  true),
    ('01a1b2c0-2090-7000-8000-000000020906', 209,  6, 'Request note', 'tap_request_note',   'Text',     16.00, 'Left',   true,  true),
    ('01a1b2c0-2090-7000-8000-000000020907', 209,  7, 'Status',       'tap_status',         'Text',      9.00, 'Center', true,  false),
    ('01a1b2c0-2090-7000-8000-000000020908', 209,  8, 'Decided',      'tap_decided_at',     'Text',     14.00, 'Left',   true,  false),
    ('01a1b2c0-2090-7000-8000-000000020909', 209,  9, 'Decided by',   'tap_decided_by',     'Text',     10.00, 'Left',   true,  true),
    ('01a1b2c0-2090-7000-8000-000000020910', 209, 10, 'Note',         'tap_decision_note',  'Text',     11.00, 'Left',   true,  true),
    ('01a1b2c0-2090-7000-8000-000000020911', 209, 11, 'Amount',       'tap_amount',         'Currency',  0.00, 'Right',  false, false),
    ('01a1b2c0-2090-7000-8000-000000020912', 209, 12, 'Channel',      'tap_channel',        'Text',      0.00, 'Left',   false, false),
    ('01a1b2c0-2090-7000-8000-000000020913', 209, 13, 'Role',         'tap_required_role',  'Text',      0.00, 'Left',   false, false),
    ('01a1b2c0-2090-7000-8000-000000020914', 209, 14, 'Sort',         'tap_sort',           'Text',      0.00, 'Left',   false, false),
    -- 210 POPUP - SALE RETURN CREDIT USES (mockup v5 H, Used on)
    ('01a1b2c0-2100-7000-8000-000000021001', 210,  1, '#',            'abj_id',             'Text',      0.00, 'Left',   false, false),
    ('01a1b2c0-2100-7000-8000-000000021002', 210,  2, 'Year',         'abj_acc_year',       'Text',      0.00, 'Left',   false, false),
    ('01a1b2c0-2100-7000-8000-000000021003', 210,  3, 'Document',     'cu_document',        'Text',     30.00, 'Left',   true,  true),
    ('01a1b2c0-2100-7000-8000-000000021004', 210,  4, 'Date',         'cu_date',            'Date',     15.00, 'Left',   true,  false),
    ('01a1b2c0-2100-7000-8000-000000021005', 210,  5, 'How',          'cu_how',             'Text',     25.00, 'Left',   true,  true),
    ('01a1b2c0-2100-7000-8000-000000021006', 210,  6, 'Amount',       'cu_amount',          'Currency', 30.00, 'Right',  true,  false),
    ('01a1b2c0-2100-7000-8000-000000021007', 210,  7, 'Bill',         'cu_bill_refno',      'Text',      0.00, 'Left',   false, false),
    ('01a1b2c0-2100-7000-8000-000000021008', 210,  8, 'Bill type',    'cu_bill_doc_type',   'Text',      0.00, 'Left',   false, false),
    ('01a1b2c0-2100-7000-8000-000000021009', 210,  9, 'Bill id',      'cu_bill_doc_id',     'Text',      0.00, 'Left',   false, false),
    ('01a1b2c0-2100-7000-8000-000000021010', 210, 10, 'Bill year',    'cu_bill_acc_year',   'Text',      0.00, 'Left',   false, false),
    ('01a1b2c0-2100-7000-8000-000000021011', 210, 11, 'Voucher',      'cu_voucher_refno',   'Text',      0.00, 'Left',   false, false),
    ('01a1b2c0-2100-7000-8000-000000021012', 210, 12, 'Adj type',     'abj_adj_type',       'Text',      0.00, 'Left',   false, false),
    ('01a1b2c0-2100-7000-8000-000000021013', 210, 13, 'Left on note', 'cu_note_left',       'Currency',  0.00, 'Right',  false, false),
    -- 211 POPUP - SALE RETURN LAST SALES (mockup v5 N)
    ('01a1b2c0-2110-7000-8000-000000021101', 211,  1, '#',            'sbi_id',             'Text',      0.00, 'Left',   false, false),
    ('01a1b2c0-2110-7000-8000-000000021102', 211,  2, 'Year',         'sbi_acc_year',       'Text',      0.00, 'Left',   false, false),
    ('01a1b2c0-2110-7000-8000-000000021103', 211,  3, 'Bill id',      'sb_id',              'Text',      0.00, 'Left',   false, false),
    ('01a1b2c0-2110-7000-8000-000000021104', 211,  4, 'Branch id',    'sb_branch_id',       'Text',      0.00, 'Left',   false, false),
    ('01a1b2c0-2110-7000-8000-000000021105', 211,  5, 'Bill',         'sb_bill_refno',      'Text',     14.00, 'Left',   true,  true),
    ('01a1b2c0-2110-7000-8000-000000021106', 211,  6, 'Date',         'sb_bill_date',       'Date',     12.00, 'Left',   true,  false),
    ('01a1b2c0-2110-7000-8000-000000021107', 211,  7, 'Branch',       'sb_branch_name',     'Text',     14.00, 'Left',   true,  true),
    ('01a1b2c0-2110-7000-8000-000000021108', 211,  8, 'Unit',         'unit_name',          'Text',      8.00, 'Left',   true,  false),
    ('01a1b2c0-2110-7000-8000-000000021109', 211,  9, 'Billed',       'sbi_bill_qty',       'Number',    8.00, 'Right',  true,  false),
    ('01a1b2c0-2110-7000-8000-000000021110', 211, 10, 'Left',         'sbi_left_qty',       'Number',    8.00, 'Right',  true,  false),
    ('01a1b2c0-2110-7000-8000-000000021111', 211, 11, 'Rate paid',    'rate_paid_base',     'Currency', 12.00, 'Right',  true,  false),
    ('01a1b2c0-2110-7000-8000-000000021112', 211, 12, 'GST %',        'sbi_tax_perc',       'Number',    7.00, 'Right',  true,  false),
    ('01a1b2c0-2110-7000-8000-000000021113', 211, 13, 'Age',          'age_days',           'Number',    7.00, 'Right',  true,  false),
    ('01a1b2c0-2110-7000-8000-000000021114', 211, 14, 'In window',    'in_window',          'Text',     10.00, 'Center', true,  false),
    ('01a1b2c0-2110-7000-8000-000000021115', 211, 15, 'Base unit',    'base_unit_name',     'Text',      0.00, 'Left',   false, false),
    ('01a1b2c0-2110-7000-8000-000000021116', 211, 16, 'Unit id',      'sbi_item_unit_id',   'Text',      0.00, 'Left',   false, false),
    ('01a1b2c0-2110-7000-8000-000000021117', 211, 17, 'Factor',       'to_base_factor',     'Number',    0.00, 'Right',  false, false),
    ('01a1b2c0-2110-7000-8000-000000021118', 211, 18, 'Tax id',       'sbi_tax_id',         'Text',      0.00, 'Left',   false, false),
    ('01a1b2c0-2110-7000-8000-000000021119', 211, 19, 'Lot id',       'sbi_lot_id',         'Text',      0.00, 'Left',   false, false)
  ) AS v(id, grid, no, name, fld, typ, width, align, visible, filter)
 WHERE EXISTS (SELECT 1 FROM fixed.grid_details g
                WHERE g.grid_id = v.grid
                  AND g.grid_name IN ('MAIN LIST - SALE RETURNS', 'POPUP - SALE RETURN BILLS',
                                      'POPUP - SALE RETURN APPROVALS', 'POPUP - SALE RETURN CREDIT USES',
                                      'POPUP - SALE RETURN LAST SALES'))
   AND NOT EXISTS (SELECT 1 FROM fixed.grid_columns c
                    WHERE c.grid_id = v.grid AND c.grid_column_number = v.no AND c.grid_column_is_deleted = false)
ON CONFLICT (grid_column_id) DO NOTHING;

SELECT setval(pg_get_serial_sequence('fixed.grid_details', 'grid_id'),
              GREATEST((SELECT COALESCE(max(grid_id), 1) FROM fixed.grid_details),
                       (SELECT last_value FROM fixed.grid_details_grid_id_seq)));


-- ── 9 · ui_tables 74-77 + columns; ui_table 22 column 100 ─────────────────
INSERT INTO fixed.ui_tables
       (ui_tbl_id, ui_tbl_name, ui_tbl_editable, ui_tbl_device_type, ui_tbl_is_active, ui_tbl_is_deleted, ui_tbl_created_by)
VALUES (74, 'SALE RETURN - LINES',          true, 'Desktop', true, false, 'system'),
       (75, 'SALE RETURN - CHARGES',        true, 'Desktop', true, false, 'system'),
       (76, 'SALE RETURN - ADJUST BILLS',   true, 'Desktop', true, false, 'system'),
       (77, 'SALE RETURN - REFUND TENDERS', true, 'Desktop', true, false, 'system')
ON CONFLICT (ui_tbl_id) DO NOTHING;

-- id = first id of the table + column number. Shown widths add up to 97.00
-- (74, 76, 77) / 95.00 (75, room for the row gutter as table 69).
INSERT INTO fixed.ui_table_columns
       (ui_tbl_clm_id, ui_tbl_clm_table_id, ui_tbl_clm_no, ui_tbl_clm_name, ui_tbl_clm_column_width,
        ui_tbl_clm_column_visibility, ui_tbl_clm_column_focus, ui_tbl_clm_column_position,
        ui_tbl_clm_column_necessity, ui_tbl_clm_is_active, ui_tbl_clm_is_deleted, ui_tbl_clm_created_by)
SELECT v.id, v.tbl, v.no, v.name, v.width, v.visible, v.focus, v.pos, false, true, false, 'system'
  FROM (VALUES
    -- 74 SALE RETURN - LINES: 0..18 shown (mockup v5 order), 19..37 hidden
    (2509::bigint, 74::bigint,  0::bigint, '#'::text,          1.50::numeric, true::boolean,  false::boolean,  0::integer),
    (2510, 74,  1, 'Barcode',        8.00, true,  false,  1),
    (2511, 74,  2, 'Item',          13.70, true,  false,  2),
    (2512, 74,  3, 'Batch · Exp',    6.00, true,  false,  3),
    (2513, 74,  4, 'Unit',           2.80, true,  true,   4),
    (2514, 74,  5, 'Billed',         3.50, true,  false,  5),
    (2515, 74,  6, 'Returned',       4.60, true,  false,  6),
    (2516, 74,  7, 'Can return',     4.60, true,  false,  7),
    (2517, 74,  8, 'Qty',            3.40, true,  true,   8),
    (2518, 74,  9, 'Weight',         4.10, true,  false,  9),
    (2519, 74, 10, 'Rate',           4.40, true,  false, 10),
    (2520, 74, 11, 'Disc',           3.20, true,  false, 11),
    (2521, 74, 12, 'Taxable',        4.60, true,  false, 12),
    (2522, 74, 13, 'GST %',          2.80, true,  false, 13),
    (2523, 74, 14, 'GST',            4.10, true,  false, 14),
    (2524, 74, 15, 'Amount',         5.00, true,  false, 15),
    (2525, 74, 16, 'Condition',      5.80, true,  true,  16),
    (2526, 74, 17, 'Godown',         5.80, true,  true,  17),
    (2527, 74, 18, 'Notes',          9.10, true,  true,  18),
    (2528, 74, 19, 'LineId',         0.00, false, false, 19),
    (2529, 74, 20, 'ItemId',         0.00, false, false, 20),
    (2530, 74, 21, 'ItemUnitId',     0.00, false, false, 21),
    (2531, 74, 22, 'GodownId',       0.00, false, false, 22),
    (2532, 74, 23, 'LotId',          0.00, false, false, 23),
    (2533, 74, 24, 'BillItemId',     0.00, false, false, 24),
    (2534, 74, 25, 'BillAccYear',    0.00, false, false, 25),
    (2535, 74, 26, 'BaseFactor',     0.00, false, false, 26),
    (2536, 74, 27, 'QtyLeftBase',    0.00, false, false, 27),
    (2537, 74, 28, 'OnDraftsBase',   0.00, false, false, 28),
    (2538, 74, 29, 'CostPerBase',    0.00, false, false, 29),
    (2539, 74, 30, 'RateSource',     0.00, false, false, 30),
    (2540, 74, 31, 'Goods',          8.00, false, true,  31),
    (2541, 74, 32, 'Evidence',       0.00, false, false, 32),
    (2542, 74, 33, 'FullyReturned',  0.00, false, false, 33),
    (2543, 74, 34, 'SplitNo',        0.00, false, false, 34),
    (2544, 74, 35, 'RateSrcItemId',  0.00, false, false, 35),
    (2545, 74, 36, 'ExpiryDate',     0.00, false, false, 36),
    (2546, 74, 37, 'IsFree',         0.00, false, false, 37),
    -- 75 SALE RETURN - CHARGES: ChargeCols 0..32 + 33 / 34; shown Charge ·
    -- Kind · On the bill · Back before · Back now · GST · Net · Posts to
    (2547, 75,  0, '#',              0.00, false, false,  8),
    (2548, 75,  1, 'Charge',        18.00, true,  false,  0),
    (2549, 75,  2, 'Posts to',      15.00, true,  false,  7),
    (2550, 75,  3, 'Basis',          0.00, false, false,  9),
    (2551, 75,  4, 'Type',           0.00, false, false, 10),
    (2552, 75,  5, 'Apply On',       0.00, false, false, 11),
    (2553, 75,  6, 'Unit',           0.00, false, false, 12),
    (2554, 75,  7, 'QtyVal',         0.00, false, false, 13),
    (2555, 75,  8, 'Weight',         0.00, false, false, 14),
    (2556, 75,  9, 'Rate',           0.00, false, false, 15),
    (2557, 75, 10, 'Back now',      10.00, true,  true,   4),
    (2558, 75, 11, 'Hsn',            0.00, false, false, 16),
    (2559, 75, 12, 'TaxPerc',        0.00, false, false, 17),
    (2560, 75, 13, 'GST',            7.00, true,  false,  5),
    (2561, 75, 14, 'SgstPerc',       0.00, false, false, 18),
    (2562, 75, 15, 'SgstAmt',        0.00, false, false, 19),
    (2563, 75, 16, 'CgstPerc',       0.00, false, false, 20),
    (2564, 75, 17, 'CgstAmt',        0.00, false, false, 21),
    (2565, 75, 18, 'IgstPerc',       0.00, false, false, 22),
    (2566, 75, 19, 'IgstAmt',        0.00, false, false, 23),
    (2567, 75, 20, 'CessPerc',       0.00, false, false, 24),
    (2568, 75, 21, 'CessAmt',        0.00, false, false, 25),
    (2569, 75, 22, 'Net',           10.00, true,  false,  6),
    (2570, 75, 23, 'Remarks',        0.00, false, false, 26),
    (2571, 75, 24, 'Role',           0.00, false, false, 27),
    (2572, 75, 25, 'LandingCost',    0.00, false, false, 28),
    (2573, 75, 26, 'CostAlloc',      0.00, false, false, 29),
    (2574, 75, 27, 'Kind',          15.00, true,  false,  1),
    (2575, 75, 28, 'SepPost',        0.00, false, false, 30),
    (2576, 75, 29, 'ChargeId',       0.00, false, false, 31),
    (2577, 75, 30, 'LedgerCode',     0.00, false, false, 32),
    (2578, 75, 31, 'TaxCode',        0.00, false, false, 33),
    (2579, 75, 32, 'TaxApl',         0.00, false, false, 34),
    (2580, 75, 33, 'On the bill',   10.00, true,  false,  2),
    (2581, 75, 34, 'Back before',   10.00, true,  false,  3),
    -- 76 SALE RETURN - ADJUST BILLS: ReceiptBillCols 0..23; shown Bill ·
    -- Date · Bill value · Due now · Adjust now · Due after · Age · Note
    (2582, 76,  0, 'Date',           8.50, true,  false,  1),
    (2583, 76,  1, 'Bill',          11.30, true,  false,  0),
    (2584, 76,  2, 'Their ref',      0.00, false, false,  8),
    (2585, 76,  3, 'Type',           0.00, false, false,  9),
    (2586, 76,  4, 'Due',            0.00, false, false, 10),
    (2587, 76,  5, 'Age',            4.50, true,  false,  6),
    (2588, 76,  6, 'Bill value',     9.60, true,  false,  2),
    (2589, 76,  7, 'Paid',           0.00, false, false, 11),
    (2590, 76,  8, 'Due now',        9.60, true,  false,  3),
    (2591, 76,  9, 'PDC held',       0.00, false, false, 12),
    (2592, 76, 10, 'TCS due',        0.00, false, false, 13),
    (2593, 76, 11, 'Adjust now',    10.20, true,  true,   4),
    (2594, 76, 12, 'Disc',           0.00, false, false, 14),
    (2595, 76, 13, 'W/off',          0.00, false, false, 15),
    (2596, 76, 14, 'R/off',          0.00, false, false, 16),
    (2597, 76, 15, 'Due after',      9.60, true,  false,  5),
    (2598, 76, 16, 'Profit',         0.00, false, false, 17),
    (2599, 76, 17, 'Net profit',     0.00, false, false, 18),
    (2600, 76, 18, 'Note',          33.70, true,  false,  7),
    (2601, 76, 19, 'BillId',         0.00, false, false, 19),
    (2602, 76, 20, 'BillAccYear',    0.00, false, false, 20),
    (2603, 76, 21, 'PpdSuggested',   0.00, false, false, 21),
    (2604, 76, 22, 'DrCr',           0.00, false, false, 22),
    (2605, 76, 23, 'TcsAmount',      0.00, false, false, 23),
    -- 77 SALE RETURN - REFUND TENDERS: ReceiptTenderCols 0..17; shown Tender
    -- · Ledger it posts to · Ref no (UTR) · Amount
    (2606, 77,  0, '#',                   0.00, false, false,  4),
    (2607, 77,  1, 'Tender',             13.70, true,  true,   0),
    (2608, 77,  2, 'Amount',             32.70, true,  true,   3),
    (2609, 77,  3, 'Ref no (UTR)',       22.30, true,  true,   2),
    (2610, 77,  4, 'Instr. date',         0.00, false, false,  5),
    (2611, 77,  5, 'Ledger it posts to', 28.30, true,  false,  1),
    (2612, 77,  6, 'Charge',              0.00, false, false,  6),
    (2613, 77,  7, 'Dr/Cr',               0.00, false, false,  7),
    (2614, 77,  8, 'Settles bill',        0.00, false, false,  8),
    (2615, 77,  9, 'Against',             0.00, false, false,  9),
    (2616, 77, 10, 'PDC / voucher',       0.00, false, false, 10),
    (2617, 77, 11, 'Kind',                0.00, false, false, 11),
    (2618, 77, 12, 'TenderId',            0.00, false, false, 12),
    (2619, 77, 13, 'TenderTypeId',        0.00, false, false, 13),
    (2620, 77, 14, 'TenderLedger',        0.00, false, false, 14),
    (2621, 77, 15, 'ChequeJson',          0.00, false, false, 15),
    (2622, 77, 16, 'LedgerId',            0.00, false, false, 16),
    (2623, 77, 17, 'IsSeeded',            0.00, false, false, 17)
       ) v(id, tbl, no, name, width, visible, focus, pos)
 WHERE EXISTS (SELECT 1 FROM fixed.ui_tables t
                WHERE t.ui_tbl_id = v.tbl AND t.ui_tbl_name LIKE 'SALE RETURN - %')
   AND NOT EXISTS (SELECT 1 FROM fixed.ui_table_columns e
                    WHERE e.ui_tbl_clm_table_id = v.tbl AND e.ui_tbl_clm_no = v.no AND e.ui_tbl_clm_is_deleted = false)
ON CONFLICT (ui_tbl_clm_id) DO NOTHING;

-- ui_table 22 (Sale Bill lines): column 100 "Returned" (SalesItemCols::ReturnedQty),
-- read only, right after Bill Qty (D62). Positions are a rank, so every live
-- column at or after the new place moves up one first (relative order kept).
-- Only while 22 is laid out and has no live column 100; a fresh database gets
-- the row from Ui_Table_Columns.sql instead.
DO $$
DECLARE
    v_pos integer;
BEGIN
    IF EXISTS (SELECT 1 FROM fixed.ui_tables WHERE ui_tbl_id = 22 AND ui_tbl_name = 'SALE BILL - LINES')
       AND EXISTS (SELECT 1 FROM fixed.ui_table_columns
                    WHERE ui_tbl_clm_table_id = 22 AND ui_tbl_clm_is_deleted = false)
       AND NOT EXISTS (SELECT 1 FROM fixed.ui_table_columns
                        WHERE ui_tbl_clm_table_id = 22 AND ui_tbl_clm_no = 100 AND ui_tbl_clm_is_deleted = false) THEN
        SELECT COALESCE(max(ui_tbl_clm_column_position), 15) + 1 INTO v_pos
          FROM fixed.ui_table_columns
         WHERE ui_tbl_clm_table_id = 22 AND ui_tbl_clm_no = 14 AND ui_tbl_clm_is_deleted = false;

        UPDATE fixed.ui_table_columns
           SET ui_tbl_clm_column_position = ui_tbl_clm_column_position + 1,
               ui_tbl_clm_modified_on = now(), ui_tbl_clm_modified_by = 'system'
         WHERE ui_tbl_clm_table_id = 22 AND ui_tbl_clm_is_deleted = false
           AND ui_tbl_clm_column_position >= v_pos;

        INSERT INTO fixed.ui_table_columns
               (ui_tbl_clm_id, ui_tbl_clm_table_id, ui_tbl_clm_no, ui_tbl_clm_name, ui_tbl_clm_column_width,
                ui_tbl_clm_column_visibility, ui_tbl_clm_column_focus, ui_tbl_clm_column_position,
                ui_tbl_clm_column_necessity, ui_tbl_clm_is_active, ui_tbl_clm_is_deleted, ui_tbl_clm_created_by)
        VALUES (2624, 22, 100, 'Returned', 3.80, true, false, v_pos, false, true, false, 'system')
        ON CONFLICT (ui_tbl_clm_id) DO NOTHING;
    END IF;
END $$;

SELECT setval('fixed.ui_tables_ui_tbl_id_seq',
              GREATEST((SELECT last_value FROM fixed.ui_tables_ui_tbl_id_seq),
                       (SELECT COALESCE(MAX(ui_tbl_id), 1) FROM fixed.ui_tables)), true);
SELECT setval('fixed.ui_table_columns_ui_tbl_clm_id_seq',
              GREATEST((SELECT last_value FROM fixed.ui_table_columns_ui_tbl_clm_id_seq),
                       (SELECT COALESCE(MAX(ui_tbl_clm_id), 1) FROM fixed.ui_table_columns)), true);


-- ── 10 · dropdown 78 "SALE RETURN REASONS" ─────────────────────────────────
INSERT INTO fixed.dropdown_details
       (dropdown_id, dropdown_name, dropdown_description, dropdown_sql,
        dropdown_sort_order, dropdown_sort_column, dropdown_completion,
        dropdown_max_visible_items, dropdown_show_header, dropdown_width,
        dropdown_device_type, dropdown_created_by)
SELECT 78, 'SALE RETURN REASONS',
       'Sale Return (menu 13) Reason picker: active SALE_RETURN reasons, shared (company NULL) and this company''s; a company row with a shared row''s code hides the shared one. Gives the default line Condition and whether after-tax charges go back (D12). Param icompany_id, always sent; compared as text, never cast.',
$d$SELECT r.srm_id, r.srm_name, r.srm_code,
       COALESCE(r.srm_default_condition, '') AS srm_default_condition,
       COALESCE(r.srm_refund_charges, false) AS srm_refund_charges
  FROM stock.stock_reason_master r
 WHERE r.srm_is_active = true
   AND r.srm_is_deleted = false
   AND r.srm_allowed_txn_types && ARRAY['SALE_RETURN']
   AND (r.srm_company_id IS NULL OR r.srm_company_id::text = 'icompany_id')
   AND NOT (r.srm_company_id IS NULL
            AND EXISTS (SELECT 1 FROM stock.stock_reason_master c
                         WHERE c.srm_company_id::text = 'icompany_id'
                           AND c.srm_code = r.srm_code
                           AND c.srm_is_deleted = false))
 ORDER BY r.srm_sort_order, r.srm_name$d$,
       'asc', 'srm_name', 'srm_name', 10, true, 0, 'Desktop', 'system'
 WHERE NOT EXISTS (SELECT 1 FROM fixed.dropdown_details WHERE dropdown_id = 78);

INSERT INTO fixed.dropdown_columns
       (dropdown_columns_id, dropdown_columns_dropdown_id, dropdown_columns_no, dropdown_columns_data_type,
        dropdown_columns_name, dropdown_columns_alias, dropdown_columns_width,
        dropdown_columns_visiblity, dropdown_columns_allignment, dropdown_columns_filter,
        dropdown_columns_sql_name, dropdown_columns_created_by)
SELECT v.id, 78, v.no, 'Text', v.name, NULL, v.width, v.visible, 'Left', v.filter, v.field, 'system'
  FROM (VALUES
    ('01a1b2c0-7800-7000-8000-000000000780'::uuid, 0, '#',            10.00, false, false, 'srm_id'),
    ('01a1b2c0-7800-7000-8000-000000000781'::uuid, 1, 'Reason',       60.00, true,  true,  'srm_name'),
    ('01a1b2c0-7800-7000-8000-000000000782'::uuid, 2, 'Code',         20.00, true,  true,  'srm_code'),
    ('01a1b2c0-7800-7000-8000-000000000783'::uuid, 3, 'Condition',    20.00, true,  false, 'srm_default_condition'),
    ('01a1b2c0-7800-7000-8000-000000000784'::uuid, 4, 'Charges back', 10.00, false, false, 'srm_refund_charges')
  ) AS v(id, no, name, width, visible, filter, field)
 WHERE EXISTS (SELECT 1 FROM fixed.dropdown_details d WHERE d.dropdown_id = 78 AND d.dropdown_name = 'SALE RETURN REASONS')
   AND NOT EXISTS (SELECT 1 FROM fixed.dropdown_columns c WHERE c.dropdown_columns_dropdown_id = 78)
ON CONFLICT (dropdown_columns_id) DO NOTHING;

SELECT setval(pg_get_serial_sequence('fixed.dropdown_details', 'dropdown_id'),
              GREATEST((SELECT COALESCE(max(dropdown_id), 1) FROM fixed.dropdown_details),
                       (SELECT last_value FROM fixed.dropdown_details_dropdown_id_seq)));


-- ── 11 · plain wording rows (notes 120), catalogue 2026-11-13.1 ────────────
-- Plan v5 §5.10. Levels (refuse / WARN / INFO) are the server's; the rows hold
-- only the words. {value} {bill} {lot} {n} {qty} {refnos} are placeholders the
-- server fills (P2).
INSERT INTO fixed.error_message
    (erm_code, erm_variant, erm_lang, erm_title, erm_line, erm_todo)
VALUES
     ('SALES_RETURN_NO_LINES', '', 'en', 'Nothing to return', 'No line has a quantity.', 'Type the quantity coming back on at least one line.')
    ,('SALES_RETURN_NO_BILL_OFF', '', 'en', 'Bill needed', 'Returns without a bill are switched off for this company.', 'Pick the bill, or ask the manager to allow them.')
    ,('SALES_RETURN_SETTLE_MODE', '', 'en', 'Settle another way', 'This return cannot be adjusted against bills (no bill, or another branch''s bill).', 'Choose Credit note or Refund now.')
    ,('SALES_RETURN_REFUND_TENDER', '', 'en', 'Refund by cash, UPI or bank', 'A refund can only be paid by cash, UPI or bank transfer.', 'Change the tender.')
    ,('SALES_RETURN_REFUND_REF', '', 'en', 'Reference missing', 'A UPI or bank refund needs its reference number.', 'Type the UTR / reference no.')
    ,('SALES_RETURN_REFUND_OVER_PAID', '', 'en', 'Refund too much', 'The refund is more than the customer paid in money on this bill. Points and gift vouchers do not count.', 'Refund less; the rest stays a credit note.')
    ,('SALES_RETURN_ADJUST_OVER', '', 'en', 'Adjust too much', 'A bill is given more than it owes, or more than the credit note.', 'Lower the Adjust now figures.')
    ,('SALES_RETURN_ADJUST_STALE', '', 'en', 'Bills changed', 'A bill''s balance changed since the split was shown.', 'Open Adjust bills again and check.')
    ,('SALES_RETURN_REFUND_SESSION_CLOSED', '', 'en', 'Refund already counted', 'This return paid money out of a till that has been counted or closed.', 'If the refund was wrong, take the money back with a Receipt.')
    ,('SALES_RETURN_SCHEME_SHORT', '', 'en', 'Scheme broken', 'After this return the customer keeps a scheme benefit they no longer earn ({value}).', 'Ask for it back, or carry on.')
    ,('SALES_RETURN_CLAIM_GOODS', '', 'en', 'Say where the goods are', 'A claim line must say Back or Destroyed at the shop.', 'Pick one for every line.')
    ,('SALES_RETURN_NOT_ON_BILL', '', 'en', 'Not on this bill', 'This item is not on bill {bill}.', 'Return it on a separate return with no bill.')
    ,('SALES_RETURN_UNIT', '', 'en', 'Wrong unit', 'That unit is not one of this item''s units.', 'Pick one of the item''s units.')
    ,('SALES_RETURN_LOT_EXPIRED', '', 'en', 'Lot past expiry', 'Lot {lot} expired {n} days ago.', 'Make it a Claim, or tick to carry on.')
    ,('SALES_RETURN_ON_DRAFTS', '', 'en', 'On other drafts', '{qty} of this line are on other draft returns ({refnos}).', 'Only the first return to post gets them.')
    ,('SALES_RETURN_NEVER_SOLD', '', 'en', 'Never sold to them', 'This customer has not bought this item; today''s price is used.', 'Check the item and the price.')
ON CONFLICT (erm_code, erm_variant, erm_lang) DO NOTHING;

UPDATE fixed.error_message_catalogue
   SET emc_version   = '2026-11-13.1',
       emc_row_count = (SELECT count(*) FROM fixed.error_message WHERE erm_is_active),
       emc_loaded_on = now()
 WHERE emc_id = 1
   AND emc_version < '2026-11-13.1';


-- ── Read-back ──────────────────────────────────────────────────────────────
-- \d sales.sale_return / sales.sale_return_item / stock.stock_reason_master
-- SELECT menu_id, menu_parent, menu_name, menu_position, menu_visiblity FROM fixed.menu_master WHERE menu_id = 13;
-- SELECT count(*) FROM public.user_menus WHERE um_menu_id = 13 AND NOT um_is_deleted;
-- SELECT grid_id, grid_name FROM fixed.grid_details WHERE grid_id BETWEEN 207 AND 211;
-- SELECT ui_tbl_id, ui_tbl_name FROM fixed.ui_tables WHERE ui_tbl_id BETWEEN 74 AND 77;
-- SELECT * FROM fixed.ui_table_columns WHERE ui_tbl_clm_table_id = 22 AND ui_tbl_clm_no = 100;
-- SELECT dropdown_id, dropdown_name FROM fixed.dropdown_details WHERE dropdown_id = 78;
-- SELECT srm_code, srm_default_condition, srm_refund_charges FROM stock.stock_reason_master WHERE srm_code LIKE 'SR\_%';
-- SELECT tar_event_code, tar_mode, tar_blocks_till FROM accounts.till_approval_rule WHERE tar_event_code IN ('RETURN_NO_RECEIPT','REFUND_CASH','SALE_RETURN','SALE_CLAIM');
-- SELECT asd_key, asd_max_scope FROM public.app_setting_def WHERE asd_key IN ('sales.return_default_kind','sales.return_expired_lot_days');
-- SELECT emc_version, emc_row_count FROM fixed.error_message_catalogue;
