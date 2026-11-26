-- ═══════════════════════════════════════════════════════════════════════════
--  Sticker printing S-P2 (transactions), step P2-1 (DB)              2026-11-26
--  Folder: prisma/migrations/20261127100000_sticker_printing_sp2/ (share copy:
--  Shared/Prathap/admin/sql/sticker-sp2-migration.sql, run by
--  run-sticker-sp2-apply.sh, checked by sticker-sp2-assert.sql).
--
--  Plan: Shared/Prathap/printing/sticker-printing/plan-sticker-printing-sp2-2026-11-26.md
--  §6 (DB), §4 (rules), §5 (offline / sync), §11 step P2-1; SP2-Q1 ... Q21 and
--  SM2-1 ... SM2-12 answered "all recommended", the architect's calls C1-C14
--  confirmed, the user's "go" 2026-11-26. Sorts after
--  20261126180000_app_theme_template_v68. Every id, name and value list below
--  was read from the live dev DB on 2026-11-26.
--
--   0 · guards: every pinned id / name is free or already ours. A clash is
--       named in a WARNING and only that piece is skipped (a ui column whose id
--       is taken gets a fresh id instead). Never raises on a live mismatch
--       (P3009); the runner's assert file is what refuses a dev apply with a
--       piece missing.
--   1 · inventory.label_job: + lbj_src_refno varchar(40) (the document number,
--       readable before the document syncs, §5); ck_lbj_src widened to MANUAL
--       (no source at all) or DOCUMENT (PURCHASE_BILL / SHORTAGE_RECEIPT, id,
--       year and number all set). Value-shape only (§5). The 283 MANUAL jobs
--       pass it; a database with a row that does not gets it NOT VALID plus a
--       WARNING. + ix_lbj_src_doc (lbj_src_doc_id, lbj_src_acc_year) WHERE
--       lbj_src_doc_id IS NOT NULL: made on the partitioned parent, which
--       builds and attaches one index per year partition (as S-P1's indexes),
--       and every partition ensure_acc_year_partitions makes later clones it.
--       The helper itself is unchanged (no new table). The sync triggers and
--       ix_sync_pending_label_job are untouched.
--   2 · grid 224 POPUP - STICKER SOURCE DOCUMENTS (menu 32 Load from a
--       document · Ctrl+O, plan §6.2) + 13 columns (8 shown, 5 hidden), pinned
--       ids 01a2129c-2240-7000-8000-000000224001 ... 013.
--   3 · grid 223 MAIN LIST - STICKER JOBS (§6.3): SQL + source_text ("Manual"
--       when none), lbj_src_doc_type / _doc_id / _acc_year, token isrc_text;
--       the SQL and description move only while they hold the text
--       20261126100000 shipped (white space folded). + columns 17 Source
--       (shown, position 10) and 18-20 (hidden); Reason / Status to positions
--       11 / 12, the hidden 12-16 to 13-17; shown widths from picture 3.
--   4 · ui_table 88 STICKER PRINTING - PRINT LIST (§6.4): + columns 27-36
--       (ids 2883-2892): 27 From and 28 Printed shown at positions 9 / 10,
--       29-36 hidden (SrcDocType, SrcDocId, SrcAccYear, SrcRefno, SrcLineId,
--       Needed, Left, Carried); Labels / Design / Last printed to 11 / 12 / 13,
--       the hidden 12-26 to 14-28 (positions are a rank: each column its own);
--       shown widths from picture 3 (100.00). Enter stops unchanged.
--   5 · setting purchase.labels_after_post (§6.5): max scope COMPANY ->
--       DEVICE (never narrowed), label "Stickers after post", the new
--       description. Values and default (ASK) unchanged; no value rows on dev.
--   6 · 14 wording rows of the 10 new STICKER_DOC_ codes (§6.6), catalogue
--       2026-11-27.1. prisma/seed/Error_Messages.json carries the same rows.
--
--  Grid_Details.sql, Grid_Columns.sql and Ui_Table_Columns.sql carry the same
--  rows for a fresh database (where grids and ui tables are seeded after the
--  migrations, so those parts no-op here). The setting has no seed file: this
--  migration is its copy. No business-logic function or trigger. Every
--  statement is re-runnable: applied twice in one transaction the second run
--  changes nothing. Grid SQL holds no comment marker; its tokens are always
--  sent and compared as text (company and branch through a scalar sub-select
--  on their master, so the uuid indexes still serve).
-- ═══════════════════════════════════════════════════════════════════════════


-- ── 0 · pinned ids / names free (or already ours) ─────────────────────────
DO $$
DECLARE
    v_clash text;
BEGIN
    SELECT string_agg(x, '; ') INTO v_clash FROM (
        SELECT format('grid %s is "%s"', g.grid_id, g.grid_name) AS x
          FROM fixed.grid_details g
         WHERE (g.grid_id = 224 AND g.grid_name IS DISTINCT FROM 'POPUP - STICKER SOURCE DOCUMENTS')
            OR (upper(g.grid_name) = 'POPUP - STICKER SOURCE DOCUMENTS' AND g.grid_id <> 224)
            OR (g.grid_id = 223 AND g.grid_name IS DISTINCT FROM 'MAIN LIST - STICKER JOBS')
        UNION ALL
        SELECT format('grid column %s (grid %s no %s)', c.grid_column_id, c.grid_id, c.grid_column_number)
          FROM fixed.grid_columns c
         WHERE (c.grid_column_id::text LIKE '01a2129c-2240-%'
                AND (c.grid_id, c.grid_column_number) IS DISTINCT FROM (224::bigint, right(c.grid_column_id::text, 3)::int))
            OR (c.grid_column_id::text LIKE '01a2129c-2230-%'
                AND (c.grid_id, c.grid_column_number) IS DISTINCT FROM (223::bigint, right(c.grid_column_id::text, 3)::int))
        UNION ALL
        SELECT format('ui_table 88 is "%s"', t.ui_tbl_name)
          FROM fixed.ui_tables t
         WHERE t.ui_tbl_id = 88 AND t.ui_tbl_name IS DISTINCT FROM 'STICKER PRINTING - PRINT LIST'
        UNION ALL
        SELECT format('ui_table_columns id %s is table %s no %s (a fresh id is used instead)',
                      c.ui_tbl_clm_id, c.ui_tbl_clm_table_id, c.ui_tbl_clm_no)
          FROM fixed.ui_table_columns c
         WHERE c.ui_tbl_clm_id BETWEEN 2883 AND 2892
           AND (c.ui_tbl_clm_table_id, c.ui_tbl_clm_no) IS DISTINCT FROM (88::bigint, (c.ui_tbl_clm_id - 2856)::bigint)
        UNION ALL
        SELECT format('setting %s is %s (want TEXT)', s.asd_key, s.asd_data_type)
          FROM public.app_setting_def s
         WHERE s.asd_key = 'purchase.labels_after_post' AND s.asd_data_type IS DISTINCT FROM 'TEXT'
        UNION ALL
        SELECT 'inventory.label_job is missing or not partitioned'
         WHERE NOT EXISTS (SELECT 1 FROM pg_class c
                            WHERE c.oid = to_regclass('inventory.label_job') AND c.relkind = 'p')
        UNION ALL
        SELECT format('column label_job.lbj_src_refno already exists as %s', format_type(a.atttypid, a.atttypmod))
          FROM pg_attribute a
         WHERE a.attrelid = to_regclass('inventory.label_job') AND a.attname = 'lbj_src_refno' AND NOT a.attisdropped
           AND format_type(a.atttypid, a.atttypmod) <> 'character varying(40)'
        UNION ALL
        SELECT format('index inventory.ix_lbj_src_doc already exists on %s', i.indrelid::regclass)
          FROM pg_index i
          JOIN pg_class c ON c.oid = i.indexrelid
         WHERE c.relnamespace = 'inventory'::regnamespace AND c.relname = 'ix_lbj_src_doc'
           AND i.indrelid IS DISTINCT FROM to_regclass('inventory.label_job')
    ) s;
    IF v_clash IS NOT NULL THEN
        RAISE WARNING 'Sticker printing S-P2: already taken by something else, so that piece is skipped: %', v_clash;
    END IF;
END $$;


-- ── 1 · inventory.label_job: the source document (plan §6.1, §4.4, §5) ────
ALTER TABLE inventory.label_job
    ADD COLUMN IF NOT EXISTS lbj_src_refno varchar(40);

-- Widened only while it is not already (S-P3 adds the Make's type to the list
-- later; a re-run must not narrow it back). Rows that break the new rule are
-- counted first: none on dev (283 MANUAL jobs, no source column set).
DO $$
DECLARE
    v_def  text;
    v_bad  bigint;
    v_rule constant text :=
        '(    lbj_src_kind = ''MANUAL'' AND lbj_src_doc_type IS NULL AND lbj_src_doc_id IS NULL'
        || ' AND lbj_src_acc_year IS NULL AND lbj_src_refno IS NULL)'
        || ' OR (lbj_src_kind = ''DOCUMENT'' AND lbj_src_doc_type IN (''PURCHASE_BILL'', ''SHORTAGE_RECEIPT'')'
        || ' AND lbj_src_doc_id IS NOT NULL AND lbj_src_acc_year IS NOT NULL AND lbj_src_refno IS NOT NULL)';
BEGIN
    IF to_regclass('inventory.label_job') IS NULL THEN
        RETURN;
    END IF;
    SELECT pg_get_constraintdef(c.oid) INTO v_def
      FROM pg_constraint c
     WHERE c.conrelid = 'inventory.label_job'::regclass AND c.conname = 'ck_lbj_src';
    IF v_def LIKE '%SHORTAGE_RECEIPT%' AND v_def LIKE '%lbj_src_refno%' THEN
        RETURN;
    END IF;
    EXECUTE 'SELECT count(*) FROM inventory.label_job WHERE NOT (' || v_rule || ')' INTO v_bad;
    IF v_def IS NOT NULL THEN
        ALTER TABLE inventory.label_job DROP CONSTRAINT ck_lbj_src;
    END IF;
    IF v_bad = 0 THEN
        EXECUTE 'ALTER TABLE inventory.label_job ADD CONSTRAINT ck_lbj_src CHECK (' || v_rule || ')';
    ELSE
        EXECUTE 'ALTER TABLE inventory.label_job ADD CONSTRAINT ck_lbj_src CHECK (' || v_rule || ') NOT VALID';
        RAISE WARNING 'Sticker printing S-P2: % sticker job(s) break the new ck_lbj_src (a source half set); it is added NOT VALID. Fix those rows, then VALIDATE CONSTRAINT.', v_bad;
    END IF;
END $$;

-- On the partitioned parent: Postgres builds one index per year partition and
-- attaches it, and a partition made later by ensure_acc_year_partitions gets
-- its own copy. Partial, so it is DB-only (not declared in the Prisma model).
CREATE INDEX IF NOT EXISTS ix_lbj_src_doc
    ON inventory.label_job (lbj_src_doc_id, lbj_src_acc_year)
    WHERE lbj_src_doc_id IS NOT NULL;

COMMENT ON COLUMN inventory.label_job.lbj_src_kind IS
    'MANUAL = typed / scanned lines, no source; DOCUMENT = the lines of one posted purchase bill (PURCHASE_BILL) or shortage receipt (SHORTAGE_RECEIPT), S-P2. ck_lbj_src: MANUAL has no source column set, DOCUMENT has all four. A reprint / resend copies the source of its original.';
COMMENT ON COLUMN inventory.label_job.lbj_src_doc_type IS
    'DOCUMENT jobs: PURCHASE_BILL (pur_invoice) or SHORTAGE_RECEIPT (pur_shortage_receipt). No FK (two types, partitioned, either may sync first, §5).';
COMMENT ON COLUMN inventory.label_job.lbj_src_doc_id IS
    'DOCUMENT jobs: pi_id / psr_id of the source. "Printed" of a document = SUM(labels) of its PRINT jobs that did not fail (ix_lbj_src_doc).';
COMMENT ON COLUMN inventory.label_job.lbj_src_acc_year IS
    'DOCUMENT jobs: the source document''s year (pi_acc_year / psr_acc_year).';
COMMENT ON COLUMN inventory.label_job.lbj_src_refno IS
    'DOCUMENT jobs: the source document''s full number (PUR/2026-2027/D8/01177), frozen at print, so the job reads right before the document syncs (§5). NULL for MANUAL.';
COMMENT ON COLUMN inventory.label_job_line.lbjl_src_line_id IS
    'DOCUMENT jobs: the document line the label came from (pii_id / psri_id; the lowest line number when the Print list merged two lines of one item + batch, C13). Trace only: counts go by item + batch.';


-- ── 2 · grid 224 POPUP - STICKER SOURCE DOCUMENTS (§6.2) ──────────────────
-- Tokens (every caller sends every one, compared as text, never cast):
-- icompany_id, ibranch_id; ifrom_date / ito_date (yyyy-MM-dd on the document
-- date, '' = no bound); idoc_type ('' / PURCHASE_BILL / SHORTAGE_RECEIPT);
-- isupplier_id ('' = all); idoc_text ('' = all, else part of the number);
-- ishow (NOTPART = not + part printed, the default; NOT / PART / DONE / ALL);
-- isticker_only (1 = items ticked Sticker only, and a document with nothing
-- to print is left out; 0 = every item). Counts per document + item + batch
-- (plan §4.1 / §4.2): needed = saleable received + free in base units over
-- the Def unit (default, else base, else first unit), rounded down, at least
-- 1; 1 when the Def unit has decimals. Printed = PRINT jobs of the document
-- not FAILED, plus (bills) labels of cancelled bills that billed the same GRN
-- lines (C4), at most needed per item + batch. The grid SQL holds no comment
-- marker.
INSERT INTO fixed.grid_details
       (grid_id, grid_name, grid_description, grid_sort_column, grid_sort_order, grid_device_type,
        grid_status, grid_is_deleted, grid_created_by, grid_sql)
SELECT 224, 'POPUP - STICKER SOURCE DOCUMENTS',
 'Sticker Printing (menu 32) Load from a document picker (Ctrl+O): one row per posted Purchase Entry or Shortage Receipt of this branch, newest document date first, with the stickers it needs and those printed. Tokens (send every one; compared as text): icompany_id, ibranch_id, ifrom_date, ito_date (yyyy-MM-dd on the document date; '''' = no bound), idoc_type ('''' / PURCHASE_BILL / SHORTAGE_RECEIPT), isupplier_id ('''' = all), idoc_text ('''' = all; else part of the number), ishow (NOTPART = not printed + part printed, the default; NOT / PART / DONE / ALL), isticker_only (1 = items ticked Sticker only, and documents with nothing to print left out; 0 = every item). Per document + item + batch: Labels = saleable received + free in the item''s default unit, rounded down, at least 1 (1 when that unit has decimals); Printed = the document''s PRINT jobs that did not fail plus, for a bill made from a GRN, the labels of cancelled bills of the same GRN lines, at most Labels. Lines = lines ticked Sticker of all lines. Hidden: doc_type, doc_id, acc_year, state_code (NONE / NOT / PART / DONE), source_kind.',
 'refno', 'Descending', 'Desktop', true, false, 'system',
$g224$WITH docs AS (
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
 ORDER BY s.doc_date DESC, s.refno DESC$g224$
 WHERE NOT EXISTS (SELECT 1 FROM fixed.grid_details g
                    WHERE g.grid_id = 224 OR upper(g.grid_name) = 'POPUP - STICKER SOURCE DOCUMENTS')
ON CONFLICT (grid_id) DO NOTHING;

-- Widths: picture 2 (sticker_sp2_mockup_2_pick.png) in proportion, 100.00
-- over the 8 shown. State is drawn as a badge by the screen (state_code).
INSERT INTO fixed.grid_columns
       (grid_column_id, grid_id, grid_column_number, grid_column_name, grid_column_sql_field_name,
        grid_column_data_type, grid_column_width, grid_column_position, grid_column_alignment,
        grid_column_visibility, grid_column_filter, grid_column_group, grid_column_total,
        grid_column_notes, grid_column_is_deleted, grid_column_created_by)
SELECT v.id, 224, v.no, v.name, v.fld, v.typ, v.width, v.no, v.align, v.visible, v.filter,
       false, false, v.fld, false, 'system'
  FROM (VALUES
    ('01a2129c-2240-7000-8000-000000224001'::uuid, 1::integer, 'Doc no'::text, 'refno'::text, 'Text'::text, 17.71::numeric, 'Left'::text, true::boolean, true::boolean),
    ('01a2129c-2240-7000-8000-000000224002', 2, 'Date', 'doc_date_text', 'Text', 8.38, 'Left', true, false),
    ('01a2129c-2240-7000-8000-000000224003', 3, 'Type', 'type_text', 'Text', 16.95, 'Left', true, true),
    ('01a2129c-2240-7000-8000-000000224004', 4, 'Supplier', 'supplier_name', 'Text', 17.71, 'Left', true, true),
    ('01a2129c-2240-7000-8000-000000224005', 5, 'Lines ticked', 'lines_text', 'Text', 8.38, 'Center', true, false),
    ('01a2129c-2240-7000-8000-000000224006', 6, 'Labels', 'needed', 'Number', 6.67, 'Right', true, false),
    ('01a2129c-2240-7000-8000-000000224007', 7, 'Printed', 'printed', 'Number', 6.67, 'Right', true, false),
    ('01a2129c-2240-7000-8000-000000224008', 8, 'State', 'state_text', 'Text', 17.53, 'Left', true, true),
    ('01a2129c-2240-7000-8000-000000224009', 9, 'Doc type', 'doc_type', 'Text', 0.00, 'Left', false, false),
    ('01a2129c-2240-7000-8000-000000224010', 10, 'Doc id', 'doc_id', 'Text', 0.00, 'Left', false, false),
    ('01a2129c-2240-7000-8000-000000224011', 11, 'Year', 'acc_year', 'Text', 0.00, 'Left', false, false),
    ('01a2129c-2240-7000-8000-000000224012', 12, 'State code', 'state_code', 'Text', 0.00, 'Left', false, false),
    ('01a2129c-2240-7000-8000-000000224013', 13, 'Source kind', 'source_kind', 'Text', 0.00, 'Left', false, false)
       ) v(id, no, name, fld, typ, width, align, visible, filter)
 WHERE EXISTS (SELECT 1 FROM fixed.grid_details d
                WHERE d.grid_id = 224 AND d.grid_name = 'POPUP - STICKER SOURCE DOCUMENTS')
   AND NOT EXISTS (SELECT 1 FROM fixed.grid_columns e
                    WHERE e.grid_id = 224 AND e.grid_column_number = v.no AND e.grid_column_is_deleted = false)
ON CONFLICT (grid_column_id) DO NOTHING;

SELECT setval(pg_get_serial_sequence('fixed.grid_details', 'grid_id'),
              GREATEST((SELECT COALESCE(max(grid_id), 1) FROM fixed.grid_details),
                       (SELECT last_value FROM fixed.grid_details_grid_id_seq)));


-- ── 3 · grid 223 MAIN LIST - STICKER JOBS: Source column + filter (§6.3) ──
-- Each field moves only while it holds the text 20261126100000 shipped (white
-- space folded): already the new text = nothing to do; grid absent (a fresh
-- database: Grid_Details.sql carries the new row) = skipped; any other text
-- (edited on this site) = left as is, with a notice. New token isrc_text
-- ('' = all; else jobs whose source number contains it), always sent; an
-- unsent one reads as all ('isrc' || '_text' is the token's own text, which
-- the runner never binds), so the S-P1 Printed jobs tab and S-P1's API suite
-- keep listing every job until they send it.
DO $mig$
DECLARE
    v_old_sql  text := $old$SELECT j.lbj_refno,
       to_char(j.lbj_printed_on AT TIME ZONE 'Asia/Kolkata', 'DD-MM-YYYY HH12:MI AM') AS printed_at,
       COALESCE(u.usr_login_name, '') AS by_name,
       COALESCE(NULLIF(d.dev_device_name, ''), d.dev_code, '') AS counter_name,
       COALESCE(t.ptl_name, '') AS design_name,
       j.lbj_printer_name,
       j.lbj_line_count,
       j.lbj_label_count,
       CASE WHEN j.lbj_kind = 'REPRINT' THEN 'Reprint of ' || COALESCE(o.lbj_refno, '')
            ELSE 'Print' END AS kind_text,
       CASE j.lbj_reason_code WHEN 'JAMMED' THEN 'Labels jammed / spoiled'
                              WHEN 'ROLL_OUT' THEN 'Roll ran out in the middle'
                              WHEN 'TORN' THEN 'Label torn / fell off'
                              WHEN 'OTHER' THEN 'Other'
                              ELSE '' END
       || CASE WHEN j.lbj_reason_code IS NOT NULL AND length(btrim(COALESCE(j.lbj_reason_note, ''))) > 0
               THEN ': ' || btrim(j.lbj_reason_note)
               ELSE '' END AS reason_text,
       CASE j.lbj_status WHEN 'PRINTED' THEN 'Printed'
                         WHEN 'FAILED' THEN 'Failed'
                         WHEN 'SENT' THEN 'Sent'
                         ELSE j.lbj_status END AS status_text,
       j.lbj_id,
       j.lbj_acc_year,
       j.lbj_status AS status_code,
       j.lbj_kind AS kind_code,
       j.lbj_device_id
  FROM inventory.label_job j
  LEFT JOIN public.user_master u ON u.usr_id = j.lbj_printed_by
  LEFT JOIN fixed.device_master d ON d.dev_id = j.lbj_device_id
  LEFT JOIN public.print_template t ON t.ptl_id = j.lbj_template_id
  LEFT JOIN inventory.label_job o ON o.lbj_id = j.lbj_reprint_of_id
                                 AND o.lbj_acc_year = j.lbj_reprint_of_acc_year
 WHERE j.lbj_company_id::text = 'icompany_id'
   AND j.lbj_branch_id::text = 'ibranch_id'
   AND (NULLIF('ifrom_date', '') IS NULL OR to_char(j.lbj_printed_on AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD') >= 'ifrom_date')
   AND (NULLIF('ito_date', '') IS NULL OR to_char(j.lbj_printed_on AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD') <= 'ito_date')
   AND ('idevice_id' = '' OR j.lbj_device_id::text = 'idevice_id')
   AND ('iuser_id' = '' OR j.lbj_printed_by::text = 'iuser_id')
   AND ('iitem_text' = ''
        OR EXISTS (SELECT 1
                     FROM inventory.label_job_line l
                     JOIN inventory.item_master i ON i.item_id = l.lbjl_item_id
                    WHERE l.lbjl_job_id = j.lbj_id
                      AND l.lbjl_acc_year = j.lbj_acc_year
                      AND i.item_name_en ILIKE '%' || 'iitem_text' || '%'))
 ORDER BY j.lbj_printed_on DESC, j.lbj_id DESC$old$;
    v_new_sql  text := $new$SELECT j.lbj_refno,
       to_char(j.lbj_printed_on AT TIME ZONE 'Asia/Kolkata', 'DD-MM-YYYY HH12:MI AM') AS printed_at,
       COALESCE(u.usr_login_name, '') AS by_name,
       COALESCE(NULLIF(d.dev_device_name, ''), d.dev_code, '') AS counter_name,
       COALESCE(t.ptl_name, '') AS design_name,
       j.lbj_printer_name,
       j.lbj_line_count,
       j.lbj_label_count,
       CASE WHEN j.lbj_kind = 'REPRINT' THEN 'Reprint of ' || COALESCE(o.lbj_refno, '')
            ELSE 'Print' END AS kind_text,
       COALESCE(j.lbj_src_refno, 'Manual') AS source_text,
       CASE j.lbj_reason_code WHEN 'JAMMED' THEN 'Labels jammed / spoiled'
                              WHEN 'ROLL_OUT' THEN 'Roll ran out in the middle'
                              WHEN 'TORN' THEN 'Label torn / fell off'
                              WHEN 'OTHER' THEN 'Other'
                              ELSE '' END
       || CASE WHEN j.lbj_reason_code IS NOT NULL AND length(btrim(COALESCE(j.lbj_reason_note, ''))) > 0
               THEN ': ' || btrim(j.lbj_reason_note)
               ELSE '' END AS reason_text,
       CASE j.lbj_status WHEN 'PRINTED' THEN 'Printed'
                         WHEN 'FAILED' THEN 'Failed'
                         WHEN 'SENT' THEN 'Sent'
                         ELSE j.lbj_status END AS status_text,
       j.lbj_id,
       j.lbj_acc_year,
       j.lbj_status AS status_code,
       j.lbj_kind AS kind_code,
       j.lbj_device_id,
       j.lbj_src_doc_type,
       j.lbj_src_doc_id,
       j.lbj_src_acc_year
  FROM inventory.label_job j
  LEFT JOIN public.user_master u ON u.usr_id = j.lbj_printed_by
  LEFT JOIN fixed.device_master d ON d.dev_id = j.lbj_device_id
  LEFT JOIN public.print_template t ON t.ptl_id = j.lbj_template_id
  LEFT JOIN inventory.label_job o ON o.lbj_id = j.lbj_reprint_of_id
                                 AND o.lbj_acc_year = j.lbj_reprint_of_acc_year
 WHERE j.lbj_company_id::text = 'icompany_id'
   AND j.lbj_branch_id::text = 'ibranch_id'
   AND (NULLIF('ifrom_date', '') IS NULL OR to_char(j.lbj_printed_on AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD') >= 'ifrom_date')
   AND (NULLIF('ito_date', '') IS NULL OR to_char(j.lbj_printed_on AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD') <= 'ito_date')
   AND ('idevice_id' = '' OR j.lbj_device_id::text = 'idevice_id')
   AND ('iuser_id' = '' OR j.lbj_printed_by::text = 'iuser_id')
   AND ('iitem_text' = ''
        OR EXISTS (SELECT 1
                     FROM inventory.label_job_line l
                     JOIN inventory.item_master i ON i.item_id = l.lbjl_item_id
                    WHERE l.lbjl_job_id = j.lbj_id
                      AND l.lbjl_acc_year = j.lbj_acc_year
                      AND i.item_name_en ILIKE '%' || 'iitem_text' || '%'))
   AND ('isrc_text' IN ('', 'isrc' || '_text') OR COALESCE(j.lbj_src_refno, '') ILIKE '%' || 'isrc_text' || '%')
 ORDER BY j.lbj_printed_on DESC, j.lbj_id DESC$new$;
    v_old_desc text := 'Sticker Printing (menu 32) Printed jobs tab: one row per sticker job of this branch, newest first. Tokens (send every one): icompany_id, ibranch_id, ifrom_date, ito_date (yyyy-MM-dd on the IST print date; '''' = no bound), idevice_id ('''' = all counters), iuser_id ('''' = all users), iitem_text ('''' = all; else jobs with a line whose item name contains it). Kind = Print or Reprint of <job no>; Reason = the fixed reason words, then ": note". Hidden: lbj_id, lbj_acc_year, status_code, kind_code, lbj_device_id.';
    v_new_desc text := 'Sticker Printing (menu 32) Printed jobs tab: one row per sticker job of this branch, newest first. Tokens (send every one): icompany_id, ibranch_id, ifrom_date, ito_date (yyyy-MM-dd on the IST print date; '''' = no bound), idevice_id ('''' = all counters), iuser_id ('''' = all users), iitem_text ('''' = all; else jobs with a line whose item name contains it), isrc_text ('''' = all; else jobs whose source document number contains it; an unsent isrc_text also reads as all, so a caller from before S-P2 still lists every job). Kind = Print or Reprint of <job no>; Source = the source document number (lbj_src_refno), Manual when none; Reason = the fixed reason words, then ": note". Hidden: lbj_id, lbj_acc_year, status_code, kind_code, lbj_device_id, lbj_src_doc_type, lbj_src_doc_id, lbj_src_acc_year.';
    r          fixed.grid_details%ROWTYPE;
    v_sql      text;
    v_desc     text;
BEGIN
    SELECT * INTO r
      FROM fixed.grid_details g
     WHERE g.grid_id = 223
       FOR UPDATE;
    IF NOT FOUND THEN
        RAISE NOTICE '20261127100000: grid 223 is not here (fresh database: Grid_Details.sql carries the new row). Skipped.';
        RETURN;
    END IF;
    IF r.grid_name IS DISTINCT FROM 'MAIN LIST - STICKER JOBS' THEN
        RAISE NOTICE '20261127100000: grid 223 is "%", not MAIN LIST - STICKER JOBS. Left as is.', r.grid_name;
        RETURN;
    END IF;

    v_sql  := r.grid_sql;
    v_desc := r.grid_description;
    IF regexp_replace(coalesce(v_sql, ''), '\s+', ' ', 'g') = regexp_replace(v_new_sql, '\s+', ' ', 'g') THEN
        NULL;
    ELSIF regexp_replace(coalesce(v_sql, ''), '\s+', ' ', 'g') = regexp_replace(v_old_sql, '\s+', ' ', 'g') THEN
        v_sql := v_new_sql;
    ELSE
        RAISE NOTICE '20261127100000: grid 223 SQL is not the text 20261126100000 shipped (edited since?). Left as is.';
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
         WHERE grid_id = 223;
    END IF;
END
$mig$;

-- New columns 17-20 (pinned ids ...223017-020); only on our grid 223.
INSERT INTO fixed.grid_columns
       (grid_column_id, grid_id, grid_column_number, grid_column_name, grid_column_sql_field_name,
        grid_column_data_type, grid_column_width, grid_column_position, grid_column_alignment,
        grid_column_visibility, grid_column_filter, grid_column_group, grid_column_total,
        grid_column_notes, grid_column_is_deleted, grid_column_created_by)
SELECT v.id, 223, v.no, v.name, v.fld, 'Text', v.width, v.pos, 'Left', v.visible, v.filter,
       false, false, v.fld, false, 'system'
  FROM (VALUES
    ('01a2129c-2230-7000-8000-000000223017'::uuid, 17::integer, 'Source'::text, 'source_text'::text, 14.40::numeric, 10.00::numeric, true::boolean, true::boolean),
    ('01a2129c-2230-7000-8000-000000223018', 18, 'Source type', 'lbj_src_doc_type', 0.00, 18.00, false, false),
    ('01a2129c-2230-7000-8000-000000223019', 19, 'Source id', 'lbj_src_doc_id', 0.00, 19.00, false, false),
    ('01a2129c-2230-7000-8000-000000223020', 20, 'Source year', 'lbj_src_acc_year', 0.00, 20.00, false, false)
       ) v(id, no, name, fld, width, pos, visible, filter)
 WHERE EXISTS (SELECT 1 FROM fixed.grid_details d
                WHERE d.grid_id = 223 AND d.grid_name = 'MAIN LIST - STICKER JOBS')
   AND NOT EXISTS (SELECT 1 FROM fixed.grid_columns e
                    WHERE e.grid_id = 223 AND e.grid_column_number = v.no AND e.grid_column_is_deleted = false)
ON CONFLICT (grid_column_id) DO NOTHING;

-- The 16 S-P1 columns: shown widths from picture 3 (sticker_sp2_mockup_3_list.png,
-- 100.00 over the 12 shown with Source); Reason / Status one place after
-- Source; the hidden ones after them. Matched on number AND field, so a
-- column re-purposed on this site is left alone; a no-op once in place.
UPDATE fixed.grid_columns c
   SET grid_column_width       = v.width,
       grid_column_position    = v.pos,
       grid_column_modified_by = 'system',
       grid_column_modified_on = now()
  FROM (VALUES
    (1::integer, 'lbj_refno'::text, 7.44::numeric, 1.00::numeric),
    (2, 'printed_at', 12.14, 2.00),
    (3, 'by_name', 5.02, 3.00),
    (4, 'counter_name', 5.99, 4.00),
    (5, 'design_name', 11.49, 5.00),
    (6, 'lbj_printer_name', 6.80, 6.00),
    (7, 'lbj_line_count', 3.72, 7.00),
    (8, 'lbj_label_count', 4.37, 8.00),
    (9, 'kind_text', 12.14, 9.00),
    (10, 'reason_text', 10.68, 11.00),
    (11, 'status_text', 5.81, 12.00),
    (12, 'lbj_id', 0.00, 13.00),
    (13, 'lbj_acc_year', 0.00, 14.00),
    (14, 'status_code', 0.00, 15.00),
    (15, 'kind_code', 0.00, 16.00),
    (16, 'lbj_device_id', 0.00, 17.00)
       ) v(no, fld, width, pos)
 WHERE c.grid_id = 223
   AND c.grid_column_number = v.no
   AND c.grid_column_sql_field_name = v.fld
   AND c.grid_column_is_deleted = false
   AND EXISTS (SELECT 1 FROM fixed.grid_details d
                WHERE d.grid_id = 223 AND d.grid_name = 'MAIN LIST - STICKER JOBS')
   AND (c.grid_column_width, c.grid_column_position) IS DISTINCT FROM (v.width, v.pos);


-- ── 4 · ui_table 88 STICKER PRINTING - PRINT LIST: From / Printed (§6.4) ───
-- Numbers 27-36 are the screen's StickerCols (From = 27 ... Carried = 36).
-- Positions are a rank (NexTable::applyLayout: the first row of a position
-- wins it), so every column keeps its own: 0 RowKind, 1-8 as before, From 9,
-- Printed 10, Labels 11, Design 12, Last printed 13, the hidden 12-26 at
-- 14-28, the new hidden 29-36 at 29-36. A column id that is taken by another
-- table's column gets a fresh id from the sequence instead (section 0 names it).
INSERT INTO fixed.ui_table_columns
       (ui_tbl_clm_id, ui_tbl_clm_table_id, ui_tbl_clm_no, ui_tbl_clm_name, ui_tbl_clm_column_width,
        ui_tbl_clm_column_visibility, ui_tbl_clm_column_focus, ui_tbl_clm_column_position,
        ui_tbl_clm_column_necessity, ui_tbl_clm_is_active, ui_tbl_clm_is_deleted, ui_tbl_clm_created_by)
SELECT CASE WHEN EXISTS (SELECT 1 FROM fixed.ui_table_columns x WHERE x.ui_tbl_clm_id = v.id)
            THEN nextval(pg_get_serial_sequence('fixed.ui_table_columns', 'ui_tbl_clm_id'))
            ELSE v.id END,
       88, v.no, v.name, v.width, v.visible, false, v.pos, false, true, false, 'system'
  FROM (VALUES
     (2883::bigint, 27::bigint, 'From'::text, 10.77::numeric, true::boolean, 9::integer)
    ,(2884, 28, 'Printed',    6.35, true,   10)
    ,(2885, 29, 'SrcDocType', 0.00, false,  29)
    ,(2886, 30, 'SrcDocId',   0.00, false,  30)
    ,(2887, 31, 'SrcAccYear', 0.00, false,  31)
    ,(2888, 32, 'SrcRefno',   0.00, false,  32)
    ,(2889, 33, 'SrcLineId',  0.00, false,  33)
    ,(2890, 34, 'Needed',     0.00, false,  34)
    ,(2891, 35, 'Left',       0.00, false,  35)
    ,(2892, 36, 'Carried',    0.00, false,  36)
       ) v(id, no, name, width, visible, pos)
 WHERE EXISTS (SELECT 1 FROM fixed.ui_tables t WHERE t.ui_tbl_id = 88 AND t.ui_tbl_name = 'STICKER PRINTING - PRINT LIST')
   AND NOT EXISTS (SELECT 1 FROM fixed.ui_table_columns e
                    WHERE e.ui_tbl_clm_table_id = 88 AND e.ui_tbl_clm_no = v.no AND e.ui_tbl_clm_is_deleted = false)
ON CONFLICT (ui_tbl_clm_id) DO NOTHING;

-- The 27 S-P1 columns: new shown widths (picture 3, 100.00 over the 13 shown)
-- and positions. Matched on number AND name; a no-op once in place.
UPDATE fixed.ui_table_columns c
   SET ui_tbl_clm_column_width    = v.width,
       ui_tbl_clm_column_position = v.pos,
       ui_tbl_clm_modified_by     = 'system',
       ui_tbl_clm_modified_on     = now()
  FROM (VALUES
     (0::bigint, 'RowKind'::text, 0.00::numeric, 0::integer)
    ,(1,  '#',             2.50,  1)
    ,(2,  'Item',         17.69,  2)
    ,(3,  'Unit',          4.04,  3)
    ,(4,  'Barcode',       9.04,  4)
    ,(5,  'Batch',         5.96,  5)
    ,(6,  'Expiry',        5.38,  6)
    ,(7,  'MRP',           5.58,  7)
    ,(8,  'Our price',     6.35,  8)
    ,(9,  'Labels',        5.00, 11)
    ,(10, 'Design',       12.12, 12)
    ,(11, 'Last printed',  9.22, 13)
    ,(12, 'ItemId',        0.00, 14)
    ,(13, 'UnitId',        0.00, 15)
    ,(14, 'LotId',         0.00, 16)
    ,(15, 'TemplateId',    0.00, 17)
    ,(16, 'DesignSource',  0.00, 18)
    ,(17, 'LotRequired',   0.00, 19)
    ,(18, 'NoBarcode',     0.00, 20)
    ,(19, 'LabelW',        0.00, 21)
    ,(20, 'LabelH',        0.00, 22)
    ,(21, 'Across',        0.00, 23)
    ,(22, 'Key',           0.00, 24)
    ,(23, 'CostCode',      0.00, 25)
    ,(24, 'PriceCode',     0.00, 26)
    ,(25, 'StockQty',      0.00, 27)
    ,(26, 'Problem',       0.00, 28)
       ) v(no, name, width, pos)
 WHERE c.ui_tbl_clm_table_id = 88
   AND c.ui_tbl_clm_no = v.no
   AND c.ui_tbl_clm_name = v.name
   AND c.ui_tbl_clm_is_deleted = false
   AND EXISTS (SELECT 1 FROM fixed.ui_tables t WHERE t.ui_tbl_id = 88 AND t.ui_tbl_name = 'STICKER PRINTING - PRINT LIST')
   AND (c.ui_tbl_clm_column_width, c.ui_tbl_clm_column_position) IS DISTINCT FROM (v.width, v.pos);

SELECT setval('fixed.ui_table_columns_ui_tbl_clm_id_seq',
              GREATEST((SELECT last_value FROM fixed.ui_table_columns_ui_tbl_clm_id_seq),
                       (SELECT COALESCE(MAX(ui_tbl_clm_id), 1) FROM fixed.ui_table_columns)), true);


-- ── 5 · setting purchase.labels_after_post: per counter (§6.5, Q5, C1) ────
-- Max scope COMPANY -> DEVICE (a counter may differ; never narrowed: a site
-- that set it wider keeps that). Values (ASK / ALWAYS / NEVER) and the default
-- ASK unchanged, so existing company / branch value rows stay valid. Read for
-- stickers by GET /stickers/docs/state with the session's device (C1).
UPDATE public.app_setting_def
   SET asd_max_scope   = CASE WHEN asd_max_scope IN ('GLOBAL', 'COMPANY', 'BRANCH') THEN 'DEVICE' ELSE asd_max_scope END,
       asd_label       = 'Stickers after post',
       asd_description = 'After a Purchase Entry or Shortage Receipt is posted. ASK: asks, then opens Sticker Printing with the document''s lines. ALWAYS: opens Sticker Printing with them, no question. NEVER: nothing (the document''s Stickers button still works). Set per company, and per counter where a counter differs.',
       asd_modified_on = now(),
       asd_modified_by = 'system'
 WHERE asd_key = 'purchase.labels_after_post'
   AND asd_data_type = 'TEXT'
   AND (   asd_max_scope IN ('GLOBAL', 'COMPANY', 'BRANCH')
        OR asd_label IS DISTINCT FROM 'Stickers after post'
        OR asd_description IS DISTINCT FROM 'After a Purchase Entry or Shortage Receipt is posted. ASK: asks, then opens Sticker Printing with the document''s lines. ALWAYS: opens Sticker Printing with them, no question. NEVER: nothing (the document''s Stickers button still works). Set per company, and per counter where a counter differs.');


-- ── 6 · plain wording rows (notes 120), catalogue 2026-11-27.1 (§6.6) ──────
-- {name} values are filled by the server (refusals) or by Qt (the after-post
-- question, the cancel sentence); the filler drops a name it cannot fill.
-- prisma/seed/Error_Messages.json carries the same rows.
INSERT INTO fixed.error_message
    (erm_code, erm_variant, erm_lang, erm_title, erm_line, erm_todo)
VALUES
     ('STICKER_DOC_TYPE_INVALID', '', 'en', 'Not a sticker document', 'Stickers come from a purchase bill or a shortage receipt.', 'Pick one of those.')
    ,('STICKER_DOC_NOT_FOUND', '', 'en', 'Document not found', '{doc} is not in this company.', 'Load it again from Load from a document (Ctrl+O).')
    ,('STICKER_DOC_OTHER_BRANCH', '', 'en', 'Another branch''s document', '{doc} belongs to another branch.', 'Print its stickers at that branch.')
    ,('STICKER_DOC_NOT_POSTED', '', 'en', 'Not posted', '{doc} is {status}: only a posted bill or receipt gives stickers.', 'Post it first.')
    ,('STICKER_DOC_NOTHING_TICKED', '', 'en', 'Nothing to load', '{doc} has no line ticked Sticker.', 'Untick "Only items ticked Sticker" to load all its lines.')
    ,('STICKER_DOC_ALREADY_LISTED', '', 'en', 'Already in the list', '{doc} is already in the Print list.', 'Print it, or clear the list (Ctrl+N) and load it again.')
    ,('STICKER_DOC_OVER_LEFT', '', 'en', 'Nothing left to print', '{item}: {printed} of {needed} labels of {doc} are printed.', 'To print some again, use Reprint in Printed jobs (Ctrl+H): it asks why.')
    ,('STICKER_DOC_OVER_LEFT', 'rule=LEFT', 'en', 'Too many labels', '{item}: only {left} labels of {doc} are left to print.', 'Type {left} or fewer. For more, use Reprint in Printed jobs (Ctrl+H).')
    ,('STICKER_DOC_LINE_NOT_ON_DOC', '', 'en', 'Not on this document', 'A line sent to print is not on {doc}.', 'Load the document again (Ctrl+O).')
    ,('STICKER_DOC_LINE_NOT_ON_DOC', 'rule=UNIT', 'en', 'Wrong unit', '{item} prints from {doc} in its default unit only.', 'Load the document again (Ctrl+O).')
    ,('STICKER_DOC_ASK', '', 'en', 'Print stickers?', '{doc} is posted. {ticked} of its {lines} lines are ticked Sticker: {labels} labels.', 'Sticker Printing opens with them. Check the lines, then Print · Ctrl+P.')
    ,('STICKER_DOC_ASK', 'rule=CARRIED', 'en', 'Print stickers?', '{doc} is posted. Its lines came on {grn}, first billed on {cancelled} (cancelled). {carried} of their {needed} labels were printed then and count here: {left} are left.', 'Sticker Printing opens with the {left}. Check the lines, then Print · Ctrl+P.')
    ,('STICKER_DOC_PRINTED', '', 'en', 'Stickers printed', '{labels} stickers were printed for it ({jobs}).', 'Take them off the goods that go back.')
    ,('STICKER_DOC_PRINTED', 'rule=GRN_BILL', 'en', 'Stickers printed', '{labels} stickers were printed for it ({jobs}). The goods stay in stock under {grn}.', 'Do not print them again: the next bill of {grn} counts them.')
ON CONFLICT (erm_code, erm_variant, erm_lang) DO NOTHING;
UPDATE fixed.error_message_catalogue
   SET emc_version   = '2026-11-27.1',
       emc_row_count = (SELECT count(*) FROM fixed.error_message WHERE erm_is_active),
       emc_loaded_on = now()
 WHERE emc_id = 1
   AND emc_version < '2026-11-27.1';


-- Checks after deploy (read-only): Shared/Prathap/admin/sql/sticker-sp2-assert.sql
