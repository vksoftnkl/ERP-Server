"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.STOCK_LEDGER_SRC_MODULE = void 0;
exports.usesInProcessPosting = usesInProcessPosting;
exports.postStockVoucher = postStockVoucher;
exports.effectivePolicyLateral = effectivePolicyLateral;
exports.effectivePolicyCte = effectivePolicyCte;
exports.lotIdentityKeyColumns = lotIdentityKeyColumns;
exports.cancelStockVoucher = cancelStockVoucher;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const logger = new common_1.Logger('StockVoucherPosting');
const DIRECTION_IN = 1;
const DIRECTION_OUT = -1;
exports.STOCK_LEDGER_SRC_MODULE = 'STOCK';
function usesInProcessPosting(rules) {
    return rules.postFunction === 'stock.fn_svh_post';
}
function auditColumnActor(actor) {
    return actor === module_service_utils_1.DEFAULT_ACTOR ? null : actor;
}
function ledgerRowsOf({ svhId, accYear, reversal }) {
    return client_1.Prisma.sql `
             sml.sml_src_doc_id  = ${svhId}::uuid
         AND sml.sml_acc_year    = ${accYear}::bpchar
         AND sml.sml_is_deleted  = false
         AND sml.sml_is_reversal = ${reversal}::boolean
  `;
}
async function postStockVoucher(tx, params) {
    const { svhId, accYear, actor, postedOn } = params;
    const author = auditColumnActor(actor);
    await resolveLots(tx, params);
    await attachLotsToLines(tx, params);
    const rowsPosted = await writeLedger(tx, params);
    await applyLedgerRows(tx, { ...params, reversal: false });
    await tx.stockVoucher.update({
        where: { svhId_svhAccYear: { svhId, svhAccYear: accYear } },
        data: {
            svhStatus: 'POSTED',
            svhPostedOn: postedOn,
            svhPostedBy: author,
            svhVersionNo: { increment: 1 },
            svhModifiedOn: postedOn,
            svhModifiedBy: author,
        },
    });
    return rowsPosted;
}
async function applyLedgerRows(tx, params) {
    await applyBalances(tx, params);
    await applyItemCost(tx, params);
    await assertNegativeStockPolicy(tx, params);
    await refreshLotTotals(tx, params);
}
function effectivePolicyLateral(scope) {
    return client_1.Prisma.sql `
    LEFT JOIN LATERAL (
      SELECT p.*
        FROM stock.stock_track_policy p
       WHERE p.stp_is_active  = true
         AND p.stp_is_deleted = false
         AND ${scope.onDate} BETWEEN p.stp_effective_from AND p.stp_effective_to
         AND (p.stp_company_id IS NULL OR p.stp_company_id = ${scope.companyId})
         AND (p.stp_branch_id  IS NULL OR p.stp_branch_id  = ${scope.branchId})
         AND (
               (p.stp_scope = 'ITEM'    AND p.stp_scope_id = ${scope.itemId})
            OR (p.stp_scope = 'GROUP'   AND p.stp_scope_id = ${scope.itemGroupId})
            OR  p.stp_scope = 'COMPANY'
         )
       ORDER BY CASE
                  WHEN p.stp_scope = 'ITEM'  AND p.stp_branch_id IS NOT NULL THEN 1
                  WHEN p.stp_scope = 'ITEM'                                  THEN 2
                  WHEN p.stp_scope = 'GROUP' AND p.stp_branch_id IS NOT NULL THEN 3
                  WHEN p.stp_scope = 'GROUP'                                 THEN 4
                  WHEN p.stp_branch_id IS NOT NULL                           THEN 5
                  ELSE 6
                END,
                (p.stp_company_id IS NULL),
                p.stp_effective_from DESC
       LIMIT 1
    ) stp ON true
  `;
}
function effectivePolicyCte() {
    return client_1.Prisma.sql `
    policy AS (
      SELECT line.svi_id,
             COALESCE(stp.stp_track_batch,      false) AS track_batch,
             COALESCE(stp.stp_track_mrp,        false) AS track_mrp,
             COALESCE(stp.stp_track_sale_price, false) AS track_sale_price,
             COALESCE(stp.stp_track_expiry,     false) AS track_expiry,
             COALESCE(stp.stp_track_serial,     false) AS track_serial,
             COALESCE(stp.stp_track_supplier,   false) AS track_supplier
        FROM line
        JOIN inventory.item_master itm ON itm.item_id = line.svi_item_id
        ${effectivePolicyLateral({
        companyId: client_1.Prisma.raw('line.svh_company_id'),
        branchId: client_1.Prisma.raw('line.svh_branch_id'),
        itemId: client_1.Prisma.raw('line.svi_item_id'),
        itemGroupId: client_1.Prisma.raw('itm.item_group_id'),
        onDate: client_1.Prisma.raw('line.svh_doc_date'),
    })}
    )
  `;
}
function lotIdentityKeyColumns() {
    return client_1.Prisma.sql `
             COALESCE(CASE WHEN policy.track_batch      THEN NULLIF(upper(btrim(line.svi_batch_no)), '') END, '~')   AS key_batch,
             COALESCE(CASE WHEN policy.track_mrp        THEN line.svi_mrp         END, -1)                             AS key_mrp,
             COALESCE(CASE WHEN policy.track_sale_price THEN line.svi_sale_price  END, -1)                             AS key_sp,
             COALESCE(CASE WHEN policy.track_expiry     THEN line.svi_expiry_date END, DATE '0001-01-01')              AS key_expiry,
             COALESCE(CASE WHEN policy.track_serial     THEN NULLIF(upper(btrim(line.svi_serial_no)), '') END, '~')   AS key_serial,
             COALESCE(CASE WHEN policy.track_supplier   THEN line.svi_supplier_id END,
                      '00000000-0000-0000-0000-000000000000'::uuid)                                                    AS key_supplier
  `;
}
function postingCte(svhId, accYear, isCount) {
    return client_1.Prisma.sql `
    doc AS (
      SELECT svh.svh_id,
             svh.svh_acc_year,
             svh.svh_company_id,
             svh.svh_branch_id,
             svh.svh_tenant_id,
             svh.svh_doc_date,
             svh.svh_doc_datetime,
             svh.svh_refno,
             svh.svh_reason_id,
             svh.svh_supplier_id,
             svh.svh_rate_source
        FROM stock.stock_voucher svh
       WHERE svh.svh_id       = ${svhId}::uuid
         AND svh.svh_acc_year = ${accYear}::bpchar
    ),
    line AS (
      SELECT svi.*, doc.svh_doc_date, doc.svh_doc_datetime, doc.svh_rate_source,
             doc.svh_company_id, doc.svh_branch_id, doc.svh_tenant_id,
             doc.svh_refno, doc.svh_reason_id, doc.svh_supplier_id
        FROM stock.stock_voucher_item svi
        JOIN doc ON doc.svh_id = svi.svi_voucher_id AND doc.svh_acc_year = svi.svi_acc_year
       WHERE svi.svi_is_deleted = false
    ),
    ${effectivePolicyCte()},
    keyed AS (
      SELECT line.*,
             policy.track_batch, policy.track_mrp, policy.track_sale_price,
             policy.track_expiry, policy.track_serial, policy.track_supplier,
             -- What the lot STORES: the original spelling, trimmed. The key
             -- below folds case; the label on the carton is kept as read.
             CASE WHEN policy.track_batch      THEN NULLIF(btrim(line.svi_batch_no), '') END  AS lot_batch_no,
             CASE WHEN policy.track_mrp        THEN line.svi_mrp         END                   AS lot_mrp,
             CASE WHEN policy.track_sale_price THEN line.svi_sale_price  END                   AS lot_sale_price,
             CASE WHEN policy.track_expiry     THEN line.svi_expiry_date END                   AS lot_expiry_date,
             CASE WHEN policy.track_serial     THEN NULLIF(btrim(line.svi_serial_no), '') END  AS lot_serial_no,
             CASE WHEN policy.track_supplier   THEN line.svi_supplier_id END                   AS lot_supplier_id,
             ${lotIdentityKeyColumns()},
             -- 'B/M/S/E/R/P' in a fixed order, 'N' when the policy tracks
             -- nothing. Stamped on the lot so a policy change tomorrow cannot
             -- make today's lots unreadable.
             COALESCE(NULLIF(
               CASE WHEN policy.track_batch      THEN 'B' ELSE '' END ||
               CASE WHEN policy.track_mrp        THEN 'M' ELSE '' END ||
               CASE WHEN policy.track_sale_price THEN 'S' ELSE '' END ||
               CASE WHEN policy.track_expiry     THEN 'E' ELSE '' END ||
               CASE WHEN policy.track_serial     THEN 'R' ELSE '' END ||
               CASE WHEN policy.track_supplier   THEN 'P' ELSE '' END,
             ''), 'N')                                                                          AS track_signature,
             -- THE VARIANCE IS THE MOVEMENT ON A COUNT. svi_diff_qty is
             -- GENERATED (counted - book) and is the only quantity a count
             -- line moves; svi_qty is 0 on every count line by construction.
             CASE WHEN ${isCount}::boolean
                  THEN ABS(COALESCE(line.svi_diff_qty, 0))
                  ELSE line.svi_base_qty END                                                    AS move_base_qty,
             CASE WHEN ${isCount}::boolean
                  THEN ABS(COALESCE(line.svi_diff_qty, 0))
                  ELSE line.svi_qty      END                                                    AS move_qty,
             CASE WHEN ${isCount}::boolean THEN 0 ELSE line.svi_free_qty      END               AS move_free_qty,
             CASE WHEN ${isCount}::boolean THEN 0 ELSE line.svi_free_base_qty END               AS move_free_base_qty
        FROM line
        JOIN policy ON policy.svi_id = line.svi_id
    ),
    costed AS (
      SELECT keyed.*,
             -- Only a zero falls through — see the note on this function.
             COALESCE(NULLIF(keyed.svi_cost_rate, 0),
                      CASE keyed.svh_rate_source
                        WHEN 'AVG_COST'      THEN sic.sic_avg_cost_rate
                        WHEN 'LAST_PURCHASE' THEN sic.sic_last_purchase_rate
                        ELSE NULL
                      END,
                      0)                                     AS line_cost_rate,
             COALESCE(NULLIF(keyed.svi_cost_rate_wot, 0),
                      CASE keyed.svh_rate_source
                        WHEN 'AVG_COST'      THEN sic.sic_avg_cost_rate_wot
                        ELSE NULL
                      END,
                      0)                                     AS line_cost_rate_wot
        FROM keyed
        LEFT JOIN stock.stock_item_cost sic
               ON sic.sic_company_id = keyed.svh_company_id
              AND sic.sic_branch_id  = keyed.svh_branch_id
              AND sic.sic_item_id    = keyed.svi_item_id
              AND sic.sic_is_deleted = false
    )
  `;
}
async function resolveLots(tx, { rules, svhId, accYear, actor }) {
    const isCount = rules.quantityMode === 'COUNT';
    await tx.$executeRaw `
    WITH ${postingCte(svhId, accYear, isCount)}
    INSERT INTO stock.stock_lot (
      slt_company_id, slt_tenant_id, slt_item_id, slt_base_uom_id,
      slt_batch_no, slt_mrp, slt_sale_price, slt_mfg_date, slt_expiry_date,
      slt_serial_no, slt_supplier_id, slt_track_signature,
      slt_first_inward_date, slt_first_inward_branch,
      slt_inward_src_module, slt_inward_src_doc_type, slt_inward_src_doc_id,
      slt_inward_src_acc_year, slt_inward_refno,
      slt_purchase_rate, slt_cost_rate, slt_cost_rate_wot, slt_landed_rate, slt_tax_rate,
      slt_created_by
    )
    SELECT DISTINCT ON (c.svh_company_id, c.svi_item_id, c.key_batch, c.key_mrp,
                        c.key_sp, c.key_expiry, c.key_serial, c.key_supplier)
           c.svh_company_id, c.svh_tenant_id, c.svi_item_id, c.svi_base_uom_id,
           c.lot_batch_no, c.lot_mrp, c.lot_sale_price, c.svi_mfg_date, c.lot_expiry_date,
           c.lot_serial_no, c.lot_supplier_id, c.track_signature,
           -- The CHAIN's ageing anchor, from the document's own date rather than
           -- today's: a March opening keyed in April is March-old stock.
           c.svh_doc_date, c.svh_branch_id,
           ${exports.STOCK_LEDGER_SRC_MODULE}, ${rules.voucherType}, c.svi_voucher_id,
           c.svi_acc_year, c.svh_refno,
           c.line_cost_rate, c.line_cost_rate, c.line_cost_rate_wot, c.svi_landed_rate, c.svi_tax_perc,
           ${auditColumnActor(actor)}
      FROM costed c
     ORDER BY c.svh_company_id, c.svi_item_id, c.key_batch, c.key_mrp,
              c.key_sp, c.key_expiry, c.key_serial, c.key_supplier,
              c.svi_line_no, c.svi_split_no
    ON CONFLICT DO NOTHING
  `;
}
async function attachLotsToLines(tx, { rules, svhId, accYear, postedOn, actor }) {
    const isCount = rules.quantityMode === 'COUNT';
    await tx.$executeRaw `
    WITH ${postingCte(svhId, accYear, isCount)}
    UPDATE stock.stock_voucher_item svi
       SET svi_lot_id        = COALESCE(svi.svi_lot_id, slt.slt_id),
           svi_cost_rate     = c.line_cost_rate,
           svi_cost_rate_wot = c.line_cost_rate_wot,
           svi_modified_on   = ${postedOn},
           svi_modified_by   = ${auditColumnActor(actor)}
      FROM costed c
      JOIN stock.stock_lot slt
        ON slt.slt_company_id  = c.svh_company_id
       AND slt.slt_item_id     = c.svi_item_id
       AND slt.slt_key_batch   = c.key_batch
       AND slt.slt_key_mrp     = c.key_mrp
       AND slt.slt_key_sp      = c.key_sp
       AND slt.slt_key_expiry  = c.key_expiry
       AND slt.slt_key_serial  = c.key_serial
       AND slt.slt_key_supplier = c.key_supplier
       AND slt.slt_is_deleted  = false
     WHERE svi.svi_id       = c.svi_id
       AND svi.svi_acc_year = c.svi_acc_year
  `;
}
async function writeLedger(tx, { rules, svhId, accYear, actor, postedOn }) {
    const isCount = rules.quantityMode === 'COUNT';
    const [plusTxnType, minusTxnType] = isCount
        ? [rules.ledgerTxnTypes[0], rules.ledgerTxnTypes[1] ?? rules.ledgerTxnTypes[0]]
        : [rules.ledgerTxnTypes[0], rules.ledgerTxnTypes[0]];
    const direction = rules.isInward ? DIRECTION_IN : DIRECTION_OUT;
    return tx.$executeRaw `
    WITH ${postingCte(svhId, accYear, isCount)}
    INSERT INTO stock.stock_ledger (
      sml_company_id, sml_branch_id, sml_tenant_id, sml_acc_year, sml_godown_id,
      sml_item_id, sml_lot_id, sml_uom_id, sml_base_uom_id, sml_to_base_factor,
      sml_src_module, sml_src_doc_type, sml_src_doc_id, sml_src_acc_year, sml_src_refno,
      sml_line_no, sml_split_no,
      sml_txn_type, sml_direction, sml_bucket,
      sml_doc_date, sml_doc_datetime, sml_posted_on,
      sml_qty, sml_base_qty, sml_free_qty, sml_free_base_qty, sml_weight_qty,
      sml_cost_rate, sml_cost_value, sml_cost_rate_wot, sml_cost_value_wot,
      sml_landed_rate, sml_landed_value,
      sml_mrp, sml_batch_no, sml_expiry_date,
      sml_reason_id, sml_created_by
    )
    SELECT c.svh_company_id, c.svh_branch_id, c.svh_tenant_id, c.svi_acc_year, c.svi_godown_id,
           c.svi_item_id, svi.svi_lot_id, c.svi_uom_id, c.svi_base_uom_id, c.svi_to_base_factor,
           ${exports.STOCK_LEDGER_SRC_MODULE}, ${rules.voucherType}, c.svi_voucher_id, c.svi_acc_year, c.svh_refno,
           c.svi_line_no, c.svi_split_no,
           CASE WHEN ${isCount}::boolean
                THEN CASE WHEN COALESCE(c.svi_diff_qty, 0) >= 0 THEN ${plusTxnType} ELSE ${minusTxnType} END
                ELSE ${plusTxnType} END,
           CASE WHEN ${isCount}::boolean
                THEN CASE WHEN COALESCE(c.svi_diff_qty, 0) >= 0 THEN ${DIRECTION_IN} ELSE ${DIRECTION_OUT} END
                ELSE ${direction} END,
           c.svi_bucket,
           c.svh_doc_date, c.svh_doc_datetime, ${postedOn},
           c.move_qty, c.move_base_qty, c.move_free_qty, c.move_free_base_qty, c.svi_weight_qty,
           c.line_cost_rate,     ROUND(c.line_cost_rate     * (c.move_base_qty + c.move_free_base_qty), 2),
           c.line_cost_rate_wot, ROUND(c.line_cost_rate_wot * (c.move_base_qty + c.move_free_base_qty), 2),
           c.svi_landed_rate,    ROUND(c.svi_landed_rate    * (c.move_base_qty + c.move_free_base_qty), 2),
           c.svi_mrp, c.svi_batch_no, c.svi_expiry_date,
           COALESCE(c.svi_reason_id, c.svh_reason_id), ${auditColumnActor(actor)}
      FROM costed c
      JOIN stock.stock_voucher_item svi
        ON svi.svi_id = c.svi_id AND svi.svi_acc_year = c.svi_acc_year
     WHERE (c.move_base_qty + c.move_free_base_qty) <> 0
  `;
}
async function applyBalances(tx, params) {
    const { actor, postedOn } = params;
    await tx.$executeRaw `
    WITH moved AS (
      SELECT sml.sml_company_id, sml.sml_branch_id, sml.sml_tenant_id,
             sml.sml_godown_id, sml.sml_item_id, sml.sml_lot_id,
             sml.sml_base_uom_id, sml.sml_bucket,
             SUM(CASE WHEN sml.sml_direction > 0 THEN sml.sml_base_qty      ELSE 0 END) AS in_qty,
             SUM(CASE WHEN sml.sml_direction < 0 THEN sml.sml_base_qty      ELSE 0 END) AS out_qty,
             SUM(CASE WHEN sml.sml_direction > 0 THEN sml.sml_free_base_qty ELSE 0 END) AS free_in_qty,
             SUM(CASE WHEN sml.sml_direction < 0 THEN sml.sml_free_base_qty ELSE 0 END) AS free_out_qty,
             MAX(sml.sml_doc_date) FILTER (WHERE sml.sml_direction > 0)                 AS last_in_date,
             MAX(sml.sml_doc_date) FILTER (WHERE sml.sml_direction < 0)                 AS last_out_date,
             MIN(sml.sml_doc_date) FILTER (WHERE sml.sml_direction > 0)                 AS first_in_date
        FROM stock.stock_ledger sml
       WHERE ${ledgerRowsOf(params)}
       GROUP BY 1, 2, 3, 4, 5, 6, 7, 8
    )
    INSERT INTO stock.stock_balance (
      sbl_company_id, sbl_branch_id, sbl_tenant_id, sbl_godown_id, sbl_item_id,
      sbl_lot_id, sbl_base_uom_id, sbl_bucket,
      sbl_in_qty, sbl_out_qty, sbl_free_in_qty, sbl_free_out_qty,
      sbl_first_in_date, sbl_last_in_date, sbl_last_out_date,
      sbl_batch_no, sbl_mrp, sbl_sale_price, sbl_expiry_date, sbl_supplier_id,
      sbl_created_by
    )
    SELECT m.sml_company_id, m.sml_branch_id, m.sml_tenant_id, m.sml_godown_id, m.sml_item_id,
           m.sml_lot_id, m.sml_base_uom_id, m.sml_bucket,
           m.in_qty, m.out_qty, m.free_in_qty, m.free_out_qty,
           m.first_in_date, m.last_in_date, m.last_out_date,
           slt.slt_batch_no, slt.slt_mrp, slt.slt_sale_price, slt.slt_expiry_date, slt.slt_supplier_id,
           ${auditColumnActor(actor)}
      FROM moved m
      JOIN stock.stock_lot slt ON slt.slt_id = m.sml_lot_id
    ON CONFLICT (sbl_company_id, sbl_branch_id, sbl_godown_id, sbl_item_id, sbl_lot_id, sbl_bucket)
    WHERE sbl_is_deleted = false
    DO UPDATE SET
      sbl_in_qty        = stock.stock_balance.sbl_in_qty        + EXCLUDED.sbl_in_qty,
      sbl_out_qty       = stock.stock_balance.sbl_out_qty       + EXCLUDED.sbl_out_qty,
      sbl_free_in_qty   = stock.stock_balance.sbl_free_in_qty   + EXCLUDED.sbl_free_in_qty,
      sbl_free_out_qty  = stock.stock_balance.sbl_free_out_qty  + EXCLUDED.sbl_free_out_qty,
      -- The FIRST inward on this shelf never moves once set; the last two do.
      sbl_first_in_date = LEAST(stock.stock_balance.sbl_first_in_date, EXCLUDED.sbl_first_in_date),
      sbl_last_in_date  = GREATEST(stock.stock_balance.sbl_last_in_date, EXCLUDED.sbl_last_in_date),
      sbl_last_out_date = GREATEST(stock.stock_balance.sbl_last_out_date, EXCLUDED.sbl_last_out_date),
      sbl_batch_no      = EXCLUDED.sbl_batch_no,
      sbl_mrp           = EXCLUDED.sbl_mrp,
      sbl_sale_price    = EXCLUDED.sbl_sale_price,
      sbl_expiry_date   = EXCLUDED.sbl_expiry_date,
      sbl_supplier_id   = EXCLUDED.sbl_supplier_id,
      sbl_row_version   = stock.stock_balance.sbl_row_version + 1,
      sbl_modified_on   = ${postedOn},
      sbl_modified_by   = ${auditColumnActor(actor)}
  `;
}
async function applyItemCost(tx, params) {
    const { actor, postedOn } = params;
    await tx.$queryRaw `
    SELECT count(pg_advisory_xact_lock(hashtextextended(
             t.sml_company_id::text || ':' || t.sml_branch_id::text || ':' || t.sml_item_id::text, 0)))::int AS locked
      FROM (
            SELECT DISTINCT sml.sml_company_id, sml.sml_branch_id, sml.sml_item_id
              FROM stock.stock_ledger sml
             WHERE ${ledgerRowsOf(params)}
             ORDER BY 1, 2, 3
           ) t
  `;
    await tx.$executeRaw `
    WITH moves AS (
      SELECT sml.sml_company_id, sml.sml_branch_id, sml.sml_item_id,
             (array_agg(sml.sml_base_uom_id ORDER BY sml.sml_line_no, sml.sml_split_no))[1]                AS base_uom_id,
             SUM(CASE WHEN sml.sml_direction > 0 THEN sml.sml_base_qty + sml.sml_free_base_qty ELSE 0 END) AS qty_in,
             SUM(CASE WHEN sml.sml_direction < 0 THEN sml.sml_base_qty + sml.sml_free_base_qty ELSE 0 END) AS qty_out,
             SUM(CASE WHEN sml.sml_direction > 0 THEN sml.sml_cost_value     ELSE 0 END)                    AS value_in,
             SUM(CASE WHEN sml.sml_direction > 0 THEN sml.sml_cost_value_wot ELSE 0 END)                    AS value_in_wot,
             COALESCE(MAX(sml.sml_cost_rate) FILTER (WHERE sml.sml_direction > 0), 0)                       AS max_in_rate,
             -- The document's LAST inward line, by line order, is its "last purchase".
             (array_agg(sml.sml_cost_rate     ORDER BY sml.sml_line_no DESC, sml.sml_split_no DESC)
                 FILTER (WHERE sml.sml_direction > 0))[1]                                                   AS last_in_rate,
             (array_agg(sml.sml_cost_rate_wot ORDER BY sml.sml_line_no DESC, sml.sml_split_no DESC)
                 FILTER (WHERE sml.sml_direction > 0))[1]                                                   AS last_in_rate_wot,
             (array_agg(sml.sml_doc_date      ORDER BY sml.sml_line_no DESC, sml.sml_split_no DESC)
                 FILTER (WHERE sml.sml_direction > 0))[1]                                                   AS last_in_date,
             -- The document's last OUTWARD line: the rate a fresh row takes
             -- when nothing was received (the trigger's seed from an outward).
             (array_agg(sml.sml_cost_rate     ORDER BY sml.sml_line_no DESC, sml.sml_split_no DESC)
                 FILTER (WHERE sml.sml_direction < 0))[1]                                                   AS last_out_rate,
             (array_agg(sml.sml_cost_rate_wot ORDER BY sml.sml_line_no DESC, sml.sml_split_no DESC)
                 FILTER (WHERE sml.sml_direction < 0))[1]                                                   AS last_out_rate_wot,
             -- An outward SALE stamps the last sale, from the DOCUMENT rate.
             (array_agg(sml.sml_doc_rate      ORDER BY sml.sml_line_no DESC, sml.sml_split_no DESC)
                 FILTER (WHERE sml.sml_direction < 0 AND sml.sml_txn_type = 'SALE'))[1]                     AS last_sale_rate,
             (array_agg(sml.sml_doc_date      ORDER BY sml.sml_line_no DESC, sml.sml_split_no DESC)
                 FILTER (WHERE sml.sml_direction < 0 AND sml.sml_txn_type = 'SALE'))[1]                     AS last_sale_date
        FROM stock.stock_ledger sml
       WHERE ${ledgerRowsOf(params)}
       GROUP BY 1, 2, 3
    ),
    cur AS (
      SELECT c.sic_company_id, c.sic_branch_id, c.sic_item_id,
             c.sic_total_qty, c.sic_total_value, c.sic_total_value_wot,
             c.sic_avg_cost_rate, c.sic_avg_cost_rate_wot, c.sic_max_cost_rate,
             c.sic_last_purchase_rate, c.sic_last_purchase_date,
             c.sic_last_sale_rate, c.sic_last_sale_date
        FROM stock.stock_item_cost c
        JOIN moves m
          ON m.sml_company_id = c.sic_company_id
         AND m.sml_branch_id  = c.sic_branch_id
         AND m.sml_item_id    = c.sic_item_id
       WHERE c.sic_is_deleted = false
         FOR UPDATE OF c
    ),
    step AS (
      -- Outwards first, at the average the branch carried before this document.
      -- A fresh row swallows them: it never starts below zero.
      SELECT m.*,
             (c.sic_company_id IS NOT NULL)                                                                AS has_row,
             CASE WHEN c.sic_company_id IS NOT NULL THEN c.sic_total_qty - m.qty_out ELSE 0 END + m.qty_in AS new_qty,
             GREATEST(COALESCE(c.sic_total_value, 0)
                      - ROUND(m.qty_out * COALESCE(c.sic_avg_cost_rate, 0), 2), 0) + m.value_in          AS new_value,
             GREATEST(COALESCE(c.sic_total_value_wot, 0)
                      - ROUND(m.qty_out * COALESCE(c.sic_avg_cost_rate_wot, 0), 2), 0) + m.value_in_wot  AS new_value_wot,
             COALESCE(c.sic_avg_cost_rate, 0)                                                              AS old_avg,
             COALESCE(c.sic_avg_cost_rate_wot, 0)                                                          AS old_avg_wot,
             GREATEST(COALESCE(c.sic_max_cost_rate, 0), m.max_in_rate)                                     AS new_max,
             CASE WHEN m.qty_in > 0 THEN m.last_in_rate ELSE c.sic_last_purchase_rate END                  AS new_last_rate,
             CASE WHEN m.qty_in > 0 THEN m.last_in_date ELSE c.sic_last_purchase_date END                  AS new_last_date,
             COALESCE(m.last_sale_rate, c.sic_last_sale_rate, 0)                                           AS new_sale_rate,
             COALESCE(m.last_sale_date, c.sic_last_sale_date)                                              AS new_sale_date
        FROM moves m
        LEFT JOIN cur c
               ON c.sic_company_id = m.sml_company_id
              AND c.sic_branch_id  = m.sml_branch_id
              AND c.sic_item_id    = m.sml_item_id
    ),
    next AS (
      -- Then inwards re-average. Quantity at or below zero keeps a rate: the
      -- document's last inward if it had one, otherwise the rate as it stood —
      -- and a fresh row with nothing received takes its outward's own cost.
      SELECT step.*,
             CASE WHEN step.new_qty > 0 THEN ROUND(step.new_value     / step.new_qty, 6)
                  WHEN step.qty_in  > 0 THEN step.last_in_rate
                  WHEN NOT step.has_row THEN COALESCE(step.last_out_rate, 0)
                  ELSE step.old_avg END                                                                    AS new_avg,
             CASE WHEN step.new_qty > 0 THEN ROUND(step.new_value_wot / step.new_qty, 6)
                  WHEN step.qty_in  > 0 THEN step.last_in_rate_wot
                  WHEN NOT step.has_row THEN COALESCE(step.last_out_rate_wot, 0)
                  ELSE step.old_avg_wot END                                                                AS new_avg_wot
        FROM step
    )
    MERGE INTO stock.stock_item_cost c
    USING next n
       ON c.sic_company_id = n.sml_company_id
      AND c.sic_branch_id  = n.sml_branch_id
      AND c.sic_item_id    = n.sml_item_id
      AND c.sic_is_deleted = false
    WHEN MATCHED THEN UPDATE SET
         sic_total_qty          = n.new_qty,
         sic_total_value        = n.new_value,
         sic_total_value_wot    = n.new_value_wot,
         sic_avg_cost_rate      = n.new_avg,
         sic_avg_cost_rate_wot  = n.new_avg_wot,
         sic_max_cost_rate      = n.new_max,
         sic_last_purchase_rate = COALESCE(n.new_last_rate, 0),
         sic_last_purchase_date = n.new_last_date,
         sic_last_sale_rate     = n.new_sale_rate,
         sic_last_sale_date     = n.new_sale_date,
         sic_row_version        = c.sic_row_version + 1,
         sic_modified_on        = ${postedOn},
         sic_modified_by        = ${auditColumnActor(actor)}
    WHEN NOT MATCHED THEN INSERT (
         sic_company_id, sic_branch_id, sic_item_id, sic_base_uom_id,
         sic_total_qty, sic_total_value, sic_total_value_wot,
         sic_avg_cost_rate, sic_avg_cost_rate_wot, sic_max_cost_rate,
         sic_last_purchase_rate, sic_last_purchase_date,
         sic_last_sale_rate, sic_last_sale_date, sic_created_by)
       VALUES (
         n.sml_company_id, n.sml_branch_id, n.sml_item_id, n.base_uom_id,
         n.new_qty, n.new_value, n.new_value_wot,
         n.new_avg, n.new_avg_wot, n.new_max,
         COALESCE(n.new_last_rate, 0), n.new_last_date,
         n.new_sale_rate, n.new_sale_date, ${auditColumnActor(actor)})
  `;
    await tx.$executeRaw `
    WITH touched AS (
      SELECT DISTINCT sml.sml_company_id, sml.sml_branch_id, sml.sml_item_id
        FROM stock.stock_ledger sml
       WHERE ${ledgerRowsOf(params)}
    )
    UPDATE stock.stock_balance b
       SET sbl_avg_cost_rate     = c.sic_avg_cost_rate,
           sbl_avg_cost_rate_wot = c.sic_avg_cost_rate_wot,
           sbl_stock_value       = ROUND(b.sbl_on_hand_qty * c.sic_avg_cost_rate,     2),
           sbl_stock_value_wot   = ROUND(b.sbl_on_hand_qty * c.sic_avg_cost_rate_wot, 2)
      FROM touched t
      JOIN stock.stock_item_cost c
        ON c.sic_company_id = t.sml_company_id
       AND c.sic_branch_id  = t.sml_branch_id
       AND c.sic_item_id    = t.sml_item_id
       AND c.sic_is_deleted = false
     WHERE b.sbl_company_id = c.sic_company_id
       AND b.sbl_branch_id  = c.sic_branch_id
       AND b.sbl_item_id    = c.sic_item_id
       AND b.sbl_is_deleted = false
  `;
}
async function assertNegativeStockPolicy(tx, params) {
    const { rules, svhId } = params;
    const holdings = await tx.$queryRaw `
    WITH touched AS (
      SELECT DISTINCT sml.sml_company_id, sml.sml_branch_id, sml.sml_godown_id,
             sml.sml_item_id, sml.sml_lot_id, sml.sml_bucket, sml.sml_doc_date
        FROM stock.stock_ledger sml
       WHERE ${ledgerRowsOf(params)}
    )
    SELECT itm.item_name_en                             AS "itemName",
           slt.slt_batch_no                             AS "batchNo",
           gdl.gdl_name                                 AS "godownName",
           sbl.sbl_on_hand_qty::text                    AS "onHand",
           COALESCE(stp.stp_allow_negative, 'ALLOW')    AS "allowNegative"
      FROM touched t
      JOIN stock.stock_balance sbl
        ON sbl.sbl_company_id = t.sml_company_id
       AND sbl.sbl_branch_id  = t.sml_branch_id
       AND sbl.sbl_godown_id  = t.sml_godown_id
       AND sbl.sbl_item_id    = t.sml_item_id
       AND sbl.sbl_lot_id     = t.sml_lot_id
       AND sbl.sbl_bucket     = t.sml_bucket
       AND sbl.sbl_is_deleted = false
      JOIN inventory.item_master itm ON itm.item_id = t.sml_item_id
      JOIN stock.stock_lot slt        ON slt.slt_id  = t.sml_lot_id
      LEFT JOIN inventory.godown_locations gdl ON gdl.gdl_id = t.sml_godown_id
      ${effectivePolicyLateral({
        companyId: client_1.Prisma.raw('t.sml_company_id'),
        branchId: client_1.Prisma.raw('t.sml_branch_id'),
        itemId: client_1.Prisma.raw('t.sml_item_id'),
        itemGroupId: client_1.Prisma.raw('itm.item_group_id'),
        onDate: client_1.Prisma.raw('t.sml_doc_date'),
    })}
     WHERE sbl.sbl_on_hand_qty < 0
       AND COALESCE(stp.stp_allow_negative, 'ALLOW') <> 'ALLOW'
     ORDER BY itm.item_name_en, slt.slt_batch_no
  `;
    const describe = (row) => `${row.itemName}${row.batchNo ? ` batch ${row.batchNo}` : ''}: stock would go negative ` +
        `(${row.onHand} on hand) in ${row.godownName ?? 'this godown'}`;
    for (const row of holdings) {
        if (row.allowNegative === 'WARN') {
            logger.warn(`${rules.displayName} ${svhId}: negative stock allowed under WARN — ${describe(row)}`);
        }
    }
    const blocked = holdings.filter((row) => row.allowNegative === 'BLOCK');
    if (blocked.length) {
        (0, module_service_utils_1.throwStockConflict)(`This ${rules.displayName.toLowerCase()} would drive stock negative — policy is BLOCK`, blocked.map((row) => ({ field: 'lines', message: `${describe(row)} — policy is BLOCK` })));
    }
}
async function refreshLotTotals(tx, params) {
    const { actor, postedOn } = params;
    await tx.$executeRaw `
    WITH touched AS (
      SELECT sml.sml_lot_id                AS lot_id,
             bool_or(sml.sml_direction > 0) AS had_in,
             bool_or(sml.sml_direction < 0) AS had_out
        FROM stock.stock_ledger sml
       WHERE ${ledgerRowsOf(params)}
       GROUP BY sml.sml_lot_id
    ),
    totals AS (
      SELECT t.lot_id, t.had_in, t.had_out,
             COALESCE(SUM(sbl.sbl_on_hand_qty), 0) AS on_hand
        FROM touched t
        LEFT JOIN stock.stock_balance sbl
               ON sbl.sbl_lot_id     = t.lot_id
              AND sbl.sbl_is_deleted = false
       GROUP BY t.lot_id, t.had_in, t.had_out
    ),
    verdict AS (
      SELECT totals.*,
             (totals.on_hand <= 0 AND totals.had_out) AS ends_empty
        FROM totals
    )
    UPDATE stock.stock_lot slt
       SET slt_total_on_hand = v.on_hand,
           slt_status        = CASE
                                 WHEN v.ends_empty AND slt.slt_status = 'ACTIVE' THEN 'CLOSED'
                                 WHEN v.had_in AND slt.slt_status = 'CLOSED' AND NOT v.ends_empty THEN 'ACTIVE'
                                 ELSE slt.slt_status
                               END,
           slt_closed_on     = CASE
                                 WHEN v.ends_empty AND slt.slt_status = 'ACTIVE' THEN ${postedOn}
                                 WHEN v.had_in AND slt.slt_status = 'CLOSED' AND NOT v.ends_empty THEN NULL
                                 ELSE slt.slt_closed_on
                               END,
           slt_row_version   = slt.slt_row_version + 1,
           slt_modified_on   = ${postedOn},
           slt_modified_by   = ${auditColumnActor(actor)}
      FROM verdict v
     WHERE slt.slt_id = v.lot_id
  `;
}
async function cancelStockVoucher(tx, params) {
    const { rules, svhId, accYear, actor, reason, cancelledOn } = params;
    const author = auditColumnActor(actor);
    await lockPostedHeader(tx, params);
    const rowsReversed = await writeReversalLedger(tx, params);
    await applyLedgerRows(tx, {
        rules,
        svhId,
        accYear,
        actor,
        postedOn: cancelledOn,
        reversal: true,
    });
    await tx.stockVoucher.update({
        where: { svhId_svhAccYear: { svhId, svhAccYear: accYear } },
        data: {
            svhStatus: 'CANCELLED',
            svhCancelledOn: cancelledOn,
            svhCancelledBy: author,
            svhCancelReason: reason.slice(0, 250),
            svhVersionNo: { increment: 1 },
            svhModifiedOn: cancelledOn,
            svhModifiedBy: author,
        },
    });
    return rowsReversed;
}
async function lockPostedHeader(tx, { rules, svhId, accYear }) {
    const [header] = await tx.$queryRaw `
    SELECT svh.svh_status AS status, svh.svh_refno AS refno
      FROM stock.stock_voucher svh
     WHERE svh.svh_id         = ${svhId}::uuid
       AND svh.svh_acc_year   = ${accYear}::bpchar
       AND svh.svh_is_deleted = false
       FOR UPDATE
  `;
    if (!header) {
        (0, module_service_utils_1.throwStockConflict)(`${rules.displayName} not found`, [
            {
                field: 'svhId',
                message: `${svhId} no longer exists in ${accYear}, so there is nothing to reverse.`,
            },
        ]);
    }
    if (header.status !== 'POSTED') {
        (0, module_service_utils_1.throwStockConflict)(`${rules.displayName} is ${header.status}`, [
            {
                field: 'svhId',
                message: header.status === 'CANCELLED'
                    ? `${header.refno} was already cancelled.`
                    : `${header.refno} is ${header.status}: only a POSTED ${rules.displayName.toLowerCase()} has ledger rows to reverse.`,
            },
        ]);
    }
}
async function writeReversalLedger(tx, { svhId, accYear, actor, reason, cancelledOn }) {
    return tx.$executeRaw `
    INSERT INTO stock.stock_ledger (
      sml_company_id, sml_branch_id, sml_tenant_id, sml_acc_year, sml_godown_id,
      sml_item_id, sml_lot_id, sml_uom_id, sml_base_uom_id, sml_to_base_factor,
      sml_src_module, sml_src_doc_type, sml_src_doc_id, sml_src_acc_year, sml_src_refno,
      sml_line_no, sml_split_no,
      sml_txn_type, sml_direction, sml_bucket,
      sml_doc_date, sml_doc_datetime, sml_posted_on,
      sml_qty, sml_base_qty, sml_free_qty, sml_free_base_qty, sml_weight_qty,
      sml_cost_rate, sml_cost_value, sml_cost_rate_wot, sml_cost_value_wot,
      sml_landed_rate, sml_landed_value,
      sml_doc_rate, sml_doc_rate_wot, sml_doc_amount_wot,
      sml_mrp, sml_batch_no, sml_expiry_date,
      sml_is_reversal, sml_reverses_id,
      sml_reason_id, sml_party_id, sml_narration, sml_created_by
    )
    SELECT sml.sml_company_id, sml.sml_branch_id, sml.sml_tenant_id, sml.sml_acc_year, sml.sml_godown_id,
           sml.sml_item_id, sml.sml_lot_id, sml.sml_uom_id, sml.sml_base_uom_id, sml.sml_to_base_factor,
           sml.sml_src_module, sml.sml_src_doc_type, sml.sml_src_doc_id, sml.sml_src_acc_year, sml.sml_src_refno,
           sml.sml_line_no, sml.sml_split_no,
           sml.sml_txn_type, -sml.sml_direction, sml.sml_bucket,
           sml.sml_doc_date, sml.sml_doc_datetime, ${cancelledOn},
           sml.sml_qty, sml.sml_base_qty, sml.sml_free_qty, sml.sml_free_base_qty, sml.sml_weight_qty,
           sml.sml_cost_rate, sml.sml_cost_value, sml.sml_cost_rate_wot, sml.sml_cost_value_wot,
           sml.sml_landed_rate, sml.sml_landed_value,
           sml.sml_doc_rate, sml.sml_doc_rate_wot, sml.sml_doc_amount_wot,
           sml.sml_mrp, sml.sml_batch_no, sml.sml_expiry_date,
           true, sml.sml_id,
           sml.sml_reason_id, sml.sml_party_id, ${reason}, ${auditColumnActor(actor)}
      FROM stock.stock_ledger sml
     WHERE sml.sml_src_doc_id  = ${svhId}::uuid
       AND sml.sml_acc_year    = ${accYear}::bpchar
       AND sml.sml_is_deleted  = false
       AND sml.sml_is_reversal = false
     ORDER BY sml.sml_line_no, sml.sml_split_no
  `;
}
//# sourceMappingURL=stock-voucher-posting.helper.js.map