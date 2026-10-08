"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertStockBalances = assertStockBalances;
async function assertStockBalances(client, scope = {}) {
    const companyId = scope.companyId ?? null;
    const branchId = scope.branchId ?? null;
    const itemId = scope.itemId ?? null;
    return client.$queryRaw `
    WITH scope AS (
      SELECT ${companyId}::uuid AS company_id, ${branchId}::uuid AS branch_id, ${itemId}::uuid AS item_id
    ),
    led AS (
      SELECT sml.sml_company_id, sml.sml_branch_id, sml.sml_godown_id, sml.sml_item_id, sml.sml_lot_id, sml.sml_bucket,
             SUM(CASE WHEN sml.sml_direction > 0 THEN sml.sml_base_qty      ELSE 0 END) AS in_qty,
             SUM(CASE WHEN sml.sml_direction < 0 THEN sml.sml_base_qty      ELSE 0 END) AS out_qty,
             SUM(CASE WHEN sml.sml_direction > 0 THEN sml.sml_free_base_qty ELSE 0 END) AS free_in_qty,
             SUM(CASE WHEN sml.sml_direction < 0 THEN sml.sml_free_base_qty ELSE 0 END) AS free_out_qty
        FROM stock.stock_ledger sml, scope s
       WHERE sml.sml_is_deleted = false
         AND (s.company_id IS NULL OR sml.sml_company_id = s.company_id)
         AND (s.branch_id  IS NULL OR sml.sml_branch_id  = s.branch_id)
         AND (s.item_id    IS NULL OR sml.sml_item_id    = s.item_id)
       GROUP BY 1, 2, 3, 4, 5, 6
    ),
    bal AS (
      SELECT b.*
        FROM stock.stock_balance b, scope s
       WHERE b.sbl_is_deleted = false
         AND (s.company_id IS NULL OR b.sbl_company_id = s.company_id)
         AND (s.branch_id  IS NULL OR b.sbl_branch_id  = s.branch_id)
         AND (s.item_id    IS NULL OR b.sbl_item_id    = s.item_id)
    ),
    findings AS (
      -- 1. balance accumulators vs the ledger, both ways round
      SELECT 'BALANCE_QTY'::text AS kind,
             COALESCE(b.sbl_company_id, l.sml_company_id) AS company_id,
             COALESCE(b.sbl_branch_id,  l.sml_branch_id)  AS branch_id,
             COALESCE(b.sbl_item_id,    l.sml_item_id)    AS item_id,
             COALESCE(b.sbl_lot_id,     l.sml_lot_id)     AS lot_id,
             COALESCE(b.sbl_godown_id,  l.sml_godown_id)  AS godown_id,
             COALESCE(b.sbl_bucket,     l.sml_bucket)     AS bucket,
             COALESCE(b.sbl_in_qty + b.sbl_free_in_qty - b.sbl_out_qty - b.sbl_free_out_qty, 0)::text AS stored,
             COALESCE(l.in_qty + l.free_in_qty - l.out_qty - l.free_out_qty, 0)::text AS derived
        FROM bal b
        FULL OUTER JOIN led l
          ON l.sml_company_id = b.sbl_company_id AND l.sml_branch_id = b.sbl_branch_id
         AND l.sml_godown_id  = b.sbl_godown_id  AND l.sml_item_id   = b.sbl_item_id
         AND l.sml_lot_id     = b.sbl_lot_id     AND l.sml_bucket    = b.sbl_bucket
       WHERE l.sml_item_id IS NOT NULL
         AND (b.sbl_id IS NULL
              OR b.sbl_in_qty <> l.in_qty OR b.sbl_out_qty <> l.out_qty
              OR b.sbl_free_in_qty <> l.free_in_qty OR b.sbl_free_out_qty <> l.free_out_qty)
      UNION ALL
      -- 2. a balance row with no ledger behind it (an orphan a rebuild could not zero)
      SELECT 'BALANCE_ORPHAN', b.sbl_company_id, b.sbl_branch_id, b.sbl_item_id, b.sbl_lot_id,
             b.sbl_godown_id, b.sbl_bucket,
             (b.sbl_in_qty + b.sbl_free_in_qty - b.sbl_out_qty - b.sbl_free_out_qty)::text, '0'
        FROM bal b
       WHERE (b.sbl_in_qty <> 0 OR b.sbl_out_qty <> 0 OR b.sbl_free_in_qty <> 0 OR b.sbl_free_out_qty <> 0)
         AND NOT EXISTS (
               SELECT 1 FROM led l
                WHERE l.sml_company_id = b.sbl_company_id AND l.sml_branch_id = b.sbl_branch_id
                  AND l.sml_godown_id  = b.sbl_godown_id  AND l.sml_item_id   = b.sbl_item_id
                  AND l.sml_lot_id     = b.sbl_lot_id     AND l.sml_bucket    = b.sbl_bucket)
      UNION ALL
      -- 3. the branch item total vs the sum of its balances
      SELECT 'ITEM_COST_QTY', c.sic_company_id, c.sic_branch_id, c.sic_item_id, NULL, NULL, NULL,
             c.sic_total_qty::text, COALESCE(t.qty, 0)::text
        FROM stock.stock_item_cost c
        JOIN scope s ON (s.company_id IS NULL OR c.sic_company_id = s.company_id)
                    AND (s.branch_id  IS NULL OR c.sic_branch_id  = s.branch_id)
                    AND (s.item_id    IS NULL OR c.sic_item_id    = s.item_id)
        LEFT JOIN LATERAL (
          SELECT SUM(b.sbl_on_hand_qty) AS qty FROM bal b
           WHERE b.sbl_company_id = c.sic_company_id AND b.sbl_branch_id = c.sic_branch_id
             AND b.sbl_item_id = c.sic_item_id
        ) t ON true
       WHERE c.sic_is_deleted = false
         -- Exact (notes 92): both figures are Σ of the same ledger rows now
         -- that the item total is rebuilt rather than clamped and incremented.
         AND c.sic_total_qty <> COALESCE(t.qty, 0)
      UNION ALL
      -- 3b. the branch item VALUE vs the sum of its holdings' values. Each
      -- holding's value is its quantity × a six-place rate rounded to a paisa,
      -- so the two may differ by a paisa per holding plus the rate rounding
      -- over the quantity — anything more means a lot's cost and the item
      -- summary have parted. Only while every holding is non-negative: a
      -- negative holding's value is not a cost (notes 92 §3.1).
      SELECT 'ITEM_COST_VALUE', c.sic_company_id, c.sic_branch_id, c.sic_item_id, NULL, NULL, NULL,
             c.sic_total_value::text, COALESCE(t.value, 0)::text
        FROM stock.stock_item_cost c
        JOIN scope s ON (s.company_id IS NULL OR c.sic_company_id = s.company_id)
                    AND (s.branch_id  IS NULL OR c.sic_branch_id  = s.branch_id)
                    AND (s.item_id    IS NULL OR c.sic_item_id    = s.item_id)
        LEFT JOIN LATERAL (
          SELECT SUM(b.sbl_stock_value) AS value, count(*) AS holdings,
                 bool_and(b.sbl_on_hand_qty >= 0) AS non_negative
            FROM bal b
           WHERE b.sbl_company_id = c.sic_company_id AND b.sbl_branch_id = c.sic_branch_id
             AND b.sbl_item_id = c.sic_item_id
        ) t ON true
       WHERE c.sic_is_deleted = false
         AND c.sic_total_qty > 0
         AND COALESCE(t.non_negative, true)
         AND ABS(c.sic_total_value - COALESCE(t.value, 0))
             > 0.01 * (COALESCE(t.holdings, 0) + 1) + c.sic_total_qty * 0.000001
      UNION ALL
      -- 4. reserved vs open reservations
      SELECT 'RESERVED', b.sbl_company_id, b.sbl_branch_id, b.sbl_item_id, b.sbl_lot_id,
             b.sbl_godown_id, b.sbl_bucket, b.sbl_reserved_qty::text, COALESCE(r.qty, 0)::text
        FROM bal b
        LEFT JOIN LATERAL (
          SELECT SUM(x.srv_open_qty) AS qty FROM stock.stock_reservation x
           WHERE x.srv_company_id = b.sbl_company_id AND x.srv_branch_id = b.sbl_branch_id
             AND x.srv_godown_id  = b.sbl_godown_id  AND x.srv_item_id   = b.sbl_item_id
             AND x.srv_lot_id     = b.sbl_lot_id     AND x.srv_bucket    = b.sbl_bucket
             AND x.srv_is_deleted = false AND x.srv_status IN ('OPEN', 'PARTIAL')
        ) r ON true
       WHERE b.sbl_reserved_qty <> COALESCE(r.qty, 0)
      UNION ALL
      -- 5. in transit vs the transit rows still in flight
      SELECT 'TRANSIT_IN', b.sbl_company_id, b.sbl_branch_id, b.sbl_item_id, b.sbl_lot_id,
             b.sbl_godown_id, b.sbl_bucket, b.sbl_transit_in_qty::text, COALESCE(t.qty, 0)::text
        FROM bal b
        LEFT JOIN LATERAL (
          SELECT SUM(x.stt_sent_qty - x.stt_received_qty - x.stt_damage_qty) AS qty FROM stock.stock_transit x
           WHERE x.stt_company_id   = b.sbl_company_id AND x.stt_to_branch_id = b.sbl_branch_id
             AND x.stt_to_godown_id = b.sbl_godown_id  AND x.stt_item_id      = b.sbl_item_id
             AND x.stt_lot_id       = b.sbl_lot_id     AND x.stt_bucket       = b.sbl_bucket
             AND x.stt_is_deleted   = false AND x.stt_status IN ('IN_TRANSIT', 'PARTIAL')
        ) t ON true
       WHERE b.sbl_transit_in_qty <> COALESCE(t.qty, 0)
      UNION ALL
      -- 6. the lot's chain-wide total vs its balances
      SELECT 'LOT_TOTAL', slt.slt_company_id, NULL, slt.slt_item_id, slt.slt_id, NULL, NULL,
             slt.slt_total_on_hand::text, COALESCE(t.qty, 0)::text
        FROM stock.stock_lot slt
        JOIN scope s ON (s.company_id IS NULL OR slt.slt_company_id = s.company_id)
                    AND (s.item_id    IS NULL OR slt.slt_item_id    = s.item_id)
        LEFT JOIN LATERAL (
          SELECT SUM(b.sbl_on_hand_qty) AS qty FROM stock.stock_balance b
           WHERE b.sbl_lot_id = slt.slt_id AND b.sbl_is_deleted = false
        ) t ON true
       WHERE slt.slt_is_deleted = false
         AND ${branchId}::uuid IS NULL
         AND slt.slt_total_on_hand <> COALESCE(t.qty, 0)
    )
    SELECT kind, company_id AS "companyId", branch_id AS "branchId", item_id AS "itemId",
           lot_id AS "lotId", godown_id AS "godownId", bucket, stored, derived
      FROM findings
     ORDER BY kind, item_id, lot_id, godown_id
  `;
}
//# sourceMappingURL=stock-balance-assertion.js.map