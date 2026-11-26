-- ═══════════════════════════════════════════════════════════════════════════
--  Sticker printing S-P1 (masters), step P1-1 (DB)                2026-11-25
--  Folder: prisma/migrations/20261126100000_sticker_printing_sp1/ (share copy:
--  Shared/Prathap/admin/sql/sticker-sp1-migration.sql, run by
--  run-sticker-sp1-apply.sh, checked by sticker-sp1-assert.sql).
--
--  Plan: Shared/Prathap/printing/sticker-printing/plan-sticker-printing-sp1-2026-11-25.md
--  §6 (DB), §5 (offline / sync), §7.4 (refusals); S1-S19, SM1-SM16 and
--  PQ1-PQ6 answered "all recommended", the user's "go" 2026-11-25. Sorts after
--  20261125100000_qty_price_card_margin_columns. Every id, name and value list
--  below was read from the live dev DB on 2026-11-25.
--
--   0 · guards: every pinned id / name is free or already ours. A clash is
--       named in a WARNING and only that piece is skipped (a ui column whose id
--       is taken gets a fresh id instead). The migration never raises on a live
--       mismatch (P3009: the live VPS is seeded apart from dev); the runner's
--       assert file is what refuses a dev apply with a piece missing.
--   1 · public.print_template_version: the label sheet, 8 columns
--       ptv_label_width_mm / _height_mm / _across / _down / _gap_x_mm /
--       _gap_y_mm / _rotate / _dpi + ck_ptv_label_sheet (the five sizing
--       columns all NULL or all set and in range), ck_ptv_label_gaps,
--       ck_ptv_label_rotate. Existing versions take NULL / 0 and pass.
--   2 · public.print_purpose ITEM_LABEL / PACK_LABEL / SHELF_LABEL: shared
--       (company NULL), INVENTORY / LABEL_JOB, 1 copy, no copy labels,
--       reprint allowed, sort 150-152, pinned uuidv7 ids.
--   3 · inventory.label_job (lbj_), PARTITION BY LIST (lbj_acc_year): one row
--       per printed design group (a sticker job), numbered per counter
--       (ux_lbj_device_no), frozen design revision and printer, status
--       SENT -> PRINTED / FAILED. Reprint / resend sources carry no FK (§5).
--   4 · inventory.label_job_line (lbjl_), PARTITION BY LIST (lbjl_acc_year):
--       the job's frozen lines (barcode, MRP, price, batch, dates, codes,
--       labels). FK to its job ON DELETE CASCADE. Sync triggers + pending
--       index on both tables, only where the sync functions exist
--       (20261117100000 pattern).
--   5 · public.ensure_acc_year_partitions: the live body (last redefined by
--       20261119100000_whatsapp, read back with pg_get_functiondef on
--       2026-11-25, unchanged since) copied forward with label_job, then
--       label_job_line, added before the stock engine's call; partitions
--       backfilled for every year public.txn_status_log has a partition for.
--   6 · inventory.item_master: fk_item_barcode_sticker (item_barcode_sticker_id
--       -> public.print_template, ON UPDATE CASCADE ON DELETE SET NULL; 0 rows
--       set on dev) + partial ix_item_barcode_sticker.
--       public.txn_status_log: ck_tsl_src_doc_type gains LABEL_JOB (the live
--       value list is read back and kept).
--   7 · seed rows: setting inventory.label_cost_code (INVENTORY / Labels /
--       TEXT / COMPANY); menu 32 Sticker Printing under 3 at 35.00, verbs
--       {VIEW,PRINT}, no user_menus rows (the admin ticks it per user);
--       db_table_master 942 / 943 (the 9xx INVENTORY block); ui_tables 88-90
--       + columns 2838-2882; grid 223 MAIN LIST - STICKER JOBS + 16 columns;
--       dropdowns 81 STICKER DESIGNS, 82 DEVICES - THIS BRANCH, 83 USERS -
--       THIS COMPANY + columns; 47 error rows (plan §7.4), catalogue
--       2026-11-25.1. Menu_Master.sql, Db_Table_Master.sql, Ui_Tables.sql,
--       Ui_Table_Columns.sql, Grid_Details.sql, Grid_Columns.sql,
--       Dropdown_Details.sql, Dropdown_Columns.sql and Error_Messages.json
--       carry the same rows. The setting and the print purposes are not
--       seeded from files (as the WhatsApp ones); this migration is their copy.
--
--  No business-logic function or trigger: the only function touched is the
--  existing partition helper; the sync triggers are the existing local-only
--  infrastructure, guarded. Every statement is re-runnable: applied twice in
--  one transaction the second run changes nothing. On a fresh database menus,
--  grids, ui_tables and dropdowns are seeded after the migrations, so those
--  parts no-op here and the seed files carry the rows. Grid and dropdown SQL
--  hold no comment marker; their tokens are always sent and compared as text.
-- ═══════════════════════════════════════════════════════════════════════════


-- ── 0 · pinned ids / names free (or already ours) ─────────────────────────
DO $$
DECLARE
    v_clash text;
BEGIN
    SELECT string_agg(x, '; ') INTO v_clash FROM (
        SELECT format('menu %s is "%s" (parent %s)', m.menu_id, m.menu_name, m.menu_parent) AS x
          FROM fixed.menu_master m
         WHERE m.menu_id = 32 AND m.menu_name IS DISTINCT FROM 'Sticker Printing'
        UNION ALL
        SELECT format('grid %s is "%s"', g.grid_id, g.grid_name)
          FROM fixed.grid_details g
         WHERE g.grid_id = 223 AND g.grid_name IS DISTINCT FROM 'MAIN LIST - STICKER JOBS'
        UNION ALL
        SELECT format('grid column %s (grid %s no %s)', c.grid_column_id, c.grid_id, c.grid_column_number)
          FROM fixed.grid_columns c
         WHERE c.grid_column_id::text LIKE '01a2129c-2230-%'
           AND (c.grid_id, c.grid_column_number) IS DISTINCT FROM (223::bigint, right(c.grid_column_id::text, 3)::int)
        UNION ALL
        SELECT format('ui_table %s is "%s"', t.ui_tbl_id, t.ui_tbl_name)
          FROM fixed.ui_tables t
          JOIN (VALUES (88::bigint, 'STICKER PRINTING - PRINT LIST'::text),
                       (89, 'STICKER PRINTING - JOB LINES'),
                       (90, 'STICKER PRINTING - REPRINT LINES')) v(id, name)
            ON v.id = t.ui_tbl_id
         WHERE t.ui_tbl_name IS DISTINCT FROM v.name
        UNION ALL
        SELECT format('ui_table_columns id %s is table %s no %s (a fresh id is used instead)',
                      c.ui_tbl_clm_id, c.ui_tbl_clm_table_id, c.ui_tbl_clm_no)
          FROM fixed.ui_table_columns c
         WHERE c.ui_tbl_clm_id BETWEEN 2838 AND 2882
           AND (c.ui_tbl_clm_table_id, c.ui_tbl_clm_no) IS DISTINCT FROM
               (CASE WHEN c.ui_tbl_clm_id <= 2864 THEN 88 WHEN c.ui_tbl_clm_id <= 2875 THEN 89 ELSE 90 END::bigint,
                c.ui_tbl_clm_id - CASE WHEN c.ui_tbl_clm_id <= 2864 THEN 2838 WHEN c.ui_tbl_clm_id <= 2875 THEN 2865 ELSE 2876 END)
        UNION ALL
        SELECT format('dropdown %s is "%s"', d.dropdown_id, d.dropdown_name)
          FROM fixed.dropdown_details d
          JOIN (VALUES (81, 'STICKER DESIGNS'::text), (82, 'DEVICES - THIS BRANCH'), (83, 'USERS - THIS COMPANY')) v(id, name)
            ON v.id = d.dropdown_id OR upper(d.dropdown_name) = v.name
         WHERE (d.dropdown_id = v.id AND d.dropdown_name IS DISTINCT FROM v.name)
            OR (upper(d.dropdown_name) = v.name AND d.dropdown_id <> v.id)
        UNION ALL
        SELECT format('dropdown column %s (dropdown %s no %s)', c.dropdown_columns_id,
                      c.dropdown_columns_dropdown_id, c.dropdown_columns_no)
          FROM fixed.dropdown_columns c
         WHERE c.dropdown_columns_id::text LIKE '01a2129c-8_00-7000-8000-%'
           AND (c.dropdown_columns_dropdown_id, c.dropdown_columns_no)
               IS DISTINCT FROM (substr(c.dropdown_columns_id::text, 10, 2)::int, right(c.dropdown_columns_id::text, 1)::int)
        UNION ALL
        SELECT format('db_table_master %s is %s.%s', d.dtm_id, d.dtm_schema, d.dtm_table)
          FROM public.db_table_master d
          JOIN (VALUES (942, 'label_job'::text), (943, 'label_job_line')) v(id, tbl)
            ON v.id = d.dtm_id OR (d.dtm_schema = 'inventory' AND d.dtm_table = v.tbl)
         WHERE (d.dtm_id, d.dtm_schema::text, d.dtm_table::text) IS DISTINCT FROM (v.id, 'inventory', v.tbl)
        UNION ALL
        SELECT format('print purpose %s (%s / %s, id %s)', p.ppo_code, p.ppo_src_module, p.ppo_doc_type, p.ppo_id)
          FROM public.print_purpose p
          JOIN (VALUES ('01a2129c-9007-7834-8801-900627c72bab'::uuid, 'ITEM_LABEL'::text),
                       ('01a2129c-900a-73eb-814c-f657c63ac969', 'PACK_LABEL'),
                       ('01a2129c-900d-7f34-ac95-e13370d6724f', 'SHELF_LABEL')) v(id, code)
            ON v.id = p.ppo_id
            OR (p.ppo_company_id IS NULL AND lower(p.ppo_code::text) = lower(v.code) AND p.ppo_is_deleted = false)
         WHERE (p.ppo_id, upper(p.ppo_code::text), p.ppo_src_module::text, p.ppo_doc_type::text)
               IS DISTINCT FROM (v.id, v.code, 'INVENTORY', 'LABEL_JOB')
        UNION ALL
        SELECT format('setting %s (%s, %s, %s)', s.asd_key, s.asd_module, s.asd_data_type, s.asd_max_scope)
          FROM public.app_setting_def s
         WHERE s.asd_key = 'inventory.label_cost_code'
           AND (s.asd_module::text, s.asd_data_type::text, s.asd_max_scope::text)
               IS DISTINCT FROM ('INVENTORY', 'TEXT', 'COMPANY')
        UNION ALL
        SELECT format('column print_template_version.%s already exists as %s', c.column_name, c.data_type)
          FROM information_schema.columns c
          JOIN (VALUES ('ptv_label_width_mm'::text, 'numeric'::text), ('ptv_label_height_mm', 'numeric'),
                       ('ptv_label_across', 'smallint'), ('ptv_label_down', 'smallint'),
                       ('ptv_label_gap_x_mm', 'numeric'), ('ptv_label_gap_y_mm', 'numeric'),
                       ('ptv_label_rotate', 'smallint'), ('ptv_label_dpi', 'smallint')) v(col, typ)
            ON c.table_schema = 'public' AND c.table_name = 'print_template_version' AND c.column_name = v.col
         WHERE c.data_type IS DISTINCT FROM v.typ
        UNION ALL
        SELECT format('table inventory.%s exists and is not partitioned', c.relname)
          FROM pg_class c
         WHERE c.relnamespace = 'inventory'::regnamespace
           AND c.relname IN ('label_job', 'label_job_line')
           AND c.relkind <> 'p'
        UNION ALL
        SELECT format('item_master constraint fk_item_barcode_sticker exists as %s', pg_get_constraintdef(c.oid))
          FROM pg_constraint c
         WHERE c.conrelid = 'inventory.item_master'::regclass
           AND c.conname = 'fk_item_barcode_sticker'
           AND c.confrelid IS DISTINCT FROM 'public.print_template'::regclass
    ) s;
    IF v_clash IS NOT NULL THEN
        RAISE WARNING 'Sticker printing S-P1: already taken by something else, so that piece is skipped: %', v_clash;
    END IF;
END $$;


-- ── 1 · print_template_version: the label sheet (plan §4.1, §6.1) ──────────
-- Constant defaults: the existing versions take NULL / 0 with no rewrite.
ALTER TABLE public.print_template_version
    ADD COLUMN IF NOT EXISTS ptv_label_width_mm  numeric(8,2),
    ADD COLUMN IF NOT EXISTS ptv_label_height_mm numeric(8,2),
    ADD COLUMN IF NOT EXISTS ptv_label_across    smallint,
    ADD COLUMN IF NOT EXISTS ptv_label_down      smallint,
    ADD COLUMN IF NOT EXISTS ptv_label_gap_x_mm  numeric(6,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS ptv_label_gap_y_mm  numeric(6,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS ptv_label_rotate    smallint     NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS ptv_label_dpi       smallint;

-- The "all set" branch tests IS NOT NULL first, so a half-filled sheet is
-- refused (a NULL comparison would otherwise let it pass).
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'public.print_template_version'::regclass AND conname = 'ck_ptv_label_sheet') THEN
        ALTER TABLE public.print_template_version
            ADD CONSTRAINT ck_ptv_label_sheet CHECK (
                   (    ptv_label_width_mm IS NULL AND ptv_label_height_mm IS NULL
                    AND ptv_label_across IS NULL AND ptv_label_down IS NULL AND ptv_label_dpi IS NULL)
                OR (    ptv_label_width_mm IS NOT NULL AND ptv_label_height_mm IS NOT NULL
                    AND ptv_label_across IS NOT NULL AND ptv_label_down IS NOT NULL AND ptv_label_dpi IS NOT NULL
                    AND ptv_label_width_mm > 0 AND ptv_label_height_mm > 0
                    AND ptv_label_across BETWEEN 1 AND 20
                    AND ptv_label_down BETWEEN 1 AND 50
                    AND ptv_label_dpi IN (203, 300, 600)));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'public.print_template_version'::regclass AND conname = 'ck_ptv_label_gaps') THEN
        ALTER TABLE public.print_template_version
            ADD CONSTRAINT ck_ptv_label_gaps CHECK (ptv_label_gap_x_mm >= 0 AND ptv_label_gap_y_mm >= 0);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'public.print_template_version'::regclass AND conname = 'ck_ptv_label_rotate') THEN
        ALTER TABLE public.print_template_version
            ADD CONSTRAINT ck_ptv_label_rotate CHECK (ptv_label_rotate IN (0, 90, 180, 270));
    END IF;
END $$;

COMMENT ON COLUMN public.print_template_version.ptv_label_width_mm IS
    'Label sheet (sticker designs, 20261126100000): ONE label''s width in mm as a person reads it; > 0, at most 500 (server). NULL on every non-label design. The five sizing columns are all NULL or all set (ck_ptv_label_sheet).';
COMMENT ON COLUMN public.print_template_version.ptv_label_height_mm IS
    'Label sheet: one label''s height in mm as a person reads it.';
COMMENT ON COLUMN public.print_template_version.ptv_label_across IS
    'Label sheet: labels across the roll / sheet, 1-20.';
COMMENT ON COLUMN public.print_template_version.ptv_label_down IS
    'Label sheet: labels down the page, 1-50; 1 = a roll, more = a sheet (A4).';
COMMENT ON COLUMN public.print_template_version.ptv_label_gap_x_mm IS
    'Label sheet: gap between labels across, mm (>= 0).';
COMMENT ON COLUMN public.print_template_version.ptv_label_gap_y_mm IS
    'Label sheet: gap between labels down, mm (>= 0); put on the page only for a sheet (labels down > 1), a roll''s gap is the printer''s gap sensor.';
COMMENT ON COLUMN public.print_template_version.ptv_label_rotate IS
    'Label sheet: how the label sits on the liner, 0 / 90 / 180 / 270 degrees.';
COMMENT ON COLUMN public.print_template_version.ptv_label_dpi IS
    'Label sheet: snap-to dpi, 203 / 300 / 600; bars land on whole dots at the printer''s own dpi when Qt reports it, else this one. The page (ptv_width_mm / ptv_height_mm) is worked out by the server at save.';


-- ── 2 · print purposes ITEM_LABEL / PACK_LABEL / SHELF_LABEL (§6.2) ────────
INSERT INTO public.print_purpose
       (ppo_id, ppo_company_id, ppo_code, ppo_name, ppo_src_module, ppo_doc_type, ppo_copy_count,
        ppo_copy_labels, ppo_allow_reprint, ppo_sort_order, ppo_notes, ppo_is_active, ppo_is_deleted)
SELECT v.id, NULL, v.code, v.name, 'INVENTORY', 'LABEL_JOB', 1, NULL, true, v.sort, v.notes, true, false
  FROM (VALUES
        ('01a2129c-9007-7834-8801-900627c72bab'::uuid, 'ITEM_LABEL'::text, 'Item label'::text, 150::smallint,
         'Item label: the price / barcode sticker on goods. Printed from Sticker Printing (menu 32). A label design carries its label sheet on the version (ptv_label_*); its body is one REPORT_HEADER band reading the MASTER dataset label (provider stickers.label). Jobs are logged in inventory.label_job, not print_log.'::text),
        ('01a2129c-900a-73eb-814c-f657c63ac969', 'PACK_LABEL', 'Pack label', 151::smallint,
         'Pack label: the shop''s own packs (LM + FSSAI fields; net qty, unit sale price, food mark and label note come with the kit, S-P3). Same label path and job log as ITEM_LABEL.'),
        ('01a2129c-900d-7f34-ac95-e13370d6724f', 'SHELF_LABEL', 'Shelf label', 152::smallint,
         'Shelf label: the shelf edge (name, price, MRP). Same label path and job log as ITEM_LABEL.')
       ) v(id, code, name, sort, notes)
 WHERE NOT EXISTS (SELECT 1 FROM public.print_purpose p
                    WHERE p.ppo_id = v.id
                       OR (p.ppo_company_id IS NULL AND lower(p.ppo_code::text) = lower(v.code) AND p.ppo_is_deleted = false));


-- ── 3 · inventory.label_job: one row per printed design group (§6.3) ───────
-- Numbered per counter (D8-000127, the serial restarts each year, PQ3): only
-- one counter writes its series, so ux_lbj_device_no cannot clash at sync.
-- CHECKs are value-shape only. No FK on the reprint / resend sources: a
-- reprint and its source may reach the cloud in either order (§5).
CREATE TABLE IF NOT EXISTS inventory.label_job (
    lbj_id                   uuid           NOT NULL DEFAULT uuidv7(),
    lbj_acc_year             character(9)   NOT NULL,
    lbj_company_id           uuid           NOT NULL,
    lbj_branch_id            uuid           NOT NULL,
    lbj_device_id            uuid           NOT NULL,
    lbj_slno                 integer        NOT NULL,
    lbj_refno                varchar(30)    NOT NULL,
    lbj_purpose_id           uuid           NOT NULL,
    lbj_template_id          uuid           NOT NULL,
    lbj_version_id           uuid           NOT NULL,
    lbj_printer_name         varchar(150)   NOT NULL,
    lbj_printer_dpi          smallint,
    lbj_price_level          smallint       NOT NULL,
    lbj_start_at             smallint       NOT NULL DEFAULT 1,
    lbj_kind                 varchar(10)    NOT NULL DEFAULT 'PRINT',
    lbj_reprint_of_id        uuid,
    lbj_reprint_of_acc_year  character(9),
    lbj_resend_of_id         uuid,
    lbj_resend_of_acc_year   character(9),
    lbj_reason_code          varchar(10),
    lbj_reason_note          varchar(250),
    lbj_src_kind             varchar(20)    NOT NULL DEFAULT 'MANUAL',
    lbj_src_doc_type         varchar(30),
    lbj_src_doc_id           uuid,
    lbj_src_acc_year         character(9),
    lbj_line_count           smallint       NOT NULL,
    lbj_label_count          integer        NOT NULL,
    lbj_page_count           integer,
    lbj_status               varchar(10)    NOT NULL DEFAULT 'SENT',
    lbj_status_on            timestamptz(6),
    lbj_printer_message      varchar(250),
    lbj_printed_on           timestamptz(6) NOT NULL DEFAULT now(),
    lbj_printed_by           uuid           NOT NULL,
    lbj_modified_on          timestamptz(6),
    lbj_modified_by          uuid,
    lbj_sync_date            timestamptz(6),
    CONSTRAINT pk_label_job PRIMARY KEY (lbj_id, lbj_acc_year),
    CONSTRAINT ck_lbj_kind CHECK (lbj_kind IN ('PRINT', 'REPRINT')),
    CONSTRAINT ck_lbj_status CHECK (lbj_status IN ('SENT', 'PRINTED', 'FAILED')),
    CONSTRAINT ck_lbj_reason_code CHECK (lbj_reason_code IS NULL OR lbj_reason_code IN ('JAMMED', 'ROLL_OUT', 'TORN', 'OTHER')),
    CONSTRAINT ck_lbj_reprint CHECK (
            ((lbj_kind = 'REPRINT') = (lbj_reprint_of_id IS NOT NULL))
        AND ((lbj_kind = 'REPRINT') = (lbj_reason_code IS NOT NULL))
        AND (lbj_reason_code IS DISTINCT FROM 'OTHER' OR length(btrim(COALESCE(lbj_reason_note, ''))) > 0)),
    CONSTRAINT ck_lbj_resend CHECK (lbj_resend_of_id IS NULL OR lbj_kind = 'PRINT'),
    CONSTRAINT ck_lbj_src CHECK (lbj_src_kind = 'MANUAL' AND lbj_src_doc_id IS NULL),
    CONSTRAINT ck_lbj_counts CHECK (lbj_line_count >= 1 AND lbj_label_count >= 1 AND lbj_start_at >= 1 AND lbj_slno >= 1),
    CONSTRAINT ck_lbj_price_level CHECK (lbj_price_level BETWEEN 1 AND 4),
    CONSTRAINT fk_lbj_company    FOREIGN KEY (lbj_company_id)  REFERENCES public.companys (comp_id)              ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_lbj_branch     FOREIGN KEY (lbj_branch_id)   REFERENCES public.branch_master (br_id)          ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_lbj_device     FOREIGN KEY (lbj_device_id)   REFERENCES fixed.device_master (dev_id)          ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_lbj_purpose    FOREIGN KEY (lbj_purpose_id)  REFERENCES public.print_purpose (ppo_id)         ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_lbj_template   FOREIGN KEY (lbj_template_id) REFERENCES public.print_template (ptl_id)        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_lbj_version    FOREIGN KEY (lbj_version_id)  REFERENCES public.print_template_version (ptv_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_lbj_printed_by FOREIGN KEY (lbj_printed_by)  REFERENCES public.user_master (usr_id)           ON UPDATE CASCADE ON DELETE RESTRICT
) PARTITION BY LIST (lbj_acc_year);

CREATE UNIQUE INDEX IF NOT EXISTS ux_lbj_device_no
    ON inventory.label_job (lbj_company_id, lbj_branch_id, lbj_device_id, lbj_acc_year, lbj_slno);
CREATE INDEX IF NOT EXISTS ix_lbj_list
    ON inventory.label_job (lbj_company_id, lbj_branch_id, lbj_printed_on DESC);
CREATE INDEX IF NOT EXISTS ix_lbj_reprint_of
    ON inventory.label_job (lbj_reprint_of_id) WHERE lbj_reprint_of_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_lbj_resend_of
    ON inventory.label_job (lbj_resend_of_id) WHERE lbj_resend_of_id IS NOT NULL;

COMMENT ON TABLE inventory.label_job IS 'Sticker Printing (menu 32): one row per printed design group, a sticker job. Numbered per counter (dev_code-000127, the serial restarts each financial year). The design revision, printer, price level and every line''s figures are frozen at print; nothing is edited afterwards except the one status step SENT -> PRINTED / FAILED (txn_status_log LABEL_JOB). A reprint (kind REPRINT, a reason) or a resend of a failed job (kind PRINT) is a new job. Sticker jobs do not write print_log.';
COMMENT ON COLUMN inventory.label_job.lbj_acc_year IS 'The company''s financial year at print (partition key).';
COMMENT ON COLUMN inventory.label_job.lbj_refno IS 'dev_code || ''-'' || the 6-digit serial, e.g. D8-000127.';
COMMENT ON COLUMN inventory.label_job.lbj_version_id IS 'The design revision used, frozen; a reprint uses the original job''s.';
COMMENT ON COLUMN inventory.label_job.lbj_printer_dpi IS 'The dpi Qt reported for the queue; NULL = the design''s snap dpi was used.';
COMMENT ON COLUMN inventory.label_job.lbj_reprint_of_id IS 'REPRINT: the original job (always the first print, never a reprint). No FK: the two may sync in either order.';
COMMENT ON COLUMN inventory.label_job.lbj_resend_of_id IS 'A FAILED job sent again (kind PRINT, no reason). No FK.';
COMMENT ON COLUMN inventory.label_job.lbj_reason_code IS 'REPRINT only: JAMMED / ROLL_OUT / TORN / OTHER (OTHER needs lbj_reason_note).';
COMMENT ON COLUMN inventory.label_job.lbj_src_kind IS 'MANUAL in S-P1; S-P2 widens ck_lbj_src for jobs from a GRN / purchase bill (lbj_src_doc_*).';


-- ── 4 · inventory.label_job_line: the job's frozen lines (§6.4) ────────────
CREATE TABLE IF NOT EXISTS inventory.label_job_line (
    lbjl_id                  uuid           NOT NULL DEFAULT uuidv7(),
    lbjl_acc_year            character(9)   NOT NULL,
    lbjl_job_id              uuid           NOT NULL,
    lbjl_line_no             smallint       NOT NULL,
    lbjl_item_id             uuid           NOT NULL,
    lbjl_unit_id             uuid           NOT NULL,
    lbjl_lot_id              uuid,
    lbjl_barcode             varchar(50),
    lbjl_mrp                 numeric(14,2),
    lbjl_price               numeric(14,2),
    lbjl_batch_no            varchar(60),
    lbjl_mfg_date            date,
    lbjl_expiry_date         date,
    lbjl_cost_code           varchar(12),
    lbjl_price_code          varchar(12),
    lbjl_labels              integer        NOT NULL,
    lbjl_reprint_of_line_id  uuid,
    lbjl_src_line_id         uuid,
    lbjl_sync_date           timestamptz(6),
    CONSTRAINT pk_label_job_line PRIMARY KEY (lbjl_id, lbjl_acc_year),
    CONSTRAINT ck_lbjl_line_no CHECK (lbjl_line_no >= 1),
    CONSTRAINT ck_lbjl_labels  CHECK (lbjl_labels BETWEEN 1 AND 9999),
    CONSTRAINT fk_lbjl_job  FOREIGN KEY (lbjl_job_id, lbjl_acc_year) REFERENCES inventory.label_job (lbj_id, lbj_acc_year) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_lbjl_item FOREIGN KEY (lbjl_item_id) REFERENCES inventory.item_master (item_id)         ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_lbjl_unit FOREIGN KEY (lbjl_unit_id) REFERENCES inventory.item_unit_conversion (iuc_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_lbjl_lot  FOREIGN KEY (lbjl_lot_id)  REFERENCES stock.stock_lot (slt_id)                ON UPDATE CASCADE ON DELETE RESTRICT
) PARTITION BY LIST (lbjl_acc_year);

CREATE INDEX IF NOT EXISTS ix_lbjl_job
    ON inventory.label_job_line (lbjl_job_id, lbjl_acc_year, lbjl_line_no);
CREATE INDEX IF NOT EXISTS ix_lbjl_item
    ON inventory.label_job_line (lbjl_item_id, lbjl_unit_id);
CREATE INDEX IF NOT EXISTS ix_lbjl_reprint_of
    ON inventory.label_job_line (lbjl_reprint_of_line_id) WHERE lbjl_reprint_of_line_id IS NOT NULL;

COMMENT ON TABLE inventory.label_job_line IS 'One line of a sticker job, frozen as printed: item, label unit (iuc_id), lot, barcode, MRP, Our price, batch, packed on / use by, cost / price code, labels. Never updated. A reprint line points at the line it reprints (no FK).';
COMMENT ON COLUMN inventory.label_job_line.lbjl_acc_year IS 'The job''s year (partition key).';
COMMENT ON COLUMN inventory.label_job_line.lbjl_reprint_of_line_id IS 'REPRINT job: the original job''s line. "Reprinted" on a line = SUM(labels) of the lines pointing at it. No FK.';
COMMENT ON COLUMN inventory.label_job_line.lbjl_src_line_id IS 'S-P2 hook: the GRN / purchase bill line the label came from.';

-- Sync triggers + pending index, one table at a time (what
-- public.sync_install_triggers() does per table). Skipped where the sync
-- functions are absent (the VPS: cloud sync is local-only), as 20261117100000.
DO $sync$
DECLARE
    r record;
BEGIN
    IF to_regprocedure('public.fn_sync_mark_dirty()') IS NULL
       OR to_regprocedure('public.fn_sync_log_delete()') IS NULL THEN
        RAISE NOTICE 'sticker printing S-P1: sync functions absent, sync triggers skipped';
        RETURN;
    END IF;
    FOR r IN SELECT * FROM (VALUES ('label_job'::text,      'lbj_id'::text,  'lbj_acc_year'::text,  'lbj_sync_date'::text),
                                   ('label_job_line',       'lbjl_id',       'lbjl_acc_year',       'lbjl_sync_date')) v(tbl, pk1, pk2, col)
    LOOP
        EXECUTE format('CREATE OR REPLACE TRIGGER zz_sync_mark_dirty BEFORE UPDATE ON inventory.%I FOR EACH ROW EXECUTE FUNCTION public.fn_sync_mark_dirty(%L)',
                       r.tbl, r.col);
        EXECUTE format('CREATE OR REPLACE TRIGGER zz_sync_log_delete AFTER DELETE ON inventory.%I FOR EACH ROW EXECUTE FUNCTION public.fn_sync_log_delete(%L, %L, %L, %L)',
                       r.tbl, 'inventory', r.tbl, r.pk1, r.pk2);
        EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON inventory.%I (%I, %I) WHERE %I IS NULL',
                       left('ix_sync_pending_' || r.tbl, 63), r.tbl, r.pk1, r.pk2, r.col);
    END LOOP;
END $sync$;


-- ── 5 · ensure_acc_year_partitions: + label_job, label_job_line (§6.5) ─────
-- The live body (last redefined by 20261119100000_whatsapp; read back with
-- pg_get_functiondef on 2026-11-25) copied forward unchanged, with the two
-- tables added before the stock engine's call, parent before child.
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

    -- ── Added by 20261119100000 — WhatsApp message log ──────────────────
    --  One row per send try; written by the send paths, updated by statuses.
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS public.%I PARTITION OF public.wa_message_log FOR VALUES IN (%L)',
        'wa_message_log_' || v_suffix, v_year);

    -- ── Added by 20261126100000 — sticker printing S-P1 ──────────────────
    --  The job before its lines (fk_lbjl_job).
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS inventory.%I PARTITION OF inventory.label_job FOR VALUES IN (%L)',
        'label_job_' || v_suffix, v_year);
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS inventory.%I PARTITION OF inventory.label_job_line FOR VALUES IN (%L)',
        'label_job_line_' || v_suffix, v_year);

    -- The stock engine's four, added by 20260907090000. This is the part the
    -- catalogue-driven helper does not reach.
    PERFORM stock.fn_create_stock_partitions(v_year::character(9));
END;
$function$;

-- Backfill: both tables' partitions for every year public.txn_status_log has a
-- partition for (read from pg_inherits, never hard-coded). Only these two
-- tables are touched here; the other tables' partitions are left as they are.
DO $$
DECLARE
    v_year text;
BEGIN
    FOR v_year IN
        SELECT DISTINCT substring(pg_get_expr(c.relpartbound, c.oid) FROM '''([0-9]{4}-[0-9]{4})''')
          FROM pg_inherits i
          JOIN pg_class c ON c.oid = i.inhrelid
         WHERE i.inhparent = 'public.txn_status_log'::regclass
         ORDER BY 1
    LOOP
        CONTINUE WHEN v_year IS NULL;
        EXECUTE format('CREATE TABLE IF NOT EXISTS inventory.%I PARTITION OF inventory.label_job FOR VALUES IN (%L)',
                       'label_job_' || replace(v_year, '-', '_'), v_year);
        EXECUTE format('CREATE TABLE IF NOT EXISTS inventory.%I PARTITION OF inventory.label_job_line FOR VALUES IN (%L)',
                       'label_job_line_' || replace(v_year, '-', '_'), v_year);
    END LOOP;
END $$;


-- ── 6 · item card Sticker design FK; LABEL_JOB in the status log (§6.6) ────
-- 0 rows set on dev. Where a database has values naming no design, the key is
-- added NOT VALID (it checks new writes; the old values are named in a
-- WARNING) rather than failing the deploy.
DO $$
DECLARE
    v_orphans bigint;
BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint
                WHERE conrelid = 'inventory.item_master'::regclass AND conname = 'fk_item_barcode_sticker') THEN
        RETURN;
    END IF;
    SELECT count(*) INTO v_orphans
      FROM inventory.item_master i
     WHERE i.item_barcode_sticker_id IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM public.print_template t WHERE t.ptl_id = i.item_barcode_sticker_id);
    IF v_orphans = 0 THEN
        ALTER TABLE inventory.item_master
            ADD CONSTRAINT fk_item_barcode_sticker FOREIGN KEY (item_barcode_sticker_id)
                REFERENCES public.print_template (ptl_id) ON UPDATE CASCADE ON DELETE SET NULL;
    ELSE
        ALTER TABLE inventory.item_master
            ADD CONSTRAINT fk_item_barcode_sticker FOREIGN KEY (item_barcode_sticker_id)
                REFERENCES public.print_template (ptl_id) ON UPDATE CASCADE ON DELETE SET NULL NOT VALID;
        RAISE WARNING 'Sticker printing S-P1: % item(s) name a sticker design that is not there; fk_item_barcode_sticker added NOT VALID. Clear those values, then VALIDATE CONSTRAINT.', v_orphans;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS ix_item_barcode_sticker
    ON inventory.item_master (item_barcode_sticker_id) WHERE item_barcode_sticker_id IS NOT NULL;

COMMENT ON COLUMN inventory.item_master.item_barcode_sticker_id IS
    'The item''s own sticker design (item card "Sticker design"): a live, published label design (print_template), used when its purpose is the Sticker Printing list''s purpose. FK fk_item_barcode_sticker, SET NULL when the design row goes.';

-- The live value list is read back and LABEL_JOB appended, so a value another
-- migration added is never lost. No CHECK there = nothing to widen (NOTICE).
DO $$
DECLARE
    v_def  text;
    v_vals text;
BEGIN
    SELECT pg_get_constraintdef(c.oid) INTO v_def
      FROM pg_constraint c
     WHERE c.conrelid = 'public.txn_status_log'::regclass AND c.conname = 'ck_tsl_src_doc_type';
    IF v_def IS NULL THEN
        RAISE NOTICE 'sticker printing S-P1: public.txn_status_log has no ck_tsl_src_doc_type, nothing to widen';
        RETURN;
    END IF;
    IF v_def LIKE '%''LABEL_JOB''%' THEN
        RETURN;
    END IF;
    SELECT string_agg(quote_literal(m[1]), ', ' ORDER BY n) INTO v_vals
      FROM regexp_matches(v_def, '''([A-Z_]+)''', 'g') WITH ORDINALITY AS t(m, n);
    ALTER TABLE public.txn_status_log DROP CONSTRAINT ck_tsl_src_doc_type;
    EXECUTE format('ALTER TABLE public.txn_status_log ADD CONSTRAINT ck_tsl_src_doc_type CHECK (tsl_src_doc_type IN (%s, %L))',
                   v_vals, 'LABEL_JOB');
END $$;


-- ── 7a · setting inventory.label_cost_code (S14, SM4) ──────────────────────
-- Per company. The server checks the value (exactly 10 letters A-Z, none
-- twice: APP_SETTING_COST_CODE_INVALID).
INSERT INTO public.app_setting_def
    (asd_key, asd_module, asd_group, asd_data_type, asd_default_value, asd_allowed_values,
     asd_min_value, asd_max_value, asd_max_scope, asd_label, asd_description, asd_sort_order, asd_created_by)
VALUES
    ('inventory.label_cost_code', 'INVENTORY', 'Labels', 'TEXT', NULL, NULL,
     NULL, NULL, 'COMPANY', 'Cost code letters',
     'Ten different letters; the first stands for 0. Used by the cost code and price code fields of label designs.',
     60, 'system')
ON CONFLICT (asd_key) DO NOTHING;


-- ── 7b · menu 32 Sticker Printing (S7: View + Print; no user_menus rows) ───
INSERT INTO fixed.menu_master
       (menu_id, menu_parent, menu_name, menu_alias, menu_visiblity, menu_position, menu_is_active,
        menu_separator, menu_verbs, menu_created_on, menu_modified_on)
SELECT 32, 3, 'Sticker Printing', NULL, true, 35.00, true, false, '{VIEW,PRINT}'::text[], now(), now()
 WHERE EXISTS (SELECT 1 FROM fixed.menu_master p WHERE p.menu_id = 3)
   AND NOT EXISTS (SELECT 1 FROM fixed.menu_master m WHERE m.menu_id = 32);

-- The sequence never hands out a pinned id: GREATEST, so a box whose sequence
-- already ran past it is not wound back.
SELECT setval('fixed.menu_master_menu_id_seq',
              GREATEST((SELECT COALESCE(max(menu_id), 1) FROM fixed.menu_master),
                       (SELECT last_value FROM fixed.menu_master_menu_id_seq)));


-- ── 7c · table registry rows 942 / 943 (Db_Table_Master.sql carries them) ──
INSERT INTO public.db_table_master
       (dtm_id, dtm_schema, dtm_table, dtm_parent_id, dtm_name, dtm_kind, dtm_module,
        dtm_col_prefix, dtm_sync_col, dtm_menu_id, dtm_write_mode, dtm_retention_days, dtm_is_active,
        dtm_description)
SELECT v.id, 'inventory', v.tbl, v.parent, v.name, 'LOG', 'INVENTORY', v.prefix, v.sync_col,
       (SELECT m.menu_id FROM fixed.menu_master m WHERE m.menu_id = 32),
       v.write_mode, NULL, true, v.descr
  FROM (VALUES
        (942, 'label_job'::text, NULL::integer, 'Sticker Job'::text, 'lbj_'::text, 'lbj_sync_date'::text, 'EDITABLE'::text,
         'One row per printed sticker design group (menu 32), numbered per counter; frozen design, printer and figures; the one status step SENT -> PRINTED / FAILED. Reprints and resends are new jobs.'::text),
        (943, 'label_job_line', 942, 'Sticker Job Line', 'lbjl_', 'lbjl_sync_date', 'APPEND_ONLY',
         'The frozen lines of a sticker job: item, unit, lot, barcode, MRP, price, batch, dates, codes, labels.')
       ) v(id, tbl, parent, name, prefix, sync_col, write_mode, descr)
 WHERE to_regclass('inventory.' || v.tbl) IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM public.db_table_master d
                    WHERE d.dtm_id = v.id OR (d.dtm_schema = 'inventory' AND d.dtm_table = v.tbl))
 ORDER BY v.id;

SELECT setval(pg_get_serial_sequence('public.db_table_master', 'dtm_id'),
              GREATEST((SELECT COALESCE(max(dtm_id), 1) FROM public.db_table_master),
                       (SELECT last_value FROM public.db_table_master_dtm_id_seq)));


-- ── 7d · ui_tables 88-90 + columns 2838-2882 (§6.7) ────────────────────────
-- Numbers are the screen's column enums. Shown widths are the mockup PNGs'
-- pixel widths in proportion (sticker_sp1_mockup_4_list.png / _5_jobs.png),
-- 100.00 over the shown columns, the rounding rest to the widest; hidden
-- columns 0. Focus = the Enter stops. A column id that is taken by another
-- table's column gets a fresh id from the sequence instead (section 0 names it).
INSERT INTO fixed.ui_tables
       (ui_tbl_id, ui_tbl_name, ui_tbl_editable, ui_tbl_device_type, ui_tbl_is_active, ui_tbl_is_deleted, ui_tbl_created_by)
VALUES (88, 'STICKER PRINTING - PRINT LIST',    true,  'Desktop', true, false, 'system'),
       (89, 'STICKER PRINTING - JOB LINES',     false, 'Desktop', true, false, 'system'),
       (90, 'STICKER PRINTING - REPRINT LINES', true,  'Desktop', true, false, 'system')
ON CONFLICT (ui_tbl_id) DO NOTHING;

INSERT INTO fixed.ui_table_columns
       (ui_tbl_clm_id, ui_tbl_clm_table_id, ui_tbl_clm_no, ui_tbl_clm_name, ui_tbl_clm_column_width,
        ui_tbl_clm_column_visibility, ui_tbl_clm_column_focus, ui_tbl_clm_column_position,
        ui_tbl_clm_column_necessity, ui_tbl_clm_is_active, ui_tbl_clm_is_deleted, ui_tbl_clm_created_by)
SELECT CASE WHEN EXISTS (SELECT 1 FROM fixed.ui_table_columns x WHERE x.ui_tbl_clm_id = v.id)
            THEN nextval(pg_get_serial_sequence('fixed.ui_table_columns', 'ui_tbl_clm_id'))
            ELSE v.id END,
       v.tbl, v.no, v.name, v.width, v.visible, v.focus, v.no, false, true, false, 'system'
  FROM (VALUES
    -- 88 STICKER PRINTING - PRINT LIST: 1..11 shown; Enter stops Item, Barcode, Batch, Labels
    (2838::bigint, 88::bigint, 0::bigint, 'RowKind'::text, 0.00::numeric, false::boolean, false::boolean, 'STICKER PRINTING - PRINT LIST'::text)
   ,(2839, 88,  1, '#',            2.69, true,  false, 'STICKER PRINTING - PRINT LIST')
   ,(2840, 88,  2, 'Item',        23.80, true,  true,  'STICKER PRINTING - PRINT LIST')
   ,(2841, 88,  3, 'Unit',         4.55, true,  false, 'STICKER PRINTING - PRINT LIST')
   ,(2842, 88,  4, 'Barcode',     11.39, true,  true,  'STICKER PRINTING - PRINT LIST')
   ,(2843, 88,  5, 'Batch',        7.87, true,  true,  'STICKER PRINTING - PRINT LIST')
   ,(2844, 88,  6, 'Expiry',       6.42, true,  false, 'STICKER PRINTING - PRINT LIST')
   ,(2845, 88,  7, 'MRP',          6.63, true,  false, 'STICKER PRINTING - PRINT LIST')
   ,(2846, 88,  8, 'Our price',    7.25, true,  false, 'STICKER PRINTING - PRINT LIST')
   ,(2847, 88,  9, 'Labels',       5.59, true,  true,  'STICKER PRINTING - PRINT LIST')
   ,(2848, 88, 10, 'Design',      13.46, true,  false, 'STICKER PRINTING - PRINT LIST')
   ,(2849, 88, 11, 'Last printed',10.35, true,  false, 'STICKER PRINTING - PRINT LIST')
   ,(2850, 88, 12, 'ItemId',       0.00, false, false, 'STICKER PRINTING - PRINT LIST')
   ,(2851, 88, 13, 'UnitId',       0.00, false, false, 'STICKER PRINTING - PRINT LIST')
   ,(2852, 88, 14, 'LotId',        0.00, false, false, 'STICKER PRINTING - PRINT LIST')
   ,(2853, 88, 15, 'TemplateId',   0.00, false, false, 'STICKER PRINTING - PRINT LIST')
   ,(2854, 88, 16, 'DesignSource', 0.00, false, false, 'STICKER PRINTING - PRINT LIST')
   ,(2855, 88, 17, 'LotRequired',  0.00, false, false, 'STICKER PRINTING - PRINT LIST')
   ,(2856, 88, 18, 'NoBarcode',    0.00, false, false, 'STICKER PRINTING - PRINT LIST')
   ,(2857, 88, 19, 'LabelW',       0.00, false, false, 'STICKER PRINTING - PRINT LIST')
   ,(2858, 88, 20, 'LabelH',       0.00, false, false, 'STICKER PRINTING - PRINT LIST')
   ,(2859, 88, 21, 'Across',       0.00, false, false, 'STICKER PRINTING - PRINT LIST')
   ,(2860, 88, 22, 'Key',          0.00, false, false, 'STICKER PRINTING - PRINT LIST')
   ,(2861, 88, 23, 'CostCode',     0.00, false, false, 'STICKER PRINTING - PRINT LIST')
   ,(2862, 88, 24, 'PriceCode',    0.00, false, false, 'STICKER PRINTING - PRINT LIST')
   ,(2863, 88, 25, 'StockQty',     0.00, false, false, 'STICKER PRINTING - PRINT LIST')
   ,(2864, 88, 26, 'Problem',      0.00, false, false, 'STICKER PRINTING - PRINT LIST')
    -- 89 STICKER PRINTING - JOB LINES (read-only): 0..8 shown
   ,(2865, 89,  0, '#',            3.25, true,  false, 'STICKER PRINTING - JOB LINES')
   ,(2866, 89,  1, 'Item',        33.75, true,  false, 'STICKER PRINTING - JOB LINES')
   ,(2867, 89,  2, 'Unit',         6.25, true,  false, 'STICKER PRINTING - JOB LINES')
   ,(2868, 89,  3, 'Barcode',     14.75, true,  false, 'STICKER PRINTING - JOB LINES')
   ,(2869, 89,  4, 'Batch',        8.75, true,  false, 'STICKER PRINTING - JOB LINES')
   ,(2870, 89,  5, 'MRP',          8.25, true,  false, 'STICKER PRINTING - JOB LINES')
   ,(2871, 89,  6, 'Our price',    9.00, true,  false, 'STICKER PRINTING - JOB LINES')
   ,(2872, 89,  7, 'Labels',       7.25, true,  false, 'STICKER PRINTING - JOB LINES')
   ,(2873, 89,  8, 'Reprinted',    8.75, true,  false, 'STICKER PRINTING - JOB LINES')
   ,(2874, 89,  9, 'LineId',       0.00, false, false, 'STICKER PRINTING - JOB LINES')
   ,(2875, 89, 10, 'ItemId',       0.00, false, false, 'STICKER PRINTING - JOB LINES')
    -- 90 STICKER PRINTING - REPRINT LINES: 0..5 shown; Enter stops Reprint now only
   ,(2876, 90,  0, '#',            4.64, true,  false, 'STICKER PRINTING - REPRINT LINES')
   ,(2877, 90,  1, 'Item',        44.64, true,  false, 'STICKER PRINTING - REPRINT LINES')
   ,(2878, 90,  2, 'Batch',       12.50, true,  false, 'STICKER PRINTING - REPRINT LINES')
   ,(2879, 90,  3, 'Printed',     11.79, true,  false, 'STICKER PRINTING - REPRINT LINES')
   ,(2880, 90,  4, 'Before',      11.07, true,  false, 'STICKER PRINTING - REPRINT LINES')
   ,(2881, 90,  5, 'Reprint now', 15.36, true,  true,  'STICKER PRINTING - REPRINT LINES')
   ,(2882, 90,  6, 'LineId',       0.00, false, false, 'STICKER PRINTING - REPRINT LINES')
       ) v(id, tbl, no, name, width, visible, focus, tbl_name)
 WHERE EXISTS (SELECT 1 FROM fixed.ui_tables t WHERE t.ui_tbl_id = v.tbl AND t.ui_tbl_name = v.tbl_name)
   AND NOT EXISTS (SELECT 1 FROM fixed.ui_table_columns e
                    WHERE e.ui_tbl_clm_table_id = v.tbl AND e.ui_tbl_clm_no = v.no AND e.ui_tbl_clm_is_deleted = false)
ON CONFLICT (ui_tbl_clm_id) DO NOTHING;

SELECT setval('fixed.ui_tables_ui_tbl_id_seq',
              GREATEST((SELECT last_value FROM fixed.ui_tables_ui_tbl_id_seq),
                       (SELECT COALESCE(MAX(ui_tbl_id), 1) FROM fixed.ui_tables)), true);
SELECT setval('fixed.ui_table_columns_ui_tbl_clm_id_seq',
              GREATEST((SELECT last_value FROM fixed.ui_table_columns_ui_tbl_clm_id_seq),
                       (SELECT COALESCE(MAX(ui_tbl_clm_id), 1) FROM fixed.ui_table_columns)), true);


-- ── 7e · grid 223 MAIN LIST - STICKER JOBS (Printed jobs, §6.7) ────────────
-- Tokens (every caller sends every one, compared as text, never cast):
-- icompany_id, ibranch_id, ifrom_date / ito_date (yyyy-MM-dd on the IST print
-- date, '' = no bound), idevice_id ('' = all counters), iuser_id ('' = all
-- users), iitem_text ('' = all; else a line whose item name contains it).
-- Printed at leaves as IST 12-hour text; newest first (sort_by lbj_id, a
-- uuidv7, keeps that order). Status and Kind are drawn as badges by the screen.
-- The grid SQL holds no comment marker.
INSERT INTO fixed.grid_details
       (grid_id, grid_name, grid_description, grid_sort_column, grid_sort_order, grid_device_type,
        grid_status, grid_is_deleted, grid_created_by, grid_sql)
VALUES
(223, 'MAIN LIST - STICKER JOBS',
 'Sticker Printing (menu 32) Printed jobs tab: one row per sticker job of this branch, newest first. Tokens (send every one): icompany_id, ibranch_id, ifrom_date, ito_date (yyyy-MM-dd on the IST print date; '''' = no bound), idevice_id ('''' = all counters), iuser_id ('''' = all users), iitem_text ('''' = all; else jobs with a line whose item name contains it). Kind = Print or Reprint of <job no>; Reason = the fixed reason words, then ": note". Hidden: lbj_id, lbj_acc_year, status_code, kind_code, lbj_device_id.',
 'lbj_id', 'Descending', 'Desktop', true, false, 'system',
$g223$SELECT j.lbj_refno,
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
 ORDER BY j.lbj_printed_on DESC, j.lbj_id DESC$g223$)
ON CONFLICT (grid_id) DO NOTHING;

INSERT INTO fixed.grid_columns
       (grid_column_id, grid_id, grid_column_number, grid_column_name, grid_column_sql_field_name,
        grid_column_data_type, grid_column_width, grid_column_position, grid_column_alignment,
        grid_column_visibility, grid_column_filter, grid_column_group, grid_column_total,
        grid_column_notes, grid_column_is_deleted, grid_column_created_by)
SELECT v.id, 223, v.no, v.name, v.fld, v.typ, v.width, v.no, v.align, v.visible, v.filter,
       false, false, v.fld, false, 'system'
  FROM (VALUES
    ('01a2129c-2230-7000-8000-000000223001'::uuid, 1::integer, 'Job no'::text, 'lbj_refno'::text, 'Text'::text, 7.18::numeric, 'Left'::text, true::boolean, true::boolean),
    ('01a2129c-2230-7000-8000-000000223002', 2, 'Printed at', 'printed_at', 'Text', 11.70, 'Left', true, false),
    ('01a2129c-2230-7000-8000-000000223003', 3, 'By', 'by_name', 'Text', 5.15, 'Left', true, true),
    ('01a2129c-2230-7000-8000-000000223004', 4, 'Counter', 'counter_name', 'Text', 8.11, 'Left', true, true),
    ('01a2129c-2230-7000-8000-000000223005', 5, 'Design', 'design_name', 'Text', 12.48, 'Left', true, true),
    ('01a2129c-2230-7000-8000-000000223006', 6, 'Printer', 'lbj_printer_name', 'Text', 8.11, 'Left', true, true),
    ('01a2129c-2230-7000-8000-000000223007', 7, 'Lines', 'lbj_line_count', 'Number', 3.90, 'Right', true, false),
    ('01a2129c-2230-7000-8000-000000223008', 8, 'Labels', 'lbj_label_count', 'Number', 4.52, 'Right', true, false),
    ('01a2129c-2230-7000-8000-000000223009', 9, 'Kind', 'kind_text', 'Text', 11.70, 'Left', true, true),
    ('01a2129c-2230-7000-8000-000000223010', 10, 'Reason', 'reason_text', 'Text', 20.60, 'Left', true, true),
    ('01a2129c-2230-7000-8000-000000223011', 11, 'Status', 'status_text', 'Text', 6.55, 'Center', true, false),
    ('01a2129c-2230-7000-8000-000000223012', 12, 'Job id', 'lbj_id', 'Text', 0.00, 'Left', false, false),
    ('01a2129c-2230-7000-8000-000000223013', 13, 'Year', 'lbj_acc_year', 'Text', 0.00, 'Left', false, false),
    ('01a2129c-2230-7000-8000-000000223014', 14, 'Status code', 'status_code', 'Text', 0.00, 'Left', false, false),
    ('01a2129c-2230-7000-8000-000000223015', 15, 'Kind code', 'kind_code', 'Text', 0.00, 'Left', false, false),
    ('01a2129c-2230-7000-8000-000000223016', 16, 'Device id', 'lbj_device_id', 'Text', 0.00, 'Left', false, false)
       ) v(id, no, name, fld, typ, width, align, visible, filter)
 WHERE EXISTS (SELECT 1 FROM fixed.grid_details d
                WHERE d.grid_id = 223 AND d.grid_name = 'MAIN LIST - STICKER JOBS')
   AND NOT EXISTS (SELECT 1 FROM fixed.grid_columns e
                    WHERE e.grid_id = 223 AND e.grid_column_number = v.no AND e.grid_column_is_deleted = false)
ON CONFLICT (grid_column_id) DO NOTHING;

SELECT setval(pg_get_serial_sequence('fixed.grid_details', 'grid_id'),
              GREATEST((SELECT COALESCE(max(grid_id), 1) FROM fixed.grid_details),
                       (SELECT last_value FROM fixed.grid_details_grid_id_seq)));


-- ── 7f · dropdowns 81 / 82 / 83 (§6.7) ─────────────────────────────────────
-- Params always sent, compared as text, never cast. 83 also lists the users
-- with no company (the all-company logins, as dropdown 68 does).
INSERT INTO fixed.dropdown_details
       (dropdown_id, dropdown_name, dropdown_description, dropdown_sql,
        dropdown_sort_order, dropdown_sort_column, dropdown_completion,
        dropdown_max_visible_items, dropdown_show_header, dropdown_width,
        dropdown_device_type, dropdown_created_by)
SELECT v.id, v.name, v.descr, v.dsql, 'asc', v.sort_col, v.sort_col, 10, true, 0, 'Desktop', 'system'
  FROM (VALUES
    (81, 'STICKER DESIGNS'::text,
     'Sticker designs: live, active templates with a published revision of the label purposes ITEM_LABEL / PACK_LABEL / SHELF_LABEL, shipped or this company''s, with their label size. Item card Sticker design (ippo_code ''''), Sticker Printing Design filter and F7 (ippo_code = the list''s purpose). Params icompany_id, ippo_code, always sent; compared as text, never cast.'::text,
$d81$SELECT t.ptl_id,
       t.ptl_name,
       COALESCE(trim_scale(v.ptv_label_width_mm)::text || ' × ' || trim_scale(v.ptv_label_height_mm)::text
                || ' mm · ' || v.ptv_label_across::text || ' across', '') AS label_size,
       p.ppo_code,
       v.ptv_label_width_mm,
       v.ptv_label_height_mm,
       v.ptv_label_across
  FROM public.print_template t
  JOIN public.print_purpose p ON p.ppo_id = t.ptl_purpose_id
  JOIN public.print_template_version v ON v.ptv_id = t.ptl_published_rev_id
 WHERE t.ptl_is_deleted = false
   AND t.ptl_is_active = true
   AND p.ppo_is_deleted = false
   AND p.ppo_code IN ('ITEM_LABEL', 'PACK_LABEL', 'SHELF_LABEL')
   AND v.ptv_status = 'PUBLISHED'
   AND v.ptv_is_deleted = false
   AND (t.ptl_company_id IS NULL OR t.ptl_company_id::text = 'icompany_id')
   AND (p.ppo_company_id IS NULL OR p.ppo_company_id::text = 'icompany_id')
   AND ('ippo_code' = '' OR p.ppo_code = 'ippo_code')
 ORDER BY p.ppo_sort_order, t.ptl_name$d81$::text, 'ptl_name'::text),
    (82, 'DEVICES - THIS BRANCH',
     'Sticker Printing Printed jobs Counter filter: live, active devices (counters) of this branch, by name. Param ibranch_id, always sent; compared as text, never cast.',
$d82$SELECT d.dev_id,
       COALESCE(d.dev_code, '') AS dev_code,
       COALESCE(d.dev_device_name, '') AS dev_device_name
  FROM fixed.device_master d
 WHERE d.dev_is_deleted = false
   AND d.dev_is_active = true
   AND d.dev_branch_id::text = 'ibranch_id'
 ORDER BY d.dev_device_name, d.dev_code$d82$, 'dev_device_name'),
    (83, 'USERS - THIS COMPANY',
     'Sticker Printing Printed jobs User filter: live, active users of this company and the users with no company (all-company logins, as dropdown 68), by login. Param icompany_id, always sent; compared as text, never cast.',
$d83$SELECT u.usr_id,
       u.usr_login_name,
       COALESCE(u.usr_full_name, '') AS usr_full_name
  FROM public.user_master u
 WHERE u.usr_is_deleted = false
   AND u.usr_is_active = true
   AND (u.usr_company_id IS NULL OR u.usr_company_id::text = 'icompany_id')
 ORDER BY u.usr_login_name$d83$, 'usr_login_name')
       ) v(id, name, descr, dsql, sort_col)
 WHERE NOT EXISTS (SELECT 1 FROM fixed.dropdown_details d
                    WHERE d.dropdown_id = v.id OR upper(d.dropdown_name) = v.name);

INSERT INTO fixed.dropdown_columns
       (dropdown_columns_id, dropdown_columns_dropdown_id, dropdown_columns_no, dropdown_columns_data_type,
        dropdown_columns_name, dropdown_columns_alias, dropdown_columns_width,
        dropdown_columns_visiblity, dropdown_columns_allignment, dropdown_columns_filter,
        dropdown_columns_sql_name, dropdown_columns_created_by)
SELECT v.id, v.dd, v.no, 'Text', v.name, NULL, v.width, v.visible, 'Left', v.filter, v.field, 'system'
  FROM (VALUES
    ('01a2129c-8100-7000-8000-000000000810'::uuid, 81, 0, '#'::text,        10.00::numeric, false::boolean, false::boolean, 'ptl_id'::text, 'STICKER DESIGNS'::text),
    ('01a2129c-8100-7000-8000-000000000811'::uuid, 81, 1, 'Design',         55.00, true,  true,  'ptl_name',            'STICKER DESIGNS'),
    ('01a2129c-8100-7000-8000-000000000812'::uuid, 81, 2, 'Size',           30.00, true,  false, 'label_size',          'STICKER DESIGNS'),
    ('01a2129c-8100-7000-8000-000000000813'::uuid, 81, 3, 'Purpose',        15.00, true,  true,  'ppo_code',            'STICKER DESIGNS'),
    ('01a2129c-8100-7000-8000-000000000814'::uuid, 81, 4, 'Width',           0.00, false, false, 'ptv_label_width_mm',  'STICKER DESIGNS'),
    ('01a2129c-8100-7000-8000-000000000815'::uuid, 81, 5, 'Height',          0.00, false, false, 'ptv_label_height_mm', 'STICKER DESIGNS'),
    ('01a2129c-8100-7000-8000-000000000816'::uuid, 81, 6, 'Across',          0.00, false, false, 'ptv_label_across',    'STICKER DESIGNS'),
    ('01a2129c-8200-7000-8000-000000000820'::uuid, 82, 0, '#',              10.00, false, false, 'dev_id',              'DEVICES - THIS BRANCH'),
    ('01a2129c-8200-7000-8000-000000000821'::uuid, 82, 1, 'Code',           25.00, true,  true,  'dev_code',            'DEVICES - THIS BRANCH'),
    ('01a2129c-8200-7000-8000-000000000822'::uuid, 82, 2, 'Counter',        75.00, true,  true,  'dev_device_name',     'DEVICES - THIS BRANCH'),
    ('01a2129c-8300-7000-8000-000000000830'::uuid, 83, 0, '#',              10.00, false, false, 'usr_id',              'USERS - THIS COMPANY'),
    ('01a2129c-8300-7000-8000-000000000831'::uuid, 83, 1, 'Login',          40.00, true,  true,  'usr_login_name',      'USERS - THIS COMPANY'),
    ('01a2129c-8300-7000-8000-000000000832'::uuid, 83, 2, 'Name',           60.00, true,  true,  'usr_full_name',       'USERS - THIS COMPANY')
  ) AS v(id, dd, no, name, width, visible, filter, field, dd_name)
 WHERE EXISTS (SELECT 1 FROM fixed.dropdown_details d WHERE d.dropdown_id = v.dd AND d.dropdown_name = v.dd_name)
   AND NOT EXISTS (SELECT 1 FROM fixed.dropdown_columns c WHERE c.dropdown_columns_dropdown_id = v.dd)
ON CONFLICT (dropdown_columns_id) DO NOTHING;

SELECT setval(pg_get_serial_sequence('fixed.dropdown_details', 'dropdown_id'),
              GREATEST((SELECT COALESCE(max(dropdown_id), 1) FROM fixed.dropdown_details),
                       (SELECT last_value FROM fixed.dropdown_details_dropdown_id_seq)));


-- ── 7g · plain wording rows (notes 120), catalogue 2026-11-25.1 ────────────
-- Plan §7.4: every STICKER_ refusal, the label-sheet / body refusals of the
-- print designer (variants field=<DTO key> for the sheet), the item card's
-- ITEM_STICKER_DESIGN_INVALID, the cost-code setting's
-- APP_SETTING_COST_CODE_INVALID and Test print's PRINT_ASSIGN_RIGHT_PRINT
-- (assertMenuRight prefix PRINT_ASSIGN, menu 248). STOCK_DEVICE_NOT_FOUND /
-- _BLOCKED are worded already. Drafted 2026-11-25 (not yet reviewed).
-- prisma/seed/Error_Messages.json carries the same rows.
INSERT INTO fixed.error_message
    (erm_code, erm_variant, erm_lang, erm_title, erm_line, erm_todo)
VALUES
     ('STICKER_RIGHT_VIEW', '', 'en', 'Not allowed', 'You have no right to open Sticker Printing.', 'Call manager.')
    ,('STICKER_RIGHT_PRINT', '', 'en', 'Not allowed', 'You have no right to print stickers.', 'Call manager.')
    ,('STICKER_BRANCH_NOT_IN_COMPANY', '', 'en', 'Wrong branch', 'That branch is not part of this company.', 'Pick a branch of this company.')
    ,('STICKER_PURPOSE_INVALID', '', 'en', 'Not a sticker kind', 'Stickers print only as Item label, Pack label or Shelf label.', 'Pick one of the three.')
    ,('STICKER_NO_DESIGN', '', 'en', 'No sticker design', 'These labels have no design here.', 'Set one in Print Assignments, or pick one for this job with F7.')
    ,('STICKER_NO_PRINTER', '', 'en', 'No label printer', 'No label printer is set for these labels here.', 'Set the label printer in Print Assignments, or use Change printer.')
    ,('STICKER_DESIGN_NOT_FOUND', '', 'en', 'Design not found', 'This sticker design is not there now.', 'Pick the design again.')
    ,('STICKER_DESIGN_NOT_PUBLISHED', '', 'en', 'Design not published', 'This sticker design has no published version yet.', 'Publish it in the Print Designer first.')
    ,('STICKER_DESIGN_NOT_LABEL', '', 'en', 'Not a sticker design', 'This design has no label sheet, so it cannot print stickers.', 'Pick a label design.')
    ,('STICKER_DESIGN_NOT_LABEL', 'rule=PURPOSE', 'en', 'Other kind of label', 'This design is made for another kind of label.', 'Pick a design made for these labels.')
    ,('STICKER_ITEM_NOT_FOUND', '', 'en', 'Item not found', 'This item is not there now, or it belongs to another company.', 'Pick the item again.')
    ,('STICKER_UNIT_NOT_OF_ITEM', '', 'en', 'Wrong unit', 'That unit is not one of this item''s units.', 'Pick one of its units.')
    ,('STICKER_LOT_NOT_OF_ITEM', '', 'en', 'Wrong batch', 'That batch is not one of this item''s.', 'Pick one of its batches.')
    ,('STICKER_CODE_NOT_FOUND', '', 'en', 'Code not found', 'No item has this barcode or code.', 'Check the code, or type the item name.')
    ,('STICKER_LOT_REQUIRED', '', 'en', 'Pick the batch', 'This item has stock here at more than one MRP.', 'Pick the batch in the Batch column.')
    ,('STICKER_LINE_NO_BARCODE', '', 'en', 'No barcode', 'This item has no barcode, and its design prints one.', 'Add a barcode on the item card, or remove the line.')
    ,('STICKER_LABELS_INVALID', '', 'en', 'Wrong number of labels', 'Each line needs 1 to 9,999 labels.', 'Type a number from 1 to 9,999.')
    ,('STICKER_TOO_MANY_LABELS', '', 'en', 'Too many labels', 'One print can take at most 5,000 labels.', 'Print the list in parts.')
    ,('STICKER_TOO_MANY_ITEMS', '', 'en', 'Too many lines', 'One list can take at most 500 lines.', 'Add fewer items, or print in parts.')
    ,('STICKER_NOTHING_TO_PRINT', '', 'en', 'Nothing to print', 'No line has labels to print.', 'Type how many labels to print.')
    ,('STICKER_JOB_NOT_FOUND', '', 'en', 'Job not found', 'This sticker job is not there, or it belongs to another branch.', 'Refresh the list and try again.')
    ,('STICKER_JOB_STATUS_SET', '', 'en', 'Already marked', 'This job is already marked Printed or Failed.', 'Refresh the list.')
    ,('STICKER_JOB_OTHER_COUNTER', '', 'en', 'Another counter''s job', 'Only the counter that printed this job can mark it.', 'Mark it from that counter.')
    ,('STICKER_REASON_REQUIRED', '', 'en', 'Reason needed', 'Pick why you are printing these labels again.', 'Pick a reason from the list.')
    ,('STICKER_NOTE_REQUIRED', '', 'en', 'Note needed', 'For Other, the reason must be typed in Note.', 'Type a short note.')
    ,('STICKER_REASON_INVALID', '', 'en', 'Reason not known', 'This reason is not on the list.', 'Pick a reason from the list.')
    ,('STICKER_REPRINT_NOT_PRINTED', '', 'en', 'Not printed', 'Only a printed job can be reprinted.', 'Use Send again for a failed job.')
    ,('STICKER_LINE_NOT_ON_JOB', '', 'en', 'Wrong line', 'This line is not on the job being reprinted.', 'Open the job again and pick its lines.')
    ,('STICKER_RESEND_NOT_FAILED', '', 'en', 'Not a failed job', 'Only a failed job can be sent again.', 'Use Reprint for a printed job.')
    ,('STICKER_ALREADY_RESENT', '', 'en', 'Already sent again', 'This failed job was already sent again and printed.', 'Reprint that new job instead, if labels are still needed.')
    ,('PRINT_ASSIGN_RIGHT_PRINT', '', 'en', 'Not allowed', 'You have no right to print a test label.', 'Ask your admin for Print on Print Assignments.')
    ,('PRINT_TEMPLATE_LABEL_SHEET_REQUIRED', '', 'en', 'Label sheet needed', 'A label design needs its label size, labels across and down, and dpi.', 'Fill in the Label sheet.')
    ,('PRINT_TEMPLATE_LABEL_SHEET_INVALID', '', 'en', 'Label sheet not right', 'A Label sheet value is not allowed.', 'Correct it and save again.')
    ,('PRINT_TEMPLATE_LABEL_SHEET_INVALID', 'field=ptvLabelWidthMm', 'en', 'Label sheet not right', 'The label width must be more than 0 and at most 500 mm.', 'Type the label width in mm.')
    ,('PRINT_TEMPLATE_LABEL_SHEET_INVALID', 'field=ptvLabelHeightMm', 'en', 'Label sheet not right', 'The label height must be more than 0 and at most 500 mm.', 'Type the label height in mm.')
    ,('PRINT_TEMPLATE_LABEL_SHEET_INVALID', 'field=ptvLabelAcross', 'en', 'Label sheet not right', 'Labels across must be 1 to 20.', 'Type a number from 1 to 20.')
    ,('PRINT_TEMPLATE_LABEL_SHEET_INVALID', 'field=ptvLabelDown', 'en', 'Label sheet not right', 'Labels down must be 1 to 50 (1 = a roll).', 'Type a number from 1 to 50.')
    ,('PRINT_TEMPLATE_LABEL_SHEET_INVALID', 'field=ptvLabelGapXMm', 'en', 'Label sheet not right', 'The gap across cannot be below 0 mm.', 'Type 0 or more.')
    ,('PRINT_TEMPLATE_LABEL_SHEET_INVALID', 'field=ptvLabelGapYMm', 'en', 'Label sheet not right', 'The gap down cannot be below 0 mm.', 'Type 0 or more.')
    ,('PRINT_TEMPLATE_LABEL_SHEET_INVALID', 'field=ptvLabelRotate', 'en', 'Label sheet not right', 'Rotate must be 0, 90, 180 or 270.', 'Pick one of the four.')
    ,('PRINT_TEMPLATE_LABEL_SHEET_INVALID', 'field=ptvLabelDpi', 'en', 'Label sheet not right', 'Snap to must be 203, 300 or 600 dpi.', 'Pick your label printer''s dpi.')
    ,('PRINT_TEMPLATE_LABEL_SHEET_INVALID', 'field=ptvPaperCode', 'en', 'Label sheet not right', 'A label design prints on Label (a roll) or A4 (a sheet).', 'Pick Label or A4 as the paper.')
    ,('PRINT_TEMPLATE_LABEL_SHEET_INVALID', 'field=ptvEngine', 'en', 'Label sheet not right', 'A label design must use the bands designer (JSON bands).', 'Make the design in the Print Designer.')
    ,('PRINT_TEMPLATE_LABEL_SHEET_NOT_LABEL', '', 'en', 'Not a label design', 'Only Item, Pack and Shelf label designs take a Label sheet.', 'Clear the Label sheet, or pick a label purpose.')
    ,('PRINT_TEMPLATE_LABEL_BODY_INVALID', '', 'en', 'Label design not right', 'A label design must have one Report header band that reads the label fields.', 'Start from a new label design, or fix its bands.')
    ,('ITEM_STICKER_DESIGN_INVALID', '', 'en', 'Sticker design not right', 'This sticker design cannot be used for this item.', 'Pick a published label design of this company.')
    ,('APP_SETTING_COST_CODE_INVALID', '', 'en', 'Cost code not right', 'Cost code letters must be 10 different letters, A to Z.', 'Type 10 letters, none of them twice.')
ON CONFLICT (erm_code, erm_variant, erm_lang) DO NOTHING;
UPDATE fixed.error_message_catalogue
   SET emc_version   = '2026-11-25.1',
       emc_row_count = (SELECT count(*) FROM fixed.error_message WHERE erm_is_active),
       emc_loaded_on = now()
 WHERE emc_id = 1
   AND emc_version < '2026-11-25.1';


-- Checks after deploy (read-only): Shared/Prathap/admin/sql/sticker-sp1-assert.sql
