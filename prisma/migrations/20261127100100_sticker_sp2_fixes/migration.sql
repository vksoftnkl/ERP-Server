-- ═══════════════════════════════════════════════════════════════════════════
--  Sticker printing S-P2 review fixes (DB part)                     2026-11-26
--  Folder: prisma/migrations/20261127100100_sticker_sp2_fixes/ (share copy:
--  Shared/Prathap/admin/sql/sticker-sp2-fixes-migration.sql, run by
--  run-sticker-sp2-fixes-apply.sh, checked by sticker-sp2-fixes-assert.sql).
--
--  Fix batch: Shared/Prathap/printing/sticker-printing/review-fix-batch-sticker-sp2-2026-11-26.md
--  (review review-sticker-sp2-2026-11-26.md: 0 BLOCKER), section DB. Sorts after
--  20261127100000_sticker_printing_sp2, which is applied on dev and is not
--  edited. Every id, name and value below was read from the live dev DB on
--  2026-11-26.
--
--   1 · F2 grid 224 POPUP - STICKER SOURCE DOCUMENTS: "printed" and "carried"
--       count only label_job_line rows with lbjl_reprint_of_line_id IS NULL.
--       A resend of a FAILED REPRINT is a job of kind PRINT whose lines keep
--       their lbjl_reprint_of_line_id: it is a reprint, so it must never lower
--       a document's "left". The FAILED and REPRINT exclusions stay as they
--       are. The SQL and description move only while they hold the text
--       20261127100000 shipped (white space folded): already the new text =
--       nothing to do; grid absent (a fresh database: Grid_Details.sql
--       carries the new row) = skipped; any other text (edited on this site)
--       = left as is, with a NOTICE. The grid SQL holds no comment marker.
--   2 · F6 ui_table 58 GRN - LINES, column 35 "Labels" (S-P2 removed the GRN's
--       Labels column; Qt keeps its slot as GrnCols::RetiredLabels, always
--       hidden): hidden, width 0 (as every hidden column). Widths follow the
--       rule of 20261029140000 for this table: the default set (every
--       optional column off) adds to 100.00, the optional columns (Excess /
--       Excess action, textile Model / Size / Colour, Sell A-D) on the same
--       scale. Without Labels the default set came to 95.38, so every shown
--       width is scaled by 100 / 95.38 and rounded to 2 places, the rounding
--       rest (0.02) to the widest (Item): the 16 default columns add to 100.00
--       again, all 25 shown to 147.54. Positions are left as they are (the
--       screen orders its sections itself, GrnEntry::applyColumns). Rows are
--       matched on number AND name, so a column re-purposed on this site is
--       left alone; a no-op once in place.
--
--  prisma/seed/Grid_Details.sql and Ui_Table_Columns.sql carry the same rows.
--  Data only: no DDL, no Prisma change, no function or trigger. Re-runnable:
--  applied twice in one transaction the second run changes nothing.
-- ═══════════════════════════════════════════════════════════════════════════


-- ── 1 · F2 grid 224: a resend of a failed reprint never counts as printed ──
DO $mig$
DECLARE
    v_old_sql  text := $old$WITH docs AS (
    SELECT 'PURCHASE_BILL'::text AS doc_type,
           p.pi_id AS doc_id,
           p.pi_acc_year AS acc_year,
           p.pi_refno AS refno,
           p.pi_doc_date AS doc_date,
           p.pi_supplier_id AS supplier_id,
           p.pi_source_kind::text AS source_kind
      FROM purchase.pur_invoice p
     WHERE p.pi_company_id = (SELECT c.comp_id FROM public.companys c WHERE c.comp_id::text = 'icompany_id')
       AND p.pi_branch_id = (SELECT b.br_id FROM public.branch_master b WHERE b.br_id::text = 'ibranch_id')
       AND p.pi_is_deleted = false
       AND p.pi_status = 'POSTED'
       AND 'idoc_type' IN ('', 'PURCHASE_BILL')
       AND (NULLIF('ifrom_date', '') IS NULL OR to_char(p.pi_doc_date, 'YYYY-MM-DD') >= 'ifrom_date')
       AND (NULLIF('ito_date', '') IS NULL OR to_char(p.pi_doc_date, 'YYYY-MM-DD') <= 'ito_date')
       AND ('isupplier_id' = '' OR p.pi_supplier_id::text = 'isupplier_id')
       AND ('idoc_text' = '' OR p.pi_refno ILIKE '%' || 'idoc_text' || '%')
    UNION ALL
    SELECT 'SHORTAGE_RECEIPT'::text,
           r.psr_id,
           r.psr_acc_year,
           r.psr_refno,
           r.psr_doc_date,
           r.psr_supplier_id,
           NULL::text
      FROM purchase.pur_shortage_receipt r
     WHERE r.psr_company_id = (SELECT c.comp_id FROM public.companys c WHERE c.comp_id::text = 'icompany_id')
       AND r.psr_branch_id = (SELECT b.br_id FROM public.branch_master b WHERE b.br_id::text = 'ibranch_id')
       AND r.psr_is_deleted = false
       AND r.psr_status = 'POSTED'
       AND 'idoc_type' IN ('', 'SHORTAGE_RECEIPT')
       AND (NULLIF('ifrom_date', '') IS NULL OR to_char(r.psr_doc_date, 'YYYY-MM-DD') >= 'ifrom_date')
       AND (NULLIF('ito_date', '') IS NULL OR to_char(r.psr_doc_date, 'YYYY-MM-DD') <= 'ito_date')
       AND ('isupplier_id' = '' OR r.psr_supplier_id::text = 'isupplier_id')
       AND ('idoc_text' = '' OR r.psr_refno ILIKE '%' || 'idoc_text' || '%')
),
lines AS (
    SELECT d.doc_type,
           d.doc_id,
           d.acc_year,
           l.pii_item_id AS item_id,
           COALESCE(NULLIF(l.pii_to_base_factor, 0), 1) AS factor,
           CASE WHEN l.pii_src_doc_type = 'GRN' THEN 'GRN' ELSE 'PURCHASE_BILL' END AS alloc_type,
           CASE WHEN l.pii_src_doc_type = 'GRN' THEN l.pii_src_item_id ELSE l.pii_id END AS alloc_line_id,
           CASE WHEN l.pii_src_doc_type = 'GRN' THEN l.pii_src_doc_year ELSE l.pii_acc_year END AS alloc_year,
           CASE WHEN l.pii_src_doc_type = 'GRN' THEN l.pii_src_item_id END AS grn_line_id,
           CASE WHEN l.pii_src_doc_type = 'GRN' THEN l.pii_src_doc_year END AS grn_year
      FROM docs d
      JOIN purchase.pur_invoice_item l
        ON l.pii_pi_id = d.doc_id
       AND l.pii_acc_year = d.acc_year
       AND l.pii_is_deleted = false
     WHERE d.doc_type = 'PURCHASE_BILL'
    UNION ALL
    SELECT d.doc_type,
           d.doc_id,
           d.acc_year,
           l.psri_item_id,
           COALESCE(NULLIF(l.psri_to_base_factor, 0), 1),
           'SHORTAGE_RECEIPT'::text,
           l.psri_id,
           l.psri_acc_year,
           NULL::uuid,
           NULL::character(9)
      FROM docs d
      JOIN purchase.pur_shortage_receipt_item l
        ON l.psri_psr_id = d.doc_id
       AND l.psri_acc_year = d.acc_year
       AND l.psri_is_deleted = false
     WHERE d.doc_type = 'SHORTAGE_RECEIPT'
),
items AS (
    SELECT i.item_id,
           i.item_barcode_sticker AS ticked,
           COALESCE(u.factor, 1) AS def_factor,
           COALESCE(u.decimals, 0) AS def_decimals
      FROM (SELECT DISTINCT item_id FROM lines) x
      JOIN inventory.item_master i ON i.item_id = x.item_id
      LEFT JOIN LATERAL (
            SELECT COALESCE(NULLIF(c.iuc_to_base_factor, 0), 1) AS factor,
                   COALESCE(m.unit_decimal_count, 0) AS decimals
              FROM inventory.item_unit_conversion c
              LEFT JOIN inventory.item_unit_master m ON m.unit_id = c.iuc_unit_id
             WHERE c.iuc_item_id = i.item_id
               AND c.iuc_is_deleted = false
             ORDER BY c.iuc_is_default_unit DESC, c.iuc_is_base_unit DESC, c.iuc_unit_slno
             LIMIT 1) u ON true
),
alloc AS (
    SELECT ln.doc_type,
           ln.doc_id,
           ln.acc_year,
           ln.item_id,
           a.pia_lot_id AS lot_id,
           SUM((a.pia_qty + a.pia_free_qty) * ln.factor) AS base_qty
      FROM lines ln
      JOIN purchase.pur_item_alloc a
        ON a.pia_doc_type = ln.alloc_type
       AND a.pia_line_id = ln.alloc_line_id
       AND a.pia_acc_year = ln.alloc_year
       AND a.pia_is_deleted = false
     WHERE a.pia_bucket = 'SALEABLE'
       AND a.pia_lot_id IS NOT NULL
     GROUP BY ln.doc_type, ln.doc_id, ln.acc_year, ln.item_id, a.pia_lot_id
),
need AS (
    SELECT a.doc_type,
           a.doc_id,
           a.acc_year,
           a.item_id,
           a.lot_id,
           CASE WHEN a.base_qty <= 0 THEN 0
                WHEN it.def_decimals > 0 THEN 1
                ELSE GREATEST(1, floor(round(a.base_qty / it.def_factor, 6)))
           END AS needed
      FROM alloc a
      JOIN items it ON it.item_id = a.item_id
     WHERE 'isticker_only' = '0' OR it.ticked
),
printed AS (
    SELECT k.doc_id,
           k.acc_year,
           l.lbjl_item_id AS item_id,
           l.lbjl_lot_id AS lot_id,
           SUM(l.lbjl_labels) AS labels
      FROM (SELECT DISTINCT doc_type, doc_id, acc_year FROM need) k
      JOIN inventory.label_job j
        ON j.lbj_src_doc_id = k.doc_id
       AND j.lbj_src_acc_year = k.acc_year
       AND j.lbj_src_doc_type = k.doc_type
       AND j.lbj_src_doc_id IS NOT NULL
      JOIN inventory.label_job_line l
        ON l.lbjl_job_id = j.lbj_id
       AND l.lbjl_acc_year = j.lbj_acc_year
     WHERE j.lbj_kind = 'PRINT'
       AND j.lbj_status <> 'FAILED'
     GROUP BY k.doc_id, k.acc_year, l.lbjl_item_id, l.lbjl_lot_id
),
carried_from AS (
    SELECT DISTINCT ln.doc_id,
           ln.acc_year,
           ln.item_id,
           x.pi_id AS from_id,
           x.pi_acc_year AS from_year
      FROM lines ln
      JOIN purchase.pur_invoice_item xl
        ON xl.pii_src_doc_type = 'GRN'
       AND xl.pii_src_item_id = ln.grn_line_id
       AND xl.pii_src_doc_year = ln.grn_year
       AND xl.pii_src_item_id IS NOT NULL
       AND xl.pii_is_deleted = false
       AND xl.pii_item_id = ln.item_id
      JOIN purchase.pur_invoice x
        ON x.pi_id = xl.pii_pi_id
       AND x.pi_acc_year = xl.pii_acc_year
       AND x.pi_status = 'CANCELLED'
     WHERE ln.grn_line_id IS NOT NULL
       AND x.pi_id <> ln.doc_id
),
carried AS (
    SELECT cf.doc_id,
           cf.acc_year,
           l.lbjl_item_id AS item_id,
           l.lbjl_lot_id AS lot_id,
           SUM(l.lbjl_labels) AS labels
      FROM carried_from cf
      JOIN inventory.label_job j
        ON j.lbj_src_doc_id = cf.from_id
       AND j.lbj_src_acc_year = cf.from_year
       AND j.lbj_src_doc_type = 'PURCHASE_BILL'
       AND j.lbj_src_doc_id IS NOT NULL
      JOIN inventory.label_job_line l
        ON l.lbjl_job_id = j.lbj_id
       AND l.lbjl_acc_year = j.lbj_acc_year
       AND l.lbjl_item_id = cf.item_id
     WHERE j.lbj_kind = 'PRINT'
       AND j.lbj_status <> 'FAILED'
     GROUP BY cf.doc_id, cf.acc_year, l.lbjl_item_id, l.lbjl_lot_id
),
per_doc AS (
    SELECT n.doc_id,
           n.acc_year,
           SUM(n.needed) AS needed,
           SUM(LEAST(n.needed, COALESCE(p.labels, 0) + COALESCE(c.labels, 0))) AS printed,
           SUM(COALESCE(p.labels, 0) + COALESCE(c.labels, 0)) AS done_all,
           bool_and(COALESCE(p.labels, 0) + COALESCE(c.labels, 0) >= n.needed) AS all_done
      FROM need n
      LEFT JOIN printed p
        ON p.doc_id = n.doc_id
       AND p.acc_year = n.acc_year
       AND p.item_id = n.item_id
       AND p.lot_id = n.lot_id
      LEFT JOIN carried c
        ON c.doc_id = n.doc_id
       AND c.acc_year = n.acc_year
       AND c.item_id = n.item_id
       AND c.lot_id = n.lot_id
     GROUP BY n.doc_id, n.acc_year
),
line_counts AS (
    SELECT ln.doc_id,
           ln.acc_year,
           count(*) AS lines_all,
           count(*) FILTER (WHERE it.ticked) AS lines_ticked
      FROM lines ln
      JOIN items it ON it.item_id = ln.item_id
     GROUP BY ln.doc_id, ln.acc_year
),
shown AS (
    SELECT d.doc_type,
           d.doc_id,
           d.acc_year,
           d.refno,
           d.doc_date,
           d.supplier_id,
           d.source_kind,
           COALESCE(pd.needed, 0)::int AS needed,
           COALESCE(pd.printed, 0)::int AS printed,
           COALESCE(lc.lines_all, 0)::int AS lines_all,
           COALESCE(lc.lines_ticked, 0)::int AS lines_ticked,
           CASE WHEN COALESCE(pd.needed, 0) = 0 THEN 'NONE'
                WHEN COALESCE(pd.done_all, 0) = 0 THEN 'NOT'
                WHEN pd.all_done THEN 'DONE'
                ELSE 'PART'
           END AS state_code
      FROM docs d
      LEFT JOIN per_doc pd
        ON pd.doc_id = d.doc_id
       AND pd.acc_year = d.acc_year
      LEFT JOIN line_counts lc
        ON lc.doc_id = d.doc_id
       AND lc.acc_year = d.acc_year
)
SELECT COALESCE(s.refno, '') AS refno,
       to_char(s.doc_date, 'DD-MM-YYYY') AS doc_date_text,
       CASE WHEN s.doc_type = 'SHORTAGE_RECEIPT' THEN 'Shortage Receipt'
            WHEN s.source_kind = 'GRN' THEN 'Purchase Entry · from GRN'
            WHEN s.source_kind = 'SISTER_SALE' THEN 'Purchase Entry · sister'
            ELSE 'Purchase Entry'
       END AS type_text,
       COALESCE(sp.sup_name, '') AS supplier_name,
       s.lines_ticked || ' of ' || s.lines_all AS lines_text,
       s.needed,
       s.printed,
       CASE s.state_code WHEN 'NOT' THEN 'Not printed'
                         WHEN 'PART' THEN 'Part · ' || s.printed || ' of ' || s.needed
                         WHEN 'DONE' THEN 'Printed'
                         ELSE 'No labels'
       END AS state_text,
       s.doc_type,
       s.doc_id,
       s.acc_year,
       s.state_code,
       s.source_kind
  FROM shown s
  LEFT JOIN purchase.suppliers sp ON sp.sup_id = s.supplier_id
 WHERE ('isticker_only' = '0' OR s.needed > 0)
   AND (   'ishow' = 'ALL'
        OR ('ishow' = 'NOT' AND s.state_code = 'NOT')
        OR ('ishow' = 'PART' AND s.state_code = 'PART')
        OR ('ishow' = 'DONE' AND s.state_code = 'DONE')
        OR ('ishow' NOT IN ('ALL', 'NOT', 'PART', 'DONE') AND s.state_code IN ('NOT', 'PART')))
 ORDER BY s.doc_date DESC, s.refno DESC$old$;
    v_new_sql  text := $new$WITH docs AS (
    SELECT 'PURCHASE_BILL'::text AS doc_type,
           p.pi_id AS doc_id,
           p.pi_acc_year AS acc_year,
           p.pi_refno AS refno,
           p.pi_doc_date AS doc_date,
           p.pi_supplier_id AS supplier_id,
           p.pi_source_kind::text AS source_kind
      FROM purchase.pur_invoice p
     WHERE p.pi_company_id = (SELECT c.comp_id FROM public.companys c WHERE c.comp_id::text = 'icompany_id')
       AND p.pi_branch_id = (SELECT b.br_id FROM public.branch_master b WHERE b.br_id::text = 'ibranch_id')
       AND p.pi_is_deleted = false
       AND p.pi_status = 'POSTED'
       AND 'idoc_type' IN ('', 'PURCHASE_BILL')
       AND (NULLIF('ifrom_date', '') IS NULL OR to_char(p.pi_doc_date, 'YYYY-MM-DD') >= 'ifrom_date')
       AND (NULLIF('ito_date', '') IS NULL OR to_char(p.pi_doc_date, 'YYYY-MM-DD') <= 'ito_date')
       AND ('isupplier_id' = '' OR p.pi_supplier_id::text = 'isupplier_id')
       AND ('idoc_text' = '' OR p.pi_refno ILIKE '%' || 'idoc_text' || '%')
    UNION ALL
    SELECT 'SHORTAGE_RECEIPT'::text,
           r.psr_id,
           r.psr_acc_year,
           r.psr_refno,
           r.psr_doc_date,
           r.psr_supplier_id,
           NULL::text
      FROM purchase.pur_shortage_receipt r
     WHERE r.psr_company_id = (SELECT c.comp_id FROM public.companys c WHERE c.comp_id::text = 'icompany_id')
       AND r.psr_branch_id = (SELECT b.br_id FROM public.branch_master b WHERE b.br_id::text = 'ibranch_id')
       AND r.psr_is_deleted = false
       AND r.psr_status = 'POSTED'
       AND 'idoc_type' IN ('', 'SHORTAGE_RECEIPT')
       AND (NULLIF('ifrom_date', '') IS NULL OR to_char(r.psr_doc_date, 'YYYY-MM-DD') >= 'ifrom_date')
       AND (NULLIF('ito_date', '') IS NULL OR to_char(r.psr_doc_date, 'YYYY-MM-DD') <= 'ito_date')
       AND ('isupplier_id' = '' OR r.psr_supplier_id::text = 'isupplier_id')
       AND ('idoc_text' = '' OR r.psr_refno ILIKE '%' || 'idoc_text' || '%')
),
lines AS (
    SELECT d.doc_type,
           d.doc_id,
           d.acc_year,
           l.pii_item_id AS item_id,
           COALESCE(NULLIF(l.pii_to_base_factor, 0), 1) AS factor,
           CASE WHEN l.pii_src_doc_type = 'GRN' THEN 'GRN' ELSE 'PURCHASE_BILL' END AS alloc_type,
           CASE WHEN l.pii_src_doc_type = 'GRN' THEN l.pii_src_item_id ELSE l.pii_id END AS alloc_line_id,
           CASE WHEN l.pii_src_doc_type = 'GRN' THEN l.pii_src_doc_year ELSE l.pii_acc_year END AS alloc_year,
           CASE WHEN l.pii_src_doc_type = 'GRN' THEN l.pii_src_item_id END AS grn_line_id,
           CASE WHEN l.pii_src_doc_type = 'GRN' THEN l.pii_src_doc_year END AS grn_year
      FROM docs d
      JOIN purchase.pur_invoice_item l
        ON l.pii_pi_id = d.doc_id
       AND l.pii_acc_year = d.acc_year
       AND l.pii_is_deleted = false
     WHERE d.doc_type = 'PURCHASE_BILL'
    UNION ALL
    SELECT d.doc_type,
           d.doc_id,
           d.acc_year,
           l.psri_item_id,
           COALESCE(NULLIF(l.psri_to_base_factor, 0), 1),
           'SHORTAGE_RECEIPT'::text,
           l.psri_id,
           l.psri_acc_year,
           NULL::uuid,
           NULL::character(9)
      FROM docs d
      JOIN purchase.pur_shortage_receipt_item l
        ON l.psri_psr_id = d.doc_id
       AND l.psri_acc_year = d.acc_year
       AND l.psri_is_deleted = false
     WHERE d.doc_type = 'SHORTAGE_RECEIPT'
),
items AS (
    SELECT i.item_id,
           i.item_barcode_sticker AS ticked,
           COALESCE(u.factor, 1) AS def_factor,
           COALESCE(u.decimals, 0) AS def_decimals
      FROM (SELECT DISTINCT item_id FROM lines) x
      JOIN inventory.item_master i ON i.item_id = x.item_id
      LEFT JOIN LATERAL (
            SELECT COALESCE(NULLIF(c.iuc_to_base_factor, 0), 1) AS factor,
                   COALESCE(m.unit_decimal_count, 0) AS decimals
              FROM inventory.item_unit_conversion c
              LEFT JOIN inventory.item_unit_master m ON m.unit_id = c.iuc_unit_id
             WHERE c.iuc_item_id = i.item_id
               AND c.iuc_is_deleted = false
             ORDER BY c.iuc_is_default_unit DESC, c.iuc_is_base_unit DESC, c.iuc_unit_slno
             LIMIT 1) u ON true
),
alloc AS (
    SELECT ln.doc_type,
           ln.doc_id,
           ln.acc_year,
           ln.item_id,
           a.pia_lot_id AS lot_id,
           SUM((a.pia_qty + a.pia_free_qty) * ln.factor) AS base_qty
      FROM lines ln
      JOIN purchase.pur_item_alloc a
        ON a.pia_doc_type = ln.alloc_type
       AND a.pia_line_id = ln.alloc_line_id
       AND a.pia_acc_year = ln.alloc_year
       AND a.pia_is_deleted = false
     WHERE a.pia_bucket = 'SALEABLE'
       AND a.pia_lot_id IS NOT NULL
     GROUP BY ln.doc_type, ln.doc_id, ln.acc_year, ln.item_id, a.pia_lot_id
),
need AS (
    SELECT a.doc_type,
           a.doc_id,
           a.acc_year,
           a.item_id,
           a.lot_id,
           CASE WHEN a.base_qty <= 0 THEN 0
                WHEN it.def_decimals > 0 THEN 1
                ELSE GREATEST(1, floor(round(a.base_qty / it.def_factor, 6)))
           END AS needed
      FROM alloc a
      JOIN items it ON it.item_id = a.item_id
     WHERE 'isticker_only' = '0' OR it.ticked
),
printed AS (
    SELECT k.doc_id,
           k.acc_year,
           l.lbjl_item_id AS item_id,
           l.lbjl_lot_id AS lot_id,
           SUM(l.lbjl_labels) AS labels
      FROM (SELECT DISTINCT doc_type, doc_id, acc_year FROM need) k
      JOIN inventory.label_job j
        ON j.lbj_src_doc_id = k.doc_id
       AND j.lbj_src_acc_year = k.acc_year
       AND j.lbj_src_doc_type = k.doc_type
       AND j.lbj_src_doc_id IS NOT NULL
      JOIN inventory.label_job_line l
        ON l.lbjl_job_id = j.lbj_id
       AND l.lbjl_acc_year = j.lbj_acc_year
     WHERE j.lbj_kind = 'PRINT'
       AND j.lbj_status <> 'FAILED'
       AND l.lbjl_reprint_of_line_id IS NULL
     GROUP BY k.doc_id, k.acc_year, l.lbjl_item_id, l.lbjl_lot_id
),
carried_from AS (
    SELECT DISTINCT ln.doc_id,
           ln.acc_year,
           ln.item_id,
           x.pi_id AS from_id,
           x.pi_acc_year AS from_year
      FROM lines ln
      JOIN purchase.pur_invoice_item xl
        ON xl.pii_src_doc_type = 'GRN'
       AND xl.pii_src_item_id = ln.grn_line_id
       AND xl.pii_src_doc_year = ln.grn_year
       AND xl.pii_src_item_id IS NOT NULL
       AND xl.pii_is_deleted = false
       AND xl.pii_item_id = ln.item_id
      JOIN purchase.pur_invoice x
        ON x.pi_id = xl.pii_pi_id
       AND x.pi_acc_year = xl.pii_acc_year
       AND x.pi_status = 'CANCELLED'
     WHERE ln.grn_line_id IS NOT NULL
       AND x.pi_id <> ln.doc_id
),
carried AS (
    SELECT cf.doc_id,
           cf.acc_year,
           l.lbjl_item_id AS item_id,
           l.lbjl_lot_id AS lot_id,
           SUM(l.lbjl_labels) AS labels
      FROM carried_from cf
      JOIN inventory.label_job j
        ON j.lbj_src_doc_id = cf.from_id
       AND j.lbj_src_acc_year = cf.from_year
       AND j.lbj_src_doc_type = 'PURCHASE_BILL'
       AND j.lbj_src_doc_id IS NOT NULL
      JOIN inventory.label_job_line l
        ON l.lbjl_job_id = j.lbj_id
       AND l.lbjl_acc_year = j.lbj_acc_year
       AND l.lbjl_item_id = cf.item_id
     WHERE j.lbj_kind = 'PRINT'
       AND j.lbj_status <> 'FAILED'
       AND l.lbjl_reprint_of_line_id IS NULL
     GROUP BY cf.doc_id, cf.acc_year, l.lbjl_item_id, l.lbjl_lot_id
),
per_doc AS (
    SELECT n.doc_id,
           n.acc_year,
           SUM(n.needed) AS needed,
           SUM(LEAST(n.needed, COALESCE(p.labels, 0) + COALESCE(c.labels, 0))) AS printed,
           SUM(COALESCE(p.labels, 0) + COALESCE(c.labels, 0)) AS done_all,
           bool_and(COALESCE(p.labels, 0) + COALESCE(c.labels, 0) >= n.needed) AS all_done
      FROM need n
      LEFT JOIN printed p
        ON p.doc_id = n.doc_id
       AND p.acc_year = n.acc_year
       AND p.item_id = n.item_id
       AND p.lot_id = n.lot_id
      LEFT JOIN carried c
        ON c.doc_id = n.doc_id
       AND c.acc_year = n.acc_year
       AND c.item_id = n.item_id
       AND c.lot_id = n.lot_id
     GROUP BY n.doc_id, n.acc_year
),
line_counts AS (
    SELECT ln.doc_id,
           ln.acc_year,
           count(*) AS lines_all,
           count(*) FILTER (WHERE it.ticked) AS lines_ticked
      FROM lines ln
      JOIN items it ON it.item_id = ln.item_id
     GROUP BY ln.doc_id, ln.acc_year
),
shown AS (
    SELECT d.doc_type,
           d.doc_id,
           d.acc_year,
           d.refno,
           d.doc_date,
           d.supplier_id,
           d.source_kind,
           COALESCE(pd.needed, 0)::int AS needed,
           COALESCE(pd.printed, 0)::int AS printed,
           COALESCE(lc.lines_all, 0)::int AS lines_all,
           COALESCE(lc.lines_ticked, 0)::int AS lines_ticked,
           CASE WHEN COALESCE(pd.needed, 0) = 0 THEN 'NONE'
                WHEN COALESCE(pd.done_all, 0) = 0 THEN 'NOT'
                WHEN pd.all_done THEN 'DONE'
                ELSE 'PART'
           END AS state_code
      FROM docs d
      LEFT JOIN per_doc pd
        ON pd.doc_id = d.doc_id
       AND pd.acc_year = d.acc_year
      LEFT JOIN line_counts lc
        ON lc.doc_id = d.doc_id
       AND lc.acc_year = d.acc_year
)
SELECT COALESCE(s.refno, '') AS refno,
       to_char(s.doc_date, 'DD-MM-YYYY') AS doc_date_text,
       CASE WHEN s.doc_type = 'SHORTAGE_RECEIPT' THEN 'Shortage Receipt'
            WHEN s.source_kind = 'GRN' THEN 'Purchase Entry · from GRN'
            WHEN s.source_kind = 'SISTER_SALE' THEN 'Purchase Entry · sister'
            ELSE 'Purchase Entry'
       END AS type_text,
       COALESCE(sp.sup_name, '') AS supplier_name,
       s.lines_ticked || ' of ' || s.lines_all AS lines_text,
       s.needed,
       s.printed,
       CASE s.state_code WHEN 'NOT' THEN 'Not printed'
                         WHEN 'PART' THEN 'Part · ' || s.printed || ' of ' || s.needed
                         WHEN 'DONE' THEN 'Printed'
                         ELSE 'No labels'
       END AS state_text,
       s.doc_type,
       s.doc_id,
       s.acc_year,
       s.state_code,
       s.source_kind
  FROM shown s
  LEFT JOIN purchase.suppliers sp ON sp.sup_id = s.supplier_id
 WHERE ('isticker_only' = '0' OR s.needed > 0)
   AND (   'ishow' = 'ALL'
        OR ('ishow' = 'NOT' AND s.state_code = 'NOT')
        OR ('ishow' = 'PART' AND s.state_code = 'PART')
        OR ('ishow' = 'DONE' AND s.state_code = 'DONE')
        OR ('ishow' NOT IN ('ALL', 'NOT', 'PART', 'DONE') AND s.state_code IN ('NOT', 'PART')))
 ORDER BY s.doc_date DESC, s.refno DESC$new$;
    v_old_desc text := 'Sticker Printing (menu 32) Load from a document picker (Ctrl+O): one row per posted Purchase Entry or Shortage Receipt of this branch, newest document date first, with the stickers it needs and those printed. Tokens (send every one; compared as text): icompany_id, ibranch_id, ifrom_date, ito_date (yyyy-MM-dd on the document date; '''' = no bound), idoc_type ('''' / PURCHASE_BILL / SHORTAGE_RECEIPT), isupplier_id ('''' = all), idoc_text ('''' = all; else part of the number), ishow (NOTPART = not printed + part printed, the default; NOT / PART / DONE / ALL), isticker_only (1 = items ticked Sticker only, and documents with nothing to print left out; 0 = every item). Per document + item + batch: Labels = saleable received + free in the item''s default unit, rounded down, at least 1 (1 when that unit has decimals); Printed = the document''s PRINT jobs that did not fail plus, for a bill made from a GRN, the labels of cancelled bills of the same GRN lines, at most Labels. Lines = lines ticked Sticker of all lines. Hidden: doc_type, doc_id, acc_year, state_code (NONE / NOT / PART / DONE), source_kind.';
    v_new_desc text := 'Sticker Printing (menu 32) Load from a document picker (Ctrl+O): one row per posted Purchase Entry or Shortage Receipt of this branch, newest document date first, with the stickers it needs and those printed. Tokens (send every one; compared as text): icompany_id, ibranch_id, ifrom_date, ito_date (yyyy-MM-dd on the document date; '''' = no bound), idoc_type ('''' / PURCHASE_BILL / SHORTAGE_RECEIPT), isupplier_id ('''' = all), idoc_text ('''' = all; else part of the number), ishow (NOTPART = not printed + part printed, the default; NOT / PART / DONE / ALL), isticker_only (1 = items ticked Sticker only, and documents with nothing to print left out; 0 = every item). Per document + item + batch: Labels = saleable received + free in the item''s default unit, rounded down, at least 1 (1 when that unit has decimals); Printed = the labels of the document''s PRINT jobs that did not fail plus, for a bill made from a GRN, the labels of cancelled bills of the same GRN lines, at most Labels; a line that reprints another (a resend of a failed reprint) never counts. Lines = lines ticked Sticker of all lines. Hidden: doc_type, doc_id, acc_year, state_code (NONE / NOT / PART / DONE), source_kind.';
    r          fixed.grid_details%ROWTYPE;
    v_sql      text;
    v_desc     text;
BEGIN
    SELECT * INTO r
      FROM fixed.grid_details g
     WHERE g.grid_id = 224
       FOR UPDATE;
    IF NOT FOUND THEN
        RAISE NOTICE '20261127100100: grid 224 is not here (fresh database: Grid_Details.sql carries the new row). Skipped.';
        RETURN;
    END IF;
    IF r.grid_name IS DISTINCT FROM 'POPUP - STICKER SOURCE DOCUMENTS' THEN
        RAISE NOTICE '20261127100100: grid 224 is "%", not POPUP - STICKER SOURCE DOCUMENTS. Left as is.', r.grid_name;
        RETURN;
    END IF;

    v_sql  := r.grid_sql;
    v_desc := r.grid_description;
    IF regexp_replace(coalesce(v_sql, ''), '\s+', ' ', 'g') = regexp_replace(v_new_sql, '\s+', ' ', 'g') THEN
        NULL;
    ELSIF regexp_replace(coalesce(v_sql, ''), '\s+', ' ', 'g') = regexp_replace(v_old_sql, '\s+', ' ', 'g') THEN
        v_sql := v_new_sql;
    ELSE
        RAISE NOTICE '20261127100100: grid 224 SQL is not the text 20261127100000 shipped (edited since?). Left as is.';
    END IF;
    IF v_desc = v_old_desc THEN
        v_desc := v_new_desc;
    END IF;

    IF v_sql IS DISTINCT FROM r.grid_sql
    OR v_desc IS DISTINCT FROM r.grid_description THEN
        UPDATE fixed.grid_details
           SET grid_sql         = v_sql,
               grid_description = v_desc,
               grid_modified_by = 'system',
               grid_modified_on = now()
         WHERE grid_id = 224;
    END IF;
END
$mig$;


-- ── 2 · F6 ui_table 58 GRN - LINES: column 35 "Labels" hidden ─────────────
UPDATE fixed.ui_table_columns c
   SET ui_tbl_clm_column_visibility = false,
       ui_tbl_clm_column_width      = 0.00,
       ui_tbl_clm_modified_by       = 'system',
       ui_tbl_clm_modified_on       = now()
 WHERE c.ui_tbl_clm_table_id = 58
   AND c.ui_tbl_clm_no = 35
   AND c.ui_tbl_clm_name = 'Labels'
   AND c.ui_tbl_clm_is_deleted = false
   AND EXISTS (SELECT 1 FROM fixed.ui_tables t WHERE t.ui_tbl_id = 58 AND t.ui_tbl_name = 'GRN - LINES')
   AND (c.ui_tbl_clm_column_visibility, c.ui_tbl_clm_column_width) IS DISTINCT FROM (false, 0.00::numeric);

-- The shown widths: the 16 default columns re-summed to 100.00 (x 100 / 95.38,
-- the rounding rest to Item), the 9 optional ones on the same scale.
UPDATE fixed.ui_table_columns c
   SET ui_tbl_clm_column_width = v.width,
       ui_tbl_clm_modified_by  = 'system',
       ui_tbl_clm_modified_on  = now()
  FROM (VALUES
     (0::bigint, 'Barcode'::text, 6.79::numeric)
    ,(1 , 'Item'           , 12.64)
    ,(2 , 'Unit'           , 4.85)
    ,(4 , 'PO pend.'       , 5.83)
    ,(5 , 'Challan'        , 4.85)
    ,(6 , 'Received'       , 5.83)
    ,(7 , 'Dmg'            , 3.88)
    ,(32, 'Dmg reason'     , 6.79)
    ,(8 , 'Free'           , 3.88)
    ,(9 , 'Short'          , 3.88)
    ,(10, 'Prov. rate'     , 5.83)
    ,(12, 'Batch / Serial' , 7.77)
    ,(13, 'Expiry'         , 7.77)
    ,(14, 'MRP'            , 4.85)
    ,(34, 'Shelf life'     , 5.83)
    ,(36, 'Check'          , 8.73)
    ,(27, 'Excess'         , 4.85)
    ,(28, 'Excess action'  , 6.79)
    ,(25, 'Model / design' , 7.77)
    ,(21, 'Size'           , 3.88)
    ,(23, 'Colour'         , 4.85)
    ,(26, 'Sell A'         , 4.85)
    ,(29, 'Sell B'         , 4.85)
    ,(30, 'Sell C'         , 4.85)
    ,(31, 'Sell D'         , 4.85)
       ) v(no, name, width)
 WHERE c.ui_tbl_clm_table_id = 58
   AND c.ui_tbl_clm_no = v.no
   AND c.ui_tbl_clm_name = v.name
   AND c.ui_tbl_clm_is_deleted = false
   AND c.ui_tbl_clm_column_visibility
   AND EXISTS (SELECT 1 FROM fixed.ui_tables t WHERE t.ui_tbl_id = 58 AND t.ui_tbl_name = 'GRN - LINES')
   AND c.ui_tbl_clm_column_width IS DISTINCT FROM v.width;


-- Checks after deploy (read-only): Shared/Prathap/admin/sql/sticker-sp2-fixes-assert.sql
