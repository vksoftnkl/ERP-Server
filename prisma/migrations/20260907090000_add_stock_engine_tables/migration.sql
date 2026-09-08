-- CreateTable
-- ═══════════════════════════════════════════════════════════════════════════
--  stock.* — the stock engine's TABLES.
--
--  Fifteen models under prisma/stocks/ have existed since the module was
--  written, and not one of them had a migration: stock_track_policy and
--  stock_track_preset arrived through ordinary Prisma migrations, and the rest
--  were expected from an external `schema/stock/` share (16_stock.sql,
--  19_stock_posting.sql, 20_stock_transfer.sql) that is not in this repo and is
--  not on any machine that builds it. `prisma migrate diff` consequently
--  reported fifteen CREATE TABLEs of permanent drift and nothing in the stock
--  module could run at all.
--
--  This migration closes that gap for the SCHEMA. Every table, column, default,
--  constraint and index below is transcribed from the model documentation in
--  prisma/stocks/*.prisma, which names each constraint and index it expects.
--
--  WHAT THIS MIGRATION DELIBERATELY DOES NOT CREATE — the posting machinery:
--
--    fn_svh_post      fn_svh_cancel     fn_svh_txn_map    fn_slt_resolve
--    fn_sml_apply     fn_sbl_rebuild    fn_sdd_rebuild    fn_sag_effective
--    fn_stock_asof
--
--  Those are business logic, not schema. They decide how a document becomes
--  ledger rows, how a lot identity is resolved from what was keyed, how the
--  balance accumulators and the moving average are maintained, and how a
--  cancellation reverses. Reconstructing them from the model prose would be
--  inventing them, and a wrong fn_sml_apply is worse than an absent one: it
--  moves stock quietly. They remain the DB owner's to supply.
--
--  So after this migration the tables are real, the constraints hold and the
--  drift is gone — but the trigger-maintained columns the models describe
--  (stock_balance's four accumulators, stock_lot.slt_total_on_hand,
--  stock_item_cost's moving average, stock_balance.sbl_reserved_qty and
--  sbl_transit_in_qty) have no trigger maintaining them yet, and posting a
--  voucher still needs fn_svh_post. GENERATED columns are real and work now:
--  they are schema, and they are declared here.
--
--  Prisma Migrate cannot express PARTITION BY, partition-aware composite
--  primary keys, GENERATED ALWAYS ... STORED, CHECK constraints, EXCLUDE
--  constraints or partial indexes, so this file is hand-written rather than
--  produced by `prisma migrate dev` — exactly as 20260808132323 and
--  20260811080000 were.
--
--  Table owners are not set here, following the repo's other partitioned-table
--  migrations, so a non-superuser deploy role still works.
-- ═══════════════════════════════════════════════════════════════════════════

-- btree_gist is what lets ex_sag_overlap mix a uuid equality with a range
-- overlap in one gist index. Already present on every environment the repo
-- targets; stated here so a fresh database is not a surprise.
CREATE EXTENSION IF NOT EXISTS btree_gist;


-- ───────────────────────────────────────────────────────────────────────────
--  stock.stock_reason_master — WHY stock moved when no trade document explains
--  it. Load-bearing: fn_svh_txn_map refuses an ADJUSTMENT that cites no reason,
--  and a reason naming exactly one txn type is BELIEVED, which is how sample,
--  gift and internal-use issues classify themselves.
--
--  srm_company_id NULL = SHARED with every company. Scoping MERGES here (a
--  company's own row with a shared row's code overrides it in the picker),
--  unlike the tracking policy, which picks most-specific, and the ageing
--  ladder, which is all-or-nothing.
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stock.stock_reason_master
(
    srm_id                 uuid                  NOT NULL DEFAULT uuidv7(),
    -- NULL = shared with every company.
    srm_company_id         uuid,
    srm_code               character varying(30) NOT NULL,
    srm_name               character varying(150) NOT NULL,

    -- Which movements may cite it. Empty = any. text[] with DEFAULT '{}':
    -- Prisma scalar lists reject null, so the DTO must normalise to [].
    srm_allowed_txn_types  text[]                NOT NULL DEFAULT '{}',
    -- IN, OUT or BOTH. BOTH is only safe where the direction comes from
    -- elsewhere — a PHYSICAL count, where the counted difference supplies it.
    srm_direction          character varying(10) NOT NULL DEFAULT 'BOTH',

    srm_require_remarks    boolean               NOT NULL DEFAULT false,
    -- Where the value of written-off stock lands. NULL = no auto posting.
    srm_gl_ledger_id       uuid,
    srm_sort_order         integer               NOT NULL DEFAULT 0,

    srm_remarks            character varying(250),
    srm_is_active          boolean               NOT NULL DEFAULT true,
    srm_is_deleted         boolean               NOT NULL DEFAULT false,
    srm_sync_date          timestamptz(6),
    srm_created_on         timestamptz(6)        NOT NULL DEFAULT now(),
    srm_created_by         text,
    srm_modified_on        timestamptz(6),
    srm_modified_by        text,

    CONSTRAINT pk_stock_reason_master PRIMARY KEY (srm_id),
    CONSTRAINT ck_srm_direction CHECK (srm_direction::text = ANY (ARRAY[
        'IN'::text, 'OUT'::text, 'BOTH'::text])),
    -- The stable identity. [A-Za-z0-9_-] only, so a code survives being put in
    -- a URL, a CSV and a filename without quoting.
    CONSTRAINT ck_srm_code_shape CHECK (srm_code ~ '^[A-Za-z0-9_-]+$'),

    CONSTRAINT fk_srm_company   FOREIGN KEY (srm_company_id)
        REFERENCES public.companys (comp_id)             ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_srm_gl_ledger FOREIGN KEY (srm_gl_ledger_id)
        REFERENCES accounts.acc_ledger_master (led_id)   ON UPDATE CASCADE ON DELETE RESTRICT
);

-- COALESCEd because a plain unique index treats every NULL as distinct, which
-- would let the seed insert SHORTAGE twice into the shared set.
CREATE UNIQUE INDEX IF NOT EXISTS ux_srm_code
    ON stock.stock_reason_master
       (COALESCE(srm_company_id, '00000000-0000-0000-0000-000000000000'::uuid), srm_code)
    WHERE srm_is_deleted = false;

CREATE INDEX IF NOT EXISTS ix_srm_list
    ON stock.stock_reason_master
       (COALESCE(srm_company_id, '00000000-0000-0000-0000-000000000000'::uuid),
        srm_sort_order, srm_name)
    WHERE srm_is_active = true AND srm_is_deleted = false;


-- ───────────────────────────────────────────────────────────────────────────
--  stock.stock_ageing_slab — the age buckets an ageing report sums into. The
--  rows sharing a sag_company_id are one LADDER.
--
--  sag_company_id NULL = the DEFAULT ladder, used WHOLE by any company that has
--  not authored one of its own. Never merged: fn_sag_effective returns a
--  company's own slabs or the default ones, never a mixture, because merging
--  two ladders puts one holding in two buckets.
--
--  The range is half-open in the database — [from, to + 1) — and read as
--  inclusive-inclusive. Written that way rather than as an inclusive '[]' range
--  because an inclusive upper bound of int4's maximum overflows when PostgreSQL
--  normalises it to upper + 1. sag_to_days NULL = open ended, and
--  int4range(from, NULL) is exactly "and everything older".
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stock.stock_ageing_slab
(
    sag_id             uuid                  NOT NULL DEFAULT uuidv7(),
    -- NULL = the default ladder.
    sag_company_id     uuid,
    -- 1-based position: display order and stable identity within a ladder.
    sag_slab_no        integer               NOT NULL,
    -- What the report column says. Free text: never parsed back into bounds.
    sag_label          character varying(50) NOT NULL,
    sag_from_days      integer               NOT NULL,
    -- NULL = open ended. Exactly one per ladder, and it is the last one.
    sag_to_days        integer,

    sag_is_active      boolean               NOT NULL DEFAULT true,
    sag_is_deleted     boolean               NOT NULL DEFAULT false,
    sag_sync_date      timestamptz(6),
    sag_created_on     timestamptz(6)        NOT NULL DEFAULT now(),
    sag_created_by     text,
    sag_modified_on    timestamptz(6),
    sag_modified_by    text,

    CONSTRAINT pk_stock_ageing_slab PRIMARY KEY (sag_id),
    CONSTRAINT ck_sag_days CHECK (
        sag_from_days >= 0
        AND (sag_to_days IS NULL OR sag_to_days >= sag_from_days)),
    CONSTRAINT ck_sag_slab_no CHECK (sag_slab_no >= 1),

    -- Two slabs of ONE ladder may not claim the same day. The company is
    -- COALESCEd because EXCLUDE never conflicts on NULL, and without it two
    -- default slabs could overlap freely. A default slab and a company slab
    -- covering the same days DO coexist, and must: different ladders.
    --
    -- DEFERRABLE because reordering a ladder is impossible otherwise —
    -- shrinking 0-30 to 0-14 collides with 31-60 until that row moves too. A
    -- caller that reorders issues SET CONSTRAINTS stock.ex_sag_overlap DEFERRED
    -- first; INITIALLY IMMEDIATE leaves everyone else unaffected.
    CONSTRAINT ex_sag_overlap EXCLUDE USING gist (
        (COALESCE(sag_company_id, '00000000-0000-0000-0000-000000000000'::uuid)) WITH =,
        int4range(sag_from_days, sag_to_days + 1) WITH &&)
        WHERE (sag_is_active = true AND sag_is_deleted = false)
        DEFERRABLE INITIALLY IMMEDIATE,

    CONSTRAINT fk_sag_company FOREIGN KEY (sag_company_id)
        REFERENCES public.companys (comp_id) ON UPDATE CASCADE ON DELETE RESTRICT
);

-- COALESCEd for the same reason as ux_srm_code: a plain unique index treats
-- every NULL as distinct and would let two slab 1s into the default ladder.
CREATE UNIQUE INDEX IF NOT EXISTS ux_sag_slab_no
    ON stock.stock_ageing_slab
       (COALESCE(sag_company_id, '00000000-0000-0000-0000-000000000000'::uuid), sag_slab_no)
    WHERE sag_is_deleted = false;


-- ───────────────────────────────────────────────────────────────────────────
--  stock.stock_lot — the IDENTITY of a holding. Never its quantity.
--
--  COMPANY-SCOPED, deliberately: a lot is NOT per branch. Transfer stock
--  between branches and it is the same batch, the same expiry, the same
--  supplier and the same AGE. A per-branch lot would reset the ageing clock at
--  every transfer and let a chain hide ninety-day-old stock by moving it.
--
--  THE NULL-NORMALISED KEY is what makes one mechanism serve batch-wise,
--  MRP-wise, sale-price-wise and untracked items alike. Every tracked dimension
--  is a nullable column with a GENERATED companion substituting a sentinel:
--  ux_slt_identity is built over the COMPANIONS, never the originals, because a
--  UNIQUE index treats every NULL as distinct — which would let an untracked
--  item accrete a fresh lot on every receipt, for ever.
--
--  The sentinels are impossible values, not merely unlikely: '~' sorts after
--  every alphanumeric batch number, -1 cannot be a price, 0001-01-01 cannot be
--  an expiry, and the nil uuid is not a supplier.
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stock.stock_lot
(
    slt_id                  uuid                   NOT NULL DEFAULT uuidv7(),
    slt_company_id          uuid                   NOT NULL,
    slt_tenant_id           uuid,

    slt_item_id             uuid                   NOT NULL,
    -- The item's BASE unit — an item_unit_conversion(iuc_id), NEVER an
    -- item_unit_master(unit_id).
    slt_base_uom_id         uuid                   NOT NULL,

    -- ── Identity. NULL means "not significant for this item". ──────────────
    slt_batch_no            character varying(100),
    slt_mfg_batch_no        character varying(100),
    slt_mrp                 numeric(18, 6),
    slt_sale_price          numeric(18, 6),
    slt_mfg_date            date,
    slt_expiry_date         date,
    slt_serial_no           character varying(100),
    slt_supplier_id         uuid,

    -- ── The key ux_slt_identity is actually built on ───────────────────────
    -- GENERATED ALWAYS ... STORED. Postgres rejects any write to these; write
    -- the nullable originals above.
    slt_key_batch           character varying(100)
        GENERATED ALWAYS AS (COALESCE(slt_batch_no, '~')) STORED,
    slt_key_mrp             numeric(18, 6)
        GENERATED ALWAYS AS (COALESCE(slt_mrp, -1)) STORED,
    slt_key_sp              numeric(18, 6)
        GENERATED ALWAYS AS (COALESCE(slt_sale_price, -1)) STORED,
    slt_key_expiry          date
        GENERATED ALWAYS AS (COALESCE(slt_expiry_date, '0001-01-01'::date)) STORED,
    slt_key_serial          character varying(100)
        GENERATED ALWAYS AS (COALESCE(slt_serial_no, '~')) STORED,
    slt_key_supplier        uuid
        GENERATED ALWAYS AS (COALESCE(slt_supplier_id,
            '00000000-0000-0000-0000-000000000000'::uuid)) STORED,

    -- Which StockTrackPolicy flags were live when this lot was created —
    -- B/M/S/E/R/P, 'N' when nothing is tracked. Stamped at creation so a policy
    -- change tomorrow cannot re-key yesterday's stock.
    slt_track_signature     character varying(8)   NOT NULL DEFAULT 'N',

    -- ── Where it came from, and when ───────────────────────────────────────
    -- The ageing anchor for the CHAIN. A godown's own "how long has this sat
    -- HERE" is stock_balance.sbl_first_in_date instead.
    slt_first_inward_date   date                   NOT NULL DEFAULT CURRENT_DATE,
    slt_first_inward_branch uuid,
    -- The (module, docType, docId) triple, all-or-nothing.
    slt_inward_src_module   character varying(20),
    slt_inward_src_doc_type character varying(30),
    slt_inward_src_doc_id   uuid,
    slt_inward_src_acc_year character(9),
    slt_inward_refno        character varying(100),

    -- ── Cost, as received ──────────────────────────────────────────────────
    -- slt_cost_rate is THIS lot's own cost, which is what makes FIFO and
    -- LOT_ACTUAL valuation a read rather than a replay. The moving weighted
    -- average is maintained in parallel in stock_item_cost — both, always, so
    -- stp_valuation_method SELECTS an answer instead of triggering a rebuild.
    slt_purchase_rate       numeric(18, 6)         NOT NULL DEFAULT 0,
    slt_cost_rate           numeric(18, 6)         NOT NULL DEFAULT 0,
    slt_cost_rate_wot       numeric(18, 6)         NOT NULL DEFAULT 0,
    slt_landed_rate         numeric(18, 6)         NOT NULL DEFAULT 0,
    slt_tax_rate            numeric(9, 3)          NOT NULL DEFAULT 0,

    -- ── Lifecycle ──────────────────────────────────────────────────────────
    -- CLOSED is set by the engine when the last unit leaves; BLOCKED and
    -- EXPIRED are business decisions that stop the lot being issued.
    slt_status              character varying(20)  NOT NULL DEFAULT 'ACTIVE',
    slt_closed_on           timestamptz(6),
    slt_blocked_reason      character varying(250),

    -- Chain-wide total across every branch and godown. TRIGGER-MAINTAINED from
    -- stock_ledger by fn_sml_apply(). NEVER written from application code.
    slt_total_on_hand       numeric(18, 6)         NOT NULL DEFAULT 0,

    slt_row_version         bigint                 NOT NULL DEFAULT 1,
    slt_remarks             character varying(250),
    slt_is_active           boolean                NOT NULL DEFAULT true,
    slt_is_deleted          boolean                NOT NULL DEFAULT false,
    slt_sync_date           timestamptz(6),
    slt_created_on          timestamptz(6)         NOT NULL DEFAULT now(),
    slt_created_by          text,
    slt_modified_on         timestamptz(6),
    slt_modified_by         text,

    CONSTRAINT pk_stock_lot PRIMARY KEY (slt_id),
    CONSTRAINT ck_slt_status CHECK (slt_status::text = ANY (ARRAY[
        'ACTIVE'::text, 'CLOSED'::text, 'BLOCKED'::text, 'EXPIRED'::text])),
    CONSTRAINT ck_slt_expiry_order CHECK (
        slt_expiry_date IS NULL OR slt_mfg_date IS NULL
        OR slt_expiry_date >= slt_mfg_date),
    CONSTRAINT ck_slt_prices CHECK (
        (slt_mrp        IS NULL OR slt_mrp        >= 0) AND
        (slt_sale_price IS NULL OR slt_sale_price >= 0) AND
        slt_purchase_rate >= 0 AND slt_cost_rate   >= 0 AND
        slt_cost_rate_wot >= 0 AND slt_landed_rate >= 0 AND
        slt_tax_rate      >= 0),
    -- A batch number of '' or '   ' is not a batch number, and would key a lot
    -- that no lookup can ever find again.
    CONSTRAINT ck_slt_batch_shape CHECK (
        slt_batch_no IS NULL OR length(btrim(slt_batch_no)) > 0),
    CONSTRAINT ck_slt_serial_shape CHECK (
        slt_serial_no IS NULL OR length(btrim(slt_serial_no)) > 0),
    -- The source triple is all-or-nothing, as everywhere else in the chain, and
    -- the year travels with it rather than standing alone.
    CONSTRAINT ck_slt_inward_src CHECK (
        num_nonnulls(slt_inward_src_module, slt_inward_src_doc_type,
                     slt_inward_src_doc_id) IN (0, 3)
        AND (slt_inward_src_acc_year IS NULL OR slt_inward_src_doc_id IS NOT NULL)),

    CONSTRAINT fk_slt_company  FOREIGN KEY (slt_company_id)
        REFERENCES public.companys (comp_id)                ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_slt_item     FOREIGN KEY (slt_item_id)
        REFERENCES inventory.item_master (item_id)           ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_slt_base_uom FOREIGN KEY (slt_base_uom_id)
        REFERENCES inventory.item_unit_conversion (iuc_id)   ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_slt_supplier FOREIGN KEY (slt_supplier_id)
        REFERENCES purchase.suppliers (sup_id)               ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_slt_branch   FOREIGN KEY (slt_first_inward_branch)
        REFERENCES public.branch_master (br_id)              ON UPDATE CASCADE ON DELETE RESTRICT
);

-- THE index of the stock engine: the one that collapses batch-wise, MRP-wise,
-- sale-price-wise and untracked into a single mechanism. Over the GENERATED
-- companions, never the originals.
CREATE UNIQUE INDEX IF NOT EXISTS ux_slt_identity
    ON stock.stock_lot
       (slt_company_id, slt_item_id, slt_key_batch, slt_key_mrp, slt_key_sp,
        slt_key_expiry, slt_key_serial, slt_key_supplier)
    WHERE slt_is_deleted = false;

-- FEFO and near-expiry.
CREATE INDEX IF NOT EXISTS ix_slt_expiry
    ON stock.stock_lot (slt_company_id, slt_item_id, slt_expiry_date)
    WHERE slt_expiry_date IS NOT NULL
      AND slt_status::text = 'ACTIVE' AND slt_is_deleted = false;

-- FIFO / LIFO, and the chain-wide ageing report.
CREATE INDEX IF NOT EXISTS ix_slt_inward
    ON stock.stock_lot (slt_company_id, slt_item_id, slt_first_inward_date)
    WHERE slt_is_deleted = false;

-- Supplier-wise stock and supplier recall.
CREATE INDEX IF NOT EXISTS ix_slt_supplier
    ON stock.stock_lot (slt_company_id, slt_supplier_id, slt_item_id)
    WHERE slt_supplier_id IS NOT NULL AND slt_is_deleted = false;

-- "Who has any of batch AX-4471?"
CREATE INDEX IF NOT EXISTS ix_slt_batch_no
    ON stock.stock_lot (slt_company_id, slt_batch_no)
    WHERE slt_batch_no IS NOT NULL AND slt_is_deleted = false;

-- "How much at 120, how much at the old 110".
CREATE INDEX IF NOT EXISTS ix_slt_mrp
    ON stock.stock_lot (slt_company_id, slt_item_id, slt_mrp)
    WHERE slt_mrp IS NOT NULL AND slt_is_deleted = false;


-- ───────────────────────────────────────────────────────────────────────────
--  stock.stock_balance — the CURRENT position. One row per holding.
--
--  stock_ledger is the truth and this is the answer: every figure here is
--  derivable by replaying the ledger, and is kept only so the billing screen
--  does not have to.
--
--  NOT PARTITIONED, and deliberately without an acc-year column: a balance is
--  as-of-now, not as-of-a-year. Carrying stock into a new fiscal year must not
--  mean copying every holding into a new partition, and "what is on the shelf"
--  has one answer regardless of which year produced it. Year-wise questions are
--  ledger questions.
--
--  THREE QUANTITIES, THREE MEANINGS, and confusing them is the classic stock
--  bug. A billing screen checks AVAILABLE, a physical count reconciles against
--  ON HAND, and a transfer receipt clears TRANSIT. sbl_available_qty repeats
--  the on-hand arithmetic rather than referencing it because PostgreSQL forbids
--  a generated column reading another generated column.
--
--  NEGATIVE STOCK IS REPRESENTABLE ON PURPOSE. ck_sbl_accum keeps the four
--  accumulators non-negative, but nothing stops on-hand going below zero: a
--  StockTrackPolicy of ALLOW is a real business choice.
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stock.stock_balance
(
    sbl_id                uuid                  NOT NULL DEFAULT uuidv7(),
    sbl_company_id        uuid                  NOT NULL,
    sbl_branch_id         uuid                  NOT NULL,
    sbl_tenant_id         uuid,
    -- The shelf. Branch and godown live HERE and not on the lot: the same batch
    -- held in four godowns is four balance rows and one lot.
    sbl_godown_id         uuid                  NOT NULL,
    sbl_item_id           uuid                  NOT NULL,
    sbl_lot_id            uuid                  NOT NULL,
    sbl_base_uom_id       uuid                  NOT NULL,
    sbl_bucket            character varying(20) NOT NULL DEFAULT 'SALEABLE',

    -- ── Accumulators ───────────────────────────────────────────────────────
    -- TRIGGER-MAINTAINED from stock_ledger by fn_sml_apply(). In and out are
    -- kept apart so a concurrent inward and outward touch different columns of
    -- the same row rather than fighting over one. Free goods ARE stock: they
    -- sit on the shelf and get sold, and on-hand counts them.
    sbl_in_qty            numeric(18, 6)        NOT NULL DEFAULT 0,
    sbl_out_qty           numeric(18, 6)        NOT NULL DEFAULT 0,
    sbl_free_in_qty       numeric(18, 6)        NOT NULL DEFAULT 0,
    sbl_free_out_qty      numeric(18, 6)        NOT NULL DEFAULT 0,

    -- What is PHYSICALLY here, free goods included.
    sbl_on_hand_qty       numeric(18, 6)
        GENERATED ALWAYS AS (sbl_in_qty + sbl_free_in_qty
                           - sbl_out_qty - sbl_free_out_qty) STORED,

    -- Here, but promised to an order. Owned by stock_reservation.
    sbl_reserved_qty      numeric(18, 6)        NOT NULL DEFAULT 0,
    -- Sent from another branch, not yet received. Owned by stock_transit, and
    -- NOT part of on hand: it is not here yet.
    sbl_transit_in_qty    numeric(18, 6)        NOT NULL DEFAULT 0,

    -- What may still be SOLD, and the figure a billing screen checks.
    sbl_available_qty     numeric(18, 6)
        GENERATED ALWAYS AS (sbl_in_qty + sbl_free_in_qty
                           - sbl_out_qty - sbl_free_out_qty
                           - sbl_reserved_qty) STORED,

    -- ── Value ──────────────────────────────────────────────────────────────
    sbl_avg_cost_rate     numeric(18, 6)        NOT NULL DEFAULT 0,
    sbl_avg_cost_rate_wot numeric(18, 6)        NOT NULL DEFAULT 0,
    sbl_stock_value       numeric(18, 2)        NOT NULL DEFAULT 0,
    sbl_stock_value_wot   numeric(18, 2)        NOT NULL DEFAULT 0,

    -- ── Ageing anchors, for THIS godown ────────────────────────────────────
    -- "How long has it sat on this shelf". The chain-wide age is the lot's
    -- slt_first_inward_date, which a transfer must not reset.
    sbl_first_in_date     date,
    sbl_last_in_date      date,
    sbl_last_out_date     date,

    -- ── Identity cache ─────────────────────────────────────────────────────
    -- Owned by stock_lot, copied here by the same trigger so the expiry, MRP
    -- and supplier reports are covering-index reads on this table alone. When
    -- the two disagree, the lot is right.
    sbl_batch_no          character varying(100),
    sbl_mrp               numeric(18, 6),
    sbl_sale_price        numeric(18, 6),
    sbl_expiry_date       date,
    sbl_supplier_id       uuid,

    sbl_row_version       bigint                NOT NULL DEFAULT 1,
    sbl_is_active         boolean               NOT NULL DEFAULT true,
    sbl_is_deleted        boolean               NOT NULL DEFAULT false,
    sbl_sync_date         timestamptz(6),
    sbl_created_on        timestamptz(6)        NOT NULL DEFAULT now(),
    sbl_created_by        text,
    sbl_modified_on       timestamptz(6),
    sbl_modified_by       text,

    CONSTRAINT pk_stock_balance PRIMARY KEY (sbl_id),
    CONSTRAINT ck_sbl_bucket CHECK (sbl_bucket::text = ANY (ARRAY[
        'SALEABLE'::text, 'DAMAGED'::text, 'QUARANTINE'::text,
        'EXPIRED'::text, 'SAMPLE'::text])),
    -- The four accumulators only. On-hand may legitimately go negative.
    CONSTRAINT ck_sbl_accum CHECK (
        sbl_in_qty       >= 0 AND sbl_out_qty       >= 0 AND
        sbl_free_in_qty  >= 0 AND sbl_free_out_qty  >= 0),
    -- Neither hold may go negative either — the models say so without naming a
    -- constraint for it, so it gets its own rather than being folded into the
    -- accumulator check, which the docs define as exactly four columns.
    CONSTRAINT ck_sbl_holds CHECK (
        sbl_reserved_qty >= 0 AND sbl_transit_in_qty >= 0),

    CONSTRAINT fk_sbl_company  FOREIGN KEY (sbl_company_id)
        REFERENCES public.companys (comp_id)              ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_sbl_branch   FOREIGN KEY (sbl_branch_id)
        REFERENCES public.branch_master (br_id)           ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_sbl_godown   FOREIGN KEY (sbl_godown_id)
        REFERENCES inventory.godown_locations (gdl_id)    ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_sbl_item     FOREIGN KEY (sbl_item_id)
        REFERENCES inventory.item_master (item_id)        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_sbl_lot      FOREIGN KEY (sbl_lot_id)
        REFERENCES stock.stock_lot (slt_id)               ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_sbl_base_uom FOREIGN KEY (sbl_base_uom_id)
        REFERENCES inventory.item_unit_conversion (iuc_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_sbl_supplier FOREIGN KEY (sbl_supplier_id)
        REFERENCES purchase.suppliers (sup_id)            ON UPDATE CASCADE ON DELETE RESTRICT
);

-- ONE ROW PER HOLDING, and the upsert target of fn_sml_apply().
CREATE UNIQUE INDEX IF NOT EXISTS ux_sbl_scope
    ON stock.stock_balance
       (sbl_company_id, sbl_branch_id, sbl_godown_id, sbl_item_id, sbl_lot_id, sbl_bucket)
    WHERE sbl_is_deleted = false;

-- The billing screen's stock lookup — what /master-lookups/item-price asks,
-- answered without touching the heap.
CREATE INDEX IF NOT EXISTS ix_sbl_lookup
    ON stock.stock_balance
       (sbl_company_id, sbl_branch_id, sbl_item_id, sbl_godown_id, sbl_bucket)
       INCLUDE (sbl_on_hand_qty, sbl_available_qty, sbl_lot_id, sbl_batch_no,
                sbl_mrp, sbl_sale_price, sbl_expiry_date)
    WHERE sbl_is_deleted = false AND sbl_is_active = true;

-- Item-wise stock across a branch's godowns, and the chain-wide "who else has
-- this?" behind an inter-store transfer suggestion.
CREATE INDEX IF NOT EXISTS ix_sbl_item_chain
    ON stock.stock_balance (sbl_company_id, sbl_item_id, sbl_branch_id)
    WHERE sbl_is_deleted = false;

-- Ageing, on SHELF age — not the lot's chain-wide age.
CREATE INDEX IF NOT EXISTS ix_sbl_ageing
    ON stock.stock_balance
       (sbl_company_id, sbl_branch_id, sbl_first_in_date, sbl_item_id)
    WHERE sbl_is_deleted = false;

-- Supplier-wise stock, straight off the cached supplier.
CREATE INDEX IF NOT EXISTS ix_sbl_supplier
    ON stock.stock_balance (sbl_company_id, sbl_supplier_id, sbl_item_id)
    WHERE sbl_supplier_id IS NOT NULL AND sbl_is_deleted = false;

-- Near expiry, and expired-stock blocking.
CREATE INDEX IF NOT EXISTS ix_sbl_expiry
    ON stock.stock_balance
       (sbl_company_id, sbl_branch_id, sbl_expiry_date, sbl_item_id)
    WHERE sbl_expiry_date IS NOT NULL AND sbl_is_deleted = false;

-- MRP-wise and selling-price-wise summaries.
CREATE INDEX IF NOT EXISTS ix_sbl_mrp
    ON stock.stock_balance (sbl_company_id, sbl_item_id, sbl_mrp, sbl_sale_price)
    WHERE sbl_mrp IS NOT NULL AND sbl_is_deleted = false;

-- The negative-stock exception report.
CREATE INDEX IF NOT EXISTS ix_sbl_negative
    ON stock.stock_balance (sbl_company_id, sbl_branch_id, sbl_item_id)
    WHERE sbl_on_hand_qty < 0 AND sbl_is_deleted = false;


-- ───────────────────────────────────────────────────────────────────────────
--  stock.stock_item_cost — the MOVING WEIGHTED AVERAGE, one row per
--  (company, branch, item). The other half of the valuation answer.
--
--  BRANCH-LEVEL, NOT GODOWN-LEVEL: moving a case from the back store to the
--  shop floor must not change what the stock cost. Not company-wide either —
--  two branches buying at different rates have different costs, and averaging
--  them lets one branch's bad buying inflate the other's margin.
--
--  THE AVERAGE IS STORED, NOT DERIVED, because qty legitimately reaches zero
--  when the last unit is sold and the rate must SURVIVE that: the next inward
--  of an item that went to nil is not a fresh start, and value/qty as a
--  generated column would divide by zero.
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stock.stock_item_cost
(
    sic_id                 uuid            NOT NULL DEFAULT uuidv7(),
    sic_company_id         uuid            NOT NULL,
    sic_branch_id          uuid            NOT NULL,
    sic_item_id            uuid            NOT NULL,
    -- sic_total_qty is in THIS unit, so the average is a rate per base unit and
    -- never per "case".
    sic_base_uom_id        uuid            NOT NULL,

    -- ── The moving average ─────────────────────────────────────────────────
    -- TRIGGER-MAINTAINED by fn_sml_apply(): an inward adds qty and value and
    -- recomputes the average; an outward removes qty at the CURRENT average and
    -- leaves the rate alone — which is what "moving average" means.
    sic_total_qty          numeric(18, 6)  NOT NULL DEFAULT 0,
    sic_total_value        numeric(18, 2)  NOT NULL DEFAULT 0,
    sic_total_value_wot    numeric(18, 2)  NOT NULL DEFAULT 0,
    sic_avg_cost_rate      numeric(18, 6)  NOT NULL DEFAULT 0,
    sic_avg_cost_rate_wot  numeric(18, 6)  NOT NULL DEFAULT 0,

    sic_last_purchase_rate numeric(18, 6)  NOT NULL DEFAULT 0,
    sic_last_purchase_date date,
    sic_last_sale_rate     numeric(18, 6)  NOT NULL DEFAULT 0,
    sic_last_sale_date     date,
    -- The highest rate this item has ever been received at. Kept because a
    -- replacement-cost valuation asks for it and it cannot be recovered once
    -- lots close.
    sic_max_cost_rate      numeric(18, 6)  NOT NULL DEFAULT 0,

    sic_row_version        bigint          NOT NULL DEFAULT 1,
    -- No sic_is_active: a cost row is not something a user switches off.
    -- sic_is_deleted exists only for the partial index predicate.
    sic_is_deleted         boolean         NOT NULL DEFAULT false,
    sic_sync_date          timestamptz(6),
    sic_created_on         timestamptz(6)  NOT NULL DEFAULT now(),
    sic_created_by         text,
    sic_modified_on        timestamptz(6),
    sic_modified_by        text,

    CONSTRAINT pk_stock_item_cost PRIMARY KEY (sic_id),

    CONSTRAINT fk_sic_company  FOREIGN KEY (sic_company_id)
        REFERENCES public.companys (comp_id)               ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_sic_branch   FOREIGN KEY (sic_branch_id)
        REFERENCES public.branch_master (br_id)            ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_sic_item     FOREIGN KEY (sic_item_id)
        REFERENCES inventory.item_master (item_id)         ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_sic_base_uom FOREIGN KEY (sic_base_uom_id)
        REFERENCES inventory.item_unit_conversion (iuc_id) ON UPDATE CASCADE ON DELETE RESTRICT
);

-- ONE ROW PER (company, branch, item), and the upsert target of fn_sml_apply().
CREATE UNIQUE INDEX IF NOT EXISTS ux_sic_scope
    ON stock.stock_item_cost (sic_company_id, sic_branch_id, sic_item_id)
    WHERE sic_is_deleted = false;


-- ───────────────────────────────────────────────────────────────────────────
--  stock.stock_ledger — every movement. The truth.
--
--  APPEND-ONLY. Never updated in place, never deleted: a cancelled bill does
--  not remove its ledger rows, it writes REVERSING ones, because a stock figure
--  that can change retrospectively is one nobody can reconcile — and in an
--  offline chain the cancellation may arrive after the day was closed. The
--  BEFORE DELETE trigger below raises rather than trusting convention.
--
--  THERE IS NO RUNNING-BALANCE COLUMN, on purpose: two tills posting
--  concurrently would serialise on it, a back-dated entry would invalidate
--  every row after it, and an offline chain has no global order to compute it
--  in. The balance is stock_balance's job and nothing else's.
--
--  PARTITIONED BY LIST (sml_acc_year), hence the composite primary key.
--  sml_acc_year is this ROW's year; sml_src_acc_year is the DOCUMENT's, and
--  they differ legitimately — a sale return in April against a March bill posts
--  here in the new year.
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stock.stock_ledger
(
    sml_id               uuid                  NOT NULL DEFAULT uuidv7(),
    sml_company_id       uuid                  NOT NULL,
    sml_branch_id        uuid                  NOT NULL,
    sml_tenant_id        uuid,
    -- The PARTITION KEY, and half the primary key.
    sml_acc_year         character(9)          NOT NULL,

    -- Where the stock physically is. Never nullable: an unlocated movement
    -- cannot be reversed, counted or transferred.
    sml_godown_id        uuid                  NOT NULL,

    -- ── What moved ─────────────────────────────────────────────────────────
    sml_item_id          uuid                  NOT NULL,
    sml_lot_id           uuid                  NOT NULL,
    -- Both are item_unit_conversion(iuc_id), NEVER item_unit_master(unit_id):
    -- the stock a bill consumes must be keyed the way the bill keys it.
    sml_uom_id           uuid                  NOT NULL,
    sml_base_uom_id      uuid                  NOT NULL,
    sml_to_base_factor   numeric(18, 6)        NOT NULL DEFAULT 1,

    -- ── Which document caused it ───────────────────────────────────────────
    -- The same (module, docType, docId) triple as acc_tender_detail,
    -- txn_status_log, txn_hold and acc_voucher_doc_register. A new document
    -- type that moves stock costs one CHECK value and nothing else.
    sml_src_module       character varying(20) NOT NULL,
    sml_src_doc_type     character varying(30) NOT NULL,
    sml_src_doc_id       uuid                  NOT NULL,
    -- The DOCUMENT's own year, which is not always sml_acc_year.
    sml_src_acc_year     character(9),
    sml_src_refno        character varying(100),
    sml_line_no          integer               NOT NULL DEFAULT 1,
    sml_split_no         integer               NOT NULL DEFAULT 1,

    -- ── The movement itself ────────────────────────────────────────────────
    sml_txn_type         character varying(30) NOT NULL,
    -- +1 in, -1 out. Redundant against sml_txn_type on purpose: a report that
    -- sums must not have to know that EXPIRY_WRITEOFF is an out.
    sml_direction        smallint              NOT NULL,
    sml_bucket           character varying(20) NOT NULL DEFAULT 'SALEABLE',

    sml_doc_date         date                  NOT NULL,
    sml_doc_datetime     timestamptz(6)        NOT NULL DEFAULT now(),
    sml_posted_on        timestamptz(6)        NOT NULL DEFAULT now(),

    -- ── Quantity, as keyed and in base ─────────────────────────────────────
    sml_qty              numeric(18, 6)        NOT NULL DEFAULT 0,
    sml_base_qty         numeric(18, 6)        NOT NULL DEFAULT 0,
    sml_free_qty         numeric(18, 6)        NOT NULL DEFAULT 0,
    sml_free_base_qty    numeric(18, 6)        NOT NULL DEFAULT 0,
    sml_weight_qty       numeric(18, 6)        NOT NULL DEFAULT 0,

    -- The one column stock_balance reads and every quantity report sums.
    sml_signed_base_qty  numeric(18, 6)
        GENERATED ALWAYS AS (sml_direction * (sml_base_qty + sml_free_base_qty)) STORED,

    -- ── Value ──────────────────────────────────────────────────────────────
    -- On an inward these are what it cost. On an outward they are the COGS,
    -- taken from the lot or the moving average per stp_valuation_method —
    -- NEVER the selling price, which goes in sml_doc_rate.
    sml_cost_rate        numeric(18, 6)        NOT NULL DEFAULT 0,
    sml_cost_value       numeric(18, 2)        NOT NULL DEFAULT 0,
    sml_cost_rate_wot    numeric(18, 6)        NOT NULL DEFAULT 0,
    sml_cost_value_wot   numeric(18, 2)        NOT NULL DEFAULT 0,
    sml_landed_rate      numeric(18, 6)        NOT NULL DEFAULT 0,
    sml_landed_value     numeric(18, 2)        NOT NULL DEFAULT 0,
    sml_doc_rate         numeric(18, 6)        NOT NULL DEFAULT 0,
    sml_doc_rate_wot     numeric(18, 6)        NOT NULL DEFAULT 0,
    sml_doc_amount_wot   numeric(18, 2)        NOT NULL DEFAULT 0,
    -- Snapshots from the lot, so batch/MRP-wise reports read one table.
    sml_mrp              numeric(18, 6),
    sml_batch_no         character varying(100),
    sml_expiry_date      date,

    -- ── Reversal ───────────────────────────────────────────────────────────
    -- sml_reverses_id points at the sml_id being reversed and carries NO
    -- foreign key: the target lives in another partition as often as not, and a
    -- composite FK back into a partitioned parent buys nothing ux_sml_reversal
    -- does not already guarantee.
    sml_is_reversal      boolean               NOT NULL DEFAULT false,
    sml_reverses_id      uuid,

    sml_reason_id        uuid,
    -- Customer or supplier, per sml_src_module. Polymorphic, so no foreign key.
    sml_party_id         uuid,
    sml_narration        text,

    sml_is_deleted       boolean               NOT NULL DEFAULT false,
    sml_sync_date        timestamptz(6),
    -- No modified pair: the table is append-only.
    sml_created_on       timestamptz(6)        NOT NULL DEFAULT now(),
    sml_created_by       text,

    CONSTRAINT pk_stock_ledger PRIMARY KEY (sml_id, sml_acc_year),
    CONSTRAINT ck_sml_acc_year CHECK (
        sml_acc_year ~ '^[0-9]{4}-[0-9]{4}$'
        AND (right(sml_acc_year::text, 4))::integer
          = (left(sml_acc_year::text, 4))::integer + 1),
    CONSTRAINT ck_sml_src_acc_year CHECK (
        sml_src_acc_year IS NULL OR (
            sml_src_acc_year ~ '^[0-9]{4}-[0-9]{4}$'
            AND (right(sml_src_acc_year::text, 4))::integer
              = (left(sml_src_acc_year::text, 4))::integer + 1)),
    CONSTRAINT ck_sml_txn_type CHECK (sml_txn_type::text = ANY (ARRAY[
        'OPENING'::text, 'PURCHASE'::text, 'PURCHASE_RETURN'::text,
        'SALE'::text, 'SALE_RETURN'::text, 'TRANSFER_OUT'::text,
        'TRANSFER_IN'::text, 'ADJUST_PLUS'::text, 'ADJUST_MINUS'::text,
        'PHYSICAL_PLUS'::text, 'PHYSICAL_MINUS'::text, 'DAMAGE'::text,
        'EXPIRY_WRITEOFF'::text, 'REPACK_IN'::text, 'REPACK_OUT'::text,
        'BUCKET_IN'::text, 'BUCKET_OUT'::text, 'GIFT_ISSUE'::text,
        'SAMPLE_ISSUE'::text])),
    CONSTRAINT ck_sml_direction CHECK (sml_direction = ANY (ARRAY[1, -1])),
    CONSTRAINT ck_sml_bucket CHECK (sml_bucket::text = ANY (ARRAY[
        'SALEABLE'::text, 'DAMAGED'::text, 'QUARANTINE'::text,
        'EXPIRED'::text, 'SAMPLE'::text])),
    CONSTRAINT ck_sml_src_module CHECK (sml_src_module::text = ANY (ARRAY[
        'SALES'::text, 'PURCHASE'::text, 'STOCK'::text, 'LOYALTY'::text,
        'PRODUCTION'::text, 'MIGRATION'::text])),
    -- Quantities are MAGNITUDES; the sign lives in sml_direction alone. A
    -- negative qty with a negative direction is a silent double negation.
    CONSTRAINT ck_sml_qty_sign CHECK (
        sml_qty        >= 0 AND sml_base_qty      >= 0 AND
        sml_free_qty   >= 0 AND sml_free_base_qty >= 0 AND
        sml_weight_qty >= 0),
    -- A movement of nothing is not a movement.
    CONSTRAINT ck_sml_qty_nonzero CHECK (sml_base_qty + sml_free_base_qty > 0),
    CONSTRAINT ck_sml_to_base_factor CHECK (sml_to_base_factor > 0),
    -- Both reversal columns move together.
    CONSTRAINT ck_sml_reversal CHECK (
        (sml_is_reversal = true  AND sml_reverses_id IS NOT NULL) OR
        (sml_is_reversal = false AND sml_reverses_id IS NULL)),
    CONSTRAINT ck_sml_line_no CHECK (sml_line_no >= 1 AND sml_split_no >= 1),

    CONSTRAINT fk_sml_company  FOREIGN KEY (sml_company_id)
        REFERENCES public.companys (comp_id)               ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_sml_branch   FOREIGN KEY (sml_branch_id)
        REFERENCES public.branch_master (br_id)            ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_sml_godown   FOREIGN KEY (sml_godown_id)
        REFERENCES inventory.godown_locations (gdl_id)     ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_sml_item     FOREIGN KEY (sml_item_id)
        REFERENCES inventory.item_master (item_id)         ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_sml_lot      FOREIGN KEY (sml_lot_id)
        REFERENCES stock.stock_lot (slt_id)                ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_sml_uom      FOREIGN KEY (sml_uom_id)
        REFERENCES inventory.item_unit_conversion (iuc_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_sml_base_uom FOREIGN KEY (sml_base_uom_id)
        REFERENCES inventory.item_unit_conversion (iuc_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_sml_reason   FOREIGN KEY (sml_reason_id)
        REFERENCES stock.stock_reason_master (srm_id)      ON UPDATE CASCADE ON DELETE RESTRICT
) PARTITION BY LIST (sml_acc_year);

-- POSTING IDEMPOTENCY. The same bill posted twice — a retry after a timeout, a
-- sync replaying a day — must not move stock twice. Direction is in the key
-- because a transfer legitimately writes an OUT and an IN for one source line.
CREATE UNIQUE INDEX IF NOT EXISTS ux_sml_source
    ON stock.stock_ledger
       (sml_acc_year, sml_company_id, sml_branch_id, sml_src_module,
        sml_src_doc_type, sml_src_doc_id, sml_line_no, sml_split_no,
        sml_godown_id, sml_lot_id, sml_direction)
    WHERE sml_is_deleted = false AND sml_is_reversal = false;

-- REVERSAL IDEMPOTENCY. ux_sml_source excludes reversal rows, which would
-- otherwise have no unique constraint at all; fn_svh_cancel guards with a NOT
-- EXISTS, but that is read-then-write and two concurrent cancels could both
-- pass it and reverse the same movement twice.
CREATE UNIQUE INDEX IF NOT EXISTS ux_sml_reversal
    ON stock.stock_ledger (sml_acc_year, sml_reverses_id)
    WHERE sml_is_reversal = true AND sml_is_deleted = false;

-- The item ledger screen.
CREATE INDEX IF NOT EXISTS ix_sml_item_date
    ON stock.stock_ledger
       (sml_company_id, sml_branch_id, sml_item_id, sml_doc_date, sml_doc_datetime)
    WHERE sml_is_deleted = false;

-- fn_sbl_rebuild and every as-on-date recomputation.
CREATE INDEX IF NOT EXISTS ix_sml_balance_scope
    ON stock.stock_ledger
       (sml_company_id, sml_branch_id, sml_godown_id, sml_item_id, sml_lot_id,
        sml_bucket, sml_doc_date)
    WHERE sml_is_deleted = false;

-- Lot movement history: the recall trail.
CREATE INDEX IF NOT EXISTS ix_sml_lot
    ON stock.stock_ledger (sml_lot_id, sml_doc_date, sml_doc_datetime)
    WHERE sml_is_deleted = false;

-- Drilling from a document into what it moved.
CREATE INDEX IF NOT EXISTS ix_sml_source_doc
    ON stock.stock_ledger (sml_src_doc_id, sml_src_doc_type, sml_src_acc_year)
    WHERE sml_is_deleted = false;

-- fn_sdd_rebuild: the sales-only slice, by day.
CREATE INDEX IF NOT EXISTS ix_sml_demand
    ON stock.stock_ledger
       (sml_company_id, sml_branch_id, sml_item_id, sml_doc_date)
    WHERE sml_src_module::text = 'SALES' AND sml_is_deleted = false;

-- APPEND-ONLY, enforced rather than trusted. The model documents this trigger
-- as part of the table ("Prisma's delete/deleteMany WILL fail here by design");
-- sml_is_deleted exists for the partial-index predicate, not as an escape
-- hatch. Reversal is the only way to undo a movement.
CREATE OR REPLACE FUNCTION stock.fn_sml_forbid_delete()
    RETURNS trigger
    LANGUAGE plpgsql
AS
$$
BEGIN
    RAISE EXCEPTION
        'stock.stock_ledger is append-only: row % cannot be deleted. Post a reversing entry instead.',
        OLD.sml_id
        USING ERRCODE = '23514';
END;
$$;

DROP TRIGGER IF EXISTS tr_sml_forbid_delete ON stock.stock_ledger;
CREATE TRIGGER tr_sml_forbid_delete
    BEFORE DELETE ON stock.stock_ledger
    FOR EACH ROW
EXECUTE FUNCTION stock.fn_sml_forbid_delete();


-- ───────────────────────────────────────────────────────────────────────────
--  stock.stock_voucher — the DOCUMENT a stock movement is raised on. Eleven
--  voucher types, one table: a receipt, an issue, an adjustment, a transfer and
--  a physical count differ in which columns they fill, not in shape, so five
--  tables would buy five sets of the same numbering, posting, cancellation and
--  print logic.
--
--  THE DEVICE IS THE COUNTER. There is no counter id: svh_slno is per
--  (company, branch, year, type, DEVICE), exactly as sale_order numbers itself,
--  because a voucher raised offline on a warehouse tablet must number itself
--  without asking a server it cannot reach.
--
--  NOTHING REACHES THE LEDGER UNTIL POSTED. A DRAFT is editable and moves no
--  stock; posting writes the ledger rows and is the point of no return —
--  afterwards a mistake is CANCELLED, which REVERSES, never deleted.
--
--  A TRANSFER IS TWO VOUCHERS, not one with two godowns. The link columns are
--  the same (module, docType, docId) triple used everywhere else and carry
--  their own year, because a transfer despatched on 29 March is received on
--  2 April. No foreign key on them: the target lives in another partition, and
--  often another branch's document.
--
--  PARTITIONED BY LIST (svh_acc_year), hence the composite primary key — and
--  hence stock_voucher_item joins back on BOTH columns.
--
--  Every index below carries a WHERE, which is why none of them is declared in
--  the Prisma model: `migrate dev` would regenerate them WITHOUT the predicate
--  and fail on the existing names. Beware that a duplicate is therefore
--  reported against the PARTITION-LOCAL index name, never ux_svh_refno.
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stock.stock_voucher
(
    svh_id                 uuid                  NOT NULL DEFAULT uuidv7(),
    svh_company_id         uuid                  NOT NULL,
    svh_branch_id          uuid                  NOT NULL,
    svh_tenant_id          uuid,
    -- The PARTITION KEY, and half the primary key.
    svh_acc_year           character(9)          NOT NULL,

    -- The counter. See THE DEVICE IS THE COUNTER above.
    svh_device_id          uuid                  NOT NULL,
    svh_session_id         uuid,

    svh_voucher_type       character varying(30) NOT NULL,
    -- Per company/branch/year/type/DEVICE — ux_svh_slno.
    svh_slno               bigint                NOT NULL,
    -- The printed number: unique per branch and year on its own.
    svh_refno              character varying(100) NOT NULL,
    svh_usr_refno          character varying(100),
    svh_doc_date           date                  NOT NULL,
    svh_doc_datetime       timestamptz(6)        NOT NULL DEFAULT now(),

    -- ── Where stock came from and went ─────────────────────────────────────
    -- A RECEIPT fills to_godown only; an ISSUE fills from_godown only; a
    -- TRANSFER fills both, and to_branch when it leaves the store.
    svh_from_godown_id     uuid,
    svh_to_godown_id       uuid,
    svh_to_branch_id       uuid,

    svh_supplier_id        uuid,
    svh_party_ref          character varying(100),
    svh_reason_id          uuid,

    -- ── The voucher this one answers ───────────────────────────────────────
    svh_link_src_module    character varying(20),
    svh_link_src_doc_type  character varying(30),
    svh_link_src_doc_id    uuid,
    svh_link_src_acc_year  character(9),

    -- ── Totals ─────────────────────────────────────────────────────────────
    -- Caches of stock_voucher_item, which owns them. When the two disagree, the
    -- lines are right.
    svh_line_count         integer               NOT NULL DEFAULT 0,
    svh_total_qty          numeric(18, 6)        NOT NULL DEFAULT 0,
    svh_total_value        numeric(18, 2)        NOT NULL DEFAULT 0,
    svh_total_value_wot    numeric(18, 2)        NOT NULL DEFAULT 0,

    -- ── Lifecycle ──────────────────────────────────────────────────────────
    svh_status             character varying(20) NOT NULL DEFAULT 'DRAFT',
    -- Stamped by fn_svh_post / fn_svh_cancel, and selected by name in the list
    -- and load queries. No foreign key on the three user columns, as with
    -- svh_session_id and the created/modified pair.
    svh_posted_on          timestamptz(6),
    svh_posted_by          uuid,
    svh_approved_on        timestamptz(6),
    svh_approved_by        uuid,
    svh_cancelled_on       timestamptz(6),
    svh_cancelled_by       uuid,
    svh_cancel_reason      character varying(250),
    svh_version_no         integer               NOT NULL DEFAULT 1,

    -- ── PHYSICAL only ──────────────────────────────────────────────────────
    -- A count freezes the stock it is counting, or it counts a moving target:
    -- without a window the difference posted is the difference between a count
    -- taken at 6pm and a book figure read at 8pm.
    svh_freeze_stock       boolean               NOT NULL DEFAULT false,
    svh_freeze_from        timestamptz(6),
    svh_freeze_to          timestamptz(6),
    svh_rate_source        character varying(20),

    svh_remarks            character varying(250),
    svh_is_deleted         boolean               NOT NULL DEFAULT false,
    svh_sync_date          timestamptz(6),
    svh_created_on         timestamptz(6)        NOT NULL DEFAULT now(),
    svh_created_by         text,
    svh_modified_on        timestamptz(6),
    svh_modified_by        text,

    CONSTRAINT pk_stock_voucher PRIMARY KEY (svh_id, svh_acc_year),
    CONSTRAINT ck_svh_acc_year CHECK (
        svh_acc_year ~ '^[0-9]{4}-[0-9]{4}$'
        AND (right(svh_acc_year::text, 4))::integer
          = (left(svh_acc_year::text, 4))::integer + 1),
    CONSTRAINT ck_svh_voucher_type CHECK (svh_voucher_type::text = ANY (ARRAY[
        'OPENING'::text, 'RECEIPT'::text, 'ISSUE'::text, 'ADJUSTMENT'::text,
        'TRANSFER_OUT'::text, 'TRANSFER_IN'::text, 'DAMAGE'::text,
        'EXPIRY_WRITEOFF'::text, 'PHYSICAL'::text, 'REPACK_IN'::text,
        'REPACK_OUT'::text])),
    CONSTRAINT ck_svh_status CHECK (svh_status::text = ANY (ARRAY[
        'DRAFT'::text, 'POSTED'::text, 'IN_TRANSIT'::text, 'RECEIVED'::text,
        'CANCELLED'::text])),
    CONSTRAINT ck_svh_rate_source CHECK (
        svh_rate_source IS NULL OR svh_rate_source::text = ANY (ARRAY[
        'AVG_COST'::text, 'LAST_PURCHASE'::text, 'LOT_COST'::text,
        'MRP'::text, 'MANUAL'::text])),
    CONSTRAINT ck_svh_slno CHECK (svh_slno > 0),
    -- A movement must say where stock comes from or where it goes.
    CONSTRAINT ck_svh_godowns CHECK (
        svh_from_godown_id IS NOT NULL OR svh_to_godown_id IS NOT NULL),
    -- A transfer must say BOTH.
    CONSTRAINT ck_svh_transfer_godowns CHECK (
        svh_voucher_type::text <> ALL (ARRAY['TRANSFER_OUT'::text, 'TRANSFER_IN'::text])
        OR (svh_from_godown_id IS NOT NULL AND svh_to_godown_id IS NOT NULL)),
    -- A TRANSFER_IN that does not name the TRANSFER_OUT it answers is not a
    -- transfer in; it is stock appearing from nowhere.
    CONSTRAINT ck_svh_transfer_in_link CHECK (
        svh_voucher_type::text <> 'TRANSFER_IN'
        OR (svh_link_src_doc_id IS NOT NULL AND svh_link_src_acc_year IS NOT NULL)),
    -- The source triple is all-or-nothing, and the year travels with it.
    CONSTRAINT ck_svh_link CHECK (
        num_nonnulls(svh_link_src_module, svh_link_src_doc_type,
                     svh_link_src_doc_id) IN (0, 3)
        AND (svh_link_src_acc_year IS NULL OR svh_link_src_doc_id IS NOT NULL)),
    -- A freeze with no window is not a freeze.
    CONSTRAINT ck_svh_freeze CHECK (
        svh_freeze_stock = false
        OR (svh_freeze_from IS NOT NULL AND svh_freeze_to IS NOT NULL
            AND svh_freeze_to >= svh_freeze_from)),

    CONSTRAINT fk_svh_company     FOREIGN KEY (svh_company_id)
        REFERENCES public.companys (comp_id)            ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_svh_branch      FOREIGN KEY (svh_branch_id)
        REFERENCES public.branch_master (br_id)         ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_svh_to_branch   FOREIGN KEY (svh_to_branch_id)
        REFERENCES public.branch_master (br_id)         ON UPDATE CASCADE ON DELETE RESTRICT,
    -- RESTRICT, not SET NULL: the device owns this document's number series, so
    -- it can be blocked or deactivated but never unlinked.
    CONSTRAINT fk_svh_device      FOREIGN KEY (svh_device_id)
        REFERENCES fixed.device_master (dev_id)         ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_svh_from_godown FOREIGN KEY (svh_from_godown_id)
        REFERENCES inventory.godown_locations (gdl_id)  ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_svh_to_godown   FOREIGN KEY (svh_to_godown_id)
        REFERENCES inventory.godown_locations (gdl_id)  ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_svh_supplier    FOREIGN KEY (svh_supplier_id)
        REFERENCES purchase.suppliers (sup_id)          ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_svh_reason      FOREIGN KEY (svh_reason_id)
        REFERENCES stock.stock_reason_master (srm_id)   ON UPDATE CASCADE ON DELETE RESTRICT
) PARTITION BY LIST (svh_acc_year);

-- The per-DEVICE serial — offline numbering.
CREATE UNIQUE INDEX IF NOT EXISTS ux_svh_slno
    ON stock.stock_voucher
       (svh_acc_year, svh_company_id, svh_branch_id, svh_voucher_type,
        svh_device_id, svh_slno)
    WHERE svh_is_deleted = false;

-- The per-branch printed number.
CREATE UNIQUE INDEX IF NOT EXISTS ux_svh_refno
    ON stock.stock_voucher (svh_acc_year, svh_company_id, svh_branch_id, svh_refno)
    WHERE svh_is_deleted = false;

-- The list screen, newest first, per type.
CREATE INDEX IF NOT EXISTS ix_svh_list
    ON stock.stock_voucher
       (svh_company_id, svh_branch_id, svh_acc_year, svh_voucher_type,
        svh_doc_date DESC, svh_doc_datetime DESC)
    WHERE svh_is_deleted = false;

-- The transfer-in worklist: sent to me, not yet received.
CREATE INDEX IF NOT EXISTS ix_svh_inbound
    ON stock.stock_voucher (svh_to_branch_id, svh_doc_date, svh_to_godown_id)
    WHERE svh_voucher_type::text = 'TRANSFER_OUT'
      AND svh_status::text = 'IN_TRANSIT'
      AND svh_is_deleted = false;

-- Following a link back to the voucher that caused this one.
CREATE INDEX IF NOT EXISTS ix_svh_link
    ON stock.stock_voucher
       (svh_link_src_doc_id, svh_link_src_acc_year, svh_link_src_doc_type)
    WHERE svh_link_src_doc_id IS NOT NULL AND svh_is_deleted = false;


-- ───────────────────────────────────────────────────────────────────────────
--  stock.stock_voucher_item — the LINES of a stock_voucher.
--
--  Same (line_no, split_no) grain as sale_bill_item, so one line issued from
--  three batches is three rows and stock_ledger receives them unchanged:
--  posting is an INSERT ... SELECT with no reshaping and no aggregation. That
--  symmetry is the whole reason the grain is what it is.
--
--  THE BATCH ATTRIBUTES ARE STORED AS ENTERED as well as resolved to a lot,
--  because a reprint must show what was keyed, and because fn_slt_resolve may
--  LEGITIMATELY have blanked a value the item's policy does not track — an MRP
--  typed on an item that is not MRP-tracked does not become part of the lot
--  identity, and silently losing it would make the document unreadable a year
--  later. svi_lot_id IS NULL ONLY WHILE DRAFT.
--
--  PHYSICAL COUNTS keep three numbers, not one: book, counted, and the
--  GENERATED difference that actually posts. Storing only the difference makes
--  a variance impossible to defend a year later; storing it generated makes it
--  impossible to fudge.
--
--  PARTITIONED BY LIST (svi_acc_year), hence the composite primary key and the
--  COMPOSITE foreign key back to the voucher on (id, accYear) — a partitioned
--  parent can only be referenced through its partition key, which is also what
--  makes svi_acc_year = the voucher's year an enforced fact rather than a
--  convention. ON DELETE CASCADE: deleting a draft voucher takes its lines.
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stock.stock_voucher_item
(
    svi_id               uuid                  NOT NULL DEFAULT uuidv7(),
    svi_voucher_id       uuid                  NOT NULL,
    svi_company_id       uuid                  NOT NULL,
    svi_branch_id        uuid                  NOT NULL,
    svi_tenant_id        uuid,
    -- The PARTITION KEY, half the primary key, AND half the foreign key back to
    -- the voucher.
    svi_acc_year         character(9)          NOT NULL,

    svi_line_no          integer               NOT NULL,
    -- A second allocation of the same line — one line issued from three batches
    -- is three rows. Only meaningful with a batch no.
    svi_split_no         integer               NOT NULL DEFAULT 1,

    svi_item_id          uuid                  NOT NULL,
    -- BOTH are item_unit_conversion(iuc_id), NEVER item_unit_master(unit_id).
    svi_uom_id           uuid                  NOT NULL,
    svi_base_uom_id      uuid                  NOT NULL,
    svi_to_base_factor   numeric(18, 6)        NOT NULL DEFAULT 1,

    svi_godown_id        uuid                  NOT NULL,
    -- Resolved by fn_slt_resolve() at POSTING time. NULL only while DRAFT.
    svi_lot_id           uuid,
    svi_bucket           character varying(20) NOT NULL DEFAULT 'SALEABLE',

    -- ── As entered ─────────────────────────────────────────────────────────
    -- What the scanner read, verbatim. NOT an identity: nothing reads stock
    -- back through it. Kept so a reprint can show the symbol actually scanned —
    -- a barcode since retired, or one that resolved through an alias.
    svi_barcode          text,
    svi_batch_no         character varying(100),
    svi_mfg_date         date,
    svi_expiry_date      date,
    svi_mrp              numeric(18, 6),
    svi_sale_price       numeric(18, 6),
    svi_serial_no        character varying(100),
    svi_supplier_id      uuid,

    -- ── Quantity ───────────────────────────────────────────────────────────
    svi_qty              numeric(18, 6)        NOT NULL DEFAULT 0,
    svi_base_qty         numeric(18, 6)        NOT NULL DEFAULT 0,
    svi_free_qty         numeric(18, 6)        NOT NULL DEFAULT 0,
    svi_free_base_qty    numeric(18, 6)        NOT NULL DEFAULT 0,
    svi_weight_qty       numeric(18, 6)        NOT NULL DEFAULT 0,

    -- ── PHYSICAL count only ────────────────────────────────────────────────
    svi_book_qty         numeric(18, 6),
    svi_counted_qty      numeric(18, 6),
    -- What POSTS. The variance must not be editable.
    svi_diff_qty         numeric(18, 6)
        GENERATED ALWAYS AS (svi_counted_qty - svi_book_qty) STORED,

    -- ── Value ──────────────────────────────────────────────────────────────
    svi_cost_rate        numeric(18, 6)        NOT NULL DEFAULT 0,
    svi_cost_rate_wot    numeric(18, 6)        NOT NULL DEFAULT 0,
    svi_landed_rate      numeric(18, 6)        NOT NULL DEFAULT 0,
    svi_tax_perc         numeric(9, 3)         NOT NULL DEFAULT 0,
    -- Free goods are included: they are stock, and they cost something to hold.
    svi_value            numeric(18, 2)
        GENERATED ALWAYS AS (round((svi_base_qty + svi_free_base_qty) * svi_cost_rate, 2)) STORED,
    svi_value_wot        numeric(18, 2)
        GENERATED ALWAYS AS (round((svi_base_qty + svi_free_base_qty) * svi_cost_rate_wot, 2)) STORED,

    svi_reason_id        uuid,
    svi_remarks          character varying(250),
    svi_is_deleted       boolean               NOT NULL DEFAULT false,
    svi_sync_date        timestamptz(6),
    svi_created_on       timestamptz(6)        NOT NULL DEFAULT now(),
    svi_created_by       text,
    svi_modified_on      timestamptz(6),
    svi_modified_by      text,

    CONSTRAINT pk_stock_voucher_item PRIMARY KEY (svi_id, svi_acc_year),
    CONSTRAINT ck_svi_acc_year CHECK (
        svi_acc_year ~ '^[0-9]{4}-[0-9]{4}$'
        AND (right(svi_acc_year::text, 4))::integer
          = (left(svi_acc_year::text, 4))::integer + 1),
    CONSTRAINT ck_svi_bucket CHECK (svi_bucket::text = ANY (ARRAY[
        'SALEABLE'::text, 'DAMAGED'::text, 'QUARANTINE'::text,
        'EXPIRED'::text, 'SAMPLE'::text])),
    -- Quantities are MAGNITUDES; direction comes from the voucher type, not
    -- from a sign here. book/counted are excluded: a count is a measurement,
    -- and its difference is allowed to be negative.
    CONSTRAINT ck_svi_qty_sign CHECK (
        svi_qty        >= 0 AND svi_base_qty      >= 0 AND
        svi_free_qty   >= 0 AND svi_free_base_qty >= 0 AND
        svi_weight_qty >= 0),
    CONSTRAINT ck_svi_line_no CHECK (svi_line_no >= 1),
    CONSTRAINT ck_svi_split_no CHECK (svi_split_no >= 1),
    -- Mirrors ck_sbi_batch_split: a splitNo above 1 only makes sense when the
    -- line is split BY BATCH.
    CONSTRAINT ck_svi_batch_split CHECK (
        svi_split_no = 1 OR svi_batch_no IS NOT NULL),
    CONSTRAINT ck_svi_to_base_factor CHECK (svi_to_base_factor > 0),
    CONSTRAINT ck_svi_expiry_order CHECK (
        svi_expiry_date IS NULL OR svi_mfg_date IS NULL
        OR svi_expiry_date >= svi_mfg_date),

    CONSTRAINT fk_svi_voucher  FOREIGN KEY (svi_voucher_id, svi_acc_year)
        REFERENCES stock.stock_voucher (svh_id, svh_acc_year)
                                                           ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_svi_item     FOREIGN KEY (svi_item_id)
        REFERENCES inventory.item_master (item_id)         ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_svi_uom      FOREIGN KEY (svi_uom_id)
        REFERENCES inventory.item_unit_conversion (iuc_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_svi_base_uom FOREIGN KEY (svi_base_uom_id)
        REFERENCES inventory.item_unit_conversion (iuc_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_svi_godown   FOREIGN KEY (svi_godown_id)
        REFERENCES inventory.godown_locations (gdl_id)     ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_svi_lot      FOREIGN KEY (svi_lot_id)
        REFERENCES stock.stock_lot (slt_id)                ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_svi_supplier FOREIGN KEY (svi_supplier_id)
        REFERENCES purchase.suppliers (sup_id)             ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_svi_reason   FOREIGN KEY (svi_reason_id)
        REFERENCES stock.stock_reason_master (srm_id)      ON UPDATE CASCADE ON DELETE RESTRICT
) PARTITION BY LIST (svi_acc_year);

-- One row per (voucher, year, lineNo, splitNo).
CREATE UNIQUE INDEX IF NOT EXISTS ux_svi_line
    ON stock.stock_voucher_item (svi_acc_year, svi_voucher_id, svi_line_no, svi_split_no)
    WHERE svi_is_deleted = false;

-- The lines of one voucher.
CREATE INDEX IF NOT EXISTS ix_svi_voucher
    ON stock.stock_voucher_item (svi_voucher_id, svi_acc_year, svi_line_no, svi_split_no)
    WHERE svi_is_deleted = false;

-- Item-wise across vouchers.
CREATE INDEX IF NOT EXISTS ix_svi_item
    ON stock.stock_voucher_item (svi_company_id, svi_branch_id, svi_item_id, svi_acc_year)
    WHERE svi_is_deleted = false;

-- Which documents touched a lot.
CREATE INDEX IF NOT EXISTS ix_svi_lot
    ON stock.stock_voucher_item (svi_lot_id, svi_acc_year)
    WHERE svi_lot_id IS NOT NULL AND svi_is_deleted = false;


-- ───────────────────────────────────────────────────────────────────────────
--  stock.stock_reservation — quantity PROMISED but still on the shelf.
--
--  Counting open orders out of sale_order_item cannot work in a chain: the
--  order that committed the last unit may have been raised offline in another
--  branch and not yet synced, and soi_pending_qty is a cache of the ORDER's
--  state, not of the STOCK's. So the hold lives beside the stock it holds.
--
--  RESERVED STOCK IS ON HAND — a physical count will find it, a valuation must
--  include it — but it is NOT AVAILABLE. That distinction is exactly why
--  stock_balance carries both figures, and why a billing screen checks the
--  second.
--
--  THREE COUNTERS, ONE ANSWER: promised, taken, given back — and srv_open_qty,
--  GENERATED from all three, is what is still holding stock and what the
--  trigger sums into stock_balance.sbl_reserved_qty.
--
--  PARTITIONED BY LIST (srv_acc_year).
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stock.stock_reservation
(
    srv_id             uuid                  NOT NULL DEFAULT uuidv7(),
    srv_company_id     uuid                  NOT NULL,
    srv_branch_id      uuid                  NOT NULL,
    srv_tenant_id      uuid,
    -- The PARTITION KEY, and half the primary key.
    srv_acc_year       character(9)          NOT NULL,

    srv_godown_id      uuid                  NOT NULL,
    srv_item_id        uuid                  NOT NULL,
    srv_lot_id         uuid                  NOT NULL,
    srv_base_uom_id    uuid                  NOT NULL,
    srv_bucket         character varying(20) NOT NULL DEFAULT 'SALEABLE',

    -- ── What is holding the stock ──────────────────────────────────────────
    -- No foreign key: the holder is a sale order today and something else
    -- tomorrow.
    srv_src_module     character varying(20) NOT NULL,
    srv_src_doc_type   character varying(30) NOT NULL,
    srv_src_doc_id     uuid                  NOT NULL,
    srv_src_acc_year   character(9),
    srv_src_refno      character varying(100),
    srv_line_no        integer               NOT NULL DEFAULT 1,

    srv_reserved_qty   numeric(18, 6)        NOT NULL DEFAULT 0,
    srv_consumed_qty   numeric(18, 6)        NOT NULL DEFAULT 0,
    srv_released_qty   numeric(18, 6)        NOT NULL DEFAULT 0,
    -- What is still holding stock. Read-only, never sent.
    srv_open_qty       numeric(18, 6)
        GENERATED ALWAYS AS (srv_reserved_qty - srv_consumed_qty - srv_released_qty) STORED,

    srv_reserved_on    timestamptz(6)        NOT NULL DEFAULT now(),
    -- Without this, an abandoned order holds stock for ever and the only cure
    -- is a human noticing.
    srv_expires_on     timestamptz(6),
    srv_status         character varying(20) NOT NULL DEFAULT 'OPEN',
    srv_closed_on      timestamptz(6),
    srv_close_reason   character varying(250),

    srv_is_deleted     boolean               NOT NULL DEFAULT false,
    srv_sync_date      timestamptz(6),
    srv_created_on     timestamptz(6)        NOT NULL DEFAULT now(),
    srv_created_by     text,
    srv_modified_on    timestamptz(6),
    srv_modified_by    text,

    CONSTRAINT pk_stock_reservation PRIMARY KEY (srv_id, srv_acc_year),
    CONSTRAINT ck_srv_acc_year CHECK (
        srv_acc_year ~ '^[0-9]{4}-[0-9]{4}$'
        AND (right(srv_acc_year::text, 4))::integer
          = (left(srv_acc_year::text, 4))::integer + 1),
    CONSTRAINT ck_srv_status CHECK (srv_status::text = ANY (ARRAY[
        'OPEN'::text, 'PARTIAL'::text, 'CONSUMED'::text, 'RELEASED'::text,
        'EXPIRED'::text])),
    CONSTRAINT ck_srv_bucket CHECK (srv_bucket::text = ANY (ARRAY[
        'SALEABLE'::text, 'DAMAGED'::text, 'QUARANTINE'::text,
        'EXPIRED'::text, 'SAMPLE'::text])),
    -- A reservation of zero is not a reservation.
    CONSTRAINT ck_srv_qty CHECK (srv_reserved_qty > 0),
    -- Nothing may consume or release more than was ever reserved.
    CONSTRAINT ck_srv_settled CHECK (
        srv_consumed_qty >= 0 AND srv_released_qty >= 0
        AND srv_consumed_qty + srv_released_qty <= srv_reserved_qty),

    CONSTRAINT fk_srv_company  FOREIGN KEY (srv_company_id)
        REFERENCES public.companys (comp_id)               ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_srv_branch   FOREIGN KEY (srv_branch_id)
        REFERENCES public.branch_master (br_id)            ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_srv_godown   FOREIGN KEY (srv_godown_id)
        REFERENCES inventory.godown_locations (gdl_id)     ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_srv_item     FOREIGN KEY (srv_item_id)
        REFERENCES inventory.item_master (item_id)         ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_srv_lot      FOREIGN KEY (srv_lot_id)
        REFERENCES stock.stock_lot (slt_id)                ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_srv_base_uom FOREIGN KEY (srv_base_uom_id)
        REFERENCES inventory.item_unit_conversion (iuc_id) ON UPDATE CASCADE ON DELETE RESTRICT
) PARTITION BY LIST (srv_acc_year);

-- One hold per source line per lot, so a re-post UPDATES rather than stacking a
-- second hold on the same stock. Getting this wrong double-reserves and makes
-- stock vanish from the sale screen.
CREATE UNIQUE INDEX IF NOT EXISTS ux_srv_source
    ON stock.stock_reservation
       (srv_acc_year, srv_src_module, srv_src_doc_type, srv_src_doc_id,
        srv_line_no, srv_lot_id, srv_godown_id, srv_bucket)
    WHERE srv_is_deleted = false;

-- The trigger's aggregate: open holds against one balance.
CREATE INDEX IF NOT EXISTS ix_srv_balance
    ON stock.stock_reservation
       (srv_company_id, srv_branch_id, srv_godown_id, srv_item_id, srv_lot_id, srv_bucket)
    WHERE srv_is_deleted = false
      AND srv_status::text = ANY (ARRAY['OPEN'::text, 'PARTIAL'::text]);

-- The expiry sweep.
CREATE INDEX IF NOT EXISTS ix_srv_expiring
    ON stock.stock_reservation (srv_expires_on)
    WHERE srv_expires_on IS NOT NULL AND srv_is_deleted = false
      AND srv_status::text = ANY (ARRAY['OPEN'::text, 'PARTIAL'::text]);


-- ───────────────────────────────────────────────────────────────────────────
--  stock.stock_transit — sent from A, not yet arrived at B.
--
--  Between the lorry leaving and the goods being checked in, the stock is out
--  of A's balance and not yet in B's — and if nothing records it, it is simply
--  MISSING. That is how a chain loses stock on paper and then finds it on the
--  floor, and it is why this is a table rather than a status flag on the
--  transfer voucher.
--
--  NOT PARTITIONED, and this is the point: a transfer despatched on 29 March
--  and received on 2 April spans two accounting years, so partitioning by year
--  would put the two halves of ONE fact in two partitions and make "what is in
--  transit right now" a query across years. Both voucher references therefore
--  carry their OWN year, and neither carries a foreign key — a composite FK
--  into a partitioned parent would pin this row to one year's partition and
--  defeat the whole arrangement.
--
--  ONE ROW PER (out voucher, item, lot, destination godown, BUCKET). Bucket is
--  in the key because one voucher legitimately sends saleable units and damaged
--  units of the same lot to the same godown as two transit lines.
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stock.stock_transit
(
    stt_id              uuid                  NOT NULL DEFAULT uuidv7(),
    stt_company_id      uuid                  NOT NULL,
    stt_tenant_id       uuid,

    stt_from_branch_id  uuid                  NOT NULL,
    stt_from_godown_id  uuid                  NOT NULL,
    stt_to_branch_id    uuid                  NOT NULL,
    stt_to_godown_id    uuid                  NOT NULL,

    stt_item_id         uuid                  NOT NULL,
    stt_lot_id          uuid                  NOT NULL,
    stt_base_uom_id     uuid                  NOT NULL,
    stt_bucket          character varying(20) NOT NULL DEFAULT 'SALEABLE',

    -- ── Both halves of the movement, each with its own year ────────────────
    stt_out_voucher_id  uuid                  NOT NULL,
    stt_out_acc_year    character(9)          NOT NULL,
    stt_out_refno       character varying(100),
    stt_in_voucher_id   uuid,
    stt_in_acc_year     character(9),
    stt_in_refno        character varying(100),

    stt_sent_qty        numeric(18, 6)        NOT NULL DEFAULT 0,
    stt_received_qty    numeric(18, 6)        NOT NULL DEFAULT 0,
    stt_damage_qty      numeric(18, 6)        NOT NULL DEFAULT 0,
    -- What left and never arrived, and the number a transfer-loss report is
    -- built on. GENERATED so it cannot be quietly rounded away by whoever keys
    -- the receipt. Damage is separate from shortage: different failures, with
    -- different people to talk to.
    stt_short_qty       numeric(18, 6)
        GENERATED ALWAYS AS (stt_sent_qty - stt_received_qty - stt_damage_qty) STORED,

    stt_cost_rate       numeric(18, 6)        NOT NULL DEFAULT 0,
    stt_transit_value   numeric(18, 2)        NOT NULL DEFAULT 0,

    stt_sent_on         timestamptz(6)        NOT NULL DEFAULT now(),
    stt_expected_on     date,
    stt_received_on     timestamptz(6),
    stt_status          character varying(20) NOT NULL DEFAULT 'IN_TRANSIT',
    stt_lr_no           character varying(50),
    stt_vehicle_no      character varying(30),

    stt_remarks         character varying(250),
    stt_is_deleted      boolean               NOT NULL DEFAULT false,
    stt_sync_date       timestamptz(6),
    stt_created_on      timestamptz(6)        NOT NULL DEFAULT now(),
    stt_created_by      text,
    stt_modified_on     timestamptz(6),
    stt_modified_by     text,

    CONSTRAINT pk_stock_transit PRIMARY KEY (stt_id),
    CONSTRAINT ck_stt_status CHECK (stt_status::text = ANY (ARRAY[
        'IN_TRANSIT'::text, 'PARTIAL'::text, 'RECEIVED'::text, 'CANCELLED'::text])),
    CONSTRAINT ck_stt_bucket CHECK (stt_bucket::text = ANY (ARRAY[
        'SALEABLE'::text, 'DAMAGED'::text, 'QUARANTINE'::text,
        'EXPIRED'::text, 'SAMPLE'::text])),
    CONSTRAINT ck_stt_acc_year CHECK (
        stt_out_acc_year ~ '^[0-9]{4}-[0-9]{4}$'
        AND (right(stt_out_acc_year::text, 4))::integer
          = (left(stt_out_acc_year::text, 4))::integer + 1
        AND (stt_in_acc_year IS NULL OR (
            stt_in_acc_year ~ '^[0-9]{4}-[0-9]{4}$'
            AND (right(stt_in_acc_year::text, 4))::integer
              = (left(stt_in_acc_year::text, 4))::integer + 1))),
    -- Nothing may be received or damaged that was never sent.
    CONSTRAINT ck_stt_qty CHECK (
        stt_sent_qty >= 0 AND stt_received_qty >= 0 AND stt_damage_qty >= 0
        AND stt_received_qty + stt_damage_qty <= stt_sent_qty),
    -- Stock cannot be in transit to the place it already is.
    CONSTRAINT ck_stt_endpoints CHECK (stt_from_godown_id <> stt_to_godown_id),
    -- The receiving voucher and its year move together.
    CONSTRAINT ck_stt_in_pair CHECK (
        num_nonnulls(stt_in_voucher_id, stt_in_acc_year) IN (0, 2)),

    CONSTRAINT fk_stt_company     FOREIGN KEY (stt_company_id)
        REFERENCES public.companys (comp_id)               ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_stt_from_branch FOREIGN KEY (stt_from_branch_id)
        REFERENCES public.branch_master (br_id)            ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_stt_to_branch   FOREIGN KEY (stt_to_branch_id)
        REFERENCES public.branch_master (br_id)            ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_stt_from_godown FOREIGN KEY (stt_from_godown_id)
        REFERENCES inventory.godown_locations (gdl_id)     ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_stt_to_godown   FOREIGN KEY (stt_to_godown_id)
        REFERENCES inventory.godown_locations (gdl_id)     ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_stt_item        FOREIGN KEY (stt_item_id)
        REFERENCES inventory.item_master (item_id)         ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_stt_lot         FOREIGN KEY (stt_lot_id)
        REFERENCES stock.stock_lot (slt_id)                ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_stt_base_uom    FOREIGN KEY (stt_base_uom_id)
        REFERENCES inventory.item_unit_conversion (iuc_id) ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_stt_out_line
    ON stock.stock_transit
       (stt_out_voucher_id, stt_out_acc_year, stt_item_id, stt_lot_id,
        stt_to_godown_id, stt_bucket)
    WHERE stt_is_deleted = false;

-- "What is on its way to me?" — the receiving worklist, and the source of
-- sbl_transit_in_qty.
CREATE INDEX IF NOT EXISTS ix_stt_inbound
    ON stock.stock_transit
       (stt_to_branch_id, stt_to_godown_id, stt_item_id, stt_lot_id)
    WHERE stt_is_deleted = false
      AND stt_status::text = ANY (ARRAY['IN_TRANSIT'::text, 'PARTIAL'::text]);

-- "What have I sent that has not been acknowledged?" — the ageing of transit
-- itself, which is where losses show up.
CREATE INDEX IF NOT EXISTS ix_stt_outbound
    ON stock.stock_transit (stt_from_branch_id, stt_sent_on, stt_item_id)
    WHERE stt_is_deleted = false
      AND stt_status::text = ANY (ARRAY['IN_TRANSIT'::text, 'PARTIAL'::text]);


-- ───────────────────────────────────────────────────────────────────────────
--  stock.stock_valuation_snap — closing stock, FROZEN.
--
--  "Stock value as on 31 March" must give the same answer in April and in
--  October, and give it in seconds for fifty branches. Replaying the ledger
--  does neither: it is slow, and a back-dated correction posted in June would
--  silently change March's audited figure.
--
--  THREE VALUATIONS, NOT ONE, and this cannot be fixed later: at COST is what
--  the books want, at MRP is what the shop floor counts, at SELLING PRICE is
--  what a retailer means by "stock worth". Once a price list changes, the
--  second and third are unrecoverable for a past date — so all three are frozen
--  together or not at all. svs_age_days is stored for the same reason.
--
--  svs_acc_year IS A SCOPE COLUMN, NOT A PARTITION KEY: a year-close snapshot
--  is precisely what the NEXT year opens against, and partitioning by year
--  would put the two sides of that handover in different partitions.
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stock.stock_valuation_snap
(
    svs_id                uuid                  NOT NULL DEFAULT uuidv7(),
    svs_company_id        uuid                  NOT NULL,
    svs_branch_id         uuid                  NOT NULL,
    svs_tenant_id         uuid,
    -- A SCOPE column, not a partition key.
    svs_acc_year          character(9)          NOT NULL,

    svs_godown_id         uuid                  NOT NULL,
    svs_item_id           uuid                  NOT NULL,
    svs_lot_id            uuid                  NOT NULL,
    -- The item's base unit at freeze time. No foreign key, unlike everywhere
    -- else in this module.
    svs_base_uom_id       uuid                  NOT NULL,
    svs_bucket            character varying(20) NOT NULL DEFAULT 'SALEABLE',

    svs_snap_type         character varying(20) NOT NULL DEFAULT 'MONTH',
    svs_snap_date         date                  NOT NULL,

    svs_qty               numeric(18, 6)        NOT NULL DEFAULT 0,
    svs_avg_cost_rate     numeric(18, 6)        NOT NULL DEFAULT 0,
    svs_avg_cost_rate_wot numeric(18, 6)        NOT NULL DEFAULT 0,
    svs_value_at_cost     numeric(18, 2)        NOT NULL DEFAULT 0,
    svs_value_at_cost_wot numeric(18, 2)        NOT NULL DEFAULT 0,
    svs_value_at_mrp      numeric(18, 2)        NOT NULL DEFAULT 0,
    svs_value_at_sp       numeric(18, 2)        NOT NULL DEFAULT 0,

    -- ── Identity cache, copied from the lot at freeze time ─────────────────
    -- The lot may be closed, and its costs long superseded, by the time
    -- anybody reads this row.
    svs_batch_no          character varying(100),
    svs_mrp               numeric(18, 6),
    svs_expiry_date       date,
    -- No foreign key: a snapshot must survive the supplier row being
    -- restricted away.
    svs_supplier_id       uuid,
    svs_age_days          integer,

    svs_frozen_on         timestamptz(6)        NOT NULL DEFAULT now(),
    svs_frozen_by         uuid,
    svs_is_deleted        boolean               NOT NULL DEFAULT false,
    svs_sync_date         timestamptz(6),
    -- No modified pair, on purpose: a snapshot is WRITE-ONCE. Re-freezing a
    -- period means deleting its rows and writing them again.
    svs_created_on        timestamptz(6)        NOT NULL DEFAULT now(),

    CONSTRAINT pk_stock_valuation_snap PRIMARY KEY (svs_id),
    CONSTRAINT ck_svs_acc_year CHECK (
        svs_acc_year ~ '^[0-9]{4}-[0-9]{4}$'
        AND (right(svs_acc_year::text, 4))::integer
          = (left(svs_acc_year::text, 4))::integer + 1),
    CONSTRAINT ck_svs_snap_type CHECK (svs_snap_type::text = ANY (ARRAY[
        'DAY'::text, 'MONTH'::text, 'YEAR_OPEN'::text, 'YEAR_CLOSE'::text])),
    CONSTRAINT ck_svs_bucket CHECK (svs_bucket::text = ANY (ARRAY[
        'SALEABLE'::text, 'DAMAGED'::text, 'QUARANTINE'::text,
        'EXPIRED'::text, 'SAMPLE'::text])),

    CONSTRAINT fk_svs_company FOREIGN KEY (svs_company_id)
        REFERENCES public.companys (comp_id)           ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_svs_branch  FOREIGN KEY (svs_branch_id)
        REFERENCES public.branch_master (br_id)        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_svs_godown  FOREIGN KEY (svs_godown_id)
        REFERENCES inventory.godown_locations (gdl_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_svs_item    FOREIGN KEY (svs_item_id)
        REFERENCES inventory.item_master (item_id)     ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_svs_lot     FOREIGN KEY (svs_lot_id)
        REFERENCES stock.stock_lot (slt_id)            ON UPDATE CASCADE ON DELETE RESTRICT
);

-- One row per holding per snapshot.
CREATE UNIQUE INDEX IF NOT EXISTS ux_svs_scope
    ON stock.stock_valuation_snap
       (svs_company_id, svs_branch_id, svs_snap_type, svs_snap_date,
        svs_godown_id, svs_item_id, svs_lot_id, svs_bucket)
    WHERE svs_is_deleted = false;

-- fn_stock_asof(): the nearest snapshot at or before a date.
CREATE INDEX IF NOT EXISTS ix_svs_asof
    ON stock.stock_valuation_snap
       (svs_company_id, svs_branch_id, svs_item_id, svs_snap_date DESC)
    WHERE svs_is_deleted = false;

-- The valuation report: one branch, one date, everything.
CREATE INDEX IF NOT EXISTS ix_svs_report
    ON stock.stock_valuation_snap
       (svs_company_id, svs_branch_id, svs_snap_date, svs_snap_type)
    WHERE svs_is_deleted = false;


-- ───────────────────────────────────────────────────────────────────────────
--  stock.stock_reorder_policy — the SETTINGS a replenishment decision is made
--  from. One row per item per location.
--
--  srp_godown_id NULL = THE WHOLE BRANCH, however many godowns it operates: a
--  shop keeps one reorder level and does not care whether the units are on the
--  shelf or in the back store. ux_srp_scope COALESCEs the godown to the nil
--  uuid, because a plain unique index treats every NULL as distinct and would
--  let the same branch-wide row be inserted twice.
--
--  srp_source IS LOAD-BEARING, not a label: MANUAL means a human set these
--  numbers and the nightly job MUST NOT overwrite them. A buyer who has
--  deliberately raised a level for a festival will not do it twice, and a job
--  that silently reverts it destroys trust in the whole module.
--
--  THE NUMBERS ARE SETTINGS, NOT ANSWERS. What to order today is
--  stock_forecast.sfc_suggested_order_qty, computed from these plus actual
--  demand.
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stock.stock_reorder_policy
(
    srp_id                    uuid                  NOT NULL DEFAULT uuidv7(),
    srp_company_id            uuid                  NOT NULL,
    srp_branch_id             uuid                  NOT NULL,
    -- NULL = the whole branch.
    srp_godown_id             uuid,
    srp_item_id               uuid                  NOT NULL,
    -- The unit the BUYER thinks in ("reorder at 4 cases"), not the base unit.
    -- Every quantity below is in this unit.
    srp_uom_id                uuid                  NOT NULL,

    srp_min_qty               numeric(18, 6)        NOT NULL DEFAULT 0,
    -- 0 = NO CEILING, exempted from the "max >= min" rule rather than forcing a
    -- sentinel.
    srp_max_qty               numeric(18, 6)        NOT NULL DEFAULT 0,
    srp_reorder_level         numeric(18, 6)        NOT NULL DEFAULT 0,
    srp_reorder_qty           numeric(18, 6)        NOT NULL DEFAULT 0,
    srp_safety_stock          numeric(18, 6)        NOT NULL DEFAULT 0,

    srp_lead_time_days        numeric(9, 3)         NOT NULL DEFAULT 0,
    -- What tells "3 days ± 1" apart from "3 days ± 6", and the only thing that
    -- makes safety stock honest.
    srp_lead_time_sd_days     numeric(9, 3)         NOT NULL DEFAULT 0,
    srp_review_period_days    integer               NOT NULL DEFAULT 7,
    -- Strictly between 0 and 100: 100% service means infinite safety stock,
    -- which is refused here rather than left for a job to compute.
    srp_service_level_perc    numeric(9, 3)         NOT NULL DEFAULT 95,

    -- The supplier's constraints, applied AFTER the maths: a suggestion of 17
    -- against a case of 12 becomes 24.
    srp_moq                   numeric(18, 6)        NOT NULL DEFAULT 0,
    srp_pack_multiple         numeric(18, 6)        NOT NULL DEFAULT 1,
    -- The opposite constraint: no point ordering more than the shelf holds.
    srp_shelf_capacity_qty    numeric(18, 6)        NOT NULL DEFAULT 0,
    srp_preferred_supplier_id uuid,

    srp_source                character varying(20) NOT NULL DEFAULT 'MANUAL',
    srp_computed_on           timestamptz(6),
    -- Arms the sweep that raises orders without a human. Off by default, and it
    -- should stay off until the forecast has been watched for a while.
    srp_auto_replenish        boolean               NOT NULL DEFAULT false,

    srp_remarks               character varying(250),
    srp_is_active             boolean               NOT NULL DEFAULT true,
    srp_is_deleted            boolean               NOT NULL DEFAULT false,
    srp_sync_date             timestamptz(6),
    srp_created_on            timestamptz(6)        NOT NULL DEFAULT now(),
    srp_created_by            text,
    srp_modified_on           timestamptz(6),
    srp_modified_by           text,

    CONSTRAINT pk_stock_reorder_policy PRIMARY KEY (srp_id),
    CONSTRAINT ck_srp_source CHECK (srp_source::text = ANY (ARRAY[
        'MANUAL'::text, 'COMPUTED'::text])),
    CONSTRAINT ck_srp_levels CHECK (
        srp_min_qty       >= 0 AND srp_max_qty      >= 0 AND
        srp_reorder_level >= 0 AND srp_reorder_qty  >= 0 AND
        srp_safety_stock  >= 0 AND srp_moq          >= 0 AND
        srp_shelf_capacity_qty >= 0
        AND (srp_max_qty = 0 OR srp_max_qty >= srp_min_qty)),
    CONSTRAINT ck_srp_lead_time CHECK (
        srp_lead_time_days >= 0 AND srp_lead_time_sd_days >= 0),
    CONSTRAINT ck_srp_service_level CHECK (
        srp_service_level_perc > 0 AND srp_service_level_perc < 100),
    -- A pack multiple of 0 would divide by zero.
    CONSTRAINT ck_srp_pack CHECK (srp_pack_multiple > 0),
    CONSTRAINT ck_srp_review CHECK (srp_review_period_days > 0),

    CONSTRAINT fk_srp_company  FOREIGN KEY (srp_company_id)
        REFERENCES public.companys (comp_id)               ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_srp_branch   FOREIGN KEY (srp_branch_id)
        REFERENCES public.branch_master (br_id)            ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_srp_godown   FOREIGN KEY (srp_godown_id)
        REFERENCES inventory.godown_locations (gdl_id)     ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_srp_item     FOREIGN KEY (srp_item_id)
        REFERENCES inventory.item_master (item_id)         ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_srp_uom      FOREIGN KEY (srp_uom_id)
        REFERENCES inventory.item_unit_conversion (iuc_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_srp_supplier FOREIGN KEY (srp_preferred_supplier_id)
        REFERENCES purchase.suppliers (sup_id)             ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_srp_scope
    ON stock.stock_reorder_policy
       (srp_company_id, srp_branch_id,
        COALESCE(srp_godown_id, '00000000-0000-0000-0000-000000000000'::uuid),
        srp_item_id, srp_uom_id)
    WHERE srp_is_deleted = false;

-- The item's policies across branches.
CREATE INDEX IF NOT EXISTS ix_srp_item
    ON stock.stock_reorder_policy (srp_company_id, srp_item_id, srp_branch_id)
    WHERE srp_is_deleted = false;

-- The auto-replenishment sweep.
CREATE INDEX IF NOT EXISTS ix_srp_auto
    ON stock.stock_reorder_policy (srp_company_id, srp_branch_id, srp_item_id)
    WHERE srp_auto_replenish = true AND srp_is_active = true AND srp_is_deleted = false;


-- ───────────────────────────────────────────────────────────────────────────
--  stock.stock_demand_daily — what actually sold, per branch, per day.
--
--  The pre-aggregate every forecast needs and no transactional table can serve:
--  aggregating a year of sale_bill_item across fifty branches on every run of a
--  replenishment job is not a plan. Rebuilt by fn_sdd_rebuild() from
--  stock_ledger, which means it can ALWAYS be recomputed and never has to be
--  trusted blindly.
--
--  THREE DIFFERENT ZEROS, THREE DIFFERENT COLUMNS, because a forecast that
--  cannot tell them apart is worse than no forecast:
--    stockout — sold zero because there was none. Demand was CENSORED, and a
--               model that reads it as "demand was zero" will under-forecast
--               the fastest movers for ever and keep them out of stock.
--    closed   — the branch was SHUT. Exclude from a moving average.
--    genuine  — nobody wanted it.
--  sdd_promo_qty is the same problem in the other direction: a week of
--  buy-one-get-one is not the baseline. It is a SUBSET of sold, not an addition.
--
--  NOT PARTITIONED. The read is a WINDOW of days for one item — "the last
--  ninety days" crosses a year boundary four times out of five.
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stock.stock_demand_daily
(
    sdd_id             uuid           NOT NULL DEFAULT uuidv7(),
    sdd_company_id     uuid           NOT NULL,
    sdd_branch_id      uuid           NOT NULL,
    sdd_tenant_id      uuid,
    sdd_item_id        uuid           NOT NULL,
    sdd_base_uom_id    uuid           NOT NULL,
    sdd_demand_date    date           NOT NULL,
    -- Denormalised so a seasonality model does not compute it a million times.
    -- 0 = Sunday, matching EXTRACT(dow).
    sdd_day_of_week    smallint       NOT NULL DEFAULT 0,

    sdd_sold_qty       numeric(18, 6) NOT NULL DEFAULT 0,
    sdd_free_qty       numeric(18, 6) NOT NULL DEFAULT 0,
    sdd_return_qty     numeric(18, 6) NOT NULL DEFAULT 0,
    sdd_net_qty        numeric(18, 6)
        GENERATED ALWAYS AS (sdd_sold_qty + sdd_free_qty - sdd_return_qty) STORED,
    -- Sold while a promotion was running: real sales, but not the baseline.
    sdd_promo_qty      numeric(18, 6) NOT NULL DEFAULT 0,

    sdd_bill_count     integer        NOT NULL DEFAULT 0,
    sdd_line_count     integer        NOT NULL DEFAULT 0,
    sdd_customer_count integer        NOT NULL DEFAULT 0,

    sdd_revenue_wot    numeric(18, 2) NOT NULL DEFAULT 0,
    sdd_cogs_wot       numeric(18, 2) NOT NULL DEFAULT 0,
    sdd_margin_wot     numeric(18, 2)
        GENERATED ALWAYS AS (sdd_revenue_wot - sdd_cogs_wot) STORED,

    -- ── Truthfulness flags ─────────────────────────────────────────────────
    sdd_stockout_flag  boolean        NOT NULL DEFAULT false,
    -- How much of the day was lost, so a partial day is not thrown away whole.
    sdd_stockout_hours numeric(9, 3)  NOT NULL DEFAULT 0,
    sdd_closed_flag    boolean        NOT NULL DEFAULT false,
    sdd_open_qty_start numeric(18, 6) NOT NULL DEFAULT 0,
    sdd_close_qty_end  numeric(18, 6) NOT NULL DEFAULT 0,

    -- A stale date on a recent day means the rebuild job did not run, which is
    -- otherwise invisible.
    sdd_rebuilt_on     timestamptz(6) NOT NULL DEFAULT now(),
    sdd_is_deleted     boolean        NOT NULL DEFAULT false,
    sdd_sync_date      timestamptz(6),
    sdd_created_on     timestamptz(6) NOT NULL DEFAULT now(),

    CONSTRAINT pk_stock_demand_daily PRIMARY KEY (sdd_id),
    CONSTRAINT ck_sdd_day_of_week CHECK (sdd_day_of_week BETWEEN 0 AND 6),
    CONSTRAINT ck_sdd_stockout_hours CHECK (
        sdd_stockout_hours >= 0 AND sdd_stockout_hours <= 24),

    CONSTRAINT fk_sdd_company  FOREIGN KEY (sdd_company_id)
        REFERENCES public.companys (comp_id)               ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_sdd_branch   FOREIGN KEY (sdd_branch_id)
        REFERENCES public.branch_master (br_id)            ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_sdd_item     FOREIGN KEY (sdd_item_id)
        REFERENCES inventory.item_master (item_id)         ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_sdd_base_uom FOREIGN KEY (sdd_base_uom_id)
        REFERENCES inventory.item_unit_conversion (iuc_id) ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_sdd_scope
    ON stock.stock_demand_daily
       (sdd_company_id, sdd_branch_id, sdd_item_id, sdd_demand_date)
    WHERE sdd_is_deleted = false;

-- The forecasting read: one item, one branch, a window of days, in order.
CREATE INDEX IF NOT EXISTS ix_sdd_series
    ON stock.stock_demand_daily
       (sdd_company_id, sdd_branch_id, sdd_item_id, sdd_demand_date)
       INCLUDE (sdd_net_qty, sdd_stockout_flag, sdd_closed_flag)
    WHERE sdd_is_deleted = false;

-- Chain-wide demand for one item across every branch — the head-office
-- allocation question.
CREATE INDEX IF NOT EXISTS ix_sdd_chain
    ON stock.stock_demand_daily (sdd_company_id, sdd_item_id, sdd_demand_date)
    WHERE sdd_is_deleted = false;


-- ───────────────────────────────────────────────────────────────────────────
--  stock.stock_forecast — what we expect to sell, and what to order.
--
--  THE MATHS IS NOT IN THE DATABASE, and that is the design. A model written in
--  PL/pgSQL cannot be changed without a migration, cannot be back-tested
--  against last year without running last year, and cannot be swapped when the
--  retailer discovers Croston fits their slow movers better. It WILL be
--  changed. So the schema holds the INPUTS (stock_demand_daily), the SETTINGS
--  (stock_reorder_policy) and the OUTPUTS (this table), and not the model.
--
--  THE ERROR COLUMNS ARE NOT OPTIONAL: a forecast without a measured error is a
--  number somebody made up. BIAS IS SEPARATE FROM ERROR on purpose —
--  consistently over-ordering and randomly missing are different diseases with
--  different cures, and a single accuracy number hides both.
--
--  ONE ROW PER (item, branch, forecast date, horizon, METHOD): keeping the
--  method in the key lets two models run side by side against the same history
--  and be compared on it, which is the only honest way to choose one.
--
--  sfc_forecast_date IS THE DAY FORECAST FOR, not the day computed. Confusing
--  the two makes every back-test wrong.
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stock.stock_forecast
(
    sfc_id                    uuid                  NOT NULL DEFAULT uuidv7(),
    sfc_company_id            uuid                  NOT NULL,
    sfc_branch_id             uuid                  NOT NULL,
    sfc_tenant_id             uuid,
    sfc_item_id               uuid                  NOT NULL,
    sfc_base_uom_id           uuid                  NOT NULL,

    sfc_forecast_date         date                  NOT NULL,
    sfc_horizon_days          integer               NOT NULL DEFAULT 30,
    -- In the unique key: two methods may run side by side on the same history.
    sfc_method                character varying(30) NOT NULL DEFAULT 'MOVING_AVG',

    -- ── The forecast ───────────────────────────────────────────────────────
    sfc_forecast_qty          numeric(18, 6)        NOT NULL DEFAULT 0,
    sfc_forecast_lower        numeric(18, 6),
    sfc_forecast_upper        numeric(18, 6),
    sfc_confidence_perc       numeric(9, 3),
    sfc_daily_rate            numeric(18, 6)        NOT NULL DEFAULT 0,

    -- ── What the model saw ─────────────────────────────────────────────────
    sfc_history_days          integer               NOT NULL DEFAULT 0,
    -- Censored days WITHIN that history.
    sfc_stockout_days         integer               NOT NULL DEFAULT 0,
    sfc_trend_slope           numeric(18, 6),
    sfc_seasonality_index     numeric(9, 4),
    -- Alpha/beta/gamma, window lengths, whatever the method needs. jsonb so a
    -- new method costs no column and no migration.
    sfc_model_params          jsonb,

    -- ── How wrong it has been ──────────────────────────────────────────────
    sfc_mape                  numeric(9, 3),
    sfc_rmse                  numeric(18, 6),
    sfc_bias                  numeric(18, 6),
    sfc_backtest_days         integer,

    -- ── What to do about it ────────────────────────────────────────────────
    sfc_on_hand_qty           numeric(18, 6)        NOT NULL DEFAULT 0,
    -- Ordered or in transit: stock already coming, which MUST be netted off
    -- before suggesting more. Forgetting this is how a chain double-orders,
    -- twice a week, until somebody notices the warehouse is full.
    sfc_pipeline_qty          numeric(18, 6)        NOT NULL DEFAULT 0,
    sfc_safety_stock          numeric(18, 6)        NOT NULL DEFAULT 0,
    sfc_reorder_point         numeric(18, 6)        NOT NULL DEFAULT 0,
    sfc_suggested_order_qty   numeric(18, 6)        NOT NULL DEFAULT 0,
    sfc_days_of_cover         numeric(9, 2),
    sfc_expected_stockout_on  date,
    sfc_preferred_supplier_id uuid,

    -- Set when a buyer OVERRIDES the suggestion, so the next back-test knows
    -- the order it sees was not the one the model asked for. Without it every
    -- override silently becomes evidence against the model.
    sfc_accepted_qty          numeric(18, 6),
    sfc_accepted_by           uuid,
    sfc_accepted_on           timestamptz(6),

    sfc_computed_on           timestamptz(6)        NOT NULL DEFAULT now(),
    -- Which job, service or notebook produced this row.
    sfc_computed_by           character varying(50),
    sfc_is_deleted            boolean               NOT NULL DEFAULT false,
    sfc_sync_date             timestamptz(6),
    sfc_created_on            timestamptz(6)        NOT NULL DEFAULT now(),

    CONSTRAINT pk_stock_forecast PRIMARY KEY (sfc_id),
    CONSTRAINT ck_sfc_method CHECK (sfc_method::text = ANY (ARRAY[
        'MOVING_AVG'::text, 'WMA'::text, 'SES'::text, 'HOLT'::text,
        'HOLT_WINTERS'::text, 'CROSTON'::text, 'REGRESSION'::text,
        'MANUAL'::text, 'EXTERNAL'::text])),
    CONSTRAINT ck_sfc_horizon CHECK (sfc_horizon_days > 0),
    CONSTRAINT ck_sfc_confidence CHECK (
        sfc_confidence_perc IS NULL
        OR (sfc_confidence_perc > 0 AND sfc_confidence_perc < 100)),
    -- sfc_on_hand_qty is deliberately absent: negative stock is representable.
    CONSTRAINT ck_sfc_qty CHECK (
        sfc_forecast_qty        >= 0 AND sfc_daily_rate     >= 0 AND
        sfc_pipeline_qty        >= 0 AND sfc_safety_stock   >= 0 AND
        sfc_suggested_order_qty >= 0
        AND (sfc_accepted_qty IS NULL OR sfc_accepted_qty >= 0)),
    -- A count of censored days WITHIN the history the model saw.
    CONSTRAINT ck_sfc_stockout_days CHECK (
        sfc_history_days  >= 0 AND sfc_stockout_days >= 0
        AND sfc_stockout_days <= sfc_history_days),
    CONSTRAINT ck_sfc_accepted CHECK (
        num_nonnulls(sfc_accepted_qty, sfc_accepted_on) IN (0, 2)),
    CONSTRAINT ck_sfc_band CHECK (
        sfc_forecast_lower IS NULL OR sfc_forecast_upper IS NULL
        OR sfc_forecast_upper >= sfc_forecast_lower),

    CONSTRAINT fk_sfc_company  FOREIGN KEY (sfc_company_id)
        REFERENCES public.companys (comp_id)               ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_sfc_branch   FOREIGN KEY (sfc_branch_id)
        REFERENCES public.branch_master (br_id)            ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_sfc_item     FOREIGN KEY (sfc_item_id)
        REFERENCES inventory.item_master (item_id)         ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_sfc_base_uom FOREIGN KEY (sfc_base_uom_id)
        REFERENCES inventory.item_unit_conversion (iuc_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_sfc_supplier FOREIGN KEY (sfc_preferred_supplier_id)
        REFERENCES purchase.suppliers (sup_id)             ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_sfc_scope
    ON stock.stock_forecast
       (sfc_company_id, sfc_branch_id, sfc_item_id, sfc_forecast_date,
        sfc_horizon_days, sfc_method)
    WHERE sfc_is_deleted = false;

-- The buying screen: this branch, latest run, worst first.
CREATE INDEX IF NOT EXISTS ix_sfc_action
    ON stock.stock_forecast
       (sfc_company_id, sfc_branch_id, sfc_forecast_date DESC, sfc_days_of_cover)
    WHERE sfc_is_deleted = false AND sfc_suggested_order_qty > 0;

-- Chain view for one item — which branch runs out first.
CREATE INDEX IF NOT EXISTS ix_sfc_item_chain
    ON stock.stock_forecast
       (sfc_company_id, sfc_item_id, sfc_forecast_date DESC, sfc_branch_id)
    WHERE sfc_is_deleted = false;

-- Model comparison: how has each method actually done.
CREATE INDEX IF NOT EXISTS ix_sfc_accuracy
    ON stock.stock_forecast (sfc_company_id, sfc_method, sfc_forecast_date DESC)
    WHERE sfc_mape IS NOT NULL AND sfc_is_deleted = false;


-- ───────────────────────────────────────────────────────────────────────────
--  stock.stock_movement_class — fast, slow, dead.
--
--  THREE ORTHOGONAL CLASSIFICATIONS, because they answer different questions
--  and a single "category A" hides two of them:
--    ABC by VALUE       — where the money is.
--    XYZ by VARIABILITY — an X item can be FORECAST; a Z item can only be
--                         BUFFERED.
--    FSN by FREQUENCY   — how often it moves at all.
--  An A-Z item — high value, wildly unpredictable — is the one that ties up
--  capital and STILL stocks out, and it is invisible to any single ranking.
--
--  COMPUTED PER PERIOD AND STORED, not derived on read: the classification of
--  March must not change when April's sales arrive. Period bounds are part of
--  the unique key, so monthly and quarterly runs coexist.
--
--  The three class columns are NULLABLE — an item with no movement in the
--  period has no honest class, and NULL says that where 'N' would be a claim.
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stock.stock_movement_class
(
    smc_id                  uuid           NOT NULL DEFAULT uuidv7(),
    smc_company_id          uuid           NOT NULL,
    smc_branch_id           uuid           NOT NULL,
    smc_tenant_id           uuid,
    smc_item_id             uuid           NOT NULL,

    smc_period_from         date           NOT NULL,
    smc_period_to           date           NOT NULL,

    smc_abc_class           character(1),
    smc_xyz_class           character(1),
    smc_fsn_class           character(1),

    smc_velocity_qty_per_day numeric(18, 6) NOT NULL DEFAULT 0,
    smc_movement_count      integer        NOT NULL DEFAULT 0,
    smc_days_since_last_sale integer,
    smc_days_of_cover       numeric(9, 2),
    -- COGS in the period over average stock held: how many times the shelf
    -- turned over. The number a retailer actually manages by.
    smc_turn_ratio          numeric(9, 3),
    -- The coefficient of variation the XYZ class is cut from, kept beside the
    -- letter so the cut can be re-examined without recomputing the period.
    smc_demand_cv           numeric(9, 4),

    smc_period_qty          numeric(18, 6) NOT NULL DEFAULT 0,
    smc_period_value_wot    numeric(18, 2) NOT NULL DEFAULT 0,
    smc_avg_stock_qty       numeric(18, 6) NOT NULL DEFAULT 0,
    smc_avg_stock_value     numeric(18, 2) NOT NULL DEFAULT 0,
    smc_closing_qty         numeric(18, 6) NOT NULL DEFAULT 0,
    smc_closing_value       numeric(18, 2) NOT NULL DEFAULT 0,

    -- The working of the ABC cut, stored so the A/B boundary can be audited
    -- rather than reproduced.
    smc_rank_in_branch      integer,
    smc_cum_value_perc      numeric(9, 3),

    smc_dead_stock_flag     boolean        NOT NULL DEFAULT false,
    -- Required whenever the flag is set: "dead since November" dates the buying
    -- mistake and prices the liquidation; "dead" alone is not actionable.
    smc_dead_since_date     date,
    -- What is tied up. Makes the liquidation worklist sortable by how much it
    -- hurts.
    smc_dead_value          numeric(18, 2) NOT NULL DEFAULT 0,

    smc_computed_on         timestamptz(6) NOT NULL DEFAULT now(),
    smc_is_deleted          boolean        NOT NULL DEFAULT false,
    smc_sync_date           timestamptz(6),
    smc_created_on          timestamptz(6) NOT NULL DEFAULT now(),

    CONSTRAINT pk_stock_movement_class PRIMARY KEY (smc_id),
    CONSTRAINT ck_smc_abc_class CHECK (
        smc_abc_class IS NULL OR smc_abc_class = ANY (ARRAY['A'::bpchar, 'B'::bpchar, 'C'::bpchar])),
    CONSTRAINT ck_smc_xyz_class CHECK (
        smc_xyz_class IS NULL OR smc_xyz_class = ANY (ARRAY['X'::bpchar, 'Y'::bpchar, 'Z'::bpchar])),
    CONSTRAINT ck_smc_fsn_class CHECK (
        smc_fsn_class IS NULL OR smc_fsn_class = ANY (ARRAY['F'::bpchar, 'S'::bpchar, 'N'::bpchar])),
    CONSTRAINT ck_smc_period CHECK (smc_period_to >= smc_period_from),
    CONSTRAINT ck_smc_dead CHECK (
        smc_dead_stock_flag = false OR smc_dead_since_date IS NOT NULL),

    CONSTRAINT fk_smc_company FOREIGN KEY (smc_company_id)
        REFERENCES public.companys (comp_id)       ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_smc_branch  FOREIGN KEY (smc_branch_id)
        REFERENCES public.branch_master (br_id)    ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_smc_item    FOREIGN KEY (smc_item_id)
        REFERENCES inventory.item_master (item_id) ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_smc_scope
    ON stock.stock_movement_class
       (smc_company_id, smc_branch_id, smc_item_id, smc_period_from, smc_period_to)
    WHERE smc_is_deleted = false;

-- The classification report, and the A-Z drilldown.
CREATE INDEX IF NOT EXISTS ix_smc_class
    ON stock.stock_movement_class
       (smc_company_id, smc_branch_id, smc_period_to DESC,
        smc_abc_class, smc_xyz_class, smc_fsn_class)
    WHERE smc_is_deleted = false;

-- Dead stock, worst first — the liquidation worklist.
CREATE INDEX IF NOT EXISTS ix_smc_dead
    ON stock.stock_movement_class
       (smc_company_id, smc_branch_id, smc_dead_value DESC)
    WHERE smc_dead_stock_flag = true AND smc_is_deleted = false;


-- ═══════════════════════════════════════════════════════════════════════════
--  PARTITIONS
--
--  stock_voucher, stock_voucher_item, stock_ledger and stock_reservation are
--  parent shells. Without a partition for the accounting year being saved,
--  every insert fails with
--
--    no partition of relation "stock_voucher" found for row
--    (Partition key of the failing row contains (svh_acc_year) = (2026-2027).)
--
--  Two entry points, because the models name two:
--
--    stock.fn_create_stock_partitions('2027-2028')  — the stock four alone,
--        which is what stockVoucher.prisma documents and what a stock-only
--        deployment (the external schema/stock share) would call.
--
--    public.ensure_acc_year_partitions('2027-2028') — the ONE place a fiscal
--        year is opened for the whole database, as stockLedger.prisma requires:
--        "It does NOT know about this table until the migration that creates
--        stock_ledger extends it (CREATE OR REPLACE, restating every existing
--        block in order)". It now delegates the stock four to the function
--        above, so the two can never drift apart.
--
--  Indexes and constraints declared on the parents are inherited by partitions
--  created with PARTITION OF, so nothing above is replayed per year.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION stock.fn_create_stock_partitions(p_acc_year character(9))
    RETURNS void
    LANGUAGE plpgsql
AS
$$
DECLARE
    v_year   text := btrim(p_acc_year);
    v_suffix text;
BEGIN
    -- The partition bound is a literal, so the year is validated rather than
    -- interpolated blind. char(9) makes 'YYYY-YYYY' the only well-formed value.
    IF v_year !~ '^[0-9]{4}-[0-9]{4}$' THEN
        RAISE EXCEPTION 'Invalid accounting year %, expected YYYY-YYYY', p_acc_year;
    END IF;

    v_suffix := replace(v_year, '-', '_');

    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS stock.%I PARTITION OF stock.stock_voucher FOR VALUES IN (%L)',
        'stock_voucher_' || v_suffix, v_year);

    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS stock.%I PARTITION OF stock.stock_voucher_item FOR VALUES IN (%L)',
        'stock_voucher_item_' || v_suffix, v_year);

    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS stock.%I PARTITION OF stock.stock_ledger FOR VALUES IN (%L)',
        'stock_ledger_' || v_suffix, v_year);

    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS stock.%I PARTITION OF stock.stock_reservation FOR VALUES IN (%L)',
        'stock_reservation_' || v_suffix, v_year);
END;
$$;

COMMENT ON FUNCTION stock.fn_create_stock_partitions(character(9)) IS
    'Idempotently creates the stock_voucher / stock_voucher_item / stock_ledger / stock_reservation LIST partitions for one accounting year (YYYY-YYYY). public.ensure_acc_year_partitions calls this; the stock module documents it as the direct entry point.';


-- Restated in full, in order, with the stock delegation appended — the repo's
-- convention for this function (20260808120000, 20260808132323, 20260811080000
-- each did the same).
CREATE OR REPLACE FUNCTION public.ensure_acc_year_partitions(p_acc_year character(9))
    RETURNS void
    LANGUAGE plpgsql
AS
$$
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

    -- The stock engine's four, added by 20260907090000.
    PERFORM stock.fn_create_stock_partitions(v_year::character(9));
END;
$$;

COMMENT ON FUNCTION public.ensure_acc_year_partitions(character(9)) IS
    'Idempotently creates every acc-year LIST partition for one accounting year (YYYY-YYYY): sale_bill / sale_bill_item / acc_tender_detail / txn_status_log / txn_charge_detail / txn_hold / sale_order / sale_order_item / sale_quotation / sale_quotation_item / acc_bill_balance / acc_bill_adjustment / acc_opening_balance / acc_pdc_register, plus the stock four via stock.fn_create_stock_partitions. Run it whenever a fiscal year is opened.';


-- Bootstrap every accounting year on record. fiscal_years is the authority on
-- which years exist; deleted rows are skipped. Re-running the helper for years
-- that already have their other partitions is a no-op for those and creates
-- only the new stock ones.
DO
$$
    DECLARE
        v_year text;
    BEGIN
        FOR v_year IN
            SELECT DISTINCT btrim(fy_year_name)
            FROM public.fiscal_years
            WHERE is_deleted = false
              AND btrim(fy_year_name) ~ '^[0-9]{4}-[0-9]{4}$'
            ORDER BY 1
            LOOP
                PERFORM public.ensure_acc_year_partitions(v_year::character(9));
            END LOOP;
    END;
$$;
