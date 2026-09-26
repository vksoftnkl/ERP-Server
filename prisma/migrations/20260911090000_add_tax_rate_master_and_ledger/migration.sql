-- ═══════════════════════════════════════════════════════════════════════════
--  inventory.tax_rate_master + inventory.tax_rate_ledger
--
--  Re-creates the GST rate master dropped by 20260911080000, in the shape the
--  role catalogue (20260911070000) made possible: the eighteen ledger columns
--  are gone, and the per-rate overrides are rows in tax_rate_ledger keyed by
--  (role, supply nature) — the same shape as accounts.acc_ledger_map.
--
--  inventory.item_tax_master stays the live rate master until the read/write
--  paths move; nothing here touches it.
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════
--  1 · The table
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS inventory.tax_rate_master
(
    -- ── Identity ─────────────────────────────────────────────────────────
    tax_id                uuid          NOT NULL DEFAULT uuidv7(),
    tax_name              varchar(100)  NOT NULL,
    tax_code              varchar(30),
    tax_sort_order        smallint      NOT NULL DEFAULT 0,

    -- ── Classification ───────────────────────────────────────────────────
    -- Same vocabulary as accounts."VoucherDocDetailTaxability", minus MIXED —
    -- a rate is never mixed; a DOCUMENT is, when its lines disagree.
    tax_taxability        varchar(15)   NOT NULL DEFAULT 'TAXABLE',
    tax_is_reverse_charge boolean       NOT NULL DEFAULT false,

    -- ── The rate. One number; the rest follow from it ────────────────────
    -- The total GST rate: 18 means 18%, charged as 9+9 locally or 18 inter-state.
    tax_rate_perc         numeric(7,3)  NOT NULL DEFAULT 0,

    -- Kept under their old names so every existing SELECT still reads, but
    -- GENERATED so they can no longer disagree with the rate they come from.
    tax_cgst_perc numeric(7,3) GENERATED ALWAYS AS ((tax_rate_perc / 2)::numeric(7,3)) STORED,
    tax_sgst_perc numeric(7,3) GENERATED ALWAYS AS ((tax_rate_perc / 2)::numeric(7,3)) STORED,
    tax_igst_perc numeric(7,3) GENERATED ALWAYS AS (tax_rate_perc) STORED,

    -- ── Cess ─────────────────────────────────────────────────────────────
    -- basis says which of the two figures below is in play, so a reader never
    -- has to guess whether a zero means "no cess" or "not this kind of cess".
    tax_cess_basis        varchar(10)   NOT NULL DEFAULT 'NONE',
    tax_cess_perc         numeric(7,3)  NOT NULL DEFAULT 0,
    tax_cess_per_unit     numeric(15,4) NOT NULL DEFAULT 0,

    -- ── Additional / state cess ──────────────────────────────────────────
    -- A SECOND cess, because three places in this schema already expect one
    -- and the old master had nowhere to define it:
    --    sales.sale_bill_item      sbi_acess_perc / _per_unit / _amt
    --    acc_voucher_doc_register  gdr_state_cess_value beside gdr_cess_value
    --    acc_ledger_master         duty head 'State Cess' beside 'Cess'
    -- Same shape as the block above, so the line can carry both independently
    -- (Kerala flood cess beside compensation cess is the standard example).
    tax_acess_basis       varchar(10)   NOT NULL DEFAULT 'NONE',
    tax_acess_perc        numeric(7,3)  NOT NULL DEFAULT 0,
    tax_acess_per_unit    numeric(15,4) NOT NULL DEFAULT 0,

    -- ── Supersession ─────────────────────────────────────────────────────
    -- A rate change makes a NEW row; this points at the one it replaced, so
    -- "what was this 18% before the rationalisation?" is one join, not a guess
    -- based on names. NULL on an original rate.
    tax_supersedes_id     uuid,

    -- ── Ledgers are NOT columns ──────────────────────────────────────────
    -- They live in inventory.tax_rate_ledger, one row per (role, supply
    -- nature) actually overridden. They were eighteen columns here and went
    -- 12 -> 14 -> 4 -> 14 -> 18 in a week as each new axis turned up — cess,
    -- state cess, inter-state. Every one of those was an ALTER. As rows they
    -- are data, and the next axis costs an insert.
    --
    -- See section 2.
    -- ── Audit (house convention) ─────────────────────────────────────────
    tax_is_active         boolean       NOT NULL DEFAULT true,
    tax_is_deleted        boolean       NOT NULL DEFAULT false,
    tax_sync_date         timestamp(6) with time zone,
    tax_created_on        timestamp(6) with time zone NOT NULL DEFAULT now(),
    tax_created_by        varchar(50),
    tax_modified_on       timestamp(6) with time zone,
    tax_modified_by       varchar(50),

    CONSTRAINT pk_tax_rate_master PRIMARY KEY (tax_id),

    CONSTRAINT fk_tax_supersedes FOREIGN KEY (tax_supersedes_id)
        REFERENCES inventory.tax_rate_master (tax_id)
        ON UPDATE CASCADE ON DELETE SET NULL,


    -- ── Rules the old table had no way to state ──────────────────────────
    CONSTRAINT ck_tax_taxability CHECK (
        tax_taxability IN ('TAXABLE','EXEMPT','NIL_RATED','NON_GST','ZERO_RATED')),

    CONSTRAINT ck_tax_cess_basis CHECK (
        tax_cess_basis IN ('NONE','PERCENT','PER_UNIT','BOTH')),

    CONSTRAINT ck_tax_acess_basis CHECK (
        tax_acess_basis IN ('NONE','PERCENT','PER_UNIT','BOTH')),

    CONSTRAINT ck_tax_rate CHECK (tax_rate_perc >= 0 AND tax_rate_perc <= 100),

    CONSTRAINT ck_tax_cess_nonneg CHECK (
        tax_cess_perc >= 0 AND tax_cess_per_unit >= 0
    AND tax_acess_perc >= 0 AND tax_acess_per_unit >= 0),

    -- An exempt / nil / non-GST rate charges nothing, by definition. ZERO_RATED
    -- is NOT here: an export is genuinely taxable at 0%, and it needs to stay
    -- distinguishable from an exempt supply on the return.
    CONSTRAINT ck_tax_exempt_zero CHECK (
        tax_taxability NOT IN ('EXEMPT','NIL_RATED','NON_GST')
        OR (tax_rate_perc = 0 AND tax_cess_perc = 0 AND tax_cess_per_unit = 0
            AND tax_acess_perc = 0 AND tax_acess_per_unit = 0)),

    -- The basis and the figures agree, so a bill can never charge no cess on a
    -- row that claims to have some.
    CONSTRAINT ck_tax_cess_agrees CHECK (
        (tax_cess_basis = 'NONE'     AND tax_cess_perc = 0 AND tax_cess_per_unit = 0)
     OR (tax_cess_basis = 'PERCENT'  AND tax_cess_perc > 0 AND tax_cess_per_unit = 0)
     OR (tax_cess_basis = 'PER_UNIT' AND tax_cess_per_unit > 0 AND tax_cess_perc = 0)
     OR (tax_cess_basis = 'BOTH'     AND tax_cess_perc > 0 AND tax_cess_per_unit > 0)),

    CONSTRAINT ck_tax_acess_agrees CHECK (
        (tax_acess_basis = 'NONE'     AND tax_acess_perc = 0 AND tax_acess_per_unit = 0)
     OR (tax_acess_basis = 'PERCENT'  AND tax_acess_perc > 0 AND tax_acess_per_unit = 0)
     OR (tax_acess_basis = 'PER_UNIT' AND tax_acess_per_unit > 0 AND tax_acess_perc = 0)
     OR (tax_acess_basis = 'BOTH'     AND tax_acess_perc > 0 AND tax_acess_per_unit > 0)),

    CONSTRAINT ck_tax_no_self_supersede CHECK (
        tax_supersedes_id IS NULL OR tax_supersedes_id <> tax_id)
);

ALTER TABLE IF EXISTS inventory.tax_rate_master OWNER to postgres;

-- Name stays unique among LIVE rows only — the old uq_tax_name_global blocked
-- reusing the name of a soft-deleted rate, which is how 'GST @ 18%' ended up
-- beside 'GST 18%' instead of replacing it.
CREATE UNIQUE INDEX IF NOT EXISTS ux_tax_name
    ON inventory.tax_rate_master (lower(tax_name))
    WHERE tax_is_deleted = false;

CREATE UNIQUE INDEX IF NOT EXISTS ux_tax_code
    ON inventory.tax_rate_master (lower(tax_code))
    WHERE tax_code IS NOT NULL AND tax_is_deleted = false;

-- Rate-wise reporting, and the picker's default order.
CREATE INDEX IF NOT EXISTS ix_tax_rate
    ON inventory.tax_rate_master (tax_rate_perc)
    WHERE tax_is_deleted = false AND tax_is_active = true;
CREATE INDEX IF NOT EXISTS ix_tax_sort
    ON inventory.tax_rate_master (tax_sort_order, tax_name)
    WHERE tax_is_deleted = false AND tax_is_active = true;

-- Cover every FK so dropping a ledger does not seq-scan this table.

CREATE INDEX IF NOT EXISTS ix_tax_supersedes
    ON inventory.tax_rate_master (tax_supersedes_id) WHERE tax_supersedes_id IS NOT NULL;

COMMENT ON TABLE inventory.tax_rate_master IS
    'GST rate master. One row per rate, shared by every company — a rate is statutory and national, so the ledgers it names must be global too.';
COMMENT ON COLUMN inventory.tax_rate_master.tax_rate_perc IS
    'The total GST rate. CGST/SGST/IGST are GENERATED from it and cannot drift.';
COMMENT ON COLUMN inventory.tax_rate_master.tax_cess_basis IS
    'NONE | PERCENT (tax_cess_perc) | PER_UNIT (tax_cess_per_unit) | BOTH. Says which figure is in play, so a zero is never ambiguous.';
COMMENT ON COLUMN inventory.tax_rate_master.tax_supersedes_id IS
    'The rate this one replaced. A rate change makes a NEW row and re-points items (see inventory.item_tax_history); this keeps the chain followable.';


-- ═══════════════════════════════════════════════════════════════════════════
--  2 · inventory.tax_rate_ledger  —  the per-rate overrides, as rows
--
--  One row per (rate, role, supply nature) that actually differs from the
--  default. A rate that posts wherever accounts.acc_ledger_map says — which is
--  most of them, and all of them in a simple chart — has no rows here at all.
--
--  Same shape as acc_ledger_map on purpose: (scope…, role, nature) -> ledger.
--  The map's scope is company and branch; this one's scope is the rate.
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS inventory.tax_rate_ledger
(
    trl_id            uuid        NOT NULL DEFAULT uuidv7(),
    trl_tax_id        uuid        NOT NULL,
    trl_role          varchar(30) NOT NULL,
    -- NULL = both natures. Only roles with alr_by_supply may set it.
    trl_supply_nature varchar(5),
    trl_ledger_id     uuid        NOT NULL,
    trl_remarks       varchar(250),

    trl_is_active     boolean     NOT NULL DEFAULT true,
    trl_is_deleted    boolean     NOT NULL DEFAULT false,
    trl_sync_date     timestamp(6) with time zone,
    trl_created_on    timestamp(6) with time zone NOT NULL DEFAULT now(),
    trl_created_by    varchar(50),
    trl_modified_on   timestamp(6) with time zone,
    trl_modified_by   varchar(50),

    CONSTRAINT pk_tax_rate_ledger PRIMARY KEY (trl_id),

    CONSTRAINT fk_trl_tax FOREIGN KEY (trl_tax_id)
        REFERENCES inventory.tax_rate_master (tax_id) ON UPDATE CASCADE ON DELETE CASCADE,
    -- An FK, not a CHECK listing role names: adding a role is one insert in
    -- accounts.acc_ledger_role and every table that uses roles follows.
    CONSTRAINT fk_trl_role FOREIGN KEY (trl_role)
        REFERENCES accounts.acc_ledger_role (alr_role) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_trl_ledger FOREIGN KEY (trl_ledger_id)
        REFERENCES accounts.acc_ledger_master (led_id) ON UPDATE CASCADE ON DELETE RESTRICT,

    CONSTRAINT ck_trl_supply_nature CHECK (
        trl_supply_nature IS NULL OR trl_supply_nature IN ('INTRA','INTER'))
);

ALTER TABLE IF EXISTS inventory.tax_rate_ledger OWNER to postgres;

CREATE UNIQUE INDEX IF NOT EXISTS ux_trl_rate_role
    ON inventory.tax_rate_ledger (trl_tax_id, trl_role, trl_supply_nature)
    NULLS NOT DISTINCT
    WHERE trl_is_deleted = false;

-- The resolver's only lookup.
CREATE INDEX IF NOT EXISTS ix_trl_lookup
    ON inventory.tax_rate_ledger (trl_tax_id, trl_role)
    INCLUDE (trl_ledger_id, trl_supply_nature)
    WHERE trl_is_deleted = false AND trl_is_active = true;

CREATE INDEX IF NOT EXISTS ix_trl_ledger ON inventory.tax_rate_ledger (trl_ledger_id);
CREATE INDEX IF NOT EXISTS ix_trl_role   ON inventory.tax_rate_ledger (trl_role);

COMMENT ON TABLE inventory.tax_rate_ledger IS
    'Per-GST-rate ledger overrides. A rate with no rows here posts wherever accounts.acc_ledger_map says, which is a complete configuration. Same (scope, role, nature) -> ledger shape as the map.';


-- ═══════════════════════════════════════════════════════════════════════════
--  3 · The statutory slabs
--
--  A rate is national, so these are the same everywhere and belong with the
--  table rather than in a per-company seed. No ledgers are named: every one of
--  these posts wherever accounts.acc_ledger_map says, which is a complete
--  configuration — tax_rate_ledger stays empty until a rate genuinely differs.
--
--  ON CONFLICT DO NOTHING with no target covers ux_tax_name and ux_tax_code
--  both, so a re-run adds nothing and an operator-renamed slab is left alone.
-- ═══════════════════════════════════════════════════════════════════════════
INSERT INTO inventory.tax_rate_master
       (tax_name, tax_code, tax_taxability, tax_rate_perc, tax_sort_order, tax_created_by)
VALUES
  -- Taxable slabs, in the order an operator scans them.
  ('GST 0%',      'GST0',    'TAXABLE',     0.000, 10, 'seed:20'),
  ('GST 0.25%',   'GST025',  'TAXABLE',     0.250, 20, 'seed:20'),
  ('GST 3%',      'GST3',    'TAXABLE',     3.000, 30, 'seed:20'),
  ('GST 5%',      'GST5',    'TAXABLE',     5.000, 40, 'seed:20'),
  ('GST 12%',     'GST12',   'TAXABLE',    12.000, 50, 'seed:20'),
  ('GST 18%',     'GST18',   'TAXABLE',    18.000, 60, 'seed:20'),
  ('GST 28%',     'GST28',   'TAXABLE',    28.000, 70, 'seed:20'),

  -- The four that are NOT the same thing, however identical 0% looks on a
  -- bill. They land in different boxes on the return, and ck_tax_exempt_zero
  -- keeps three of them at zero.
  --   ZERO_RATED  export / SEZ — taxable, at 0%, and ITC is claimable
  --   EXEMPT      exempt by notification — no ITC
  --   NIL_RATED   the schedule rate is nil
  --   NON_GST     outside GST entirely (petrol, alcohol)
  ('Export / Zero Rated', 'ZERO',   'ZERO_RATED', 0.000, 80, 'seed:20'),
  ('Exempt',              'EXEMPT', 'EXEMPT',     0.000, 90, 'seed:20'),
  ('Nil Rated',           'NIL',    'NIL_RATED',  0.000,100, 'seed:20'),
  ('Non-GST',             'NONGST', 'NON_GST',    0.000,110, 'seed:20')
ON CONFLICT DO NOTHING;
