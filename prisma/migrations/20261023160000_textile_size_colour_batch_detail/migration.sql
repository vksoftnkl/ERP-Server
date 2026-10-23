-- ════════════════════════════════════════════════════════════════════════════
-- 20261023160000_textile_size_colour_batch_detail — textile auto batch,
-- addendum 2 (2026-10-23): size, colour and model on the inward line.
--
--  E1  inventory.item_size_master    (isz_)  picked list with quick-add
--      inventory.item_colour_master  (icl_)  the same, without a size set
--  E2  stock.stock_batch_detail      (sbd_)  a batch's size / colour / model
--
-- Company NULL = shared by every company (house rule for masters). Names are
-- unique per company-or-shared ignoring case. stock_lot, stock_voucher_item
-- and sale_bill_item are not touched: a batch's detail is read by its batch
-- number, which is unique in the company by construction (plan D1).
--
-- Written by NestJS only: no function, no trigger beyond the cloud-sync pair.
-- ════════════════════════════════════════════════════════════════════════════

-- ── E1. sizes ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inventory.item_size_master (
    isz_id           uuid         NOT NULL DEFAULT uuidv7(),
    isz_company_id   uuid,
    isz_code         varchar(20),
    isz_name         varchar(50)  NOT NULL,
    isz_size_set     varchar(20),
    isz_sort         integer      NOT NULL DEFAULT 0,
    isz_is_active    boolean      NOT NULL DEFAULT true,
    isz_is_deleted   boolean      NOT NULL DEFAULT false,
    isz_sync_date    timestamptz(6),
    isz_created_on   timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    isz_created_by   varchar(100),
    isz_modified_on  timestamptz(6),
    isz_modified_by  varchar(100),
    CONSTRAINT pk_item_size_master PRIMARY KEY (isz_id),
    CONSTRAINT fk_isz_company FOREIGN KEY (isz_company_id)
        REFERENCES public.companys (comp_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT ck_isz_name CHECK (length(btrim(isz_name)) > 0)
);
-- XS < S < M < L < XL; 28 < 30 < 32 — lists and reports sort by isz_sort.
CREATE UNIQUE INDEX IF NOT EXISTS ux_isz_name ON inventory.item_size_master
    (COALESCE(isz_company_id, '00000000-0000-0000-0000-000000000000'::uuid), upper(isz_name))
    WHERE isz_is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_isz_list ON inventory.item_size_master
    (isz_company_id, isz_sort) WHERE isz_is_deleted = false;

-- ── E1. colours ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inventory.item_colour_master (
    icl_id           uuid         NOT NULL DEFAULT uuidv7(),
    icl_company_id   uuid,
    icl_code         varchar(20),
    icl_name         varchar(50)  NOT NULL,
    icl_sort         integer      NOT NULL DEFAULT 0,
    icl_is_active    boolean      NOT NULL DEFAULT true,
    icl_is_deleted   boolean      NOT NULL DEFAULT false,
    icl_sync_date    timestamptz(6),
    icl_created_on   timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    icl_created_by   varchar(100),
    icl_modified_on  timestamptz(6),
    icl_modified_by  varchar(100),
    CONSTRAINT pk_item_colour_master PRIMARY KEY (icl_id),
    CONSTRAINT fk_icl_company FOREIGN KEY (icl_company_id)
        REFERENCES public.companys (comp_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT ck_icl_name CHECK (length(btrim(icl_name)) > 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_icl_name ON inventory.item_colour_master
    (COALESCE(icl_company_id, '00000000-0000-0000-0000-000000000000'::uuid), upper(icl_name))
    WHERE icl_is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_icl_list ON inventory.item_colour_master
    (icl_company_id, icl_sort) WHERE icl_is_deleted = false;

-- ── E2. a batch's size / colour / model ────────────────────────────────────
-- sbd_id is uuid v5 over (company, batch no) — computed by the server, the
-- same pattern as the lot id — so two installs writing one batch write one row.
-- The source triple names the inward line that created it (OPENING now,
-- PURCHASE later); after the document posts, /stock/batch-detail/update is the
-- only writer.
CREATE TABLE IF NOT EXISTS stock.stock_batch_detail (
    sbd_id            uuid         NOT NULL,
    sbd_company_id    uuid         NOT NULL,
    sbd_batch_no      varchar(100) NOT NULL,
    sbd_item_id       uuid         NOT NULL,
    sbd_size_id       uuid,
    sbd_colour_id     uuid,
    sbd_model         varchar(100),
    sbd_src_doc_type  varchar(30),
    sbd_src_doc_id    uuid,
    sbd_src_line_id   uuid,
    sbd_is_active     boolean      NOT NULL DEFAULT true,
    sbd_is_deleted    boolean      NOT NULL DEFAULT false,
    sbd_sync_date     timestamptz(6),
    sbd_created_on    timestamptz(6) NOT NULL DEFAULT now(),
    sbd_created_by    text,
    sbd_modified_on   timestamptz(6),
    sbd_modified_by   text,
    CONSTRAINT pk_stock_batch_detail PRIMARY KEY (sbd_id),
    CONSTRAINT fk_sbd_company FOREIGN KEY (sbd_company_id)
        REFERENCES public.companys (comp_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_sbd_item FOREIGN KEY (sbd_item_id)
        REFERENCES inventory.item_master (item_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_sbd_size FOREIGN KEY (sbd_size_id)
        REFERENCES inventory.item_size_master (isz_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_sbd_colour FOREIGN KEY (sbd_colour_id)
        REFERENCES inventory.item_colour_master (icl_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    -- Stored folded, as slt_key_batch folds it, so a read joins on equality.
    CONSTRAINT ck_sbd_batch_shape CHECK (sbd_batch_no = upper(btrim(sbd_batch_no)) AND sbd_batch_no <> ''),
    CONSTRAINT ck_sbd_model CHECK (sbd_model IS NULL OR length(btrim(sbd_model)) > 0),
    CONSTRAINT ck_sbd_src CHECK (num_nonnulls(sbd_src_doc_type, sbd_src_doc_id, sbd_src_line_id) IN (0, 3))
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_sbd_batch ON stock.stock_batch_detail
    (sbd_company_id, sbd_batch_no) WHERE sbd_is_deleted = false;
-- GET /stock/batch-detail/models — the models used for an item.
CREATE INDEX IF NOT EXISTS ix_sbd_model ON stock.stock_batch_detail
    (sbd_company_id, sbd_item_id, upper(sbd_model))
    WHERE sbd_model IS NOT NULL AND sbd_is_deleted = false;
-- Reports by size / colour, and the masters' "in use" check.
CREATE INDEX IF NOT EXISTS ix_sbd_size ON stock.stock_batch_detail
    (sbd_company_id, sbd_size_id) WHERE sbd_size_id IS NOT NULL AND sbd_is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_sbd_colour ON stock.stock_batch_detail
    (sbd_company_id, sbd_colour_id) WHERE sbd_colour_id IS NOT NULL AND sbd_is_deleted = false;
-- The source document's own reads and deletes.
CREATE INDEX IF NOT EXISTS ix_sbd_src_doc ON stock.stock_batch_detail
    (sbd_src_doc_id) WHERE sbd_src_doc_id IS NOT NULL AND sbd_is_deleted = false;

COMMENT ON TABLE inventory.item_size_master IS
    'Textile sizes (S, M, L, 28, 30 …) picked on an inward line. Company NULL = shared. isz_sort orders them.';
COMMENT ON TABLE inventory.item_colour_master IS
    'Textile colours picked on an inward line. Company NULL = shared. icl_sort orders them.';
COMMENT ON TABLE stock.stock_batch_detail IS
    'A batch''s size, colour and model, keyed by (company, batch no). Written by the inward save; after post only by /stock/batch-detail/update.';

-- ── sync: exactly what public.sync_install_triggers() creates per table ──
-- Skipped where the sync functions are absent (they come from a migration kept
-- out of git, so only local installs have them).
DO $$
DECLARE
  t record;
BEGIN
  IF to_regprocedure('public.fn_sync_mark_dirty()') IS NULL
     OR to_regprocedure('public.fn_sync_log_delete()') IS NULL THEN
    RAISE NOTICE 'textile masters: sync functions absent, sync triggers skipped';
    RETURN;
  END IF;
  FOR t IN SELECT * FROM (VALUES
      ('inventory', 'item_size_master',   'isz'),
      ('inventory', 'item_colour_master', 'icl'),
      ('stock',     'stock_batch_detail', 'sbd')) AS v(sch, tbl, pfx)
  LOOP
    EXECUTE format(
      'CREATE OR REPLACE TRIGGER zz_sync_mark_dirty BEFORE UPDATE ON %I.%I '
      'FOR EACH ROW EXECUTE FUNCTION public.fn_sync_mark_dirty(%L)',
      t.sch, t.tbl, t.pfx || '_sync_date');
    EXECUTE format(
      'CREATE OR REPLACE TRIGGER zz_sync_log_delete AFTER DELETE ON %I.%I '
      'FOR EACH ROW EXECUTE FUNCTION public.fn_sync_log_delete(%L, %L, %L)',
      t.sch, t.tbl, t.sch, t.tbl, t.pfx || '_id');
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON %I.%I (%I) WHERE %I IS NULL',
      'ix_sync_pending_' || t.tbl, t.sch, t.tbl, t.pfx || '_id', t.pfx || '_sync_date');
  END LOOP;
END $$;
