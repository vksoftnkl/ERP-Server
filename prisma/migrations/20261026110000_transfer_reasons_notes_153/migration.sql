-- ═══════════════════════════════════════════════════════════════════════════
--  Godown Transfer: the reasons, and the charge counts free goods
--  — notes 153, second revision (2026-10-26)
--
--  1. Three shared transfer reasons (E4). The Godown Transfer header has a
--     Reason, and no reason named TRANSFER_OUT except TRANSIT_LOSS, which is
--     the short-settlement's write-off. BOTH, because a transfer moves the
--     stock out of one godown and into another; the API lists and accepts only
--     BOTH reasons on a transfer. prisma/seed/Stock_Reason_Master.sql carries
--     the same three for a fresh database (migrations run before seeds).
--  2. The charge is what was CARRIED: round(Σ (qty + freeQty) × rate, 2). The
--     column comments of 20261026100000 said qty alone; restated here rather
--     than editing an applied migration.
-- ═══════════════════════════════════════════════════════════════════════════


-- ── 1 · transfer reasons ───────────────────────────────────────────────────
INSERT INTO stock.stock_reason_master
    (srm_company_id, srm_code, srm_name, srm_direction, srm_allowed_txn_types,
     srm_require_remarks, srm_sort_order, srm_remarks)
SELECT v.company, v.code, v.name, v.direction, v.allowed, false, v.sort_order, v.note
  FROM (VALUES
    (NULL::uuid, 'REPLENISH'::varchar, 'Replenish godown'::varchar, 'BOTH'::varchar,
     ARRAY['TRANSFER_OUT','TRANSFER_IN']::text[], 190,
     'Topping up a godown or a cold room from stock held elsewhere.'::varchar),
    (NULL, 'REARRANGE', 'Re-arrange stock', 'BOTH',
     ARRAY['TRANSFER_OUT','TRANSFER_IN']::text[], 200,
     'Moving stock to where it is better kept or picked from. Nothing is gained or lost.'),
    (NULL, 'RETURN_STORE', 'Back to main store', 'BOTH',
     ARRAY['TRANSFER_OUT','TRANSFER_IN']::text[], 210,
     'Unsold or surplus stock sent back to the main store.')
  ) AS v(company, code, name, direction, allowed, sort_order, note)
 WHERE NOT EXISTS (
        SELECT 1 FROM stock.stock_reason_master e
         WHERE e.srm_company_id IS NULL AND e.srm_code = v.code AND e.srm_is_deleted = false);


-- ── 2 · the charge counts free goods ───────────────────────────────────────
COMMENT ON COLUMN stock.stock_voucher.svh_loading_charge IS
    'COMPUTED by the API on every save: round(Σ (svi_qty + svi_free_qty) × svi_load_rate, 2) when svh_load_enabled, else 0 — the labour is paid on what was carried. Never taken from a body. Posts DR LOADING_CHARGES / CR LOADING_PAYABLE at despatch.';
COMMENT ON COLUMN stock.stock_voucher.svh_unloading_charge IS
    'COMPUTED as svh_loading_charge, from svi_unload_rate and svh_unload_enabled.';
COMMENT ON COLUMN stock.stock_voucher_item.svi_load_rate IS
    'Loading charge per unit of the LINE''s unit (svi_uom_id); the amount is (svi_qty + svi_free_qty) × rate and is not stored. Defaults on the screen from item_unit_master.unit_loading when item_allow_loading; stored so a later rate change cannot move an old transfer''s charge.';
