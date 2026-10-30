-- ─────────────────────────────────────────────────────────────────────────────
-- inventory.tax_rate_master
--
-- Replacement shape for the GST rate master: one rate figure with CGST/SGST/IGST
-- GENERATED from it, a declared cess basis, a second (state/additional) cess,
-- a supersession chain, and the full ledger set named after acc_ledger_map roles.
--
-- Section 1: table
-- Section 2: indexes
-- Section 3: global-ledger guard
-- Section 4: comments
--
-- The old inventory.item_tax_master is left in place and untouched; nothing is
-- migrated off it here.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Section 1: table ─────────────────────────────────────────────────────────
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

    -- ── Ledgers ──────────────────────────────────────────────────────────
    -- Named for the roles in accounts.acc_ledger_map's ck_alm_role, so the
    -- resolver's role -> column mapping is mechanical rather than a lookup
    -- table of near-synonyms.
    --
    -- These must name GLOBAL ledgers (led_company_id IS NULL): this table has
    -- no company column, so one row serves every company, so the ledger it
    -- names has to as well. Enforced by the guard in section 3.
    tax_sales_ledger_id           uuid,
    tax_sales_return_ledger_id    uuid,
    tax_output_cgst_ledger_id     uuid,
    tax_output_sgst_ledger_id     uuid,
    tax_output_igst_ledger_id     uuid,
    tax_output_cess_ledger_id     uuid,
    tax_output_acess_ledger_id    uuid,
    tax_purchase_ledger_id        uuid,
    tax_purchase_return_ledger_id uuid,
    tax_input_cgst_ledger_id      uuid,
    tax_input_sgst_ledger_id      uuid,
    tax_input_igst_ledger_id      uuid,
    tax_input_cess_ledger_id      uuid,
    tax_input_acess_ledger_id     uuid,

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

    CONSTRAINT fk_tax_sales        FOREIGN KEY (tax_sales_ledger_id)           REFERENCES accounts.acc_ledger_master (led_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_tax_sales_ret    FOREIGN KEY (tax_sales_return_ledger_id)    REFERENCES accounts.acc_ledger_master (led_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_tax_out_cgst     FOREIGN KEY (tax_output_cgst_ledger_id)     REFERENCES accounts.acc_ledger_master (led_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_tax_out_sgst     FOREIGN KEY (tax_output_sgst_ledger_id)     REFERENCES accounts.acc_ledger_master (led_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_tax_out_igst     FOREIGN KEY (tax_output_igst_ledger_id)     REFERENCES accounts.acc_ledger_master (led_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_tax_out_cess     FOREIGN KEY (tax_output_cess_ledger_id)     REFERENCES accounts.acc_ledger_master (led_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_tax_purchase     FOREIGN KEY (tax_purchase_ledger_id)        REFERENCES accounts.acc_ledger_master (led_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_tax_pur_ret      FOREIGN KEY (tax_purchase_return_ledger_id) REFERENCES accounts.acc_ledger_master (led_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_tax_in_cgst      FOREIGN KEY (tax_input_cgst_ledger_id)      REFERENCES accounts.acc_ledger_master (led_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_tax_in_sgst      FOREIGN KEY (tax_input_sgst_ledger_id)      REFERENCES accounts.acc_ledger_master (led_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_tax_in_igst      FOREIGN KEY (tax_input_igst_ledger_id)      REFERENCES accounts.acc_ledger_master (led_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_tax_in_cess      FOREIGN KEY (tax_input_cess_ledger_id)      REFERENCES accounts.acc_ledger_master (led_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_tax_out_acess    FOREIGN KEY (tax_output_acess_ledger_id)    REFERENCES accounts.acc_ledger_master (led_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_tax_in_acess     FOREIGN KEY (tax_input_acess_ledger_id)     REFERENCES accounts.acc_ledger_master (led_id) ON UPDATE CASCADE ON DELETE RESTRICT,

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

-- ── Section 2: indexes ───────────────────────────────────────────────────────

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
CREATE INDEX IF NOT EXISTS ix_tax_sales     ON inventory.tax_rate_master (tax_sales_ledger_id)           WHERE tax_sales_ledger_id           IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_tax_sales_ret ON inventory.tax_rate_master (tax_sales_return_ledger_id)    WHERE tax_sales_return_ledger_id    IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_tax_out_cgst  ON inventory.tax_rate_master (tax_output_cgst_ledger_id)     WHERE tax_output_cgst_ledger_id     IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_tax_out_sgst  ON inventory.tax_rate_master (tax_output_sgst_ledger_id)     WHERE tax_output_sgst_ledger_id     IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_tax_out_igst  ON inventory.tax_rate_master (tax_output_igst_ledger_id)     WHERE tax_output_igst_ledger_id     IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_tax_out_cess  ON inventory.tax_rate_master (tax_output_cess_ledger_id)     WHERE tax_output_cess_ledger_id     IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_tax_purchase  ON inventory.tax_rate_master (tax_purchase_ledger_id)        WHERE tax_purchase_ledger_id        IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_tax_pur_ret   ON inventory.tax_rate_master (tax_purchase_return_ledger_id) WHERE tax_purchase_return_ledger_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_tax_in_cgst   ON inventory.tax_rate_master (tax_input_cgst_ledger_id)      WHERE tax_input_cgst_ledger_id      IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_tax_in_sgst   ON inventory.tax_rate_master (tax_input_sgst_ledger_id)      WHERE tax_input_sgst_ledger_id      IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_tax_in_igst   ON inventory.tax_rate_master (tax_input_igst_ledger_id)      WHERE tax_input_igst_ledger_id      IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_tax_in_cess   ON inventory.tax_rate_master (tax_input_cess_ledger_id)      WHERE tax_input_cess_ledger_id      IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_tax_out_acess ON inventory.tax_rate_master (tax_output_acess_ledger_id)    WHERE tax_output_acess_ledger_id    IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_tax_in_acess  ON inventory.tax_rate_master (tax_input_acess_ledger_id)     WHERE tax_input_acess_ledger_id     IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_tax_supersedes
    ON inventory.tax_rate_master (tax_supersedes_id) WHERE tax_supersedes_id IS NOT NULL;

-- ── Section 3: global-ledger guard ───────────────────────────────────────────
-- The ledger columns promise a GLOBAL ledger (led_company_id IS NULL). A plain
-- FK cannot say that, so this says it: on insert/update, any ledger named by a
-- changed column must be global, or the write is refused naming the column and
-- the company it belongs to.
CREATE OR REPLACE FUNCTION inventory.fn_tax_ledgers_global()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    new_row  jsonb := to_jsonb(NEW);
    old_row  jsonb := CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) END;
    col      text;
    led      uuid;
    owner_id uuid;
BEGIN
    FOREACH col IN ARRAY ARRAY[
        'tax_sales_ledger_id','tax_sales_return_ledger_id',
        'tax_output_cgst_ledger_id','tax_output_sgst_ledger_id',
        'tax_output_igst_ledger_id','tax_output_cess_ledger_id',
        'tax_output_acess_ledger_id',
        'tax_purchase_ledger_id','tax_purchase_return_ledger_id',
        'tax_input_cgst_ledger_id','tax_input_sgst_ledger_id',
        'tax_input_igst_ledger_id','tax_input_cess_ledger_id',
        'tax_input_acess_ledger_id']
    LOOP
        led := (new_row ->> col)::uuid;
        CONTINUE WHEN led IS NULL;

        -- Only re-check what actually changed, so an UPDATE of tax_name does
        -- not re-validate fourteen ledgers.
        CONTINUE WHEN old_row IS NOT NULL
                  AND (old_row ->> col) IS NOT DISTINCT FROM (new_row ->> col);

        SELECT led_company_id INTO owner_id
        FROM   accounts.acc_ledger_master
        WHERE  led_id = led;

        IF owner_id IS NOT NULL THEN
            RAISE EXCEPTION
                'tax_rate_master.%: ledger % belongs to company % — a rate row '
                'serves every company, so the ledger it names must be global '
                '(led_company_id IS NULL).', col, led, owner_id
                USING ERRCODE = '23514';
        END IF;
    END LOOP;

    RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS tr_tax_ledgers_global ON inventory.tax_rate_master;
CREATE TRIGGER tr_tax_ledgers_global
    BEFORE INSERT OR UPDATE ON inventory.tax_rate_master
    FOR EACH ROW EXECUTE FUNCTION inventory.fn_tax_ledgers_global();

-- ── Section 4: comments ──────────────────────────────────────────────────────
COMMENT ON TABLE inventory.tax_rate_master IS
    'GST rate master. One row per rate, shared by every company — a rate is statutory and national, so the ledgers it names must be global too.';
COMMENT ON COLUMN inventory.tax_rate_master.tax_rate_perc IS
    'The total GST rate. CGST/SGST/IGST are GENERATED from it and cannot drift.';
COMMENT ON COLUMN inventory.tax_rate_master.tax_cess_basis IS
    'NONE | PERCENT (tax_cess_perc) | PER_UNIT (tax_cess_per_unit) | BOTH. Says which figure is in play, so a zero is never ambiguous.';
COMMENT ON COLUMN inventory.tax_rate_master.tax_supersedes_id IS
    'The rate this one replaced. A rate change makes a NEW row and re-points items (see inventory.item_tax_history); this keeps the chain followable.';
