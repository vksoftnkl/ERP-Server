-- ═══════════════════════════════════════════════════════════════════════════
--  Delivery tracking ("billed but not delivered"), phase 1, step P1 (DB)
--                                                                 2026-11-15
--  Folder: prisma/migrations/20261117100000_delivery_tracking/ (share copy:
--  Shared/Prathap/sales/sql/delivery-tracking-p1-migration.sql).
--
--  Plan: Shared/Prathap/sales/plan-delivery-tracking-p1-2026-11-15.md §7 (DB),
--  §5 (posting rules), §6 (offline), §13 P1, answers N1-N6 = recommended;
--  addendum plan-delivery-tracking-p1-addendum-1.md §4 (ui_tables 28 / 74 /
--  83 / 86, four new codes, DELIVERY_RETURN_GODOWN reworded). Mockups v1 +
--  addendum v1 approved 2026-11-15; the user's build "go" 2026-11-15. Sorts
--  after 20261116130000_print_purpose_dropdown_company (Voucher Types,
--  committed 936f1393). Checked against the live dev DB 2026-11-15.
--
--   0 · guards: every pinned id / name is free or already ours.
--   1 · sales.sale_bill: sb_delivery_mode varchar(10) NOT NULL DEFAULT
--       'INSTANT' + ck_sb_delivery_mode (INSTANT / PICKUP / DISPATCH).
--   2 · accounts.acc_voucher_types.vchr_delivery_mode varchar(10) NULL +
--       ck_vchr_delivery_mode; 'INSTANT' on the base Sales Bill (Bil). Children
--       keep NULL (= the base's) until saved on menu 303.
--   3 · sales.sale_return_item.sri_undelivered_qty numeric(14,3) NOT NULL
--       DEFAULT 0 + ck_sri_undelivered (>= 0 and <= return + free qty).
--   4 · stock.stock_voucher_item.svi_shelf_qty numeric(18,6) NULL,
--       svi_undelivered_qty numeric(18,6) NOT NULL DEFAULT 0 (the siblings'
--       type). No CHECK on svi_counted_qty (addendum decision 68).
--   5 · ck_tsl_src_doc_type and ck_ttd_doc_type gain DELIVERY_NOTE (the live
--       lists are kept and DELIVERY_NOTE appended).
--   6 · three new tables, PARTITION BY LIST (*_acc_year):
--         sales.sale_delivery_note       (sdn_)  the note / gate pass
--         sales.sale_delivery_note_item  (sdni_) its lines
--         sales.sale_delivery_event      (sde_)  insert-only events
--       keys, CHECKs, FKs, indexes per plan §7.1-7.3; the partial unique
--       indexes are single-writer safe (§6). Sync triggers + pending index per
--       table, only where the sync functions exist (20261029130000 pattern).
--   7 · public.ensure_acc_year_partitions: the live body copied forward, plus
--       the three tables (parent before child); partitions backfilled for
--       every year sales.sale_bill has a partition for (pg_inherits).
--   8 · Q15 go-live cleanup (decision 41): each POSTED, live WHOLESALE bill
--       whose status is not NA and that the new code has not touched yet
--       (mode still INSTANT) and has an eligible line: mode PICKUP, one CLEANUP
--       event per eligible line (settle = out = billed), status DELIVERED,
--       sb_delivered_on = now, one txn_status_log row. Every other INSTANT
--       bill with a status other than NA -> NA (cancelled, drafts, POS, no
--       eligible line). Re-runnable: a cleaned bill is PICKUP afterwards.
--       Sync-safe ids (review S4, decision R-2, 2026-11-16): the cloud and
--       each offline site run this, so the rows it writes carry the same keys
--       everywhere: sde_id = md5('dt-cleanup:' || sbi_id)::uuid, tsl_id =
--       md5('dt-cleanup-log:' || sb_id)::uuid, tsl_seq_no = 1000 (a fixed
--       marker: MAX + 1 differs on a site holding steps not yet pushed).
--       Go-live window (review N1, accepted as decided, R-3): the cleanup
--       writes one event per eligible line of every posted, live wholesale
--       bill the old flow left at a status other than NA, updates those bills,
--       sets every other INSTANT bill not at NA to NA, and section 9 validates
--       ck_sb_delivery_status over all of sales.sale_bill, in this one
--       transaction (row locks on the bills; the CHECK holds an exclusive
--       lock on sale_bill while it scans). Measured on dev 2026-11-16 in a
--       rolled-back worst case (all 21 posted wholesale bills pending, 1,020
--       other INSTANT bills to NA, 1,276 bills): selection 4 ms, 21 events
--       6 ms, 21 log rows 5 ms, 21 bills 8 ms, 1,020 bills to NA 128 ms
--       (about 0.13 ms a row, sync trigger included), CHECK scan 6 ms; about
--       0.15 s in all. It grows with the bill count: deploy outside billing
--       hours. After go-live a pre-go-live wholesale bill can no longer be
--       cancelled or amended below billed; a sale return undoes it.
--   9 · ck_sb_delivery_status -> NA / PENDING / PART / OUT / DELIVERED /
--       RETURNED (PACKED / DISPATCHED go); ix_sb_delivery_status replaced by
--       ix_sb_delivery_open (company, branch, bill date) WHERE posted, live,
--       status PENDING / PART / OUT.
--  10 · stock.stock_reason_master: shared system row DELIVERY_GODOWN
--       ({TRANSFER_OUT, TRANSFER_IN}, BOTH, sort 220). Only the server posts
--       it; the table has no "system / not selectable" column, so the
--       Godown Transfer picker (/stock/reasons) leaves it out in code (P2).
--  11 · settings sales.delivery_godown (UUID, DEVICE), sales.delivery_amber_days
--       (INT 1-365, COMPANY, 7), sales.delivery_old_days (INT 1-365, COMPANY,
--       30); sales.delivery_status_tracking and
--       sales.require_verification_before_dispatch made inactive.
--  12 · print purposes GATE_PASS, PICK_LIST, PENDING_DELIVERIES (SALES),
--       GODOWN_POSITION (REPORT, like STOCK_SUMMARY / ITEM_LEDGER) and
--       COUNT_SHEET (STOCK: it prints from Physical Stock), fixed ids, no
--       template rows (answer Q2, 2026-11-15).
--  13 · menus 304 Pending Deliveries (under 1, 40.00), 305 Delivery Note
--       (under 1, 41.00), 306 Godown Stock Position (under 300, 30.00); 182
--       renamed "Delivery Challan" (still hidden); 226 hidden. Rights: 304
--       view / print / export to each live 226 viewer and (N1) each live
--       menu-12 row with post; 305 view / create / edit / delete / print /
--       export / post / cancel to the same users, override = their live
--       override on 41 (Q18); 306 = each live 302 row's view / print / export.
--  14 · public.db_table_master 632 / 633 / 634 for the three tables.
--  15 · audit.audit_screen 164 "Delivery Note" (transaction); the server
--       fills screen_audit_sql from AUDIT_SCREEN_SQL_BY_NAME on first write.
--  16 · grids 212-218 (+ columns), and grid 86 gains sb_delivery_status
--       ("Delivery", after Status), sb_delivery_mode (hidden) and the token
--       idelivery ('' = all, else one status). The idelivery test is written
--       so a caller that does not send the key yet (the Qt bills list until
--       P3) still gets every bill. No grid SQL holds a comment marker.
--  17 · ui_tables 80-86 + columns (ids 2652-2780); new columns on 22 (101
--       Delivered, id 2781), 28 (30 Not delivered, 31 Physical, 32 Shelf
--       counted, ids 2782-2784; 12 Counted Qty hidden), 74 (38 To give, 39
--       Not taken, ids 2785-2786), 78 (17 Not delivered, 18 Physical, ids
--       2787-2788), each placed by moving the later positions up. Then, in
--       each of these four tables (answer Q4), the old shown columns wider
--       than 3.00 are scaled in proportion so the shown widths add up to
--       100.00 again with the new columns at their planned widths; shown
--       columns of 3.00 or less (#, ticks, caret, unit) keep their width; the
--       rounding rest goes to the widest scaled column. Done only in the run
--       that adds the new columns, so a re-run never scales twice.
--  18 · fixed.error_message: 77 rows (plan §7.10 + addendum §4.3; since
--       review N2 2026-11-16 DELIVERY_RETURN_AMEND_LOCKED and DN_QTY_NEGATIVE
--       variant event=GOODS_BACK; since the review fixes DN_UNDO_BELOW_RETURNED
--       (S3), DN_DRAFT_YEAR_CHANGED + its field=accYear variant (N3),
--       DN_LINE_DUPLICATE (S2), DN_GODOWN_FROZEN variants event=GOODS_BACK and
--       event=CANCEL (N6)), catalogue 2026-11-16.1: every row the seed gained
--       from 2026-11-15.4 to 2026-11-16.1. prisma/seed/Error_Messages.json
--       carries the same rows, so a deploy that does not run the seed still
--       has them.
--
--  No business-logic function or trigger: the only function touched is the
--  existing partition helper; the sync triggers are the existing local-only
--  infrastructure, guarded. Every statement is re-runnable. On a fresh
--  database menus, grids, ui_tables and voucher types are seeded after the
--  migrations, so those parts no-op here and the seed files carry the rows.
-- ═══════════════════════════════════════════════════════════════════════════


-- ── 0 · pinned ids / names free (or already ours) ─────────────────────────
DO $$
DECLARE
    v_clash text;
BEGIN
    SELECT string_agg(x, '; ') INTO v_clash FROM (
        SELECT format('menu %s (%s)', m.menu_id, m.menu_name) AS x
          FROM fixed.menu_master m
          JOIN (VALUES (304, 'Pending Deliveries'::text), (305, 'Delivery Note'), (306, 'Godown Stock Position')) v(id, name)
            ON v.id = m.menu_id
         WHERE m.menu_name IS DISTINCT FROM v.name
        UNION ALL
        SELECT format('grid %s (%s)', g.grid_id, g.grid_name)
          FROM fixed.grid_details g
          JOIN (VALUES (212, 'MAIN LIST - PENDING DELIVERIES'::text), (213, 'PENDING DELIVERIES - BEATS'),
                       (214, 'PENDING DELIVERIES - ITEM-WISE'), (215, 'PENDING DELIVERIES - OPEN LINES'),
                       (216, 'MAIN LIST - DELIVERY NOTES'), (217, 'POPUP - DELIVERY NOTE PENDINGS'),
                       (218, 'POPUP - BILL DELIVERIES')) v(id, name)
            ON v.id = g.grid_id
         WHERE g.grid_name IS DISTINCT FROM v.name
        UNION ALL
        SELECT format('ui_table %s (%s)', t.ui_tbl_id, t.ui_tbl_name)
          FROM fixed.ui_tables t
          JOIN (VALUES (80, 'PENDING DELIVERIES - BILLS'::text), (81, 'PENDING DELIVERIES - ITEMS'),
                       (82, 'PENDING DELIVERIES - OPEN LINES'), (83, 'DELIVERY NOTE - LINES'),
                       (84, 'GODOWN POSITION - ROWS'), (85, 'GODOWN POSITION - BEHIND'),
                       (86, 'DELIVERY NOTE - GOODS BACK')) v(id, name)
            ON v.id = t.ui_tbl_id
         WHERE t.ui_tbl_name IS DISTINCT FROM v.name
        UNION ALL
        SELECT format('ui_table_columns id %s (table %s, no %s)', c.ui_tbl_clm_id, c.ui_tbl_clm_table_id, c.ui_tbl_clm_no)
          FROM fixed.ui_table_columns c
         WHERE c.ui_tbl_clm_id BETWEEN 2652 AND 2788
           AND NOT (   (c.ui_tbl_clm_table_id BETWEEN 80 AND 86)
                    OR (c.ui_tbl_clm_table_id = 22 AND c.ui_tbl_clm_no = 101)
                    OR (c.ui_tbl_clm_table_id = 28 AND c.ui_tbl_clm_no IN (30, 31, 32))
                    OR (c.ui_tbl_clm_table_id = 74 AND c.ui_tbl_clm_no IN (38, 39))
                    OR (c.ui_tbl_clm_table_id = 78 AND c.ui_tbl_clm_no IN (17, 18)))
        UNION ALL
        SELECT format('ui_table %s column %s is "%s"', c.ui_tbl_clm_table_id, c.ui_tbl_clm_no, c.ui_tbl_clm_name)
          FROM fixed.ui_table_columns c
          JOIN (VALUES (22, 101, 'Delivered'::text), (28, 30, 'Not delivered'), (28, 31, 'Physical'),
                       (28, 32, 'Shelf counted'), (74, 38, 'To give'), (74, 39, 'Not taken'),
                       (78, 17, 'Not delivered'), (78, 18, 'Physical')) v(tbl, no, name)
            ON v.tbl = c.ui_tbl_clm_table_id AND v.no = c.ui_tbl_clm_no
         WHERE c.ui_tbl_clm_is_deleted = false
           AND c.ui_tbl_clm_name IS DISTINCT FROM v.name
        UNION ALL
        SELECT format('grid column %s (grid %s)', c.grid_column_id, c.grid_id)
          FROM fixed.grid_columns c
         WHERE c.grid_column_id::text LIKE '01a1e1d0-%'
           AND c.grid_id NOT IN (86, 212, 213, 214, 215, 216, 217, 218)
        UNION ALL
        SELECT format('grid 86 column %s is %s', c.grid_column_number, c.grid_column_sql_field_name)
          FROM fixed.grid_columns c
         WHERE c.grid_id = 86 AND c.grid_column_number IN (16, 17) AND c.grid_column_is_deleted = false
           AND c.grid_column_sql_field_name NOT IN ('sb_delivery_status', 'sb_delivery_mode')
        UNION ALL
        SELECT format('db_table_master %s is %s.%s', d.dtm_id, d.dtm_schema, d.dtm_table)
          FROM public.db_table_master d
          JOIN (VALUES (632, 'sale_delivery_note'::text), (633, 'sale_delivery_note_item'), (634, 'sale_delivery_event')) v(id, tbl)
            ON v.id = d.dtm_id
         WHERE (d.dtm_schema::text, d.dtm_table::text) IS DISTINCT FROM ('sales', v.tbl)
        UNION ALL
        SELECT format('audit screen %s (%s)', s.screen_id, s.screen_name)
          FROM audit.audit_screen s
         WHERE (s.screen_id = 164 AND s.screen_name IS DISTINCT FROM 'Delivery Note')
            OR (s.screen_id <> 164 AND s.screen_name = 'Delivery Note')
        UNION ALL
        SELECT format('print purpose %s (%s / %s)', p.ppo_code, p.ppo_src_module, p.ppo_doc_type)
          FROM public.print_purpose p
          JOIN (VALUES ('01a1df42-297f-72cb-8103-6474f4cf1e84'::uuid, 'GATE_PASS'::text, 'SALES'::text, 'DELIVERY_NOTE'::text),
                       ('01a1df42-297f-72de-b9de-b5798ca6a9b2', 'PICK_LIST', 'SALES', 'PENDING_DELIVERIES'),
                       ('01a1df42-297f-72e4-be0a-e89394b8e6be', 'PENDING_DELIVERIES', 'SALES', 'PENDING_DELIVERIES'),
                       ('01a1df42-297f-72e9-adb9-ff7cd9fd0a8b', 'GODOWN_POSITION', 'REPORT', 'GODOWN_POSITION'),
                       ('01a1df42-297f-72ee-9cc4-67ee10957dae', 'COUNT_SHEET', 'STOCK', 'GODOWN_POSITION')) v(id, code, module, doc)
            ON v.id = p.ppo_id
            OR (p.ppo_company_id IS NULL AND lower(p.ppo_code::text) = lower(v.code) AND p.ppo_is_deleted = false)
         WHERE (p.ppo_id, upper(p.ppo_code::text), p.ppo_src_module::text, p.ppo_doc_type::text)
               IS DISTINCT FROM (v.id, v.code, v.module, v.doc)
        UNION ALL
        SELECT format('setting %s (%s, %s)', s.asd_key, s.asd_data_type, s.asd_max_scope)
          FROM public.app_setting_def s
          JOIN (VALUES ('sales.delivery_godown'::text, 'UUID'::text, 'DEVICE'::text),
                       ('sales.delivery_amber_days', 'INT', 'COMPANY'),
                       ('sales.delivery_old_days', 'INT', 'COMPANY')) v(k, typ, scope)
            ON v.k = s.asd_key
         WHERE (s.asd_data_type::text, s.asd_max_scope::text) IS DISTINCT FROM (v.typ, v.scope)
        UNION ALL
        SELECT format('stock reason %s (%s, %s)', r.srm_code, r.srm_direction, r.srm_allowed_txn_types)
          FROM stock.stock_reason_master r
         WHERE r.srm_company_id IS NULL AND r.srm_code = 'DELIVERY_GODOWN' AND r.srm_is_deleted = false
           AND (r.srm_direction::text, r.srm_allowed_txn_types) IS DISTINCT FROM ('BOTH', ARRAY['TRANSFER_OUT', 'TRANSFER_IN']::text[])
    ) c;
    IF v_clash IS NOT NULL THEN
        RAISE EXCEPTION 'Delivery tracking P1: ids or names already taken: %. Pick free ones here, in the seed files and in the server / Qt code.', v_clash;
    END IF;
END $$;


-- ── 1 · sales.sale_bill.sb_delivery_mode ────────────────────────────────────
-- Constant default: existing rows take INSTANT with no rewrite; added on the
-- parent it reaches every partition. Section 8 moves the old PENDING bills to
-- PICKUP. The old status CHECK goes here (section 9 adds the new list once the
-- data is in it).
ALTER TABLE sales.sale_bill
    ADD COLUMN IF NOT EXISTS sb_delivery_mode varchar(10) NOT NULL DEFAULT 'INSTANT';

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'sales.sale_bill'::regclass AND conname = 'ck_sb_delivery_mode') THEN
        ALTER TABLE sales.sale_bill
            ADD CONSTRAINT ck_sb_delivery_mode CHECK (sb_delivery_mode IN ('INSTANT', 'PICKUP', 'DISPATCH'));
    END IF;
END $$;

ALTER TABLE sales.sale_bill DROP CONSTRAINT IF EXISTS ck_sb_delivery_status;


-- ── 2 · accounts.acc_voucher_types.vchr_delivery_mode (Q3) ─────────────────
ALTER TABLE accounts.acc_voucher_types
    ADD COLUMN IF NOT EXISTS vchr_delivery_mode varchar(10);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'accounts.acc_voucher_types'::regclass AND conname = 'ck_vchr_delivery_mode') THEN
        ALTER TABLE accounts.acc_voucher_types
            ADD CONSTRAINT ck_vchr_delivery_mode
                CHECK (vchr_delivery_mode IS NULL OR vchr_delivery_mode IN ('INSTANT', 'PICKUP', 'DISPATCH'));
    END IF;
END $$;

UPDATE accounts.acc_voucher_types
   SET vchr_delivery_mode = 'INSTANT',
       vchr_updated_on    = now(),
       vchr_updated_by    = '20261117100000_delivery_tracking'
 WHERE vchr_type_code = 'Bil'
   AND vchr_parent_id IS NULL
   AND vchr_delivery_mode IS NULL;


-- ── 3 · sales.sale_return_item.sri_undelivered_qty (N3, addendum A3) ────────
ALTER TABLE sales.sale_return_item
    ADD COLUMN IF NOT EXISTS sri_undelivered_qty numeric(14,3) NOT NULL DEFAULT 0;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'sales.sale_return_item'::regclass AND conname = 'ck_sri_undelivered') THEN
        ALTER TABLE sales.sale_return_item
            ADD CONSTRAINT ck_sri_undelivered
                CHECK (sri_undelivered_qty >= 0 AND sri_undelivered_qty <= sri_return_qty + sri_free_qty);
    END IF;
END $$;


-- ── 4 · stock.stock_voucher_item: shelf count and its billed-not-delivered ──
ALTER TABLE stock.stock_voucher_item
    ADD COLUMN IF NOT EXISTS svi_shelf_qty       numeric(18,6),
    ADD COLUMN IF NOT EXISTS svi_undelivered_qty numeric(18,6) NOT NULL DEFAULT 0;


-- ── 5 · DELIVERY_NOTE in the shared status-log and transport-band CHECKs ───
-- The live value lists are read back and DELIVERY_NOTE appended, so a value
-- another migration added is never lost.
DO $$
DECLARE
    r      record;
    v_def  text;
    v_vals text;
BEGIN
    FOR r IN SELECT * FROM (VALUES ('public.txn_status_log'::text, 'ck_tsl_src_doc_type'::text, 'tsl_src_doc_type'::text),
                                   ('public.txn_transport_detail', 'ck_ttd_doc_type', 'ttd_doc_type')) v(tbl, con, col)
    LOOP
        SELECT pg_get_constraintdef(c.oid) INTO v_def
          FROM pg_constraint c
         WHERE c.conrelid = r.tbl::regclass AND c.conname = r.con;
        IF v_def IS NULL THEN
            RAISE EXCEPTION 'Delivery tracking P1: % has no CHECK %.', r.tbl, r.con;
        END IF;
        CONTINUE WHEN v_def LIKE '%''DELIVERY_NOTE''%';
        SELECT string_agg(quote_literal(m[1]), ', ' ORDER BY n) INTO v_vals
          FROM regexp_matches(v_def, '''([A-Z_]+)''', 'g') WITH ORDINALITY AS t(m, n);
        EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', r.tbl, r.con);
        EXECUTE format('ALTER TABLE %s ADD CONSTRAINT %I CHECK (%I IN (%s, %L))',
                       r.tbl, r.con, r.col, v_vals, 'DELIVERY_NOTE');
    END LOOP;
END $$;


-- ── 6 · the three new tables ───────────────────────────────────────────────
-- 6a · sales.sale_delivery_note: the note (gate pass). Numbered per device
-- (DN/{acc_year}/{device}/{00000}); the client may send its own uuidv7 on the
-- first save. Transporter / LR live in txn_transport_detail (DELIVERY_NOTE).
CREATE TABLE IF NOT EXISTS sales.sale_delivery_note (
    sdn_id                  uuid           NOT NULL DEFAULT uuidv7(),
    sdn_company_id          uuid           NOT NULL,
    sdn_branch_id           uuid           NOT NULL,
    sdn_tenant_id           uuid,
    sdn_acc_year            character(9)   NOT NULL,
    sdn_device_id           text           NOT NULL,
    sdn_device_type         varchar(20),
    sdn_session_id          uuid,
    sdn_slno                bigint         NOT NULL,
    sdn_refno               varchar(40)    NOT NULL,
    sdn_date                date           NOT NULL,
    sdn_datetime            timestamptz(6) NOT NULL DEFAULT now(),
    sdn_godown_id           uuid           NOT NULL,
    sdn_mode                varchar(12)    NOT NULL DEFAULT 'SELF',
    sdn_vehicle_id          uuid,
    sdn_vehicle_no          varchar(20),
    sdn_vehicle_capacity_kg numeric(12,3),
    sdn_driver_id           uuid,
    sdn_supervisor_id       uuid,
    sdn_loadman_id          uuid[],
    sdn_collected_by        varchar(100),
    sdn_collector_phone     varchar(20),
    sdn_tot_lines           integer        NOT NULL DEFAULT 0,
    sdn_tot_qty             numeric(14,3)  NOT NULL DEFAULT 0,
    sdn_tot_bags            numeric(14,3)  NOT NULL DEFAULT 0,
    sdn_tot_weight_kg       numeric(14,3)  NOT NULL DEFAULT 0,
    sdn_bill_count          integer        NOT NULL DEFAULT 0,
    sdn_status              varchar(10)    NOT NULL DEFAULT 'DRAFT',
    sdn_overrides           varchar(400),
    sdn_posted_on           timestamptz(6),
    sdn_posted_by           varchar(60),
    sdn_cancelled_on        timestamptz(6),
    sdn_cancelled_by        varchar(60),
    sdn_cancel_reason       varchar(200),
    sdn_print_count         integer        NOT NULL DEFAULT 0,
    sdn_revision_no         integer        NOT NULL DEFAULT 1,
    sdn_remarks             varchar(250),
    sdn_is_deleted          boolean        NOT NULL DEFAULT false,
    sdn_sync_date           timestamptz(6),
    sdn_created_on          timestamptz(6) NOT NULL DEFAULT now(),
    sdn_created_by          varchar(60)    NOT NULL,
    sdn_modified_on         timestamptz(6),
    sdn_modified_by         varchar(60),
    CONSTRAINT pk_sale_delivery_note PRIMARY KEY (sdn_id, sdn_acc_year),
    CONSTRAINT ck_sdn_mode   CHECK (sdn_mode IN ('SELF', 'VEHICLE', 'TRANSPORTER')),
    CONSTRAINT ck_sdn_status CHECK (sdn_status IN ('DRAFT', 'POSTED', 'CANCELLED')),
    CONSTRAINT ck_sdn_cancel_reason CHECK (sdn_status <> 'CANCELLED' OR length(btrim(COALESCE(sdn_cancel_reason, ''))) > 0),
    CONSTRAINT ck_sdn_slno   CHECK (sdn_slno > 0),
    CONSTRAINT ck_sdn_acc_year CHECK (sdn_acc_year ~ '^[0-9]{4}-[0-9]{4}$'
                                      AND right(sdn_acc_year, 4)::integer = left(sdn_acc_year, 4)::integer + 1),
    CONSTRAINT fk_sdn_godown     FOREIGN KEY (sdn_godown_id)     REFERENCES inventory.godown_locations (gdl_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_sdn_vehicle    FOREIGN KEY (sdn_vehicle_id)    REFERENCES public.vehicle_master (veh_id)      ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_sdn_driver     FOREIGN KEY (sdn_driver_id)     REFERENCES public.employee_master (emp_id)     ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_sdn_supervisor FOREIGN KEY (sdn_supervisor_id) REFERENCES public.employee_master (emp_id)     ON UPDATE CASCADE ON DELETE RESTRICT
) PARTITION BY LIST (sdn_acc_year);

CREATE UNIQUE INDEX IF NOT EXISTS ux_sdn_device_slno
    ON sales.sale_delivery_note (sdn_company_id, sdn_branch_id, sdn_acc_year, sdn_device_id, sdn_slno);
CREATE UNIQUE INDEX IF NOT EXISTS ux_sdn_refno
    ON sales.sale_delivery_note (sdn_company_id, sdn_branch_id, sdn_acc_year, sdn_refno);
CREATE INDEX IF NOT EXISTS ix_sdn_branch_date
    ON sales.sale_delivery_note (sdn_company_id, sdn_branch_id, sdn_date DESC) WHERE sdn_is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_sdn_godown
    ON sales.sale_delivery_note (sdn_godown_id, sdn_date DESC) WHERE sdn_status = 'POSTED';
CREATE INDEX IF NOT EXISTS ix_sdn_vehicle
    ON sales.sale_delivery_note (sdn_vehicle_id) WHERE sdn_vehicle_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_sdn_driver
    ON sales.sale_delivery_note (sdn_driver_id) WHERE sdn_driver_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_sdn_supervisor
    ON sales.sale_delivery_note (sdn_supervisor_id) WHERE sdn_supervisor_id IS NOT NULL;

COMMENT ON TABLE sales.sale_delivery_note IS 'Delivery Note / gate pass (menu 305): what physically left one godown against posted Pickup / Dispatch bills. Moves no stock itself; its GIVEN events in sale_delivery_event lower billed-not-delivered. Lot or godown corrections are shadow stock vouchers linked by svh_link_src_*.';
COMMENT ON COLUMN sales.sale_delivery_note.sdn_overrides IS 'The WARN codes ticked at post (overrideWarnings), comma separated; logged.';
COMMENT ON COLUMN sales.sale_delivery_note.sdn_vehicle_capacity_kg IS 'The vehicle''s capacity at post, for the load check on a reprint.';

-- 6b · sales.sale_delivery_note_item: the lines. No UNIQUE on (note, bill
-- line): one bill line may be given in two lots on one note.
CREATE TABLE IF NOT EXISTS sales.sale_delivery_note_item (
    sdni_id              uuid           NOT NULL DEFAULT uuidv7(),
    sdni_note_id         uuid           NOT NULL,
    sdni_acc_year        character(9)   NOT NULL,
    sdni_company_id      uuid           NOT NULL,
    sdni_branch_id       uuid           NOT NULL,
    sdni_tenant_id       uuid,
    sdni_line_no         integer        NOT NULL,
    sdni_bill_id         uuid           NOT NULL,
    sdni_bill_acc_year   character(9)   NOT NULL,
    sdni_bill_item_id    uuid           NOT NULL,
    sdni_bill_line_no    integer        NOT NULL,
    sdni_bill_refno      varchar(40),
    sdni_item_id         uuid           NOT NULL,
    sdni_item_unit_id    uuid           NOT NULL,
    sdni_to_base_factor  numeric(15,6)  NOT NULL,
    sdni_bill_godown_id  uuid           NOT NULL,
    sdni_godown_id       uuid           NOT NULL,
    sdni_bill_lot_id     uuid,
    sdni_lot_id          uuid,
    sdni_bucket          varchar(20)    NOT NULL DEFAULT 'SALEABLE',
    sdni_qty             numeric(14,3)  NOT NULL DEFAULT 0,
    sdni_base_qty        numeric(18,6)  NOT NULL DEFAULT 0,
    sdni_weight_kg       numeric(14,3)  NOT NULL DEFAULT 0,
    sdni_scanned_qty     numeric(14,3)  NOT NULL DEFAULT 0,
    sdni_other_godown_ok boolean        NOT NULL DEFAULT false,
    sdni_remarks         varchar(200),
    sdni_is_deleted      boolean        NOT NULL DEFAULT false,
    sdni_sync_date       timestamptz(6),
    sdni_created_on      timestamptz(6) NOT NULL DEFAULT now(),
    sdni_created_by      varchar(60)    NOT NULL,
    sdni_modified_on     timestamptz(6),
    sdni_modified_by     varchar(60),
    CONSTRAINT pk_sale_delivery_note_item PRIMARY KEY (sdni_id, sdni_acc_year),
    CONSTRAINT ck_sdni_line_no  CHECK (sdni_line_no >= 1),
    CONSTRAINT ck_sdni_bucket   CHECK (sdni_bucket IN ('SALEABLE', 'DAMAGED', 'QUARANTINE', 'EXPIRED', 'SAMPLE')),
    CONSTRAINT ck_sdni_qty      CHECK (sdni_qty >= 0),
    CONSTRAINT ck_sdni_base_qty CHECK (sdni_base_qty >= 0),
    CONSTRAINT fk_sdni_note      FOREIGN KEY (sdni_note_id, sdni_acc_year)           REFERENCES sales.sale_delivery_note (sdn_id, sdn_acc_year)  ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_sdni_bill_item FOREIGN KEY (sdni_bill_item_id, sdni_bill_acc_year) REFERENCES sales.sale_bill_item (sbi_id, sbi_acc_year)     ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_sdni_item      FOREIGN KEY (sdni_item_id)      REFERENCES inventory.item_master (item_id)          ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_sdni_item_unit FOREIGN KEY (sdni_item_unit_id) REFERENCES inventory.item_unit_conversion (iuc_id)  ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_sdni_bill_lot  FOREIGN KEY (sdni_bill_lot_id)  REFERENCES stock.stock_lot (slt_id)                 ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_sdni_lot       FOREIGN KEY (sdni_lot_id)       REFERENCES stock.stock_lot (slt_id)                 ON UPDATE CASCADE ON DELETE RESTRICT
) PARTITION BY LIST (sdni_acc_year);

CREATE INDEX IF NOT EXISTS ix_sdni_note
    ON sales.sale_delivery_note_item (sdni_note_id, sdni_acc_year, sdni_line_no) WHERE sdni_is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_sdni_bill_item
    ON sales.sale_delivery_note_item (sdni_bill_item_id, sdni_bill_acc_year) WHERE sdni_is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_sdni_item
    ON sales.sale_delivery_note_item (sdni_item_id) WHERE sdni_is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_sdni_lot
    ON sales.sale_delivery_note_item (sdni_lot_id) WHERE sdni_lot_id IS NOT NULL AND sdni_is_deleted = false;

COMMENT ON TABLE sales.sale_delivery_note_item IS 'One line of a Delivery Note: a bill line given now (qty in the bill line''s unit), from the note''s godown and the lot actually given. Zero-qty draft lines are soft-deleted at post.';

-- 6c · sales.sale_delivery_event: insert-only. Every reader sums the signed
-- settle / out columns; no counter is stored anywhere (decision 35). No CHECK
-- or UNIQUE over a quantity two sites draw on (§6): the partial UNIQUEs below
-- are written only by the note's / the return's own site.
CREATE TABLE IF NOT EXISTS sales.sale_delivery_event (
    sde_id              uuid           NOT NULL DEFAULT uuidv7(),
    sde_company_id      uuid           NOT NULL,
    sde_branch_id       uuid           NOT NULL,
    sde_tenant_id       uuid,
    sde_acc_year        character(9)   NOT NULL,
    sde_kind            varchar(16)    NOT NULL,
    sde_bill_id         uuid           NOT NULL,
    sde_bill_acc_year   character(9)   NOT NULL,
    sde_bill_item_id    uuid           NOT NULL,
    sde_bill_line_no    integer        NOT NULL,
    sde_item_id         uuid           NOT NULL,
    sde_godown_id       uuid           NOT NULL,
    sde_lot_id          uuid,
    sde_settle_qty      numeric(14,3)  NOT NULL,
    sde_settle_base_qty numeric(18,6)  NOT NULL,
    sde_out_qty         numeric(14,3)  NOT NULL DEFAULT 0,
    sde_out_base_qty    numeric(18,6)  NOT NULL DEFAULT 0,
    sde_src_doc_type    varchar(20)    NOT NULL,
    sde_src_doc_id      uuid,
    sde_src_acc_year    character(9),
    sde_src_line_id     uuid,
    sde_src_refno       varchar(40),
    sde_reverses_id     uuid,
    sde_event_datetime  timestamptz(6) NOT NULL,
    sde_reason          varchar(200),
    sde_device_id       text,
    sde_is_deleted      boolean        NOT NULL DEFAULT false,
    sde_sync_date       timestamptz(6),
    sde_created_on      timestamptz(6) NOT NULL DEFAULT now(),
    sde_created_by      varchar(60)    NOT NULL,
    CONSTRAINT pk_sale_delivery_event PRIMARY KEY (sde_id, sde_acc_year),
    CONSTRAINT ck_sde_kind CHECK (sde_kind IN ('GIVEN', 'CANCEL', 'GOODS_BACK', 'RETURN', 'RETURN_CANCEL', 'CLEANUP')),
    CONSTRAINT ck_sde_src_doc_type CHECK (sde_src_doc_type IN ('DELIVERY_NOTE', 'SALE_RETURN', 'CLEANUP')),
    CONSTRAINT ck_sde_signs CHECK (
           (sde_kind IN ('GIVEN', 'CLEANUP')     AND sde_settle_qty > 0 AND sde_out_qty = sde_settle_qty
                                                 AND sde_settle_base_qty > 0 AND sde_out_base_qty = sde_settle_base_qty)
        OR (sde_kind IN ('CANCEL', 'GOODS_BACK') AND sde_settle_qty < 0 AND sde_out_qty = sde_settle_qty
                                                 AND sde_settle_base_qty < 0 AND sde_out_base_qty = sde_settle_base_qty)
        OR (sde_kind = 'RETURN'                  AND sde_settle_qty > 0 AND sde_out_qty = 0
                                                 AND sde_settle_base_qty > 0 AND sde_out_base_qty = 0)
        OR (sde_kind = 'RETURN_CANCEL'           AND sde_settle_qty < 0 AND sde_out_qty = 0
                                                 AND sde_settle_base_qty < 0 AND sde_out_base_qty = 0)),
    CONSTRAINT ck_sde_reverses CHECK ((sde_kind IN ('CANCEL', 'RETURN_CANCEL')) = (sde_reverses_id IS NOT NULL)),
    CONSTRAINT ck_sde_src CHECK ((sde_src_doc_type = 'CLEANUP') = (sde_src_doc_id IS NULL)),
    CONSTRAINT fk_sde_bill_item FOREIGN KEY (sde_bill_item_id, sde_bill_acc_year) REFERENCES sales.sale_bill_item (sbi_id, sbi_acc_year) ON UPDATE CASCADE ON DELETE RESTRICT
) PARTITION BY LIST (sde_acc_year);

-- Partial (WHERE sde_is_deleted = false, which every row is) so the INCLUDE
-- index stays DB-only: Prisma cannot express INCLUDE.
CREATE INDEX IF NOT EXISTS ix_sde_bill_item
    ON sales.sale_delivery_event (sde_bill_item_id, sde_bill_acc_year)
    INCLUDE (sde_settle_qty, sde_settle_base_qty, sde_out_qty, sde_out_base_qty)
    WHERE sde_is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_sde_bill
    ON sales.sale_delivery_event (sde_bill_id, sde_bill_acc_year);
CREATE INDEX IF NOT EXISTS ix_sde_src
    ON sales.sale_delivery_event (sde_src_doc_type, sde_src_doc_id);
CREATE INDEX IF NOT EXISTS ix_sde_godown_time
    ON sales.sale_delivery_event (sde_company_id, sde_branch_id, sde_godown_id, sde_event_datetime DESC)
    WHERE sde_kind = 'GIVEN';
CREATE UNIQUE INDEX IF NOT EXISTS ux_sde_given
    ON sales.sale_delivery_event (sde_src_line_id, sde_acc_year) WHERE sde_kind = 'GIVEN';
CREATE UNIQUE INDEX IF NOT EXISTS ux_sde_return
    ON sales.sale_delivery_event (sde_src_line_id, sde_acc_year) WHERE sde_kind = 'RETURN';
CREATE UNIQUE INDEX IF NOT EXISTS ux_sde_reversal
    ON sales.sale_delivery_event (sde_reverses_id, sde_acc_year) WHERE sde_kind IN ('CANCEL', 'RETURN_CANCEL');
CREATE UNIQUE INDEX IF NOT EXISTS ux_sde_cleanup
    ON sales.sale_delivery_event (sde_bill_item_id, sde_acc_year) WHERE sde_kind = 'CLEANUP';

COMMENT ON TABLE sales.sale_delivery_event IS 'Insert-only delivery events of a bill line (GIVEN / CANCEL / GOODS_BACK from a Delivery Note, RETURN / RETURN_CANCEL from a Sale Return, CLEANUP at go-live). pending = billed - SUM(settle); given = SUM(out). Never updated, never deleted.';
COMMENT ON COLUMN sales.sale_delivery_event.sde_acc_year IS 'The source document''s year (the note''s, the return''s; the bill''s for CLEANUP).';

-- 6d · sync triggers + pending index, one table at a time (what
-- public.sync_install_triggers() does per table). Skipped where the sync
-- functions are absent (the VPS: cloud sync is local-only), as 20261029130000.
DO $sync$
DECLARE
    r record;
BEGIN
    IF to_regprocedure('public.fn_sync_mark_dirty()') IS NULL
       OR to_regprocedure('public.fn_sync_log_delete()') IS NULL THEN
        RAISE NOTICE 'delivery tracking: sync functions absent, sync triggers skipped';
        RETURN;
    END IF;
    FOR r IN SELECT * FROM (VALUES ('sale_delivery_note'::text,      'sdn_id'::text,  'sdn_acc_year'::text,  'sdn_sync_date'::text),
                                   ('sale_delivery_note_item',       'sdni_id',       'sdni_acc_year',       'sdni_sync_date'),
                                   ('sale_delivery_event',           'sde_id',        'sde_acc_year',        'sde_sync_date')) v(tbl, pk1, pk2, col)
    LOOP
        EXECUTE format('CREATE OR REPLACE TRIGGER zz_sync_mark_dirty BEFORE UPDATE ON sales.%I FOR EACH ROW EXECUTE FUNCTION public.fn_sync_mark_dirty(%L)',
                       r.tbl, r.col);
        EXECUTE format('CREATE OR REPLACE TRIGGER zz_sync_log_delete AFTER DELETE ON sales.%I FOR EACH ROW EXECUTE FUNCTION public.fn_sync_log_delete(%L, %L, %L, %L)',
                       r.tbl, 'sales', r.tbl, r.pk1, r.pk2);
        EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON sales.%I (%I, %I) WHERE %I IS NULL',
                       left('ix_sync_pending_' || r.tbl, 63), r.tbl, r.pk1, r.pk2, r.col);
    END LOOP;
END $sync$;


-- ── 7 · ensure_acc_year_partitions: + the three tables ─────────────────────
-- The live body (last redefined by 20261017150000_till_void_bill) copied
-- forward unchanged, with the delivery tables appended, parent before child.
CREATE OR REPLACE FUNCTION public.ensure_acc_year_partitions(p_acc_year character)
 RETURNS void
 LANGUAGE plpgsql
AS $function$

DECLARE
    v_year   text := btrim(p_acc_year);
    v_suffix text;
BEGIN
    IF v_year !~ '^[0-9]{4}-[0-9]{4}$' THEN
        RAISE EXCEPTION 'Invalid accounting year %, expected YYYY-YYYY', p_acc_year;
    END IF;

    v_suffix := replace(v_year, '-', '_');

    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS sales.%I PARTITION OF sales.sale_bill FOR VALUES IN (%L)',
        'sale_bill_' || v_suffix, v_year);
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS sales.%I PARTITION OF sales.sale_bill_item FOR VALUES IN (%L)',
        'sale_bill_item_' || v_suffix, v_year);
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS accounts.%I PARTITION OF accounts.acc_tender_detail FOR VALUES IN (%L)',
        'acc_tender_detail_' || v_suffix, v_year);
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS public.%I PARTITION OF public.txn_status_log FOR VALUES IN (%L)',
        'txn_status_log_' || v_suffix, v_year);
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS public.%I PARTITION OF public.txn_charge_detail FOR VALUES IN (%L)',
        'txn_charge_detail_' || v_suffix, v_year);
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS public.%I PARTITION OF public.txn_hold FOR VALUES IN (%L)',
        'txn_hold_' || v_suffix, v_year);
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS sales.%I PARTITION OF sales.sale_order FOR VALUES IN (%L)',
        'sale_order_' || v_suffix, v_year);
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS sales.%I PARTITION OF sales.sale_order_item FOR VALUES IN (%L)',
        'sale_order_item_' || v_suffix, v_year);
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS sales.%I PARTITION OF sales.sale_quotation FOR VALUES IN (%L)',
        'sale_quotation_' || v_suffix, v_year);
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS sales.%I PARTITION OF sales.sale_quotation_item FOR VALUES IN (%L)',
        'sale_quotation_item_' || v_suffix, v_year);

    -- The bill is partitioned again as of 20260811090000: on the FY it was
    -- RAISED in, which it keeps for life.
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS accounts.%I PARTITION OF accounts.acc_bill_balance FOR VALUES IN (%L)',
        'acc_bill_balance_' || v_suffix, v_year);
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS accounts.%I PARTITION OF accounts.acc_bill_adjustment FOR VALUES IN (%L)',
        'acc_bill_adjustment_' || v_suffix, v_year);
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS accounts.%I PARTITION OF accounts.acc_opening_balance FOR VALUES IN (%L)',
        'acc_opening_balance_' || v_suffix, v_year);
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS accounts.%I PARTITION OF accounts.acc_pdc_register FOR VALUES IN (%L)',
        'acc_pdc_register_' || v_suffix, v_year);

    -- ── Added by 20260915120000 ──────────────────────────────────────────
    --  Header BEFORE lines: acc_vouchers carries fk_av_header into it.
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS accounts.%I PARTITION OF accounts.acc_voucher_header FOR VALUES IN (%L)',
        'acc_voucher_header_' || v_suffix, v_year);
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS accounts.%I PARTITION OF accounts.acc_vouchers FOR VALUES IN (%L)',
        'acc_vouchers_' || v_suffix, v_year);

    -- ── Added by 20260921120000 ──────────────────────────────────────────
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS public.%I PARTITION OF public.gst_api_log FOR VALUES IN (%L)',
        'gst_api_log_' || v_suffix, v_year);

    -- ── Added by 20260921140000 ──────────────────────────────────────────
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS sales.%I PARTITION OF sales.loyalty_ledger FOR VALUES IN (%L)',
        'loyalty_ledger_' || v_suffix, v_year);
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS sales.%I PARTITION OF sales.loyalty_gift_redeem FOR VALUES IN (%L)',
        'loyalty_gift_redeem_' || v_suffix, v_year);
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS sales.%I PARTITION OF sales.loyalty_gift_redeem_item FOR VALUES IN (%L)',
        'loyalty_gift_redeem_item_' || v_suffix, v_year);

    -- ── Added by 20260921160000 ──────────────────────────────────────────
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS sales.%I PARTITION OF sales.loyalty_coupon_txn FOR VALUES IN (%L)',
        'loyalty_coupon_txn_' || v_suffix, v_year);

    -- ── Added by 20260921180000 ──────────────────────────────────────────
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS sales.%I PARTITION OF sales.promotion_usage FOR VALUES IN (%L)',
        'promotion_usage_' || v_suffix, v_year);

    -- ── Added by 20260921200000 ──────────────────────────────────────────
    --  The six sales documents. Parent before child throughout.
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS sales.%I PARTITION OF sales.sale_return FOR VALUES IN (%L)',
        'sale_return_' || v_suffix, v_year);
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS sales.%I PARTITION OF sales.sale_return_item FOR VALUES IN (%L)',
        'sale_return_item_' || v_suffix, v_year);
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS sales.%I PARTITION OF sales.sale_dc FOR VALUES IN (%L)',
        'sale_dc_' || v_suffix, v_year);
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS sales.%I PARTITION OF sales.sale_dc_item FOR VALUES IN (%L)',
        'sale_dc_item_' || v_suffix, v_year);
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS sales.%I PARTITION OF sales.sale_dc_return FOR VALUES IN (%L)',
        'sale_dc_return_' || v_suffix, v_year);
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS sales.%I PARTITION OF sales.sale_dc_return_item FOR VALUES IN (%L)',
        'sale_dc_return_item_' || v_suffix, v_year);

    -- ── Added by 20260922000000 ──────────────────────────────────────────
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS accounts.%I PARTITION OF accounts.acc_temp_credit FOR VALUES IN (%L)',
        'acc_temp_credit_' || v_suffix, v_year);

    -- ── Added by 20260922040000 ──────────────────────────────────────────
    --  The transport band. Written for every goods-moving document that has a
    --  consignment, so a missing partition stops a dispatch.
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS public.%I PARTITION OF public.txn_transport_detail FOR VALUES IN (%L)',
        'txn_transport_detail_' || v_suffix, v_year);

    -- ── Added by 20260922100000 ──────────────────────────────────
    --  The GST document band. The register carries fk_*_gdr from the other
    --  three, so it is created first.
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS accounts.%I PARTITION OF accounts.acc_voucher_doc_register FOR VALUES IN (%L)',
        'acc_voucher_doc_register_' || v_suffix, v_year);
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS accounts.%I PARTITION OF accounts.acc_voucher_doc_detail FOR VALUES IN (%L)',
        'acc_voucher_doc_detail_' || v_suffix, v_year);
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS accounts.%I PARTITION OF accounts.acc_voucher_doc_einvoice FOR VALUES IN (%L)',
        'acc_voucher_doc_einvoice_' || v_suffix, v_year);
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS accounts.%I PARTITION OF accounts.acc_voucher_doc_ewaybill FOR VALUES IN (%L)',
        'acc_voucher_doc_ewaybill_' || v_suffix, v_year);

    -- ── Added by 20261008100000 — till management (share file 47) ────────
    --  Parent before child: day → session → variance, count → count line.
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS accounts.%I PARTITION OF accounts.till_business_day FOR VALUES IN (%L)',
        'till_business_day_' || v_suffix, v_year);
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS accounts.%I PARTITION OF accounts.till_session FOR VALUES IN (%L)',
        'till_session_' || v_suffix, v_year);
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS accounts.%I PARTITION OF accounts.till_count FOR VALUES IN (%L)',
        'till_count_' || v_suffix, v_year);
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS accounts.%I PARTITION OF accounts.till_count_line FOR VALUES IN (%L)',
        'till_count_line_' || v_suffix, v_year);
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS accounts.%I PARTITION OF accounts.till_cash_movement FOR VALUES IN (%L)',
        'till_cash_movement_' || v_suffix, v_year);
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS accounts.%I PARTITION OF accounts.till_variance FOR VALUES IN (%L)',
        'till_variance_' || v_suffix, v_year);
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS accounts.%I PARTITION OF accounts.till_approval FOR VALUES IN (%L)',
        'till_approval_' || v_suffix, v_year);
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS accounts.%I PARTITION OF accounts.till_event FOR VALUES IN (%L)',
        'till_event_' || v_suffix, v_year);
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS accounts.%I PARTITION OF accounts.till_session_review FOR VALUES IN (%L)',
        'till_session_review_' || v_suffix, v_year);

    -- ── Added by 20261008130000 — non-cash tender control (share file 49) ─
    --  Import before line: acc_settlement_line carries fk_asl_import.
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS accounts.%I PARTITION OF accounts.acc_settlement_import FOR VALUES IN (%L)',
        'acc_settlement_import_' || v_suffix, v_year);
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS accounts.%I PARTITION OF accounts.acc_settlement_line FOR VALUES IN (%L)',
        'acc_settlement_line_' || v_suffix, v_year);

    -- ── Added by 20261017150000 — void bill (REV 2) ───────────────────────
    --  The void evidence row, and print_log, whose "printed before the void"
    --  rows it reads: both year-partitioned, neither was in the roll before.
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS accounts.%I PARTITION OF accounts.till_void FOR VALUES IN (%L)',
        'till_void_' || v_suffix, v_year);
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS public.%I PARTITION OF public.print_log FOR VALUES IN (%L)',
        'print_log_' || v_suffix, v_year);

    -- ── Added by 20261117100000 — delivery tracking P1 ────────────────────
    --  The note before its lines (fk_sdni_note); the events last.
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS sales.%I PARTITION OF sales.sale_delivery_note FOR VALUES IN (%L)',
        'sale_delivery_note_' || v_suffix, v_year);
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS sales.%I PARTITION OF sales.sale_delivery_note_item FOR VALUES IN (%L)',
        'sale_delivery_note_item_' || v_suffix, v_year);
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS sales.%I PARTITION OF sales.sale_delivery_event FOR VALUES IN (%L)',
        'sale_delivery_event_' || v_suffix, v_year);

    -- The stock engine's four, added by 20260907090000. This is the part the
    -- catalogue-driven helper does not reach.
    PERFORM stock.fn_create_stock_partitions(v_year::character(9));
END;
$function$;

-- Backfill: the three tables for every year sales.sale_bill has a partition
-- for (read from pg_inherits, never hard-coded). Only these three tables are
-- touched here; the other tables' partitions are left as they are.
DO $$
DECLARE
    v_year   text;
    v_suffix text;
BEGIN
    FOR v_year IN
        SELECT DISTINCT substring(pg_get_expr(c.relpartbound, c.oid) FROM '''([0-9]{4}-[0-9]{4})''')
          FROM pg_inherits i
          JOIN pg_class c ON c.oid = i.inhrelid
         WHERE i.inhparent = 'sales.sale_bill'::regclass
         ORDER BY 1
    LOOP
        CONTINUE WHEN v_year IS NULL;
        v_suffix := replace(v_year, '-', '_');
        EXECUTE format('CREATE TABLE IF NOT EXISTS sales.%I PARTITION OF sales.sale_delivery_note FOR VALUES IN (%L)',
                       'sale_delivery_note_' || v_suffix, v_year);
        EXECUTE format('CREATE TABLE IF NOT EXISTS sales.%I PARTITION OF sales.sale_delivery_note_item FOR VALUES IN (%L)',
                       'sale_delivery_note_item_' || v_suffix, v_year);
        EXECUTE format('CREATE TABLE IF NOT EXISTS sales.%I PARTITION OF sales.sale_delivery_event FOR VALUES IN (%L)',
                       'sale_delivery_event_' || v_suffix, v_year);
    END LOOP;
END $$;


-- ── 8 · Q15 go-live cleanup (decision 41) ──────────────────────────────────
-- The bills the cleanup takes: POSTED, live, WHOLESALE, status not NA, mode
-- still INSTANT (the default section 1 gave them: the new code never leaves an
-- INSTANT bill at a status other than NA, so these are the old flow's), with
-- at least one eligible line (§5.1). Everything is stamped with one time.
DROP TABLE IF EXISTS pg_temp.tmp_dt_cleanup;
CREATE TEMP TABLE tmp_dt_cleanup AS
SELECT b.sb_id, b.sb_acc_year, b.sb_company_id, b.sb_branch_id, b.sb_tenant_id,
       b.sb_bill_refno, b.sb_user_id, b.sb_delivery_status AS old_status
  FROM sales.sale_bill b
 WHERE b.sb_is_deleted = false
   AND b.sb_status = 'POSTED'
   AND b.sb_bill_mode = 'WHOLESALE'
   AND b.sb_delivery_mode = 'INSTANT'
   AND b.sb_delivery_status <> 'NA'
   AND EXISTS (SELECT 1 FROM sales.sale_bill_item i
                WHERE i.sbi_bill_id = b.sb_id AND i.sbi_acc_year = b.sb_acc_year
                  AND i.sbi_is_deleted = false
                  AND i.sbi_is_service = false
                  AND COALESCE(i.sbi_src_doc_type, '') <> 'DELIVERY_CHALLAN'
                  AND i.sbi_bill_qty > 0);

-- One CLEANUP event per eligible line: settle = out = billed (line unit), the
-- base figures by the §5.1 factor rule; the event's year is the bill's.
-- S4 (review 2026-11-16, decision R-2): every database that runs this (the
-- cloud and each offline site) must write the SAME primary key for one bill
-- line, so a site's later push meets its own row, not a second CLEANUP. The
-- id is md5('dt-cleanup:' || sbi_id) laid out as a uuid, version and variant
-- nibbles not forced: the loyalty sweeps' deterministicUuid() recipe
-- (src/modules/sales/posting/loyalty-ledger.service.ts). Nothing orders or
-- partitions by sde_id (the partition key is sde_acc_year, every reader orders
-- by time or kind), so a non-v7 id is safe. ON CONFLICT without a target: the
-- same PK, or ux_sde_cleanup, means the line is done already.
INSERT INTO sales.sale_delivery_event
       (sde_id, sde_company_id, sde_branch_id, sde_tenant_id, sde_acc_year, sde_kind,
        sde_bill_id, sde_bill_acc_year, sde_bill_item_id, sde_bill_line_no, sde_item_id,
        sde_godown_id, sde_lot_id, sde_settle_qty, sde_settle_base_qty, sde_out_qty, sde_out_base_qty,
        sde_src_doc_type, sde_src_doc_id, sde_src_acc_year, sde_src_line_id, sde_src_refno,
        sde_event_datetime, sde_reason, sde_created_on, sde_created_by)
SELECT md5('dt-cleanup:' || i.sbi_id::text)::uuid,
       t.sb_company_id, t.sb_branch_id, i.sbi_tenant_id, t.sb_acc_year, 'CLEANUP',
       t.sb_id, t.sb_acc_year, i.sbi_id, i.sbi_line_no, i.sbi_item_id,
       i.sbi_godown_id, i.sbi_lot_id,
       i.sbi_bill_qty,
       round(i.sbi_bill_qty * CASE WHEN i.sbi_to_base_factor > 0 THEN i.sbi_to_base_factor
                                   ELSE COALESCE(NULLIF(u.iuc_to_base_factor, 0), 1) END, 6),
       i.sbi_bill_qty,
       round(i.sbi_bill_qty * CASE WHEN i.sbi_to_base_factor > 0 THEN i.sbi_to_base_factor
                                   ELSE COALESCE(NULLIF(u.iuc_to_base_factor, 0), 1) END, 6),
       'CLEANUP', NULL, NULL, NULL, NULL,
       now(), 'Go-live: marked delivered (delivery tracking starts ' || to_char(now() AT TIME ZONE 'Asia/Kolkata', 'DD-MM-YYYY') || ')',
       now(), 'go-live cleanup'
  FROM tmp_dt_cleanup t
  JOIN sales.sale_bill_item i ON i.sbi_bill_id = t.sb_id AND i.sbi_acc_year = t.sb_acc_year
  LEFT JOIN inventory.item_unit_conversion u ON u.iuc_id = i.sbi_item_unit_id
 WHERE i.sbi_is_deleted = false
   AND i.sbi_is_service = false
   AND COALESCE(i.sbi_src_doc_type, '') <> 'DELIVERY_CHALLAN'
   AND i.sbi_bill_qty > 0
ON CONFLICT DO NOTHING;

-- One txn_status_log step per bill: SALES / SALE_BILL, DELIVERED, the old
-- status -> DELIVERED, by the bill's user.
-- S4 (R-2): tsl_id = md5('dt-cleanup-log:' || sb_id) as a uuid, the same on
-- every database. The seq cannot be MAX + 1: an offline site upgrades with
-- status steps of its own the cloud has not seen yet, so MAX + 1 differs per
-- database and the site's push would then break ux_tsl_doc_seq. It is the
-- fixed marker 1000 instead: every database writes the same (doc, year, 1000)
-- under the same id, no bill had more than 13 steps on dev (2026-11-16), and
-- the next step on the bill is 1001 (MAX + 1), so the go-live step stays in
-- its place in the Ctrl+H history ("#" 1000) and "latest by seq" still reads
-- it. ON CONFLICT without a target: the same PK, or a step already at 1000,
-- means nothing to add.
INSERT INTO public.txn_status_log
       (tsl_id, tsl_company_id, tsl_branch_id, tsl_tenant_id, tsl_acc_year, tsl_src_module, tsl_src_doc_type,
        tsl_src_doc_id, tsl_src_doc_refno, tsl_seq_no, tsl_event, tsl_from_status, tsl_to_status,
        tsl_changed_on, tsl_changed_by, tsl_remarks, tsl_created_on, tsl_created_by)
SELECT md5('dt-cleanup-log:' || t.sb_id::text)::uuid,
       t.sb_company_id, t.sb_branch_id, t.sb_tenant_id, t.sb_acc_year, 'SALES', 'SALE_BILL',
       t.sb_id, t.sb_bill_refno,
       1000,
       'DELIVERED', t.old_status, 'DELIVERED',
       now(), t.sb_user_id,
       'Go-live: marked delivered (delivery tracking starts ' || to_char(now() AT TIME ZONE 'Asia/Kolkata', 'DD-MM-YYYY') || ')',
       now(), 'go-live cleanup'
  FROM tmp_dt_cleanup t
 WHERE t.old_status <> 'DELIVERED'
ON CONFLICT DO NOTHING;

UPDATE sales.sale_bill b
   SET sb_delivery_mode   = 'PICKUP',
       sb_delivery_status = 'DELIVERED',
       sb_delivered_on    = CASE WHEN t.old_status = 'DELIVERED' THEN COALESCE(b.sb_delivered_on, now()) ELSE now() END
  FROM tmp_dt_cleanup t
 WHERE b.sb_id = t.sb_id
   AND b.sb_acc_year = t.sb_acc_year;

-- Every other bill the old flow left at a status other than NA (cancelled,
-- drafts, POS, nothing eligible): NA. Mode stays INSTANT.
UPDATE sales.sale_bill b
   SET sb_delivery_status = 'NA'
 WHERE b.sb_delivery_mode = 'INSTANT'
   AND b.sb_delivery_status <> 'NA';

DO $$
DECLARE
    v_bills  integer;
    v_events integer;
    v_logs   integer;
BEGIN
    SELECT count(*) INTO v_bills FROM tmp_dt_cleanup;
    SELECT count(*) INTO v_events FROM sales.sale_delivery_event e
      JOIN tmp_dt_cleanup t ON t.sb_id = e.sde_bill_id AND t.sb_acc_year = e.sde_bill_acc_year
     WHERE e.sde_kind = 'CLEANUP';
    SELECT count(*) INTO v_logs FROM public.txn_status_log l
      JOIN tmp_dt_cleanup t ON t.sb_id = l.tsl_src_doc_id AND t.sb_acc_year = l.tsl_acc_year
     WHERE l.tsl_src_doc_type = 'SALE_BILL' AND l.tsl_event = 'DELIVERED' AND l.tsl_created_by = 'go-live cleanup';
    RAISE NOTICE 'delivery tracking go-live cleanup: % bill(s) DELIVERED, % CLEANUP event(s), % status-log row(s)', v_bills, v_events, v_logs;
END $$;

DROP TABLE IF EXISTS pg_temp.tmp_dt_cleanup;


-- ── 9 · the computed status's values, and its open-bills index ─────────────
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'sales.sale_bill'::regclass AND conname = 'ck_sb_delivery_status') THEN
        ALTER TABLE sales.sale_bill
            ADD CONSTRAINT ck_sb_delivery_status
                CHECK (sb_delivery_status IN ('NA', 'PENDING', 'PART', 'OUT', 'DELIVERED', 'RETURNED'));
    END IF;
END $$;

DROP INDEX IF EXISTS sales.ix_sb_delivery_status;
CREATE INDEX IF NOT EXISTS ix_sb_delivery_open
    ON sales.sale_bill (sb_company_id, sb_branch_id, sb_bill_date)
    WHERE sb_is_deleted = false AND sb_status = 'POSTED' AND sb_delivery_status IN ('PENDING', 'PART', 'OUT');


-- ── 10 · stock reason DELIVERY_GODOWN (shared system row, decision 38) ─────
-- Never picked by a user (answer Q1): /stock/reasons filters it out in code,
-- as the table has no column that marks a reason not selectable.
INSERT INTO stock.stock_reason_master
       (srm_company_id, srm_code, srm_name, srm_direction, srm_allowed_txn_types,
        srm_require_remarks, srm_sort_order, srm_remarks, srm_created_by)
SELECT NULL, 'DELIVERY_GODOWN', 'Given from another godown at delivery', 'BOTH',
       ARRAY['TRANSFER_OUT', 'TRANSFER_IN']::text[], false, 220,
       'Posted by a Delivery Note: the books follow the goods to the bill''s godown.', 'system'
 WHERE NOT EXISTS (SELECT 1 FROM stock.stock_reason_master r
                    WHERE r.srm_company_id IS NULL AND r.srm_code = 'DELIVERY_GODOWN' AND r.srm_is_deleted = false);


-- ── 11 · settings (decisions 52, 53) ───────────────────────────────────────
INSERT INTO public.app_setting_def
    (asd_key, asd_module, asd_group, asd_data_type, asd_default_value, asd_allowed_values,
     asd_min_value, asd_max_value, asd_max_scope, asd_label, asd_description, asd_sort_order, asd_created_by)
VALUES
    ('sales.delivery_godown', 'SALES', 'Delivery', 'UUID', NULL, NULL,
     NULL, NULL, 'DEVICE', 'This PC''s godown (Delivery Note, Pending Deliveries, Godown Stock Position)',
     'The godown this PC gives goods from: a new Delivery Note starts on it, and Pending Deliveries and the Godown Stock Position open on it. Empty = All godowns (the note asks).',
     142, 'system'),
    ('sales.delivery_amber_days', 'SALES', 'Delivery', 'INT', '7', NULL,
     1, 365, 'COMPANY', 'Pending deliveries turn amber after (days)',
     'A Pickup / Dispatch bill still to give after this many days shows amber on Pending Deliveries.',
     143, 'system'),
    ('sales.delivery_old_days', 'SALES', 'Delivery', 'INT', '30', NULL,
     1, 365, 'COMPANY', 'Pending deliveries turn red and warn after (days)',
     'A bill still to give after this many days shows red on Pending Deliveries, and a new Sale Bill for that customer warns (never blocks).',
     144, 'system')
ON CONFLICT (asd_key) DO NOTHING;

-- The old hand-set flow (menu 226) is replaced by the computed status (D8).
UPDATE public.app_setting_def
   SET asd_is_active   = false,
       asd_modified_on = now(),
       asd_modified_by = '20261117100000_delivery_tracking'
 WHERE asd_key IN ('sales.delivery_status_tracking', 'sales.require_verification_before_dispatch')
   AND asd_is_active = true;


-- ── 12 · print purposes (DT-15; designs come in P5) ────────────────────────
INSERT INTO public.print_purpose
       (ppo_id, ppo_company_id, ppo_code, ppo_name, ppo_src_module, ppo_doc_type, ppo_copy_count,
        ppo_copy_labels, ppo_allow_reprint, ppo_sort_order, ppo_notes, ppo_is_active, ppo_is_deleted)
SELECT v.id, NULL, v.code, v.name, v.module, v.doc, v.copies, v.labels, true, v.sort, v.notes, true, false
  FROM (VALUES
        ('01a1df42-297f-72cb-8103-6474f4cf1e84'::uuid, 'GATE_PASS'::text, 'Gate Pass / Delivery Note'::text, 'SALES'::text,
         'DELIVERY_NOTE'::text, 2::smallint, 'GATE COPY,DRIVER / CUSTOMER COPY'::text, 45::smallint,
         'The Delivery Note (menu 305) printed as a gate pass: company, branch, godown, copy label, note no / date / vehicle / driver / loadmen / supervisor; lines (bill, customer, item, unit, qty, lot, kg), totals, what is still to come on the same bills, the came-back qty after a goods back; no prices; signature boxes; the note QR (NXD1-). docId = sdn_id, accYear = sdn_acc_year.'::text),
        ('01a1df42-297f-72de-b9de-b5798ca6a9b2', 'PICK_LIST', 'Pick List', 'SALES',
         'PENDING_DELIVERIES', 1, 'NA', 46,
         'Pending Deliveries (menu 304) Ctrl+P: the ticked bills'' open lines by godown, then item, with sums. No money.'),
        ('01a1df42-297f-72e4-be0a-e89394b8e6be', 'PENDING_DELIVERIES', 'Pending Deliveries (bill list)', 'SALES',
         'PENDING_DELIVERIES', 1, 'NA', 47,
         'Pending Deliveries (menu 304) F7: the bill list as filtered. No money.'),
        ('01a1df42-297f-72e9-adb9-ff7cd9fd0a8b', 'GODOWN_POSITION', 'Godown Stock Position', 'REPORT',
         'GODOWN_POSITION', 1, 'NA', 134,
         'Godown Stock Position (menu 306): the item x godown grid (physical, billed not delivered, owned, reserved, free to sell, challan out) and its tiles, today only.'),
        ('01a1df42-297f-72ee-9cc4-67ee10957dae', 'COUNT_SHEET', 'Count Sheet', 'STOCK',
         'GODOWN_POSITION', 1, 'NA', 135,
         'Godown Stock Position (menu 306) F7: item, godown, Physical and an empty Counted column, for a shelf count.')
       ) v(id, code, name, module, doc, copies, labels, sort, notes)
 WHERE NOT EXISTS (SELECT 1 FROM public.print_purpose p
                    WHERE p.ppo_id = v.id
                       OR (p.ppo_company_id IS NULL AND lower(p.ppo_code::text) = lower(v.code) AND p.ppo_is_deleted = false));


-- ── 13 · menus 304 / 305 / 306, 182 renamed, 226 hidden; rights ────────────
INSERT INTO fixed.menu_master
       (menu_id, menu_parent, menu_name, menu_alias, menu_visiblity, menu_position, menu_is_active,
        menu_separator, menu_verbs, menu_created_on, menu_modified_on)
SELECT v.id, v.parent, v.name, NULL, true, v.pos, true, false, v.verbs::text[], now(), now()
  FROM (VALUES (304, 1,   'Pending Deliveries',    40.00, '{VIEW,PRINT,EXPORT}'),
               (305, 1,   'Delivery Note',         41.00, '{VIEW,CREATE,EDIT,DELETE,PRINT,EXPORT,POST,CANCEL,OVERRIDE}'),
               (306, 300, 'Godown Stock Position', 30.00, '{VIEW,PRINT,EXPORT}')
       ) v(id, parent, name, pos, verbs)
 WHERE EXISTS (SELECT 1 FROM fixed.menu_master p WHERE p.menu_id = v.parent)
   AND NOT EXISTS (SELECT 1 FROM fixed.menu_master m WHERE m.menu_id = v.id);

-- The sequence never hands out a pinned id: GREATEST, so a box whose sequence
-- already ran past 306 is not wound back.
SELECT setval('fixed.menu_master_menu_id_seq',
              GREATEST((SELECT COALESCE(max(menu_id), 1) FROM fixed.menu_master),
                       (SELECT last_value FROM fixed.menu_master_menu_id_seq)));

-- Q2: label only, it stays hidden. D8: 226's hand-set status is retired.
UPDATE fixed.menu_master
   SET menu_name = 'Delivery Challan', menu_modified_on = now()
 WHERE menu_id = 182 AND menu_name = 'Deliver Note';
UPDATE fixed.menu_master
   SET menu_visiblity = false, menu_modified_on = now()
 WHERE menu_id = 226 AND menu_name = 'Delivery Status' AND menu_visiblity = true;

-- 304: each live 226 viewer, and (N1) each live Sales Bill (12) row that may
-- post; one row per user, the 226 row's creator first.
INSERT INTO public.user_menus
       (um_user_id, um_menu_id, um_can_view, um_can_create, um_can_edit, um_can_delete,
        um_can_print, um_can_export, um_visibility, um_is_favourite, um_is_pinned,
        um_sort_order, um_is_deleted, um_created_by, um_can_post, um_can_cancel,
        um_can_amend, um_can_override, um_can_retender)
SELECT DISTINCT ON (s.user_id)
       s.user_id, 304, true, false, false, false,
       true, true, true, false, false,
       0, false, s.created_by, false, false,
       false, false, false
  FROM (SELECT u.um_user_id AS user_id, u.um_created_by AS created_by, 1 AS src
          FROM public.user_menus u
         WHERE u.um_menu_id = 226 AND u.um_is_deleted = false AND u.um_can_view = true
        UNION ALL
        SELECT u.um_user_id, u.um_created_by, 2
          FROM public.user_menus u
         WHERE u.um_menu_id = 12 AND u.um_is_deleted = false AND u.um_can_post = true) s
 WHERE EXISTS (SELECT 1 FROM fixed.menu_master m WHERE m.menu_id = 304 AND m.menu_name = 'Pending Deliveries')
 ORDER BY s.user_id, s.src
ON CONFLICT (um_user_id, um_menu_id) DO NOTHING;

-- 305: the same users, every verb but override; override = their live
-- override on Godown Transfer (41) (Q18).
INSERT INTO public.user_menus
       (um_user_id, um_menu_id, um_can_view, um_can_create, um_can_edit, um_can_delete,
        um_can_print, um_can_export, um_visibility, um_is_favourite, um_is_pinned,
        um_sort_order, um_is_deleted, um_created_by, um_can_post, um_can_cancel,
        um_can_amend, um_can_override, um_can_retender)
SELECT DISTINCT ON (s.user_id)
       s.user_id, 305, true, true, true, true,
       true, true, true, false, false,
       0, false, s.created_by, true, true,
       false,
       COALESCE((SELECT g.um_can_override FROM public.user_menus g
                  WHERE g.um_user_id = s.user_id AND g.um_menu_id = 41 AND g.um_is_deleted = false), false),
       false
  FROM (SELECT u.um_user_id AS user_id, u.um_created_by AS created_by, 1 AS src
          FROM public.user_menus u
         WHERE u.um_menu_id = 226 AND u.um_is_deleted = false AND u.um_can_view = true
        UNION ALL
        SELECT u.um_user_id, u.um_created_by, 2
          FROM public.user_menus u
         WHERE u.um_menu_id = 12 AND u.um_is_deleted = false AND u.um_can_post = true) s
 WHERE EXISTS (SELECT 1 FROM fixed.menu_master m WHERE m.menu_id = 305 AND m.menu_name = 'Delivery Note')
 ORDER BY s.user_id, s.src
ON CONFLICT (um_user_id, um_menu_id) DO NOTHING;

-- 306: each live Stock Summary (302) row, its view / print / export.
INSERT INTO public.user_menus
       (um_user_id, um_menu_id, um_can_view, um_can_create, um_can_edit, um_can_delete,
        um_can_print, um_can_export, um_visibility, um_is_favourite, um_is_pinned,
        um_sort_order, um_is_deleted, um_created_by, um_can_post, um_can_cancel,
        um_can_amend, um_can_override, um_can_retender)
SELECT u.um_user_id, 306, u.um_can_view, false, false, false,
       u.um_can_print, u.um_can_export, u.um_visibility, false, false,
       0, false, u.um_created_by, false, false,
       false, false, false
  FROM public.user_menus u
 WHERE u.um_menu_id = 302
   AND u.um_is_deleted = false
   AND EXISTS (SELECT 1 FROM fixed.menu_master m WHERE m.menu_id = 306 AND m.menu_name = 'Godown Stock Position')
ON CONFLICT (um_user_id, um_menu_id) DO NOTHING;


-- ── 14 · table registry rows 632-634 (Db_Table_Master.sql carries the same) ─
INSERT INTO public.db_table_master
       (dtm_id, dtm_schema, dtm_table, dtm_parent_id, dtm_name, dtm_kind, dtm_module,
        dtm_col_prefix, dtm_sync_col, dtm_menu_id, dtm_write_mode, dtm_retention_days, dtm_is_active,
        dtm_description)
SELECT v.id, 'sales', v.tbl, v.parent, v.name, v.kind, 'SALES', v.prefix, v.sync_col,
       (SELECT m.menu_id FROM fixed.menu_master m WHERE m.menu_id = 305),
       v.write_mode, NULL, true, v.descr
  FROM (VALUES
        (632, 'sale_delivery_note'::text, NULL::integer, 'Delivery Note'::text, 'TRANSACTION'::text, 'sdn_'::text, 'sdn_sync_date'::text, 'EDITABLE'::text,
         'The Delivery Note / gate pass (menu 305): what physically left one godown against posted Pickup / Dispatch bills. Numbered per device.'::text),
        (633, 'sale_delivery_note_item', 632, 'Delivery Note Line', 'TRANSACTION', 'sdni_', 'sdni_sync_date', 'EDITABLE',
         'A bill line given on a Delivery Note: qty, the godown and lot actually given.'),
        (634, 'sale_delivery_event', NULL, 'Delivery Event', 'LEDGER', 'sde_', 'sde_sync_date', 'APPEND_ONLY',
         'Insert-only delivery events per bill line (GIVEN, CANCEL, GOODS_BACK, RETURN, RETURN_CANCEL, CLEANUP); billed not delivered = billed - SUM(settle).')
       ) v(id, tbl, parent, name, kind, prefix, sync_col, write_mode, descr)
 WHERE to_regclass('sales.' || v.tbl) IS NOT NULL
ON CONFLICT (dtm_id) DO NOTHING;

SELECT setval(pg_get_serial_sequence('public.db_table_master', 'dtm_id'),
              GREATEST((SELECT COALESCE(max(dtm_id), 1) FROM public.db_table_master),
                       (SELECT last_value FROM public.db_table_master_dtm_id_seq)));


-- ── 15 · audit screen 164 "Delivery Note" ──────────────────────────────────
-- screen_audit_sql is filled by the server on first write from
-- AUDIT_SCREEN_SQL_BY_NAME (nestjs-backend adds the 'Delivery Note' entry and
-- vchr_delivery_mode to 'Voucher Types').
INSERT INTO audit.audit_screen (screen_id, screen_name, screen_type, screen_status, screen_module)
SELECT 164, 'Delivery Note', 'transaction'::audit.audit_screen_type, true, 'SALES'
 WHERE NOT EXISTS (SELECT 1 FROM audit.audit_screen s WHERE s.screen_id = 164);

SELECT setval('audit.audit_screen_screen_id_seq',
              GREATEST((SELECT COALESCE(max(screen_id), 1) FROM audit.audit_screen),
                       (SELECT last_value FROM audit.audit_screen_screen_id_seq)));


-- ── 16 · grids 212-218 (Delivery_Grids_212_218.sql carries the same) ───────
INSERT INTO fixed.grid_details
       (grid_id, grid_name, grid_description, grid_sort_column, grid_sort_order, grid_device_type,
        grid_status, grid_is_deleted, grid_created_by, grid_sql)
VALUES
(212, 'MAIN LIST - PENDING DELIVERIES',
 'Pending Deliveries (menu 304) bill-wise list. One BILL row per posted Pickup / Dispatch bill with an eligible line still to give (pending = billed - settled, never stored; an over-given line counts too, shown negative), oldest first; then one DC row per posted delivery challan with open lines (sdi_open_qty > 0). No money. Tokens (send every one; '''' = no filter): icompany_id, ibranch_id, igodown_id (open lines of that godown; godown_names lists every godown still to give), icust_id, isalesman_id, iarea_ids (comma list of arm_id; NONE = customers with no area), imodes (''PICKUP,DISPATCH''), ichallans (''true'' = add the DC rows), iamber_days, iold_days (age_band NEW / AMBER / OLD; '''' = 7 / 30).',
 'doc_date', 'Ascending', 'Desktop', true, false, 'system',
$g212$WITH pl AS (
  SELECT b.sb_id, b.sb_acc_year, i.sbi_godown_id,
         i.sbi_bill_qty - COALESCE(ev.settled_qty, 0) AS pending_qty,
         CASE WHEN i.sbi_weight_qty > 0 AND i.sbi_bill_qty > 0 THEN i.sbi_weight_qty / i.sbi_bill_qty
              ELSE COALESCE(u.iuc_uom_weight, 0) END AS unit_kg,
         ('igodown_id' = '' OR i.sbi_godown_id::text = 'igodown_id') AS in_scope
    FROM sales.sale_bill b
    JOIN sales.sale_bill_item i ON i.sbi_bill_id = b.sb_id AND i.sbi_acc_year = b.sb_acc_year
    LEFT JOIN inventory.item_unit_conversion u ON u.iuc_id = i.sbi_item_unit_id
    LEFT JOIN LATERAL (SELECT SUM(e.sde_settle_qty) AS settled_qty
                         FROM sales.sale_delivery_event e
                        WHERE e.sde_bill_item_id = i.sbi_id
                          AND e.sde_bill_acc_year = i.sbi_acc_year
                          AND e.sde_is_deleted = false) ev ON true
   WHERE b.sb_company_id::text = 'icompany_id'
     AND b.sb_branch_id::text = 'ibranch_id'
     AND b.sb_is_deleted = false
     AND b.sb_status = 'POSTED'
     AND b.sb_delivery_mode IN ('PICKUP', 'DISPATCH')
     AND b.sb_delivery_status IN ('PENDING', 'PART', 'OUT')
     AND ('imodes' = '' OR b.sb_delivery_mode = ANY (string_to_array('imodes', ',')))
     AND ('icust_id' = '' OR b.sb_cust_id::text = 'icust_id')
     AND ('isalesman_id' = '' OR 'isalesman_id' = ANY (b.sb_salesman_id::text[]))
     AND i.sbi_is_deleted = false
     AND i.sbi_is_service = false
     AND COALESCE(i.sbi_src_doc_type, '') <> 'DELIVERY_CHALLAN'
     AND i.sbi_bill_qty > 0
),
ob AS (
  SELECT p.sb_id, p.sb_acc_year,
         count(*) FILTER (WHERE p.in_scope) AS open_lines,
         SUM(p.pending_qty) FILTER (WHERE p.in_scope) AS open_pkgs,
         SUM(p.pending_qty * p.unit_kg) FILTER (WHERE p.in_scope) AS open_kg,
         string_agg(DISTINCT g.gdl_name, ', ') AS godown_names,
         count(DISTINCT p.sbi_godown_id) AS godown_count
    FROM pl p
    LEFT JOIN inventory.godown_locations g ON g.gdl_id = p.sbi_godown_id
   WHERE p.pending_qty <> 0
   GROUP BY p.sb_id, p.sb_acc_year
  HAVING count(*) FILTER (WHERE p.in_scope) > 0
),
dl AS (
  SELECT d.sdc_id, d.sdc_acc_year,
         count(*) FILTER (WHERE di.sdi_open_qty > 0 AND ('igodown_id' = '' OR di.sdi_godown_id::text = 'igodown_id')) AS open_lines,
         SUM(di.sdi_open_qty) FILTER (WHERE di.sdi_open_qty > 0 AND ('igodown_id' = '' OR di.sdi_godown_id::text = 'igodown_id')) AS open_pkgs,
         SUM(di.sdi_open_qty * CASE WHEN di.sdi_weight_qty > 0 AND di.sdi_dc_qty > 0 THEN di.sdi_weight_qty / di.sdi_dc_qty
                                    ELSE COALESCE(u.iuc_uom_weight, 0) END)
             FILTER (WHERE di.sdi_open_qty > 0 AND ('igodown_id' = '' OR di.sdi_godown_id::text = 'igodown_id')) AS open_kg,
         SUM(di.sdi_dc_qty) AS total_pkgs,
         SUM(di.sdi_billed_qty) AS billed_pkgs,
         string_agg(DISTINCT g.gdl_name, ', ') FILTER (WHERE di.sdi_open_qty > 0) AS godown_names,
         count(DISTINCT di.sdi_godown_id) FILTER (WHERE di.sdi_open_qty > 0) AS godown_count
    FROM sales.sale_dc d
    JOIN sales.sale_dc_item di ON di.sdi_dc_id = d.sdc_id AND di.sdi_acc_year = d.sdc_acc_year
    LEFT JOIN inventory.item_unit_conversion u ON u.iuc_id = di.sdi_item_unit_id
    LEFT JOIN inventory.godown_locations g ON g.gdl_id = di.sdi_godown_id
   WHERE 'ichallans' = 'true'
     AND d.sdc_company_id::text = 'icompany_id'
     AND d.sdc_branch_id::text = 'ibranch_id'
     AND d.sdc_is_deleted = false
     AND d.sdc_status = 'POSTED'
     AND ('icust_id' = '' OR d.sdc_cust_id::text = 'icust_id')
     AND ('isalesman_id' = '' OR 'isalesman_id' = ANY (d.sdc_salesman_id::text[]))
     AND di.sdi_is_deleted = false
   GROUP BY d.sdc_id, d.sdc_acc_year
  HAVING count(*) FILTER (WHERE di.sdi_open_qty > 0 AND ('igodown_id' = '' OR di.sdi_godown_id::text = 'igodown_id')) > 0
),
lim AS (
  SELECT COALESCE(NULLIF('iamber_days', '')::integer, 7) AS amber_days,
         COALESCE(NULLIF('iold_days', '')::integer, 30) AS old_days
),
r AS (
  SELECT 'BILL' AS row_kind, 0 AS kind_sort,
         b.sb_id AS doc_id, b.sb_acc_year AS doc_acc_year, b.sb_company_id AS company_id, b.sb_branch_id AS branch_id,
         b.sb_bill_refno AS doc_refno, b.sb_bill_date AS doc_date,
         b.sb_cust_id AS cust_id, COALESCE(c.cus_name, b.sb_cust_name) AS cust_name,
         c.cus_area_id AS area_uuid, b.sb_salesman_id AS salesman_ids,
         b.sb_delivery_mode AS delivery_mode, b.sb_delivery_status AS delivery_status,
         ob.godown_names, ob.godown_count, ob.open_lines, ob.open_pkgs, ob.open_kg,
         COALESCE(lg.sde_src_refno || ' · ' || to_char(lg.sde_event_datetime AT TIME ZONE 'Asia/Kolkata', 'DD-MM-YYYY HH12:MI AM'), '') AS last_given,
         lg.sde_src_doc_id AS last_note_id, lg.sde_src_acc_year AS last_note_acc_year
    FROM ob
    JOIN sales.sale_bill b ON b.sb_id = ob.sb_id AND b.sb_acc_year = ob.sb_acc_year
    LEFT JOIN sales.customers c ON c.cus_id = b.sb_cust_id
    LEFT JOIN LATERAL (SELECT e.sde_src_refno, e.sde_event_datetime, e.sde_src_doc_id, e.sde_src_acc_year
                         FROM sales.sale_delivery_event e
                        WHERE e.sde_bill_id = b.sb_id
                          AND e.sde_bill_acc_year = b.sb_acc_year
                          AND e.sde_kind = 'GIVEN'
                          AND e.sde_is_deleted = false
                          AND NOT EXISTS (SELECT 1 FROM sales.sale_delivery_event x
                                           WHERE x.sde_reverses_id = e.sde_id
                                             AND x.sde_kind = 'CANCEL')
                        ORDER BY e.sde_event_datetime DESC, e.sde_created_on DESC
                        LIMIT 1) lg ON true
  UNION ALL
  SELECT 'DC', 1,
         d.sdc_id, d.sdc_acc_year, d.sdc_company_id, d.sdc_branch_id,
         d.sdc_dc_refno, d.sdc_dc_date,
         d.sdc_cust_id, COALESCE(c.cus_name, d.sdc_cust_name),
         c.cus_area_id, d.sdc_salesman_id,
         'DC', CASE WHEN dl.billed_pkgs > 0 THEN 'DC PART-BILLED' ELSE 'DC OPEN' END,
         dl.godown_names, dl.godown_count, dl.open_lines, dl.open_pkgs, dl.open_kg,
         'open ' || trim_scale(dl.open_pkgs) || ' of ' || trim_scale(dl.total_pkgs),
         NULL::uuid, NULL::character(9)
    FROM dl
    JOIN sales.sale_dc d ON d.sdc_id = dl.sdc_id AND d.sdc_acc_year = dl.sdc_acc_year
    LEFT JOIN sales.customers c ON c.cus_id = d.sdc_cust_id
)
SELECT r.row_kind, r.doc_id, r.doc_acc_year, r.company_id, r.branch_id,
       r.doc_refno, r.doc_date,
       (CURRENT_DATE - r.doc_date) AS days_old,
       CASE WHEN CURRENT_DATE - r.doc_date > lim.old_days THEN 'OLD'
            WHEN CURRENT_DATE - r.doc_date > lim.amber_days THEN 'AMBER'
            ELSE 'NEW' END AS age_band,
       r.cust_id, r.cust_name,
       COALESCE(a.arm_id::text, 'NONE') AS area_id, COALESCE(a.arm_name, '(no area)') AS area_name,
       COALESCE(ct.ctm_name, '') AS city_name,
       COALESCE(sm.names, '') AS salesman_names,
       r.delivery_mode, r.delivery_status,
       COALESCE(r.godown_names, '') AS godown_names, r.godown_count, r.open_lines,
       round(r.open_pkgs, 3) AS open_pkgs, round(COALESCE(r.open_kg, 0), 3) AS open_kg,
       r.last_given, r.last_note_id, r.last_note_acc_year
  FROM r
  CROSS JOIN lim
  LEFT JOIN sales.area_master a ON a.arm_id = r.area_uuid
  LEFT JOIN sales.city_master ct ON ct.ctm_id = a.arm_city_id
  LEFT JOIN LATERAL (SELECT string_agg(em.emp_name, ', ' ORDER BY em.emp_name) AS names
                       FROM public.employee_master em
                      WHERE em.emp_id = ANY (r.salesman_ids)) sm ON true
 WHERE ('iarea_ids' = '' OR COALESCE(a.arm_id::text, 'NONE') = ANY (string_to_array('iarea_ids', ',')))
 ORDER BY r.kind_sort, r.doc_date, r.doc_refno$g212$),
(213, 'PENDING DELIVERIES - BEATS',
 'Pending Deliveries (menu 304) beats tree: one row per city and area of the customers with something to give: bills, kg and ton of their open lines, and the open challans when ichallans = ''true''. NONE / (no area) for a customer with no area. Tokens as grid 212 without iarea_ids: icompany_id, ibranch_id, igodown_id, icust_id, isalesman_id, imodes, ichallans.',
 'city_name', 'Ascending', 'Desktop', true, false, 'system',
$g213$WITH pl AS (
  SELECT b.sb_id, b.sb_acc_year, b.sb_cust_id,
         i.sbi_bill_qty - COALESCE(ev.settled_qty, 0) AS pending_qty,
         CASE WHEN i.sbi_weight_qty > 0 AND i.sbi_bill_qty > 0 THEN i.sbi_weight_qty / i.sbi_bill_qty
              ELSE COALESCE(u.iuc_uom_weight, 0) END AS unit_kg
    FROM sales.sale_bill b
    JOIN sales.sale_bill_item i ON i.sbi_bill_id = b.sb_id AND i.sbi_acc_year = b.sb_acc_year
    LEFT JOIN inventory.item_unit_conversion u ON u.iuc_id = i.sbi_item_unit_id
    LEFT JOIN LATERAL (SELECT SUM(e.sde_settle_qty) AS settled_qty
                         FROM sales.sale_delivery_event e
                        WHERE e.sde_bill_item_id = i.sbi_id
                          AND e.sde_bill_acc_year = i.sbi_acc_year
                          AND e.sde_is_deleted = false) ev ON true
   WHERE b.sb_company_id::text = 'icompany_id'
     AND b.sb_branch_id::text = 'ibranch_id'
     AND b.sb_is_deleted = false
     AND b.sb_status = 'POSTED'
     AND b.sb_delivery_mode IN ('PICKUP', 'DISPATCH')
     AND b.sb_delivery_status IN ('PENDING', 'PART', 'OUT')
     AND ('imodes' = '' OR b.sb_delivery_mode = ANY (string_to_array('imodes', ',')))
     AND ('icust_id' = '' OR b.sb_cust_id::text = 'icust_id')
     AND ('isalesman_id' = '' OR 'isalesman_id' = ANY (b.sb_salesman_id::text[]))
     AND ('igodown_id' = '' OR i.sbi_godown_id::text = 'igodown_id')
     AND i.sbi_is_deleted = false
     AND i.sbi_is_service = false
     AND COALESCE(i.sbi_src_doc_type, '') <> 'DELIVERY_CHALLAN'
     AND i.sbi_bill_qty > 0
),
ob AS (
  SELECT p.sb_id, p.sb_cust_id, SUM(p.pending_qty * p.unit_kg) AS open_kg
    FROM pl p
   WHERE p.pending_qty <> 0
   GROUP BY p.sb_id, p.sb_acc_year, p.sb_cust_id
),
dl AS (
  SELECT d.sdc_id, d.sdc_cust_id,
         SUM(di.sdi_open_qty * CASE WHEN di.sdi_weight_qty > 0 AND di.sdi_dc_qty > 0 THEN di.sdi_weight_qty / di.sdi_dc_qty
                                    ELSE COALESCE(u.iuc_uom_weight, 0) END) AS open_kg
    FROM sales.sale_dc d
    JOIN sales.sale_dc_item di ON di.sdi_dc_id = d.sdc_id AND di.sdi_acc_year = d.sdc_acc_year
    LEFT JOIN inventory.item_unit_conversion u ON u.iuc_id = di.sdi_item_unit_id
   WHERE 'ichallans' = 'true'
     AND d.sdc_company_id::text = 'icompany_id'
     AND d.sdc_branch_id::text = 'ibranch_id'
     AND d.sdc_is_deleted = false
     AND d.sdc_status = 'POSTED'
     AND ('icust_id' = '' OR d.sdc_cust_id::text = 'icust_id')
     AND ('isalesman_id' = '' OR 'isalesman_id' = ANY (d.sdc_salesman_id::text[]))
     AND ('igodown_id' = '' OR di.sdi_godown_id::text = 'igodown_id')
     AND di.sdi_is_deleted = false
     AND di.sdi_open_qty > 0
   GROUP BY d.sdc_id, d.sdc_acc_year, d.sdc_cust_id
),
r AS (
  SELECT 'BILL' AS row_kind, ob.sb_cust_id AS cust_id, ob.open_kg FROM ob
  UNION ALL
  SELECT 'DC', dl.sdc_cust_id, dl.open_kg FROM dl
)
SELECT COALESCE(ct.ctm_id::text, 'NONE') AS city_id,
       COALESCE(ct.ctm_name, '(no city)') AS city_name,
       COALESCE(a.arm_id::text, 'NONE') AS area_id,
       COALESCE(a.arm_name, '(no area)') AS area_name,
       count(*) FILTER (WHERE r.row_kind = 'BILL') AS bill_count,
       round(COALESCE(SUM(r.open_kg) FILTER (WHERE r.row_kind = 'BILL'), 0), 3) AS open_kg,
       round(COALESCE(SUM(r.open_kg) FILTER (WHERE r.row_kind = 'BILL'), 0) / 1000, 2) AS open_ton,
       count(*) FILTER (WHERE r.row_kind = 'DC') AS dc_count,
       round(COALESCE(SUM(r.open_kg) FILTER (WHERE r.row_kind = 'DC'), 0), 3) AS dc_kg,
       min(ct.ctm_order) AS city_sort,
       min(a.arm_sort) AS area_sort
  FROM r
  LEFT JOIN sales.customers c ON c.cus_id = r.cust_id
  LEFT JOIN sales.area_master a ON a.arm_id = c.cus_area_id
  LEFT JOIN sales.city_master ct ON ct.ctm_id = a.arm_city_id
 GROUP BY 1, 2, 3, 4
 ORDER BY min(ct.ctm_order) NULLS LAST, 2, min(a.arm_sort) NULLS LAST, 4$g213$),
(214, 'PENDING DELIVERIES - ITEM-WISE',
 'Pending Deliveries (menu 304) Item-wise tab: one row per item and godown of the open lines: pending in the item''s selling unit (iuc_is_default_unit, else base), bills, kg, oldest days, on shelf (Physical = owned SALEABLE + billed not delivered, base / selling factor) and short (pending above the shelf). Tokens as grid 212: icompany_id, ibranch_id, igodown_id, icust_id, isalesman_id, iarea_ids, imodes.',
 'item_name', 'Ascending', 'Desktop', true, false, 'system',
$g214$WITH op AS (
  SELECT b.sb_id, b.sb_bill_date, b.sb_cust_id, b.sb_salesman_id, b.sb_delivery_mode,
         i.sbi_item_id, i.sbi_godown_id, i.sbi_bucket,
         i.sbi_bill_qty - COALESCE(ev.settled_qty, 0) AS pending_qty,
         CASE WHEN i.sbi_to_base_factor > 0 THEN i.sbi_to_base_factor
              ELSE COALESCE(NULLIF(u.iuc_to_base_factor, 0), 1) END AS base_factor,
         CASE WHEN i.sbi_weight_qty > 0 AND i.sbi_bill_qty > 0 THEN i.sbi_weight_qty / i.sbi_bill_qty
              ELSE COALESCE(u.iuc_uom_weight, 0) END AS unit_kg
    FROM sales.sale_bill b
    JOIN sales.sale_bill_item i ON i.sbi_bill_id = b.sb_id AND i.sbi_acc_year = b.sb_acc_year
    LEFT JOIN inventory.item_unit_conversion u ON u.iuc_id = i.sbi_item_unit_id
    LEFT JOIN LATERAL (SELECT SUM(e.sde_settle_qty) AS settled_qty
                         FROM sales.sale_delivery_event e
                        WHERE e.sde_bill_item_id = i.sbi_id
                          AND e.sde_bill_acc_year = i.sbi_acc_year
                          AND e.sde_is_deleted = false) ev ON true
   WHERE b.sb_company_id::text = 'icompany_id'
     AND b.sb_branch_id::text = 'ibranch_id'
     AND b.sb_is_deleted = false
     AND b.sb_status = 'POSTED'
     AND b.sb_delivery_mode IN ('PICKUP', 'DISPATCH')
     AND b.sb_delivery_status IN ('PENDING', 'PART', 'OUT')
     AND i.sbi_is_deleted = false
     AND i.sbi_is_service = false
     AND COALESCE(i.sbi_src_doc_type, '') <> 'DELIVERY_CHALLAN'
     AND i.sbi_bill_qty > 0
     AND i.sbi_bill_qty - COALESCE(ev.settled_qty, 0) <> 0
),
flt AS (
  SELECT o.*
    FROM op o
    LEFT JOIN sales.customers c ON c.cus_id = o.sb_cust_id
   WHERE ('igodown_id' = '' OR o.sbi_godown_id::text = 'igodown_id')
     AND ('imodes' = '' OR o.sb_delivery_mode = ANY (string_to_array('imodes', ',')))
     AND ('icust_id' = '' OR o.sb_cust_id::text = 'icust_id')
     AND ('isalesman_id' = '' OR 'isalesman_id' = ANY (o.sb_salesman_id::text[]))
     AND ('iarea_ids' = '' OR COALESCE(c.cus_area_id::text, 'NONE') = ANY (string_to_array('iarea_ids', ',')))
),
grp AS (
  SELECT f.sbi_item_id, f.sbi_godown_id,
         SUM(f.pending_qty * f.base_factor) AS pending_base,
         count(DISTINCT f.sb_id) AS bill_count,
         SUM(f.pending_qty * f.unit_kg) AS open_kg,
         MAX(CURRENT_DATE - f.sb_bill_date) AS oldest_days
    FROM flt f
   GROUP BY f.sbi_item_id, f.sbi_godown_id
),
bnd AS (
  SELECT o.sbi_item_id, o.sbi_godown_id, SUM(o.pending_qty * o.base_factor) AS bnd_base
    FROM op o
   WHERE o.sbi_bucket = 'SALEABLE'
   GROUP BY o.sbi_item_id, o.sbi_godown_id
),
own AS (
  SELECT s.sbl_item_id, s.sbl_godown_id, SUM(s.sbl_on_hand_qty) AS owned_base
    FROM stock.stock_balance s
   WHERE s.sbl_company_id::text = 'icompany_id'
     AND s.sbl_branch_id::text = 'ibranch_id'
     AND s.sbl_bucket = 'SALEABLE'
     AND s.sbl_is_deleted = false
     AND (s.sbl_item_id, s.sbl_godown_id) IN (SELECT g.sbi_item_id, g.sbi_godown_id FROM grp g)
   GROUP BY s.sbl_item_id, s.sbl_godown_id
)
SELECT g.sbi_item_id AS item_id,
       im.item_code,
       im.item_name_en AS item_name,
       g.sbi_godown_id AS godown_id,
       COALESCE(gd.gdl_name, '') AS godown_name,
       COALESCE(su.unit_name, bu.unit_name, '') AS unit_name,
       COALESCE(dfl.factor, 1) AS sell_factor,
       round(g.pending_base / COALESCE(dfl.factor, 1), 3) AS pending_qty,
       g.bill_count,
       round(g.open_kg, 3) AS open_kg,
       g.oldest_days,
       round((COALESCE(ow.owned_base, 0) + COALESCE(bd.bnd_base, 0)) / COALESCE(dfl.factor, 1), 3) AS on_shelf_qty,
       round(GREATEST(g.pending_base - COALESCE(ow.owned_base, 0) - COALESCE(bd.bnd_base, 0), 0) / COALESCE(dfl.factor, 1), 3) AS short_qty
  FROM grp g
  JOIN inventory.item_master im ON im.item_id = g.sbi_item_id
  LEFT JOIN inventory.godown_locations gd ON gd.gdl_id = g.sbi_godown_id
  LEFT JOIN bnd bd ON bd.sbi_item_id = g.sbi_item_id AND bd.sbi_godown_id = g.sbi_godown_id
  LEFT JOIN own ow ON ow.sbl_item_id = g.sbi_item_id AND ow.sbl_godown_id = g.sbi_godown_id
  LEFT JOIN LATERAL (SELECT COALESCE(NULLIF(x.iuc_to_base_factor, 0), 1) AS factor, x.iuc_unit_id
                       FROM inventory.item_unit_conversion x
                      WHERE x.iuc_item_id = g.sbi_item_id
                        AND x.iuc_is_default_unit = true
                        AND x.iuc_is_deleted = false
                      ORDER BY x.iuc_unit_slno
                      LIMIT 1) dfl ON true
  LEFT JOIN inventory.item_unit_master su ON su.unit_id = dfl.iuc_unit_id
  LEFT JOIN inventory.item_unit_master bu ON bu.unit_id = im.item_base_unit_id
 ORDER BY im.item_name_en, gd.gdl_name$g214$),
(215, 'PENDING DELIVERIES - OPEN LINES',
 'One bill''s eligible lines for Pending Deliveries (menu 304, OPEN LINES pane): billed, given (sum of out), pending (billed - settled), kg, and the last note that gave it (qty, refno, IST time, by). Tokens: icompany_id, ibill_id (sb_id), iacc_year (sb_acc_year).',
 'line_no', 'Ascending', 'Desktop', true, false, 'system',
$g215$SELECT i.sbi_id AS line_id,
       i.sbi_acc_year AS line_acc_year,
       i.sbi_line_no AS line_no,
       i.sbi_item_id AS item_id,
       im.item_code,
       im.item_name_en AS item_name,
       i.sbi_godown_id AS godown_id,
       COALESCE(gd.gdl_name, '') AS godown_name,
       i.sbi_lot_id AS lot_id,
       COALESCE(lt.slt_batch_no, '') AS lot_no,
       COALESCE(um.unit_name, '') AS unit_name,
       i.sbi_bill_qty AS billed_qty,
       COALESCE(ev.given_qty, 0) AS given_qty,
       i.sbi_bill_qty - COALESCE(ev.settled_qty, 0) AS pending_qty,
       round((i.sbi_bill_qty - COALESCE(ev.settled_qty, 0))
             * CASE WHEN i.sbi_weight_qty > 0 AND i.sbi_bill_qty > 0 THEN i.sbi_weight_qty / i.sbi_bill_qty
                    ELSE COALESCE(u.iuc_uom_weight, 0) END, 3) AS pending_kg,
       COALESCE(trim_scale(lg.sde_out_qty) || ' on ' || lg.sde_src_refno || ' · '
                || to_char(lg.sde_event_datetime AT TIME ZONE 'Asia/Kolkata', 'DD-MM-YYYY HH12:MI AM')
                || ' · ' || COALESCE(NULLIF(lu.usr_display_name, ''), lu.usr_login_name, lg.sde_created_by), '') AS given_on,
       lg.sde_src_doc_id AS last_note_id,
       lg.sde_src_acc_year AS last_note_acc_year,
       b.sb_id AS bill_id,
       b.sb_acc_year AS bill_acc_year
  FROM sales.sale_bill b
  JOIN sales.sale_bill_item i ON i.sbi_bill_id = b.sb_id AND i.sbi_acc_year = b.sb_acc_year
  JOIN inventory.item_master im ON im.item_id = i.sbi_item_id
  LEFT JOIN inventory.item_unit_conversion u ON u.iuc_id = i.sbi_item_unit_id
  LEFT JOIN inventory.item_unit_master um ON um.unit_id = u.iuc_unit_id
  LEFT JOIN inventory.godown_locations gd ON gd.gdl_id = i.sbi_godown_id
  LEFT JOIN stock.stock_lot lt ON lt.slt_id = i.sbi_lot_id
  LEFT JOIN LATERAL (SELECT SUM(e.sde_settle_qty) AS settled_qty, SUM(e.sde_out_qty) AS given_qty
                       FROM sales.sale_delivery_event e
                      WHERE e.sde_bill_item_id = i.sbi_id
                        AND e.sde_bill_acc_year = i.sbi_acc_year
                        AND e.sde_is_deleted = false) ev ON true
  LEFT JOIN LATERAL (SELECT e.sde_out_qty, e.sde_src_refno, e.sde_event_datetime, e.sde_created_by,
                            e.sde_src_doc_id, e.sde_src_acc_year
                       FROM sales.sale_delivery_event e
                      WHERE e.sde_bill_item_id = i.sbi_id
                        AND e.sde_bill_acc_year = i.sbi_acc_year
                        AND e.sde_kind = 'GIVEN'
                        AND e.sde_is_deleted = false
                        AND NOT EXISTS (SELECT 1 FROM sales.sale_delivery_event x
                                         WHERE x.sde_reverses_id = e.sde_id
                                           AND x.sde_kind = 'CANCEL')
                      ORDER BY e.sde_event_datetime DESC, e.sde_created_on DESC
                      LIMIT 1) lg ON true
  LEFT JOIN public.user_master lu ON lu.usr_id::text = lg.sde_created_by
 WHERE b.sb_company_id::text = 'icompany_id'
   AND b.sb_id::text = 'ibill_id'
   AND b.sb_acc_year = 'iacc_year'
   AND b.sb_is_deleted = false
   AND b.sb_status = 'POSTED'
   AND b.sb_delivery_mode IN ('PICKUP', 'DISPATCH')
   AND i.sbi_is_deleted = false
   AND i.sbi_is_service = false
   AND COALESCE(i.sbi_src_doc_type, '') <> 'DELIVERY_CHALLAN'
   AND i.sbi_bill_qty > 0
 ORDER BY i.sbi_line_no$g215$),
(216, 'MAIN LIST - DELIVERY NOTES',
 'Delivery Note list (menu 305, TxnMainView). Tokens (send every one; '''' = no bound / all): icompany_id, ibranch_id, ifrom_date, ito_date (yyyy-MM-dd, on sdn_date), igodown_id, istatus ('''' / DRAFT / POSTED / CANCELLED). Newest first.',
 'sdn_date', 'Descending', 'Desktop', true, false, 'system',
$g216$SELECT n.sdn_id,
       n.sdn_company_id,
       n.sdn_branch_id,
       n.sdn_acc_year,
       n.sdn_refno,
       n.sdn_date,
       COALESCE(g.gdl_name, '') AS godown_name,
       CASE n.sdn_mode WHEN 'SELF' THEN 'Self pickup'
                       WHEN 'VEHICLE' THEN 'Vehicle'
                       WHEN 'TRANSPORTER' THEN 'Transporter'
                       ELSE n.sdn_mode END AS sdn_mode_text,
       CASE n.sdn_mode WHEN 'SELF' THEN COALESCE(n.sdn_collected_by, '')
                       WHEN 'TRANSPORTER' THEN COALESCE(t.ttd_transporter_name, '')
                       ELSE COALESCE(NULLIF(n.sdn_vehicle_no, ''), v.veh_vehicle_no, '') END AS sdn_vehicle_text,
       n.sdn_bill_count,
       n.sdn_tot_lines,
       n.sdn_tot_qty,
       n.sdn_tot_weight_kg,
       n.sdn_status,
       n.sdn_print_count,
       COALESCE(NULLIF(u.usr_display_name, ''), u.usr_login_name, n.sdn_created_by) AS sdn_created_by_name,
       CASE WHEN n.sdn_posted_on IS NULL THEN ''
            ELSE to_char(n.sdn_posted_on AT TIME ZONE 'Asia/Kolkata', 'DD-MM-YYYY HH12:MI AM') END AS sdn_posted_at,
       n.sdn_mode,
       n.sdn_godown_id,
       n.sdn_device_id,
       n.sdn_slno
  FROM sales.sale_delivery_note n
  LEFT JOIN inventory.godown_locations g ON g.gdl_id = n.sdn_godown_id
  LEFT JOIN public.vehicle_master v ON v.veh_id = n.sdn_vehicle_id
  LEFT JOIN public.txn_transport_detail t ON t.ttd_doc_type = 'DELIVERY_NOTE'
                                         AND t.ttd_doc_id = n.sdn_id
                                         AND t.ttd_acc_year = n.sdn_acc_year
                                         AND t.ttd_is_deleted = false
  LEFT JOIN public.user_master u ON u.usr_id::text = n.sdn_created_by
 WHERE n.sdn_company_id::text = 'icompany_id'
   AND n.sdn_branch_id::text = 'ibranch_id'
   AND n.sdn_is_deleted = false
   AND (NULLIF('ifrom_date', '') IS NULL OR n.sdn_date::text >= 'ifrom_date')
   AND (NULLIF('ito_date', '') IS NULL OR n.sdn_date::text <= 'ito_date')
   AND ('igodown_id' = '' OR n.sdn_godown_id::text = 'igodown_id')
   AND ('istatus' = '' OR n.sdn_status = 'istatus')
 ORDER BY n.sdn_date DESC, n.sdn_created_on DESC$g216$),
(217, 'POPUP - DELIVERY NOTE PENDINGS',
 'Delivery Note (menu 305) F4: the bills with something still to give from ONE godown: lines, packages and kg here, and what waits in other godowns. Tokens: icompany_id, ibranch_id, igodown_id (required).',
 'sb_bill_date', 'Ascending', 'Desktop', true, false, 'system',
$g217$WITH op AS (
  SELECT b.sb_id, b.sb_acc_year, i.sbi_godown_id,
         (i.sbi_godown_id::text = 'igodown_id') AS is_here,
         i.sbi_bill_qty - COALESCE(ev.settled_qty, 0) AS pending_qty,
         CASE WHEN i.sbi_weight_qty > 0 AND i.sbi_bill_qty > 0 THEN i.sbi_weight_qty / i.sbi_bill_qty
              ELSE COALESCE(u.iuc_uom_weight, 0) END AS unit_kg
    FROM sales.sale_bill b
    JOIN sales.sale_bill_item i ON i.sbi_bill_id = b.sb_id AND i.sbi_acc_year = b.sb_acc_year
    LEFT JOIN inventory.item_unit_conversion u ON u.iuc_id = i.sbi_item_unit_id
    LEFT JOIN LATERAL (SELECT SUM(e.sde_settle_qty) AS settled_qty
                         FROM sales.sale_delivery_event e
                        WHERE e.sde_bill_item_id = i.sbi_id
                          AND e.sde_bill_acc_year = i.sbi_acc_year
                          AND e.sde_is_deleted = false) ev ON true
   WHERE b.sb_company_id::text = 'icompany_id'
     AND b.sb_branch_id::text = 'ibranch_id'
     AND b.sb_is_deleted = false
     AND b.sb_status = 'POSTED'
     AND b.sb_delivery_mode IN ('PICKUP', 'DISPATCH')
     AND b.sb_delivery_status IN ('PENDING', 'PART', 'OUT')
     AND i.sbi_is_deleted = false
     AND i.sbi_is_service = false
     AND COALESCE(i.sbi_src_doc_type, '') <> 'DELIVERY_CHALLAN'
     AND i.sbi_bill_qty > 0
     AND i.sbi_bill_qty - COALESCE(ev.settled_qty, 0) > 0
),
ob AS (
  SELECT o.sb_id, o.sb_acc_year,
         count(*) FILTER (WHERE o.is_here) AS lines_here,
         SUM(o.pending_qty) FILTER (WHERE o.is_here) AS pkgs_here,
         SUM(o.pending_qty * o.unit_kg) FILTER (WHERE o.is_here) AS kg_here,
         count(*) FILTER (WHERE NOT o.is_here) AS lines_elsewhere,
         string_agg(DISTINCT g.gdl_name, ', ') FILTER (WHERE NOT o.is_here) AS godowns_elsewhere
    FROM op o
    LEFT JOIN inventory.godown_locations g ON g.gdl_id = o.sbi_godown_id
   GROUP BY o.sb_id, o.sb_acc_year
  HAVING count(*) FILTER (WHERE o.is_here) > 0
)
SELECT b.sb_id,
       b.sb_acc_year,
       b.sb_bill_refno,
       b.sb_bill_date,
       (CURRENT_DATE - b.sb_bill_date) AS days_old,
       b.sb_cust_id,
       COALESCE(c.cus_name, b.sb_cust_name) AS cust_name,
       COALESCE(a.arm_name, '(no area)') AS area_name,
       b.sb_delivery_mode,
       b.sb_delivery_status,
       ob.lines_here,
       round(ob.pkgs_here, 3) AS pkgs_here,
       round(COALESCE(ob.kg_here, 0), 3) AS kg_here,
       ob.lines_elsewhere,
       CASE WHEN ob.lines_elsewhere = 0 THEN ''
            WHEN ob.lines_elsewhere = 1 THEN '1 line in ' || ob.godowns_elsewhere
            ELSE ob.lines_elsewhere || ' lines in ' || ob.godowns_elsewhere END AS elsewhere_text
  FROM ob
  JOIN sales.sale_bill b ON b.sb_id = ob.sb_id AND b.sb_acc_year = ob.sb_acc_year
  LEFT JOIN sales.customers c ON c.cus_id = b.sb_cust_id
  LEFT JOIN sales.area_master a ON a.arm_id = c.cus_area_id
 ORDER BY b.sb_bill_date, b.sb_bill_refno$g217$),
(218, 'POPUP - BILL DELIVERIES',
 'One bill''s delivery events (the Sale Bill''s DELIVERY chip): when (IST, 12-hour), what, the note or return, line, item, qty settled and qty out of the godown, unit, godown, lot, by, reason. Tokens: icompany_id, ibill_id (sb_id), iacc_year (sb_acc_year).',
 'event_sort', 'Ascending', 'Desktop', true, false, 'system',
$g218$SELECT e.sde_id,
       e.sde_acc_year,
       to_char(e.sde_event_datetime AT TIME ZONE 'Asia/Kolkata', 'DD-MM-YYYY HH12:MI AM') AS event_at,
       e.sde_kind,
       CASE e.sde_kind WHEN 'GIVEN' THEN 'Given'
                       WHEN 'CANCEL' THEN 'Note cancelled'
                       WHEN 'GOODS_BACK' THEN 'Goods back'
                       WHEN 'RETURN' THEN 'Returned, never taken'
                       WHEN 'RETURN_CANCEL' THEN 'Return cancelled'
                       WHEN 'CLEANUP' THEN 'Marked delivered at go-live'
                       ELSE e.sde_kind END AS kind_text,
       COALESCE(e.sde_src_refno, '') AS src_refno,
       e.sde_src_doc_type,
       e.sde_src_doc_id,
       e.sde_src_acc_year,
       e.sde_bill_line_no AS line_no,
       im.item_name_en AS item_name,
       e.sde_settle_qty AS qty,
       e.sde_out_qty AS out_qty,
       COALESCE(um.unit_name, '') AS unit_name,
       COALESCE(gd.gdl_name, '') AS godown_name,
       COALESCE(lt.slt_batch_no, '') AS lot_no,
       COALESCE(NULLIF(u.usr_display_name, ''), u.usr_login_name, e.sde_created_by) AS by_name,
       COALESCE(e.sde_reason, '') AS reason,
       e.sde_bill_item_id,
       to_char(e.sde_event_datetime AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD HH24:MI:SS') AS event_sort
  FROM sales.sale_delivery_event e
  JOIN sales.sale_bill_item i ON i.sbi_id = e.sde_bill_item_id AND i.sbi_acc_year = e.sde_bill_acc_year
  JOIN inventory.item_master im ON im.item_id = e.sde_item_id
  LEFT JOIN inventory.item_unit_conversion iu ON iu.iuc_id = i.sbi_item_unit_id
  LEFT JOIN inventory.item_unit_master um ON um.unit_id = iu.iuc_unit_id
  LEFT JOIN inventory.godown_locations gd ON gd.gdl_id = e.sde_godown_id
  LEFT JOIN stock.stock_lot lt ON lt.slt_id = e.sde_lot_id
  LEFT JOIN public.user_master u ON u.usr_id::text = e.sde_created_by
 WHERE e.sde_company_id::text = 'icompany_id'
   AND e.sde_bill_id::text = 'ibill_id'
   AND e.sde_bill_acc_year = 'iacc_year'
   AND e.sde_is_deleted = false
 ORDER BY e.sde_event_datetime, e.sde_created_on, e.sde_bill_line_no$g218$)
ON CONFLICT (grid_id) DO NOTHING;

INSERT INTO fixed.grid_columns
       (grid_column_id, grid_id, grid_column_number, grid_column_name, grid_column_sql_field_name,
        grid_column_data_type, grid_column_width, grid_column_position, grid_column_alignment,
        grid_column_visibility, grid_column_filter, grid_column_group, grid_column_total,
        grid_column_notes, grid_column_is_deleted, grid_column_created_by)
SELECT v.id, v.grid, v.no, v.name, v.fld, v.typ, v.width, v.no, v.align, v.visible, v.filter,
       false, false, v.fld, false, 'system'
  FROM (VALUES
    -- 212 MAIN LIST - PENDING DELIVERIES
    ('01a1e1d0-2120-7000-8000-000000212001'::uuid, 212::bigint, 1::integer, 'Kind'::text, 'row_kind'::text, 'Text'::text, 0.00::numeric, 'Left'::text, false::boolean, false::boolean),
    ('01a1e1d0-2120-7000-8000-000000212002', 212, 2, '#', 'doc_id', 'Text', 0.00, 'Left', false, false),
    ('01a1e1d0-2120-7000-8000-000000212003', 212, 3, 'Year', 'doc_acc_year', 'Text', 0.00, 'Left', false, false),
    ('01a1e1d0-2120-7000-8000-000000212004', 212, 4, 'Company', 'company_id', 'Text', 0.00, 'Left', false, false),
    ('01a1e1d0-2120-7000-8000-000000212005', 212, 5, 'Branch', 'branch_id', 'Text', 0.00, 'Left', false, false),
    ('01a1e1d0-2120-7000-8000-000000212006', 212, 6, 'Bill no', 'doc_refno', 'Text', 10.00, 'Left', true, true),
    ('01a1e1d0-2120-7000-8000-000000212007', 212, 7, 'Date', 'doc_date', 'Date', 7.00, 'Left', true, false),
    ('01a1e1d0-2120-7000-8000-000000212008', 212, 8, 'Days', 'days_old', 'Number', 4.00, 'Right', true, false),
    ('01a1e1d0-2120-7000-8000-000000212009', 212, 9, 'Age band', 'age_band', 'Text', 0.00, 'Left', false, false),
    ('01a1e1d0-2120-7000-8000-000000212010', 212, 10, 'Customer id', 'cust_id', 'Text', 0.00, 'Left', false, false),
    ('01a1e1d0-2120-7000-8000-000000212011', 212, 11, 'Customer', 'cust_name', 'Text', 13.00, 'Left', true, true),
    ('01a1e1d0-2120-7000-8000-000000212012', 212, 12, 'Area id', 'area_id', 'Text', 0.00, 'Left', false, false),
    ('01a1e1d0-2120-7000-8000-000000212013', 212, 13, 'Area', 'area_name', 'Text', 8.00, 'Left', true, true),
    ('01a1e1d0-2120-7000-8000-000000212014', 212, 14, 'City', 'city_name', 'Text', 0.00, 'Left', false, true),
    ('01a1e1d0-2120-7000-8000-000000212015', 212, 15, 'Salesman', 'salesman_names', 'Text', 6.00, 'Left', true, true),
    ('01a1e1d0-2120-7000-8000-000000212016', 212, 16, 'Mode', 'delivery_mode', 'Text', 7.00, 'Center', true, false),
    ('01a1e1d0-2120-7000-8000-000000212017', 212, 17, 'Status', 'delivery_status', 'Text', 8.00, 'Center', true, false),
    ('01a1e1d0-2120-7000-8000-000000212018', 212, 18, 'Godowns', 'godown_names', 'Text', 10.00, 'Left', true, true),
    ('01a1e1d0-2120-7000-8000-000000212019', 212, 19, 'Godown count', 'godown_count', 'Number', 0.00, 'Right', false, false),
    ('01a1e1d0-2120-7000-8000-000000212020', 212, 20, 'Lines', 'open_lines', 'Number', 4.00, 'Right', true, false),
    ('01a1e1d0-2120-7000-8000-000000212021', 212, 21, 'Pkgs', 'open_pkgs', 'Number', 4.00, 'Right', true, false),
    ('01a1e1d0-2120-7000-8000-000000212022', 212, 22, 'Kg', 'open_kg', 'Number', 6.00, 'Right', true, false),
    ('01a1e1d0-2120-7000-8000-000000212023', 212, 23, 'Last given', 'last_given', 'Text', 13.00, 'Left', true, false),
    ('01a1e1d0-2120-7000-8000-000000212024', 212, 24, 'Last note', 'last_note_id', 'Text', 0.00, 'Left', false, false),
    ('01a1e1d0-2120-7000-8000-000000212025', 212, 25, 'Last note year', 'last_note_acc_year', 'Text', 0.00, 'Left', false, false),
    -- 213 PENDING DELIVERIES - BEATS
    ('01a1e1d0-2130-7000-8000-000000213001', 213, 1, 'City id', 'city_id', 'Text', 0.00, 'Left', false, false),
    ('01a1e1d0-2130-7000-8000-000000213002', 213, 2, 'City', 'city_name', 'Text', 35.00, 'Left', true, true),
    ('01a1e1d0-2130-7000-8000-000000213003', 213, 3, 'Area id', 'area_id', 'Text', 0.00, 'Left', false, false),
    ('01a1e1d0-2130-7000-8000-000000213004', 213, 4, 'Area', 'area_name', 'Text', 35.00, 'Left', true, true),
    ('01a1e1d0-2130-7000-8000-000000213005', 213, 5, 'Bills', 'bill_count', 'Number', 10.00, 'Right', true, false),
    ('01a1e1d0-2130-7000-8000-000000213006', 213, 6, 'Kg', 'open_kg', 'Number', 0.00, 'Right', false, false),
    ('01a1e1d0-2130-7000-8000-000000213007', 213, 7, 'Ton', 'open_ton', 'Number', 10.00, 'Right', true, false),
    ('01a1e1d0-2130-7000-8000-000000213008', 213, 8, 'Challans', 'dc_count', 'Number', 10.00, 'Right', true, false),
    ('01a1e1d0-2130-7000-8000-000000213009', 213, 9, 'Challan kg', 'dc_kg', 'Number', 0.00, 'Right', false, false),
    ('01a1e1d0-2130-7000-8000-000000213010', 213, 10, 'City sort', 'city_sort', 'Number', 0.00, 'Right', false, false),
    ('01a1e1d0-2130-7000-8000-000000213011', 213, 11, 'Area sort', 'area_sort', 'Number', 0.00, 'Right', false, false),
    -- 214 PENDING DELIVERIES - ITEM-WISE
    ('01a1e1d0-2140-7000-8000-000000214001', 214, 1, 'Item id', 'item_id', 'Text', 0.00, 'Left', false, false),
    ('01a1e1d0-2140-7000-8000-000000214002', 214, 2, 'Code', 'item_code', 'Text', 8.00, 'Left', true, true),
    ('01a1e1d0-2140-7000-8000-000000214003', 214, 3, 'Item', 'item_name', 'Text', 28.00, 'Left', true, true),
    ('01a1e1d0-2140-7000-8000-000000214004', 214, 4, 'Godown id', 'godown_id', 'Text', 0.00, 'Left', false, false),
    ('01a1e1d0-2140-7000-8000-000000214005', 214, 5, 'Godown', 'godown_name', 'Text', 10.00, 'Left', true, true),
    ('01a1e1d0-2140-7000-8000-000000214006', 214, 6, 'Unit', 'unit_name', 'Text', 5.00, 'Left', true, false),
    ('01a1e1d0-2140-7000-8000-000000214007', 214, 7, 'Selling factor', 'sell_factor', 'Number', 0.00, 'Right', false, false),
    ('01a1e1d0-2140-7000-8000-000000214008', 214, 8, 'Pending', 'pending_qty', 'Number', 9.00, 'Right', true, false),
    ('01a1e1d0-2140-7000-8000-000000214009', 214, 9, 'Bills', 'bill_count', 'Number', 6.00, 'Right', true, false),
    ('01a1e1d0-2140-7000-8000-000000214010', 214, 10, 'Kg', 'open_kg', 'Number', 9.00, 'Right', true, false),
    ('01a1e1d0-2140-7000-8000-000000214011', 214, 11, 'Oldest', 'oldest_days', 'Number', 7.00, 'Right', true, false),
    ('01a1e1d0-2140-7000-8000-000000214012', 214, 12, 'On shelf', 'on_shelf_qty', 'Number', 9.00, 'Right', true, false),
    ('01a1e1d0-2140-7000-8000-000000214013', 214, 13, 'Short', 'short_qty', 'Number', 9.00, 'Right', true, false),
    -- 215 PENDING DELIVERIES - OPEN LINES
    ('01a1e1d0-2150-7000-8000-000000215001', 215, 1, 'Line id', 'line_id', 'Text', 0.00, 'Left', false, false),
    ('01a1e1d0-2150-7000-8000-000000215002', 215, 2, 'Line year', 'line_acc_year', 'Text', 0.00, 'Left', false, false),
    ('01a1e1d0-2150-7000-8000-000000215003', 215, 3, '#', 'line_no', 'Number', 3.00, 'Right', true, false),
    ('01a1e1d0-2150-7000-8000-000000215004', 215, 4, 'Item id', 'item_id', 'Text', 0.00, 'Left', false, false),
    ('01a1e1d0-2150-7000-8000-000000215005', 215, 5, 'Code', 'item_code', 'Text', 0.00, 'Left', false, true),
    ('01a1e1d0-2150-7000-8000-000000215006', 215, 6, 'Item', 'item_name', 'Text', 28.00, 'Left', true, true),
    ('01a1e1d0-2150-7000-8000-000000215007', 215, 7, 'Godown id', 'godown_id', 'Text', 0.00, 'Left', false, false),
    ('01a1e1d0-2150-7000-8000-000000215008', 215, 8, 'Godown', 'godown_name', 'Text', 9.00, 'Left', true, false),
    ('01a1e1d0-2150-7000-8000-000000215009', 215, 9, 'Lot id', 'lot_id', 'Text', 0.00, 'Left', false, false),
    ('01a1e1d0-2150-7000-8000-000000215010', 215, 10, 'Lot', 'lot_no', 'Text', 8.00, 'Left', true, false),
    ('01a1e1d0-2150-7000-8000-000000215011', 215, 11, 'Unit', 'unit_name', 'Text', 4.00, 'Left', true, false),
    ('01a1e1d0-2150-7000-8000-000000215012', 215, 12, 'Billed', 'billed_qty', 'Number', 6.00, 'Right', true, false),
    ('01a1e1d0-2150-7000-8000-000000215013', 215, 13, 'Given', 'given_qty', 'Number', 6.00, 'Right', true, false),
    ('01a1e1d0-2150-7000-8000-000000215014', 215, 14, 'Pending', 'pending_qty', 'Number', 7.00, 'Right', true, false),
    ('01a1e1d0-2150-7000-8000-000000215015', 215, 15, 'Kg', 'pending_kg', 'Number', 7.00, 'Right', true, false),
    ('01a1e1d0-2150-7000-8000-000000215016', 215, 16, 'Given on', 'given_on', 'Text', 22.00, 'Left', true, false),
    ('01a1e1d0-2150-7000-8000-000000215017', 215, 17, 'Last note', 'last_note_id', 'Text', 0.00, 'Left', false, false),
    ('01a1e1d0-2150-7000-8000-000000215018', 215, 18, 'Last note year', 'last_note_acc_year', 'Text', 0.00, 'Left', false, false),
    ('01a1e1d0-2150-7000-8000-000000215019', 215, 19, 'Bill id', 'bill_id', 'Text', 0.00, 'Left', false, false),
    ('01a1e1d0-2150-7000-8000-000000215020', 215, 20, 'Bill year', 'bill_acc_year', 'Text', 0.00, 'Left', false, false),
    -- 216 MAIN LIST - DELIVERY NOTES
    ('01a1e1d0-2160-7000-8000-000000216001', 216, 1, '#', 'sdn_id', 'Text', 0.00, 'Left', false, false),
    ('01a1e1d0-2160-7000-8000-000000216002', 216, 2, 'Company', 'sdn_company_id', 'Text', 0.00, 'Left', false, false),
    ('01a1e1d0-2160-7000-8000-000000216003', 216, 3, 'Branch', 'sdn_branch_id', 'Text', 0.00, 'Left', false, false),
    ('01a1e1d0-2160-7000-8000-000000216004', 216, 4, 'Year', 'sdn_acc_year', 'Text', 0.00, 'Left', false, false),
    ('01a1e1d0-2160-7000-8000-000000216005', 216, 5, 'Note No', 'sdn_refno', 'Text', 14.00, 'Left', true, true),
    ('01a1e1d0-2160-7000-8000-000000216006', 216, 6, 'Date', 'sdn_date', 'Date', 8.00, 'Left', true, false),
    ('01a1e1d0-2160-7000-8000-000000216007', 216, 7, 'Godown', 'godown_name', 'Text', 10.00, 'Left', true, true),
    ('01a1e1d0-2160-7000-8000-000000216008', 216, 8, 'Mode', 'sdn_mode_text', 'Text', 8.00, 'Left', true, false),
    ('01a1e1d0-2160-7000-8000-000000216009', 216, 9, 'Vehicle / collected by', 'sdn_vehicle_text', 'Text', 12.00, 'Left', true, true),
    ('01a1e1d0-2160-7000-8000-000000216010', 216, 10, 'Bills', 'sdn_bill_count', 'Number', 5.00, 'Right', true, false),
    ('01a1e1d0-2160-7000-8000-000000216011', 216, 11, 'Lines', 'sdn_tot_lines', 'Number', 5.00, 'Right', true, false),
    ('01a1e1d0-2160-7000-8000-000000216012', 216, 12, 'Pkgs', 'sdn_tot_qty', 'Number', 6.00, 'Right', true, false),
    ('01a1e1d0-2160-7000-8000-000000216013', 216, 13, 'Kg', 'sdn_tot_weight_kg', 'Number', 7.00, 'Right', true, false),
    ('01a1e1d0-2160-7000-8000-000000216014', 216, 14, 'Status', 'sdn_status', 'Text', 8.00, 'Center', true, false),
    ('01a1e1d0-2160-7000-8000-000000216015', 216, 15, 'Prints', 'sdn_print_count', 'Number', 4.00, 'Center', true, false),
    ('01a1e1d0-2160-7000-8000-000000216016', 216, 16, 'By', 'sdn_created_by_name', 'Text', 13.00, 'Left', true, false),
    ('01a1e1d0-2160-7000-8000-000000216017', 216, 17, 'Posted at', 'sdn_posted_at', 'Text', 0.00, 'Left', false, false),
    ('01a1e1d0-2160-7000-8000-000000216018', 216, 18, 'Mode code', 'sdn_mode', 'Text', 0.00, 'Left', false, false),
    ('01a1e1d0-2160-7000-8000-000000216019', 216, 19, 'Godown id', 'sdn_godown_id', 'Text', 0.00, 'Left', false, false),
    ('01a1e1d0-2160-7000-8000-000000216020', 216, 20, 'Device', 'sdn_device_id', 'Text', 0.00, 'Left', false, false),
    ('01a1e1d0-2160-7000-8000-000000216021', 216, 21, 'Slno', 'sdn_slno', 'Number', 0.00, 'Right', false, false),
    -- 217 POPUP - DELIVERY NOTE PENDINGS
    ('01a1e1d0-2170-7000-8000-000000217001', 217, 1, '#', 'sb_id', 'Text', 0.00, 'Left', false, false),
    ('01a1e1d0-2170-7000-8000-000000217002', 217, 2, 'Year', 'sb_acc_year', 'Text', 0.00, 'Left', false, false),
    ('01a1e1d0-2170-7000-8000-000000217003', 217, 3, 'Bill no', 'sb_bill_refno', 'Text', 15.00, 'Left', true, true),
    ('01a1e1d0-2170-7000-8000-000000217004', 217, 4, 'Date', 'sb_bill_date', 'Date', 12.00, 'Left', true, false),
    ('01a1e1d0-2170-7000-8000-000000217005', 217, 5, 'Days', 'days_old', 'Number', 5.00, 'Right', true, false),
    ('01a1e1d0-2170-7000-8000-000000217006', 217, 6, 'Customer id', 'sb_cust_id', 'Text', 0.00, 'Left', false, false),
    ('01a1e1d0-2170-7000-8000-000000217007', 217, 7, 'Customer', 'cust_name', 'Text', 17.00, 'Left', true, true),
    ('01a1e1d0-2170-7000-8000-000000217008', 217, 8, 'Area', 'area_name', 'Text', 11.00, 'Left', true, true),
    ('01a1e1d0-2170-7000-8000-000000217009', 217, 9, 'Mode', 'sb_delivery_mode', 'Text', 10.00, 'Center', true, false),
    ('01a1e1d0-2170-7000-8000-000000217010', 217, 10, 'Status', 'sb_delivery_status', 'Text', 0.00, 'Center', false, false),
    ('01a1e1d0-2170-7000-8000-000000217011', 217, 11, 'Lines here', 'lines_here', 'Number', 9.00, 'Right', true, false),
    ('01a1e1d0-2170-7000-8000-000000217012', 217, 12, 'Pkgs here', 'pkgs_here', 'Number', 0.00, 'Right', false, false),
    ('01a1e1d0-2170-7000-8000-000000217013', 217, 13, 'Kg here', 'kg_here', 'Number', 9.00, 'Right', true, false),
    ('01a1e1d0-2170-7000-8000-000000217014', 217, 14, 'Lines elsewhere', 'lines_elsewhere', 'Number', 0.00, 'Right', false, false),
    ('01a1e1d0-2170-7000-8000-000000217015', 217, 15, 'Elsewhere', 'elsewhere_text', 'Text', 12.00, 'Left', true, false),
    -- 218 POPUP - BILL DELIVERIES
    ('01a1e1d0-2180-7000-8000-000000218001', 218, 1, '#', 'sde_id', 'Text', 0.00, 'Left', false, false),
    ('01a1e1d0-2180-7000-8000-000000218002', 218, 2, 'Year', 'sde_acc_year', 'Text', 0.00, 'Left', false, false),
    ('01a1e1d0-2180-7000-8000-000000218003', 218, 3, 'When', 'event_at', 'Text', 13.00, 'Left', true, false),
    ('01a1e1d0-2180-7000-8000-000000218004', 218, 4, 'Kind', 'sde_kind', 'Text', 0.00, 'Left', false, false),
    ('01a1e1d0-2180-7000-8000-000000218005', 218, 5, 'What', 'kind_text', 'Text', 12.00, 'Left', true, true),
    ('01a1e1d0-2180-7000-8000-000000218006', 218, 6, 'Note / return', 'src_refno', 'Text', 14.00, 'Left', true, true),
    ('01a1e1d0-2180-7000-8000-000000218007', 218, 7, 'Source type', 'sde_src_doc_type', 'Text', 0.00, 'Left', false, false),
    ('01a1e1d0-2180-7000-8000-000000218008', 218, 8, 'Source id', 'sde_src_doc_id', 'Text', 0.00, 'Left', false, false),
    ('01a1e1d0-2180-7000-8000-000000218009', 218, 9, 'Source year', 'sde_src_acc_year', 'Text', 0.00, 'Left', false, false),
    ('01a1e1d0-2180-7000-8000-000000218010', 218, 10, 'Line', 'line_no', 'Number', 4.00, 'Right', true, false),
    ('01a1e1d0-2180-7000-8000-000000218011', 218, 11, 'Item', 'item_name', 'Text', 18.00, 'Left', true, true),
    ('01a1e1d0-2180-7000-8000-000000218012', 218, 12, 'Qty', 'qty', 'Number', 6.00, 'Right', true, false),
    ('01a1e1d0-2180-7000-8000-000000218013', 218, 13, 'Out qty', 'out_qty', 'Number', 0.00, 'Right', false, false),
    ('01a1e1d0-2180-7000-8000-000000218014', 218, 14, 'Unit', 'unit_name', 'Text', 4.00, 'Left', true, false),
    ('01a1e1d0-2180-7000-8000-000000218015', 218, 15, 'Godown', 'godown_name', 'Text', 8.00, 'Left', true, false),
    ('01a1e1d0-2180-7000-8000-000000218016', 218, 16, 'Lot', 'lot_no', 'Text', 6.00, 'Left', true, false),
    ('01a1e1d0-2180-7000-8000-000000218017', 218, 17, 'By', 'by_name', 'Text', 8.00, 'Left', true, false),
    ('01a1e1d0-2180-7000-8000-000000218018', 218, 18, 'Reason', 'reason', 'Text', 7.00, 'Left', true, false),
    ('01a1e1d0-2180-7000-8000-000000218019', 218, 19, 'Bill line id', 'sde_bill_item_id', 'Text', 0.00, 'Left', false, false),
    ('01a1e1d0-2180-7000-8000-000000218020', 218, 20, 'Sort', 'event_sort', 'Text', 0.00, 'Left', false, false)
       ) v(id, grid, no, name, fld, typ, width, align, visible, filter)
 WHERE EXISTS (SELECT 1 FROM fixed.grid_details d
                WHERE d.grid_id = v.grid
                  AND d.grid_name IN ('MAIN LIST - PENDING DELIVERIES', 'PENDING DELIVERIES - BEATS',
                                      'PENDING DELIVERIES - ITEM-WISE', 'PENDING DELIVERIES - OPEN LINES',
                                      'MAIN LIST - DELIVERY NOTES', 'POPUP - DELIVERY NOTE PENDINGS',
                                      'POPUP - BILL DELIVERIES'))
   AND NOT EXISTS (SELECT 1 FROM fixed.grid_columns e
                    WHERE e.grid_id = v.grid AND e.grid_column_number = v.no AND e.grid_column_is_deleted = false)
ON CONFLICT (grid_column_id) DO NOTHING;
SELECT setval('fixed.grid_details_grid_id_seq',
              GREATEST((SELECT COALESCE(max(grid_id), 1) FROM fixed.grid_details),
                       (SELECT last_value FROM fixed.grid_details_grid_id_seq)));

-- Grid 86 "TXN MAIN LIST - BILLS": the delivery status and mode after
-- sb_created_by, and the idelivery filter before the final ORDER BY. Done as
-- two anchored edits, each only when its anchor is there exactly once and
-- the field is not in yet, so a site's own edits elsewhere in the SQL stay.
-- '' or a key the caller does not send = every bill (the literal token is
-- not a status), else exactly that status.
DO $g86$
DECLARE
    v_sql text;
BEGIN
    SELECT grid_sql INTO v_sql FROM fixed.grid_details
     WHERE grid_id = 86 AND grid_name = 'TXN MAIN LIST - BILLS';
    IF v_sql IS NULL OR position('sb_delivery_status' IN v_sql) > 0 THEN
        RETURN;
    END IF;
    IF (SELECT count(*) FROM regexp_matches(v_sql, 'b\.sb_created_by,', 'g')) <> 1
       OR (SELECT count(*) FROM regexp_matches(v_sql, '\sORDER BY\s+b\.sb_bill_date DESC', 'g')) <> 1 THEN
        RAISE NOTICE 'Delivery tracking P1: grid 86 SQL is not as shipped; the delivery columns were not added. Add sb_delivery_status, sb_delivery_mode and the idelivery filter by hand.';
        RETURN;
    END IF;
    v_sql := regexp_replace(v_sql, 'b\.sb_created_by,',
                            E'b.sb_created_by,\n       b.sb_delivery_status,\n       b.sb_delivery_mode,');
    v_sql := regexp_replace(v_sql, '(\s)ORDER BY(\s+)b\.sb_bill_date DESC',
                            E'\n  \tAND (''idelivery'' NOT IN (''NA'', ''PENDING'', ''PART'', ''OUT'', ''DELIVERED'', ''RETURNED'') OR b.sb_delivery_status = ''idelivery'')\\1ORDER BY\\2b.sb_bill_date DESC');
    UPDATE fixed.grid_details
       SET grid_sql = v_sql, grid_modified_by = 'system', grid_modified_on = now()
     WHERE grid_id = 86;
END $g86$;

-- The columns: "Delivery" right after Status, "Delivery mode" hidden at the
-- end. As now (Status 12, Prints 13, By 14, Print design 15) the columns from
-- 13 on move one place right; otherwise both go to the end.
DO $c86$
DECLARE
    v_as_now boolean;
    v_pos    numeric(12,2);
    v_last   numeric(12,2);
BEGIN
    IF NOT EXISTS (SELECT 1 FROM fixed.grid_details
                    WHERE grid_id = 86 AND position('b.sb_delivery_status' IN grid_sql) > 0)
       OR EXISTS (SELECT 1 FROM fixed.grid_columns
                   WHERE grid_column_id IN ('01a1e1d0-0860-7000-8000-000000086016', '01a1e1d0-0860-7000-8000-000000086017')) THEN
        RETURN;
    END IF;
    v_as_now := EXISTS (SELECT 1 FROM fixed.grid_columns
                         WHERE grid_id = 86 AND grid_column_sql_field_name = 'sb_status'
                           AND grid_column_position = 12 AND grid_column_is_deleted = false)
            AND NOT EXISTS (SELECT 1 FROM fixed.grid_columns
                             WHERE grid_id = 86 AND grid_column_position = 13 AND grid_column_is_deleted = false
                               AND grid_column_sql_field_name <> 'sb_print_count');
    IF v_as_now THEN
        UPDATE fixed.grid_columns
           SET grid_column_position    = grid_column_position + 1,
               grid_column_modified_by = 'system',
               grid_column_modified_on = now()
         WHERE grid_id = 86
           AND grid_column_position >= 13;
        v_pos := 13;
    ELSE
        SELECT COALESCE(max(grid_column_position), 0) + 1 INTO v_pos FROM fixed.grid_columns WHERE grid_id = 86;
        RAISE NOTICE 'Delivery tracking P1: grid 86 layout is not as shipped; Delivery goes to position %.', v_pos;
    END IF;
    SELECT GREATEST(COALESCE(max(grid_column_position), 0), v_pos) + 1 INTO v_last FROM fixed.grid_columns WHERE grid_id = 86;

    INSERT INTO fixed.grid_columns
        (grid_column_id, grid_id, grid_column_number, grid_column_name, grid_column_sql_field_name,
         grid_column_data_type, grid_column_width, grid_column_position, grid_column_alignment,
         grid_column_visibility, grid_column_filter, grid_column_group, grid_column_total,
         grid_column_notes, grid_column_is_deleted, grid_column_created_by, grid_column_created_on)
    VALUES
        ('01a1e1d0-0860-7000-8000-000000086016', 86, 16, 'Delivery', 'sb_delivery_status',
         'Text', 9.00, v_pos, 'center',
         true, false, false, false,
         'sb_delivery_status', false, 'system', now()),
        ('01a1e1d0-0860-7000-8000-000000086017', 86, 17, 'Delivery mode', 'sb_delivery_mode',
         'Text', 9.00, v_last, 'left',
         false, false, false, false,
         'sb_delivery_mode', false, 'system', now());
END $c86$;


-- ── 17 · ui_tables 80-86 and their columns; columns on 22 / 28 / 74 / 78 ────
INSERT INTO fixed.ui_tables
       (ui_tbl_id, ui_tbl_name, ui_tbl_editable, ui_tbl_device_type, ui_tbl_is_active, ui_tbl_is_deleted, ui_tbl_created_by)
VALUES (80, 'PENDING DELIVERIES - BILLS', false, 'Desktop', true, false, 'system'),
       (81, 'PENDING DELIVERIES - ITEMS', false, 'Desktop', true, false, 'system'),
       (82, 'PENDING DELIVERIES - OPEN LINES', false, 'Desktop', true, false, 'system'),
       (83, 'DELIVERY NOTE - LINES', true, 'Desktop', true, false, 'system'),
       (84, 'GODOWN POSITION - ROWS', false, 'Desktop', true, false, 'system'),
       (85, 'GODOWN POSITION - BEHIND', false, 'Desktop', true, false, 'system'),
       (86, 'DELIVERY NOTE - GOODS BACK', true, 'Desktop', true, false, 'system')
ON CONFLICT (ui_tbl_id) DO NOTHING;

INSERT INTO fixed.ui_table_columns
       (ui_tbl_clm_id, ui_tbl_clm_table_id, ui_tbl_clm_no, ui_tbl_clm_name, ui_tbl_clm_column_width,
        ui_tbl_clm_column_visibility, ui_tbl_clm_column_focus, ui_tbl_clm_column_position,
        ui_tbl_clm_column_necessity, ui_tbl_clm_is_active, ui_tbl_clm_is_deleted, ui_tbl_clm_created_by)
SELECT v.id, v.tbl, v.no, v.name, v.width, v.visible, v.focus, v.pos, false, true, false, 'system'
  FROM (VALUES
        (2652::bigint, 80::bigint, 0::bigint, ''::text, 2.48::numeric, true::boolean, false::boolean, 0::integer),
        (2653, 80,  1, 'Bill no', 10.09, true, false, 1),
        (2654, 80,  2, 'Date', 6.61, true, false, 2),
        (2655, 80,  3, 'Days', 3.64, true, false, 3),
        (2656, 80,  4, 'Customer', 12.39, true, false, 4),
        (2657, 80,  5, 'Area', 7.60, true, false, 5),
        (2658, 80,  6, 'Salesman', 5.78, true, false, 6),
        (2659, 80,  7, 'Mode', 6.94, true, false, 7),
        (2660, 80,  8, 'Status', 7.60, true, false, 8),
        (2661, 80,  9, 'Godowns', 10.58, true, false, 9),
        (2662, 80, 10, 'Lines', 3.80, true, false, 10),
        (2663, 80, 11, 'Pkgs', 3.80, true, false, 11),
        (2664, 80, 12, 'Kg', 5.78, true, false, 12),
        (2665, 80, 13, 'Last given', 9.91, true, false, 13),
        (2666, 80, 14, 'RowKind', 0.00, false, false, 14),
        (2667, 80, 15, 'DocId', 0.00, false, false, 15),
        (2668, 80, 16, 'AccYear', 0.00, false, false, 16),
        (2669, 80, 17, 'CustId', 0.00, false, false, 17),
        (2670, 80, 18, 'AreaId', 0.00, false, false, 18),
        (2671, 80, 19, 'City', 0.00, false, false, 19),
        (2672, 80, 20, 'GodownCount', 0.00, false, false, 20),
        (2673, 80, 21, 'AgeBand', 0.00, false, false, 21),
        (2674, 80, 22, 'LastNoteId', 0.00, false, false, 22),
        (2675, 80, 23, 'LastNoteYear', 0.00, false, false, 23),
        (2676, 81,  0, 'Item', 33.84, true, false, 0),
        (2677, 81,  1, 'Godown', 10.37, true, false, 1),
        (2678, 81,  2, 'Unit', 4.74, true, false, 2),
        (2679, 81,  3, 'Pending', 7.44, true, false, 3),
        (2680, 81,  4, 'Bills', 4.96, true, false, 4),
        (2681, 81,  5, 'Kg', 7.90, true, false, 5),
        (2682, 81,  6, 'Oldest', 6.32, true, false, 6),
        (2683, 81,  7, 'On shelf', 7.90, true, false, 7),
        (2684, 81,  8, 'Short', 13.53, true, false, 8),
        (2685, 81,  9, 'ItemId', 0.00, false, false, 9),
        (2686, 81, 10, 'GodownId', 0.00, false, false, 10),
        (2687, 81, 11, 'ItemCode', 0.00, false, false, 11),
        (2688, 82,  0, '#', 2.81, true, false, 0),
        (2689, 82,  1, 'Item', 29.75, true, false, 1),
        (2690, 82,  2, 'Godown', 8.59, true, false, 2),
        (2691, 82,  3, 'Lot', 7.44, true, false, 3),
        (2692, 82,  4, 'Unit', 3.80, true, false, 4),
        (2693, 82,  5, 'Billed', 5.78, true, false, 5),
        (2694, 82,  6, 'Given', 5.78, true, false, 6),
        (2695, 82,  7, 'Pending', 6.28, true, false, 7),
        (2696, 82,  8, 'Kg', 6.28, true, false, 8),
        (2697, 82,  9, 'Given on', 20.49, true, false, 9),
        (2698, 82, 10, 'LineId', 0.00, false, false, 10),
        (2699, 82, 11, 'ItemId', 0.00, false, false, 11),
        (2700, 82, 12, 'GodownId', 0.00, false, false, 12),
        (2701, 82, 13, 'LotId', 0.00, false, false, 13),
        (2702, 83,  0, '#', 2.49, true, false, 0),
        (2703, 83,  1, 'Item', 23.25, true, false, 1),
        (2704, 83,  2, 'Lot', 10.96, true, true, 2),
        (2705, 83,  3, 'Godown', 12.46, true, true, 3),
        (2706, 83,  4, 'Unit', 3.49, true, false, 4),
        (2707, 83,  5, 'Billed', 4.32, true, false, 5),
        (2708, 83,  6, 'Given', 4.15, true, false, 6),
        (2709, 83,  7, 'Pending', 4.98, true, false, 7),
        (2710, 83,  8, 'Give now', 6.15, true, true, 8),
        (2711, 83,  9, 'Came back', 4.98, true, false, 9),
        (2712, 83, 10, 'Kg', 5.15, true, false, 10),
        (2713, 83, 11, '', 14.62, true, false, 11),
        (2714, 83, 12, 'SdniId', 0.00, false, false, 12),
        (2715, 83, 13, 'BillId', 0.00, false, false, 13),
        (2716, 83, 14, 'BillAccYear', 0.00, false, false, 14),
        (2717, 83, 15, 'BillItemId', 0.00, false, false, 15),
        (2718, 83, 16, 'BillLineNo', 0.00, false, false, 16),
        (2719, 83, 17, 'BillRefno', 0.00, false, false, 17),
        (2720, 83, 18, 'ItemId', 0.00, false, false, 18),
        (2721, 83, 19, 'UnitId', 0.00, false, false, 19),
        (2722, 83, 20, 'ToBaseFactor', 0.00, false, false, 20),
        (2723, 83, 21, 'BillGodownId', 0.00, false, false, 21),
        (2724, 83, 22, 'GodownId', 0.00, false, false, 22),
        (2725, 83, 23, 'BillLotId', 0.00, false, false, 23),
        (2726, 83, 24, 'LotId', 0.00, false, false, 24),
        (2727, 83, 25, 'Bucket', 0.00, false, false, 25),
        (2728, 83, 26, 'BaseQty', 0.00, false, false, 26),
        (2729, 83, 27, 'ScannedQty', 0.00, false, false, 27),
        (2730, 83, 28, 'OtherGodownOk', 0.00, false, false, 28),
        (2731, 83, 29, 'ShelfQty', 0.00, false, false, 29),
        (2732, 83, 30, 'Remarks', 0.00, false, false, 30),
        (2733, 83, 31, 'UnitKg', 0.00, false, false, 31),
        (2734, 84,  0, 'Code', 7.60, true, false, 0),
        (2735, 84,  1, 'Item', 19.02, true, false, 1),
        (2736, 84,  2, 'Godown', 6.29, true, false, 2),
        (2737, 84,  3, 'Unit', 2.75, true, false, 3),
        (2738, 84,  4, 'Physical', 6.03, true, false, 4),
        (2739, 84,  5, 'Billed not delivered', 5.64, true, false, 5),
        (2740, 84,  6, 'Owned', 4.85, true, false, 6),
        (2741, 84,  7, 'Reserved', 4.98, true, false, 7),
        (2742, 84,  8, 'Free to sell', 4.85, true, false, 8),
        (2743, 84,  9, 'On vehicle', 5.24, true, false, 9),
        (2744, 84, 10, 'Challan out', 5.90, true, false, 10),
        (2745, 84, 11, 'Physical kg', 5.37, true, false, 11),
        (2746, 84, 12, 'Last given', 18.48, true, false, 12),
        (2747, 84, 13, 'ItemId', 0.00, false, false, 13),
        (2748, 84, 14, 'GodownId', 0.00, false, false, 14),
        (2749, 84, 15, 'LastNoteId', 0.00, false, false, 15),
        (2750, 84, 16, 'LastNoteYear', 0.00, false, false, 16),
        (2751, 84, 17, 'Short', 0.00, false, false, 17),
        (2752, 84, 18, 'OverGiven', 0.00, false, false, 18),
        (2753, 84, 19, 'Tie', 0.00, false, false, 19),
        (2754, 85,  0, 'Bill no', 12.73, true, false, 0),
        (2755, 85,  1, 'Date', 8.48, true, false, 1),
        (2756, 85,  2, 'Days', 4.65, true, false, 2),
        (2757, 85,  3, 'Customer', 13.14, true, false, 3),
        (2758, 85,  4, 'Area', 8.49, true, false, 4),
        (2759, 85,  5, 'Mode', 8.49, true, false, 5),
        (2760, 85,  6, 'Lot', 8.49, true, false, 6),
        (2761, 85,  7, 'Billed', 6.26, true, false, 7),
        (2762, 85,  8, 'Given', 5.86, true, false, 8),
        (2763, 85,  9, 'Pending', 7.07, true, false, 9),
        (2764, 85, 10, 'Last given', 13.34, true, false, 10),
        (2765, 85, 11, 'Kind', 0.00, false, false, 11),
        (2766, 85, 12, 'DocId', 0.00, false, false, 12),
        (2767, 85, 13, 'AccYear', 0.00, false, false, 13),
        (2768, 85, 14, 'LotId', 0.00, false, false, 14),
        (2769, 86,  0, '#', 2.00, true, false, 0),
        (2770, 86,  1, 'Bill', 8.00, true, false, 1),
        (2771, 86,  2, 'Customer', 7.00, true, false, 2),
        (2772, 86,  3, 'Item', 16.00, true, false, 3),
        (2773, 86,  4, 'Unit', 3.00, true, false, 4),
        (2774, 86,  5, 'Lot', 5.30, true, false, 5),
        (2775, 86,  6, 'Given', 3.90, true, false, 6),
        (2776, 86,  7, 'Back before', 5.70, true, false, 7),
        (2777, 86,  8, 'Came back', 6.00, true, true, 8),
        (2778, 86,  9, 'Still given', 6.00, true, false, 9),
        (2779, 86, 10, 'SdniId', 0.00, false, false, 10),
        (2780, 86, 11, 'MaxBack', 0.00, false, false, 11)
       ) v(id, tbl, no, name, width, visible, focus, pos)
 WHERE EXISTS (SELECT 1 FROM fixed.ui_tables t
                WHERE t.ui_tbl_id = v.tbl
                  AND t.ui_tbl_name IN ('PENDING DELIVERIES - BILLS', 'PENDING DELIVERIES - ITEMS',
                                        'PENDING DELIVERIES - OPEN LINES', 'DELIVERY NOTE - LINES',
                                        'GODOWN POSITION - ROWS', 'GODOWN POSITION - BEHIND',
                                        'DELIVERY NOTE - GOODS BACK'))
   AND NOT EXISTS (SELECT 1 FROM fixed.ui_table_columns e
                    WHERE e.ui_tbl_clm_table_id = v.tbl AND e.ui_tbl_clm_no = v.no AND e.ui_tbl_clm_is_deleted = false)
ON CONFLICT (ui_tbl_clm_id) DO NOTHING;
-- 22 SALE BILL - LINES: 101 "Delivered" right after 100 Returned (read only).
-- 28 PHYSICAL STOCK - LINES (addendum §4.2): 30 Not delivered, 31 Physical,
--    32 Shelf counted (the focus stop) at 13 / 14 / 15; 12 Counted Qty hidden,
--    no focus, at 16; the rest move up three. Positions 0-12 stay.
-- 74 SALE RETURN - LINES (addendum §4.2): 38 To give at 8, Qty (8) at 9, 39
--    Not taken (focus) at 10; 9-37 move up two. Positions 0-7 stay.
-- 78 STOCK SUMMARY - ITEMS: 17 Not delivered, 18 Physical after Closing (8);
--    9-16 move up two.
-- Positions are a rank. Each table is changed only while it is laid out and
-- the new column is not there yet; a fresh database gets the rows from
-- Ui_Table_Columns.sql instead. After that, the shown widths of each changed
-- table are scaled back to 100.00 (answer Q4; see the header).
DO $ui$
DECLARE
    v_pos    integer;
    v_done   integer[] := '{}';
    r        record;
    v_ids    bigint[];
    v_new    numeric;
    v_fixed  numeric;
    v_old    numeric;
    v_factor numeric;
    v_rest   numeric;
BEGIN
    -- 22
    IF EXISTS (SELECT 1 FROM fixed.ui_tables WHERE ui_tbl_id = 22 AND ui_tbl_name = 'SALE BILL - LINES')
       AND EXISTS (SELECT 1 FROM fixed.ui_table_columns
                    WHERE ui_tbl_clm_table_id = 22 AND ui_tbl_clm_no = 100 AND ui_tbl_clm_is_deleted = false)
       AND NOT EXISTS (SELECT 1 FROM fixed.ui_table_columns
                        WHERE ui_tbl_clm_table_id = 22 AND ui_tbl_clm_no = 101 AND ui_tbl_clm_is_deleted = false) THEN
        SELECT ui_tbl_clm_column_position + 1 INTO v_pos
          FROM fixed.ui_table_columns
         WHERE ui_tbl_clm_table_id = 22 AND ui_tbl_clm_no = 100 AND ui_tbl_clm_is_deleted = false
         LIMIT 1;
        UPDATE fixed.ui_table_columns
           SET ui_tbl_clm_column_position = ui_tbl_clm_column_position + 1,
               ui_tbl_clm_modified_on = now(), ui_tbl_clm_modified_by = 'system'
         WHERE ui_tbl_clm_table_id = 22 AND ui_tbl_clm_is_deleted = false
           AND ui_tbl_clm_column_position >= v_pos;
        INSERT INTO fixed.ui_table_columns
               (ui_tbl_clm_id, ui_tbl_clm_table_id, ui_tbl_clm_no, ui_tbl_clm_name, ui_tbl_clm_column_width,
                ui_tbl_clm_column_visibility, ui_tbl_clm_column_focus, ui_tbl_clm_column_position,
                ui_tbl_clm_column_necessity, ui_tbl_clm_is_active, ui_tbl_clm_is_deleted, ui_tbl_clm_created_by)
        VALUES (2781, 22, 101, 'Delivered', 3.80, true, false, v_pos, false, true, false, 'system')
        ON CONFLICT (ui_tbl_clm_id) DO NOTHING;
        v_done := v_done || 22;
    END IF;

    -- 28
    IF EXISTS (SELECT 1 FROM fixed.ui_tables WHERE ui_tbl_id = 28 AND ui_tbl_name = 'PHYSICAL STOCK - LINES')
       AND EXISTS (SELECT 1 FROM fixed.ui_table_columns
                    WHERE ui_tbl_clm_table_id = 28 AND ui_tbl_clm_no = 12 AND ui_tbl_clm_is_deleted = false)
       AND NOT EXISTS (SELECT 1 FROM fixed.ui_table_columns
                        WHERE ui_tbl_clm_table_id = 28 AND ui_tbl_clm_no IN (30, 31, 32) AND ui_tbl_clm_is_deleted = false) THEN
        UPDATE fixed.ui_table_columns
           SET ui_tbl_clm_column_position = ui_tbl_clm_column_position + 3,
               ui_tbl_clm_modified_on = now(), ui_tbl_clm_modified_by = 'system'
         WHERE ui_tbl_clm_table_id = 28 AND ui_tbl_clm_is_deleted = false
           AND ui_tbl_clm_column_position >= 13;
        UPDATE fixed.ui_table_columns
           SET ui_tbl_clm_column_position   = 16,
               ui_tbl_clm_column_visibility = false,
               ui_tbl_clm_column_focus      = false,
               ui_tbl_clm_modified_on = now(), ui_tbl_clm_modified_by = 'system'
         WHERE ui_tbl_clm_table_id = 28 AND ui_tbl_clm_no = 12 AND ui_tbl_clm_is_deleted = false;
        INSERT INTO fixed.ui_table_columns
               (ui_tbl_clm_id, ui_tbl_clm_table_id, ui_tbl_clm_no, ui_tbl_clm_name, ui_tbl_clm_column_width,
                ui_tbl_clm_column_visibility, ui_tbl_clm_column_focus, ui_tbl_clm_column_position,
                ui_tbl_clm_column_necessity, ui_tbl_clm_is_active, ui_tbl_clm_is_deleted, ui_tbl_clm_created_by)
        VALUES (2782, 28, 30, 'Not delivered', 6.92, true, false, 13, false, true, false, 'system'),
               (2783, 28, 31, 'Physical',      6.92, true, false, 14, false, true, false, 'system'),
               (2784, 28, 32, 'Shelf counted', 6.92, true, true,  15, false, true, false, 'system')
        ON CONFLICT (ui_tbl_clm_id) DO NOTHING;
        v_done := v_done || 28;
    END IF;

    -- 74
    IF EXISTS (SELECT 1 FROM fixed.ui_tables WHERE ui_tbl_id = 74 AND ui_tbl_name = 'SALE RETURN - LINES')
       AND EXISTS (SELECT 1 FROM fixed.ui_table_columns
                    WHERE ui_tbl_clm_table_id = 74 AND ui_tbl_clm_no = 8 AND ui_tbl_clm_is_deleted = false)
       AND NOT EXISTS (SELECT 1 FROM fixed.ui_table_columns
                        WHERE ui_tbl_clm_table_id = 74 AND ui_tbl_clm_no IN (38, 39) AND ui_tbl_clm_is_deleted = false) THEN
        UPDATE fixed.ui_table_columns
           SET ui_tbl_clm_column_position = ui_tbl_clm_column_position + 2,
               ui_tbl_clm_modified_on = now(), ui_tbl_clm_modified_by = 'system'
         WHERE ui_tbl_clm_table_id = 74 AND ui_tbl_clm_is_deleted = false
           AND ui_tbl_clm_column_position >= 8 AND ui_tbl_clm_no <> 8;
        UPDATE fixed.ui_table_columns
           SET ui_tbl_clm_column_position = 9,
               ui_tbl_clm_modified_on = now(), ui_tbl_clm_modified_by = 'system'
         WHERE ui_tbl_clm_table_id = 74 AND ui_tbl_clm_no = 8 AND ui_tbl_clm_is_deleted = false;
        INSERT INTO fixed.ui_table_columns
               (ui_tbl_clm_id, ui_tbl_clm_table_id, ui_tbl_clm_no, ui_tbl_clm_name, ui_tbl_clm_column_width,
                ui_tbl_clm_column_visibility, ui_tbl_clm_column_focus, ui_tbl_clm_column_position,
                ui_tbl_clm_column_necessity, ui_tbl_clm_is_active, ui_tbl_clm_is_deleted, ui_tbl_clm_created_by)
        VALUES (2785, 74, 38, 'To give',   4.00, true, false,  8, false, true, false, 'system'),
               (2786, 74, 39, 'Not taken', 4.60, true, true,  10, false, true, false, 'system')
        ON CONFLICT (ui_tbl_clm_id) DO NOTHING;
        v_done := v_done || 74;
    END IF;

    -- 78
    IF EXISTS (SELECT 1 FROM fixed.ui_tables WHERE ui_tbl_id = 78 AND ui_tbl_name = 'STOCK SUMMARY - ITEMS')
       AND EXISTS (SELECT 1 FROM fixed.ui_table_columns
                    WHERE ui_tbl_clm_table_id = 78 AND ui_tbl_clm_no = 8 AND ui_tbl_clm_is_deleted = false)
       AND NOT EXISTS (SELECT 1 FROM fixed.ui_table_columns
                        WHERE ui_tbl_clm_table_id = 78 AND ui_tbl_clm_no IN (17, 18) AND ui_tbl_clm_is_deleted = false) THEN
        SELECT ui_tbl_clm_column_position + 1 INTO v_pos
          FROM fixed.ui_table_columns
         WHERE ui_tbl_clm_table_id = 78 AND ui_tbl_clm_no = 8 AND ui_tbl_clm_is_deleted = false
         LIMIT 1;
        UPDATE fixed.ui_table_columns
           SET ui_tbl_clm_column_position = ui_tbl_clm_column_position + 2,
               ui_tbl_clm_modified_on = now(), ui_tbl_clm_modified_by = 'system'
         WHERE ui_tbl_clm_table_id = 78 AND ui_tbl_clm_is_deleted = false
           AND ui_tbl_clm_column_position >= v_pos;
        INSERT INTO fixed.ui_table_columns
               (ui_tbl_clm_id, ui_tbl_clm_table_id, ui_tbl_clm_no, ui_tbl_clm_name, ui_tbl_clm_column_width,
                ui_tbl_clm_column_visibility, ui_tbl_clm_column_focus, ui_tbl_clm_column_position,
                ui_tbl_clm_column_necessity, ui_tbl_clm_is_active, ui_tbl_clm_is_deleted, ui_tbl_clm_created_by)
        VALUES (2787, 78, 17, 'Not delivered', 6.00, true, false, v_pos,     false, true, false, 'system'),
               (2788, 78, 18, 'Physical',      5.40, true, false, v_pos + 1, false, true, false, 'system')
        ON CONFLICT (ui_tbl_clm_id) DO NOTHING;
        v_done := v_done || 78;
    END IF;

    -- Q4: the shown widths back to 100.00, only for the tables changed above.
    FOR r IN SELECT * FROM (VALUES (22, ARRAY[101]::bigint[]), (28, ARRAY[30, 31, 32]::bigint[]),
                                   (74, ARRAY[38, 39]::bigint[]), (78, ARRAY[17, 18]::bigint[])) v(tbl, new_nos)
              WHERE v.tbl = ANY (v_done)
    LOOP
        SELECT COALESCE(sum(c.ui_tbl_clm_column_width) FILTER (WHERE c.ui_tbl_clm_no = ANY (r.new_nos)), 0),
               COALESCE(sum(c.ui_tbl_clm_column_width) FILTER (WHERE NOT c.ui_tbl_clm_no = ANY (r.new_nos) AND c.ui_tbl_clm_column_width <= 3.00), 0),
               COALESCE(sum(c.ui_tbl_clm_column_width) FILTER (WHERE NOT c.ui_tbl_clm_no = ANY (r.new_nos) AND c.ui_tbl_clm_column_width > 3.00), 0),
               array_agg(c.ui_tbl_clm_id) FILTER (WHERE NOT c.ui_tbl_clm_no = ANY (r.new_nos) AND c.ui_tbl_clm_column_width > 3.00)
          INTO v_new, v_fixed, v_old, v_ids
          FROM fixed.ui_table_columns c
         WHERE c.ui_tbl_clm_table_id = r.tbl AND c.ui_tbl_clm_is_deleted = false AND c.ui_tbl_clm_column_visibility = true;
        IF v_old <= 0 OR 100 - v_new - v_fixed <= 0 THEN
            RAISE NOTICE 'Delivery tracking P1: ui_table % not rescaled (new %, narrow %, others %).', r.tbl, v_new, v_fixed, v_old;
            CONTINUE;
        END IF;
        v_factor := (100 - v_new - v_fixed) / v_old;
        UPDATE fixed.ui_table_columns
           SET ui_tbl_clm_column_width = round(ui_tbl_clm_column_width * v_factor, 2),
               ui_tbl_clm_modified_on = now(), ui_tbl_clm_modified_by = 'system'
         WHERE ui_tbl_clm_id = ANY (v_ids);
        SELECT 100 - sum(ui_tbl_clm_column_width) INTO v_rest
          FROM fixed.ui_table_columns
         WHERE ui_tbl_clm_table_id = r.tbl AND ui_tbl_clm_is_deleted = false AND ui_tbl_clm_column_visibility = true;
        UPDATE fixed.ui_table_columns
           SET ui_tbl_clm_column_width = ui_tbl_clm_column_width + v_rest
         WHERE ui_tbl_clm_id = (SELECT c.ui_tbl_clm_id FROM fixed.ui_table_columns c
                                 WHERE c.ui_tbl_clm_id = ANY (v_ids)
                                 ORDER BY c.ui_tbl_clm_column_width DESC, c.ui_tbl_clm_column_position, c.ui_tbl_clm_id
                                 LIMIT 1)
           AND v_rest <> 0;
        RAISE NOTICE 'Delivery tracking P1: ui_table % shown widths % + new % -> 100.00 (old columns x %).',
                     r.tbl, round(v_fixed + v_old, 2), round(v_new, 2), round(v_factor, 4);
    END LOOP;
END $ui$;

SELECT setval('fixed.ui_tables_ui_tbl_id_seq',
              GREATEST((SELECT last_value FROM fixed.ui_tables_ui_tbl_id_seq),
                       (SELECT COALESCE(MAX(ui_tbl_id), 1) FROM fixed.ui_tables)), true);
SELECT setval('fixed.ui_table_columns_ui_tbl_clm_id_seq',
              GREATEST((SELECT last_value FROM fixed.ui_table_columns_ui_tbl_clm_id_seq),
                       (SELECT COALESCE(MAX(ui_tbl_clm_id), 1) FROM fixed.ui_table_columns)), true);


-- ── 18 · plain wording rows (notes 120), catalogue 2026-11-16.1 ──────────
INSERT INTO fixed.error_message
    (erm_code, erm_variant, erm_lang, erm_title, erm_line, erm_todo)
VALUES
     ('DN_RIGHT_VIEW', '', 'en', 'Not allowed', 'You have no right to open delivery notes.', 'Call manager.')
    ,('DN_RIGHT_CREATE', '', 'en', 'Not allowed', 'You have no right to make delivery notes.', 'Call manager.')
    ,('DN_RIGHT_EDIT', '', 'en', 'Not allowed', 'You have no right to change delivery notes.', 'Call manager.')
    ,('DN_RIGHT_DELETE', '', 'en', 'Not allowed', 'You have no right to delete delivery notes.', 'Call manager.')
    ,('DN_RIGHT_POST', '', 'en', 'Not allowed', 'You have no right to post delivery notes.', 'Call manager.')
    ,('DN_RIGHT_CANCEL', '', 'en', 'Not allowed', 'You have no right to cancel delivery notes.', 'Call manager.')
    ,('DN_RIGHT_PRINT', '', 'en', 'Not allowed', 'You have no right to print delivery notes.', 'Call manager.')
    ,('DN_RIGHT_EXPORT', '', 'en', 'Not allowed', 'You have no right to export delivery notes.', 'Call manager.')
    ,('DN_NOT_FOUND', '', 'en', 'Not found', 'This delivery note is not there any more.', 'Refresh the list.')
    ,('DN_NOT_DRAFT', '', 'en', 'Already posted', '{refno} is posted; a posted note is never changed.', 'Cancel it (Alt+X) and make a new note.')
    ,('DN_ALREADY_CANCELLED', '', 'en', 'Already cancelled', '{refno} was cancelled on {date}.', 'Nothing to do.')
    ,('DN_REVISION_STALE', '', 'en', 'Changed meanwhile', 'Someone saved this draft after you opened it.', 'Reload it and make the change again.')
    ,('DN_DRAFT_YEAR_CHANGED', '', 'en', 'Draft from another year', 'Draft {refno} was saved in {year}, but today falls in {yearNow}.', 'Delete this draft and make the note again in {yearNow}.')
    ,('DN_DRAFT_YEAR_CHANGED', 'field=accYear', 'en', 'Wrong year', 'You are working in {year}, but today falls in {yearNow}.', 'Switch to {yearNow} and make the note there.')
    ,('DN_GODOWN_REQUIRED', '', 'en', 'Godown needed', 'Pick the godown the goods leave from.', 'Pick a godown.')
    ,('DN_GODOWN_NOT_IN_BRANCH', '', 'en', 'Other branch''s godown', '{godown} is not a godown of {branch}.', 'Pick one of this branch.')
    ,('DN_GODOWN_LOCKED', '', 'en', 'Godown fixed', 'The note already has lines from {godown}.', 'Take the lines off first.')
    ,('DN_VEHICLE_REQUIRED', '', 'en', 'Vehicle needed', 'Mode is Vehicle: the vehicle is missing.', 'Pick the vehicle or type its number.')
    ,('DN_TRANSPORTER_REQUIRED', '', 'en', 'Transporter needed', 'Mode is Transporter: the transporter is missing.', 'Pick or type the transporter.')
    ,('DN_COLLECTED_BY_REQUIRED', '', 'en', 'Who collected?', 'Self pickup: the name of the person who took the goods is missing.', 'Type who collected.')
    ,('DN_NO_LINES', '', 'en', 'Nothing to give', 'Every Give now is blank.', 'Type a quantity on at least one line.')
    ,('DN_LINE_DUPLICATE', '', 'en', 'Line sent twice', 'Line {n} was sent twice, or with the id of another note''s line.', 'Refresh the note and try again.')
    ,('DN_QTY_NEGATIVE', '', 'en', 'Not right', 'Line {n}: Give now cannot be below 0.', 'Type 0 or more.')
    ,('DN_QTY_NEGATIVE', 'event=GOODS_BACK', 'en', 'Not right', 'Line {n}: Came back cannot be below 0.', 'Type 0 or more.')
    ,('DN_QTY_OVER_PENDING', '', 'en', 'More than is left to give', 'Line {n}: {qty} {unit} typed, but only {pending} {unit} are left to give on {bill}.', 'Type {pending} or less.')
    ,('DN_BILL_NOT_POSTED', '', 'en', 'Bill not posted', '{bill} is not posted, or is cancelled, so its goods cannot be given.', 'Post the bill first.')
    ,('DN_BILL_INSTANT', '', 'en', 'Given at the counter', '{bill} is an Instant bill; nothing of it waits in the godown.', 'Leave it off the note.')
    ,('DN_BILL_OTHER_BRANCH', '', 'en', 'Other branch''s bill', '{bill} belongs to {branch}.', 'Give it at that branch.')
    ,('DN_LINE_NOT_GOODS', '', 'en', 'Not a godown line', 'Line {n} of {bill} is a service or came from challan {dc}; it is already with the customer.', 'Leave it off the note.')
    ,('DN_GODOWN_RIGHT', '', 'en', 'Another godown''s goods', 'You can''t give another godown''s goods: line {n} was billed from {billGodown}.', 'Give it from {billGodown}''s note, or ask a user with the Override right.')
    ,('DN_OTHER_GODOWN', '', 'en', 'From another godown', 'Line {n}: the bill took these {qty} {unit} from {billGodown}. Given from {godown}, Post moves {qty} {unit} {godown} → {billGodown} on the books.', 'Tick to confirm (logged with your name).')
    ,('DN_LOT_SWAP', '', 'en', 'Another lot', 'Line {n}: lot {given} given for {billLot}. Post swaps {qty} {unit} between the two lots on the books, so both stay true.', 'Nothing to do.')
    ,('DN_LOT_INVALID', '', 'en', 'Lot not right', '{lot} is not a lot of {item} in {godown}.', 'Pick the lot from the list (F2).')
    ,('DN_SHELF_SHORT', '', 'en', 'Short on the shelf', 'Line {n}: only {shelf} {unit} of {item} are on the shelf here; {pending} are billed. Left for later — the bill stays PART.', 'Give the rest later.')
    ,('DN_OVER_SHELF', '', 'en', 'More than the shelf shows', 'Line {n}: the books say {shelf} {unit} of lot {lot} are on the shelf here; {qty} are being given.', 'Tick if the goods really left (logged); count the shelf later.')
    ,('DN_VEHICLE_OVERLOAD', '', 'en', 'Over the vehicle''s load', '{kg} kg on {vehicle}, over its {cap} kg.', 'Tick to send anyway (logged), or take lines off.')
    ,('DN_WARN_NOT_CONFIRMED', '', 'en', 'Please confirm', '{count} warning(s) need your tick before posting: {codes}.', 'Tick them, or change the note.')
    ,('DN_GODOWN_FROZEN', '', 'en', 'Godown being counted', '{godown} is frozen for a count from {from} to {to}.', 'Give the goods after the count.')
    ,('DN_GODOWN_FROZEN', 'event=GOODS_BACK', 'en', 'Godown being counted', '{godown} is frozen for a count from {from} to {to}.', 'Take the goods back after the count.')
    ,('DN_GODOWN_FROZEN', 'event=CANCEL', 'en', 'Godown being counted', '{godown} is frozen for a count from {from} to {to}.', 'Cancel the note after the count.')
    ,('DN_STOCK_NEGATIVE', '', 'en', 'Stock would go below 0', 'Line {n}: moving {qty} {unit} of lot {lot} on the books would take {godown} below 0, and this godown does not allow it.', 'Give the bill''s own lot, or correct the stock first.')
    ,('DN_CANCEL_REASON_REQUIRED', '', 'en', 'Reason needed', 'Say why the note is cancelled.', 'Type a reason.')
    ,('DN_GOODS_BACK_OVER', '', 'en', 'More than was given', 'Line {n}: {qty} came back, but only {max} were given on this note.', 'Type {max} or less.')
    ,('DN_GOODS_BACK_REASON_REQUIRED', '', 'en', 'Reason needed', 'Say why the goods came back.', 'Type a reason.')
    ,('DN_GOODS_BACK_NOT_POSTED', '', 'en', 'Not posted', '{refno} is a draft; nothing has left the godown yet.', 'Change the draft instead.')
    ,('DN_UNDO_BELOW_RETURNED', '', 'en', 'Goods already returned', 'Line {n} of {bill}: {qty} {unit} came back on sale return {sr}.', 'Cancel or amend that return first.')
    ,('DN_SCAN_UNKNOWN', '', 'en', 'Not ours', 'This QR is not a bill or gate pass of {branch}.', 'Check the paper.')
    ,('DN_SCAN_NO_OPEN_HERE', '', 'en', 'Not in this godown', '{bill} has no open lines in {godown} (its goods are in {godowns}).', 'Give them from that godown.')
    ,('DELIVERY_NOTHING_OPEN', '', 'en', 'Nothing left to give', '{bill} has nothing left to give (delivered {date} on {dn}).', 'Refresh the list.')
    ,('DELIVERY_CHALLAN_ROW', '', 'en', 'A challan', '{dc} is a delivery challan: its goods are already with the customer.', 'Bill it from the Sale Bill, or take it back with a challan return.')
    ,('DELIVERY_MODE_GIVEN', '', 'en', 'Already given', '{bill} is fully given already, so its mode cannot change now.', 'Nothing to change.')
    ,('DELIVERY_MODE_INSTANT', '', 'en', 'Instant bill', '{bill} was given at the counter; its mode cannot change after posting.', 'Nothing to change.')
    ,('DELIVERY_MODE_INVALID', '', 'en', 'Mode not right', 'A posted bill can only switch between Pickup and Dispatch.', 'Pick Pickup or Dispatch.')
    ,('DELIVERY_MODE_REASON_REQUIRED', '', 'en', 'Reason needed', 'Say why the mode changes.', 'Type a reason.')
    ,('DELIVERY_RIGHT_MODE', '', 'en', 'Not allowed', 'You have no right to change a bill''s delivery mode.', 'Call manager.')
    ,('DELIVERY_RIGHT_VIEW', '', 'en', 'Not allowed', 'You have no right to open Pending Deliveries.', 'Call manager.')
    ,('HIDDEN_TICKED', '', 'en', 'Ticked but hidden', '{count} ticked bill(s) ({bills}) are hidden by the search.', 'Include them?')
    ,('DELIVERY_RETURN_OVER', '', 'en', 'More than is left', 'Line {n}: {qty} marked not taken, but only {pending} are still to give on {bill}.', 'Type {pending} or less.')
    ,('DELIVERY_RETURN_NOT_GIVEN', '', 'en', 'Never taken', 'Line {n}: only {given} were given; the rest was never taken.', 'Mark at least {min} as not taken.')
    ,('DELIVERY_RETURN_GODOWN', '', 'en', 'Same godown', 'Line {n}: goods never taken stay in {godown}, lot {lot}.', 'Leave the godown and lot as the bill''s (condition Good, Damaged or Expired).')
    ,('DELIVERY_RETURN_OVER_QTY', '', 'en', 'More than returned', 'Line {n}: {u} {unit} marked not taken, but only {qty} {unit} are being returned.', 'Type {qty} or less.')
    ,('DELIVERY_RETURN_CLAIM', '', 'en', 'A claim', 'Line {n}: a claim is for goods the customer had, but {u} {unit} are marked never taken.', 'Make goods never taken a Return, or set Not taken to 0.')
    ,('DELIVERY_RETURN_AMEND_LOCKED', '', 'en', 'Not taken is fixed', 'Line {n}: {was} {unit} were posted as not taken on this return; an amend can keep that figure or set it to 0, not change it.', 'Cancel the return and make a new one for the right figure.')
    ,('BILL_OLD_PENDING_DELIVERY', '', 'en', 'Old goods not collected', '{customer} still has {bill} with {qty} not collected after {days} days.', 'A warning only.')
    ,('BILL_DELIVERED_CANCEL', '', 'en', 'Goods already given', '{bill}: goods left the godown on {dn}. A bill with given goods cannot be cancelled.', 'Make a sale return for them instead.')
    ,('BILL_DELIVERED_AMEND', '', 'en', 'Below what is given', 'Line {n} ({item}): {given} {unit} are already given or returned; the line cannot go below that, be dropped, or change item, unit, godown or lot.', 'Keep at least {given}.')
    ,('BILL_DELIVERY_MODE_LOCKED', '', 'en', 'Mode fixed', 'The delivery mode of a posted bill changes only on Pending Deliveries (Pickup ↔ Dispatch).', 'Use Pending Deliveries.')
    ,('BILL_DELIVERY_MODE_POS', '', 'en', 'Counter bill', 'A counter (POS) bill is always Instant.', 'Leave it as Instant.')
    ,('SALES_DELIVERY_RETIRED', '', 'en', 'Moved', 'Delivery is now worked out from Delivery Notes.', 'Use Pending Deliveries (menu 304).')
    ,('GODOWN_POSITION_RIGHT_VIEW', '', 'en', 'Not allowed', 'You have no right to open the Godown Stock Position.', 'Call manager.')
    ,('GODOWN_POSITION_RIGHT_PRINT', '', 'en', 'Not allowed', 'You have no right to print the Godown Stock Position.', 'Call manager.')
    ,('GODOWN_POSITION_RIGHT_EXPORT', '', 'en', 'Not allowed', 'You have no right to export the Godown Stock Position.', 'Call manager.')
    ,('GODOWN_POSITION_GODOWN_NOT_IN_BRANCH', '', 'en', 'Other branch''s godown', '{godown} is not a godown of {branch}.', 'Pick one of this branch.')
    ,('PHY_UNDELIVERED_CHANGED', '', 'en', 'Pending moved', 'Line {n}: {item} had {old} billed not delivered when the sheet was drawn; now {new}.', 'Check the count before posting.')
    ,('PHY_SHELF_AND_COUNTED', '', 'en', 'Two counts', 'Line {n}: both a shelf count and a counted qty were sent.', 'Send the shelf count only.')
    ,('VT_DELIVERY_MODE_REQUIRED', '', 'en', 'Delivery mode needed', 'A Sales Bill type needs a delivery mode.', 'Pick Instant, Pickup or Dispatch.')
    ,('VT_DELIVERY_MODE_NOT_ALLOWED', '', 'en', 'No delivery mode here', 'Only Sales Bill types have a delivery mode.', 'Leave it empty.')
ON CONFLICT (erm_code, erm_variant, erm_lang) DO NOTHING;
UPDATE fixed.error_message_catalogue
   SET emc_version   = '2026-11-16.1',
       emc_row_count = (SELECT count(*) FROM fixed.error_message WHERE erm_is_active),
       emc_loaded_on = now()
 WHERE emc_id = 1
   AND emc_version < '2026-11-16.1';


-- Checks after deploy (read-only):
-- SELECT sb_delivery_mode, sb_delivery_status, sb_status, count(*) FROM sales.sale_bill GROUP BY 1, 2, 3 ORDER BY 1, 2, 3;
-- SELECT sde_kind, count(*) FROM sales.sale_delivery_event GROUP BY 1;
-- SELECT c.relname FROM pg_inherits i JOIN pg_class c ON c.oid = i.inhrelid JOIN pg_class p ON p.oid = i.inhparent WHERE p.relname LIKE 'sale_delivery%' ORDER BY 1;
-- SELECT menu_id, menu_parent, menu_name, menu_visiblity, menu_position, menu_verbs FROM fixed.menu_master WHERE menu_id IN (182, 226, 304, 305, 306);
-- SELECT um_menu_id, count(*) FROM public.user_menus WHERE um_menu_id IN (304, 305, 306) GROUP BY 1;
-- SELECT emc_version, emc_row_count FROM fixed.error_message_catalogue;
-- SELECT * FROM public.v_db_table_master_drift;
