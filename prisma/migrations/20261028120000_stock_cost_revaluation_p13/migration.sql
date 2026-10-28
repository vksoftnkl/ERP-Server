-- ═══════════════════════════════════════════════════════════════════════════
--  P13 — stock revaluation, value-only rows (notes-162 P13, plan D19 / R2)
--
--  A GRN posts stock at a provisional rate. When the supplier's bill arrives at
--  another rate, the qty still on hand is revalued. A value-only movement cannot
--  live in stock_ledger (ck_sml_qty_nonzero), so it gets its own append-only
--  table, which the cost rebuild sums together with the ledger:
--      lot / item value = Σ direction × sml_cost_value  +  Σ scr_value
--  One writer (stock-voucher-posting.helper.ts: postCostRevaluation /
--  reverseCostRevaluation), INSERT only. A cancel is a reversal row (negative
--  value, scr_reverses_id), never an UPDATE or DELETE.
--  No function, no trigger of its own (sync triggers come from
--  public.sync_install_triggers, as on every synced table).
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE stock.stock_cost_revaluation (
    scr_id              uuid DEFAULT uuidv7() NOT NULL,
    scr_acc_year        character(9) NOT NULL,
    scr_company_id      uuid NOT NULL,
    scr_branch_id       uuid NOT NULL,
    scr_item_id         uuid NOT NULL,
    scr_lot_id          uuid NOT NULL,
    scr_value           numeric(18,2) NOT NULL,
    scr_value_wot       numeric(18,2) NOT NULL,
    scr_basis_base_qty  numeric(18,6) NOT NULL,
    scr_doc_date        date NOT NULL,
    scr_doc_datetime    timestamp(6) with time zone DEFAULT now() NOT NULL,
    scr_src_module      character varying(20) NOT NULL,
    scr_src_doc_type    character varying(30) NOT NULL,
    scr_src_doc_id      uuid NOT NULL,
    scr_src_acc_year    character(9) NOT NULL,
    scr_src_line_id     uuid NOT NULL,
    scr_src_refno       character varying(100),
    scr_is_reversal     boolean DEFAULT false NOT NULL,
    scr_reverses_id     uuid,
    scr_narration       text,
    scr_is_deleted      boolean DEFAULT false NOT NULL,
    scr_sync_date       timestamp(6) with time zone,
    scr_created_on      timestamp(6) with time zone DEFAULT now() NOT NULL,
    scr_created_by      text,
    CONSTRAINT ck_scr_acc_year CHECK (scr_acc_year ~ '^[0-9]{4}-[0-9]{4}$' AND right(scr_acc_year, 4)::int = left(scr_acc_year, 4)::int + 1),
    CONSTRAINT ck_scr_value CHECK (scr_value <> 0 OR scr_value_wot <> 0),
    CONSTRAINT ck_scr_basis CHECK (scr_basis_base_qty > 0),
    CONSTRAINT ck_scr_reversal CHECK ((scr_is_reversal AND scr_reverses_id IS NOT NULL) OR (NOT scr_is_reversal AND scr_reverses_id IS NULL)),
    CONSTRAINT ck_scr_src_module CHECK (scr_src_module IN ('SALES','PURCHASE','STOCK','PRODUCTION','MIGRATION'))
)
PARTITION BY LIST (scr_acc_year);
ALTER TABLE stock.stock_cost_revaluation ADD CONSTRAINT pk_stock_cost_revaluation PRIMARY KEY (scr_id, scr_acc_year);
COMMENT ON TABLE stock.stock_cost_revaluation IS 'Value-only stock movements (P13): a bill priced differently from its GRN revalues the qty still on hand. Summed by the cost rebuild with stock_ledger (lot value for LOT_ACTUAL, item value for every item). Append-only; a cancel is a reversal row. scr_basis_base_qty = the on-hand qty the value was spread over (information).';
COMMENT ON COLUMN stock.stock_cost_revaluation.scr_lot_id IS 'The lot revalued. For a WAVG item only the item total moves (the lot carries the item average); the lot is kept for the trail.';

CREATE TABLE stock.stock_cost_revaluation_2024_2025 PARTITION OF stock.stock_cost_revaluation FOR VALUES IN ('2024-2025');
CREATE TABLE stock.stock_cost_revaluation_2025_2026 PARTITION OF stock.stock_cost_revaluation FOR VALUES IN ('2025-2026');
CREATE TABLE stock.stock_cost_revaluation_2026_2027 PARTITION OF stock.stock_cost_revaluation FOR VALUES IN ('2026-2027');
CREATE TABLE stock.stock_cost_revaluation_2027_2028 PARTITION OF stock.stock_cost_revaluation FOR VALUES IN ('2027-2028');

ALTER TABLE stock.stock_cost_revaluation ADD CONSTRAINT fk_scr_branch FOREIGN KEY (scr_branch_id) REFERENCES public.branch_master (br_id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE stock.stock_cost_revaluation ADD CONSTRAINT fk_scr_item FOREIGN KEY (scr_item_id) REFERENCES inventory.item_master (item_id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE stock.stock_cost_revaluation ADD CONSTRAINT fk_scr_lot FOREIGN KEY (scr_lot_id) REFERENCES stock.stock_lot (slt_id) ON UPDATE CASCADE ON DELETE RESTRICT;

CREATE INDEX ix_scr_item ON stock.stock_cost_revaluation (scr_company_id, scr_branch_id, scr_item_id) WHERE (scr_is_deleted = false);
CREATE INDEX ix_scr_lot ON stock.stock_cost_revaluation (scr_lot_id) WHERE (scr_is_deleted = false);
CREATE INDEX ix_scr_source ON stock.stock_cost_revaluation (scr_src_doc_id, scr_src_doc_type, scr_src_acc_year) WHERE (scr_is_deleted = false);
-- one forward row per (source line, lot); one reversal per forward row
CREATE UNIQUE INDEX ux_scr_source ON stock.stock_cost_revaluation (scr_acc_year, scr_src_module, scr_src_doc_type, scr_src_doc_id, scr_src_line_id, scr_lot_id)
    WHERE (scr_is_deleted = false AND scr_is_reversal = false);
CREATE UNIQUE INDEX ux_scr_reversal ON stock.stock_cost_revaluation (scr_acc_year, scr_reverses_id)
    WHERE (scr_is_reversal = true AND scr_is_deleted = false);

-- the year-roll helper (a partition DDL helper — the one kind of DB function we keep) learns the new parent
CREATE OR REPLACE FUNCTION stock.fn_create_stock_partitions(p_acc_year character)
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_year   text := btrim(p_acc_year);
    v_suffix text;
    v_count  integer := 0;
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
    v_count := v_count + 1;

    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS stock.%I PARTITION OF stock.stock_voucher_item FOR VALUES IN (%L)',
        'stock_voucher_item_' || v_suffix, v_year);
    v_count := v_count + 1;

    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS stock.%I PARTITION OF stock.stock_ledger FOR VALUES IN (%L)',
        'stock_ledger_' || v_suffix, v_year);
    v_count := v_count + 1;

    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS stock.%I PARTITION OF stock.stock_reservation FOR VALUES IN (%L)',
        'stock_reservation_' || v_suffix, v_year);
    v_count := v_count + 1;

    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS stock.%I PARTITION OF stock.stock_cost_revaluation FOR VALUES IN (%L)',
        'stock_cost_revaluation_' || v_suffix, v_year);
    v_count := v_count + 1;

    RETURN v_count;   -- number of stock parents visited
END;
$function$;

SELECT public.sync_install_triggers();
