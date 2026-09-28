"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.STOCK_LEDGER_SRC_MODULE = void 0;
exports.postStockVoucher = postStockVoucher;
exports.effectivePolicyLateral = effectivePolicyLateral;
exports.effectivePolicyCte = effectivePolicyCte;
exports.lotIdentityKeyColumns = lotIdentityKeyColumns;
exports.lineReasonJoin = lineReasonJoin;
exports.lineDirectionColumn = lineDirectionColumn;
exports.lotlessOutwardLine = lotlessOutwardLine;
exports.unreversedLedgerRow = unreversedLedgerRow;
exports.settleTransitShort = settleTransitShort;
exports.transitHoldingsOf = transitHoldingsOf;
exports.reservationHoldingsOf = reservationHoldingsOf;
exports.openReservationHoldings = openReservationHoldings;
exports.ensureBalanceRows = ensureBalanceRows;
exports.refreshReserved = refreshReserved;
exports.refreshTransitIn = refreshTransitIn;
exports.cancelStockVoucher = cancelStockVoucher;
exports.cancelDraftVoucher = cancelDraftVoucher;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const logger = new common_1.Logger('StockVoucherPosting');
const DIRECTION_IN = 1;
const DIRECTION_OUT = -1;
exports.STOCK_LEDGER_SRC_MODULE = 'STOCK';
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
const isTransferShape = (shape) => shape === 'TRANSFER_OUT' || shape === 'TRANSFER_IN';
async function postStockVoucher(tx, params) {
    const { rules, svhId, accYear, actor, postedOn } = params;
    const author = auditColumnActor(actor);
    const shape = rules.postShape;
    const header = await lockHeaderInStatus(tx, params, 'DRAFT');
    let transit = null;
    if (shape === 'TRANSFER_OUT') {
        transit = await assertDespatchable(tx, params, header);
    }
    else if (shape === 'TRANSFER_IN') {
        transit = await assertReceivable(tx, params, header);
    }
    else {
        if (rules.quantityMode === 'QTY' && (!rules.isInward || rules.lineDirection === 'REASON')) {
            await pickIssueLots(tx, params);
        }
        await resolveLots(tx, params);
    }
    await attachLotsToLines(tx, params);
    if (!isTransferShape(shape) && !params.ledgerSource) {
        await assertInwardCost(tx, params);
    }
    const rowsPosted = await writeLedger(tx, params);
    let transitRows = 0;
    let closedOut = null;
    let status = 'POSTED';
    if (shape === 'TRANSFER_OUT' && transit && !transit.sameBranch) {
        transitRows = await writeTransitRows(tx, params);
        await ensureBalanceRows(tx, transitHoldingsOf(svhId, accYear), actor);
        await refreshTransitIn(tx, transitHoldingsOf(svhId, accYear), actor, postedOn);
        status = 'IN_TRANSIT';
    }
    else if (shape === 'TRANSFER_IN' && transit) {
        const settled = await settleTransitRows(tx, params, transit);
        transitRows = settled.rows;
        closedOut = settled.closedOut;
        await refreshTransitIn(tx, transitHoldingsOf(transit.outId, transit.outAccYear), actor, postedOn);
    }
    await applyLedgerRows(tx, { ...params, reversal: false });
    await recomputeHeaderTotals(tx, params);
    await tx.stockVoucher.update({
        where: { svhId_svhAccYear: { svhId, svhAccYear: accYear } },
        data: {
            svhStatus: status,
            svhVersionNo: { increment: 1 },
            svhModifiedOn: postedOn,
            svhModifiedBy: author,
        },
    });
    return { rowsPosted, status, transitRows, closedOut };
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
             COALESCE(stp.stp_track_supplier,   false) AS track_supplier,
             COALESCE(stp.stp_issue_strategy,   'FEFO') AS issue_strategy
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
function lineReasonJoin() {
    return client_1.Prisma.sql `
          LEFT JOIN stock.stock_reason_master rsn
                 ON rsn.srm_id = COALESCE(line.svi_reason_id, line.svh_reason_id)
  `;
}
const ISSUE_TXN_TYPES = ['SAMPLE_ISSUE', 'GIFT_ISSUE', 'ADJUST_MINUS'];
function lineDirectionColumn(rules) {
    const docDirection = rules.quantityMode === 'COUNT' ? 0 : rules.isInward ? 1 : -1;
    const byReason = rules.lineDirection === 'REASON';
    return client_1.Prisma.sql `
             CASE WHEN ${byReason}::boolean
                  THEN COALESCE(line.svi_direction,
                                CASE rsn.srm_direction WHEN 'IN' THEN 1 WHEN 'OUT' THEN -1 END,
                                ${docDirection}::int)
                  ELSE ${docDirection}::int END                                                  AS line_direction,
             rsn.srm_allowed_txn_types                                                          AS reason_txn_types,
             rsn.srm_code                                                                       AS reason_code
  `;
}
function lineTxnTypeColumn(rules, alias) {
    const a = client_1.Prisma.raw(alias);
    const [plus, minus] = [rules.ledgerTxnTypes[0], rules.ledgerTxnTypes[1] ?? rules.ledgerTxnTypes[0]];
    if (rules.lineDirection !== 'REASON') {
        return client_1.Prisma.sql `${plus}::text AS line_txn_type`;
    }
    if (rules.voucherType === 'ADJUSTMENT') {
        return client_1.Prisma.sql `
             CASE WHEN ${a}.line_direction > 0 THEN 'ADJUST_PLUS' ELSE 'ADJUST_MINUS' END AS line_txn_type`;
    }
    if (rules.voucherType === 'ISSUE') {
        return client_1.Prisma.sql `
             CASE WHEN cardinality(${a}.reason_txn_types) = 1
                   AND ${a}.reason_txn_types[1] = ANY(${ISSUE_TXN_TYPES}::text[])
                  THEN ${a}.reason_txn_types[1]
                  ELSE 'ADJUST_MINUS' END                                                  AS line_txn_type`;
    }
    return client_1.Prisma.sql `CASE WHEN ${a}.line_direction > 0 THEN ${plus}::text ELSE ${minus}::text END AS line_txn_type`;
}
function lotlessOutwardLine() {
    return client_1.Prisma.sql `
             keyed.svi_lot_id IS NULL
         AND (
               (keyed.track_batch      AND COALESCE(keyed.svi_batch_no, '')  = '')
            OR (keyed.track_expiry     AND keyed.svi_expiry_date IS NULL)
            OR (keyed.track_mrp        AND keyed.svi_mrp         IS NULL)
            OR (keyed.track_sale_price AND keyed.svi_sale_price  IS NULL)
            OR (keyed.track_serial     AND COALESCE(keyed.svi_serial_no, '') = '')
            OR (keyed.track_supplier   AND keyed.svi_supplier_id IS NULL)
         )
  `;
}
function unreversedLedgerRow() {
    return client_1.Prisma.sql `
             sml.sml_is_deleted  = false
         AND sml.sml_is_reversal = false
         AND NOT EXISTS (
               SELECT 1
                 FROM stock.stock_ledger rev
                WHERE rev.sml_reverses_id = sml.sml_id
                  AND rev.sml_acc_year    = sml.sml_acc_year
                  AND rev.sml_is_reversal = true
                  AND rev.sml_is_deleted  = false)
  `;
}
function postingCte(svhId, accYear, rules) {
    const isCount = rules.quantityMode === 'COUNT';
    const shape = rules.postShape;
    const defaultRateSource = rules.defaultRateSource ?? (isTransferShape(shape) ? 'AVG_COST' : null);
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
             COALESCE(NULLIF(svh.svh_rate_source, ''), ${defaultRateSource}::varchar) AS svh_rate_source,
             svh.svh_from_godown_id,
             svh.svh_to_godown_id,
             svh.svh_to_branch_id,
             (svh.svh_to_branch_id IS NULL OR svh.svh_to_branch_id = svh.svh_branch_id) AS same_branch,
             svh.svh_link_src_doc_id,
             COALESCE(svh.svh_link_src_acc_year, svh.svh_acc_year) AS svh_link_src_acc_year
        FROM stock.stock_voucher svh
       WHERE svh.svh_id       = ${svhId}::uuid
         AND svh.svh_acc_year = ${accYear}::bpchar
    ),
    line AS (
      SELECT svi.*, doc.svh_doc_date, doc.svh_doc_datetime, doc.svh_rate_source,
             doc.svh_company_id, doc.svh_branch_id, doc.svh_tenant_id,
             doc.svh_refno, doc.svh_reason_id, doc.svh_supplier_id,
             doc.svh_to_godown_id, doc.svh_to_branch_id, doc.same_branch,
             doc.svh_link_src_doc_id, doc.svh_link_src_acc_year
        FROM stock.stock_voucher_item svi
        JOIN doc ON doc.svh_id = svi.svi_voucher_id AND doc.svh_acc_year = svi.svi_acc_year
       WHERE svi.svi_is_deleted = false
    ),
    ${effectivePolicyCte()},
    keyed AS (
      SELECT line.*,
             policy.track_batch, policy.track_mrp, policy.track_sale_price,
             policy.track_expiry, policy.track_serial, policy.track_supplier,
             policy.issue_strategy,
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
             CASE WHEN ${isCount}::boolean THEN 0 ELSE line.svi_free_base_qty END               AS move_free_base_qty,
             ${lineDirectionColumn(rules)}
        FROM line
        JOIN policy ON policy.svi_id = line.svi_id
        ${lineReasonJoin()}
    ),
    priced AS (
      SELECT keyed.*,
             ${lineTxnTypeColumn(rules, 'keyed')},
             stt.stt_id AS transit_id,
             CASE WHEN ${shape === 'TRANSFER_IN'}::boolean THEN COALESCE(stt.stt_cost_rate, 0)
                  -- AN OUTWARD LINE IS RELIEVED AT WHAT THE STOCK COST US — the
                  -- branch's moving average — whatever the document's rate
                  -- source says and whatever was keyed: a write-off, an issue
                  -- or a count shortage cannot value itself (physical plan
                  -- §3.3, adjustments plan §2). Only when the branch carries no
                  -- average yet does a keyed figure stand.
                  WHEN keyed.line_direction < 0
                    OR (${isCount}::boolean AND COALESCE(keyed.svi_diff_qty, 0) < 0)
                  THEN COALESCE(NULLIF(sic.sic_avg_cost_rate, 0), NULLIF(keyed.svi_cost_rate, 0), 0)
                  ELSE
             -- Only a zero falls through — see the note on this function.
             COALESCE(NULLIF(keyed.svi_cost_rate, 0),
                      CASE keyed.svh_rate_source
                        WHEN 'AVG_COST'      THEN sic.sic_avg_cost_rate
                        WHEN 'LAST_PURCHASE' THEN sic.sic_last_purchase_rate
                        WHEN 'LOT_COST'      THEN slc.slt_cost_rate
                        WHEN 'MRP'           THEN keyed.svi_mrp
                        ELSE NULL
                      END,
                      0) END                                 AS line_cost_rate,
             CASE WHEN ${shape === 'TRANSFER_IN'}::boolean THEN COALESCE(stt.stt_cost_rate_wot, 0)
                  WHEN keyed.line_direction < 0
                    OR (${isCount}::boolean AND COALESCE(keyed.svi_diff_qty, 0) < 0)
                  THEN COALESCE(NULLIF(sic.sic_avg_cost_rate_wot, 0), NULLIF(keyed.svi_cost_rate_wot, 0))
                  ELSE
             COALESCE(NULLIF(keyed.svi_cost_rate_wot, 0),
                      CASE keyed.svh_rate_source
                        WHEN 'AVG_COST'      THEN sic.sic_avg_cost_rate_wot
                        WHEN 'LOT_COST'      THEN slc.slt_cost_rate_wot
                        ELSE NULL
                      END) END                               AS stated_cost_rate_wot
        FROM keyed
        LEFT JOIN stock.stock_item_cost sic
               ON sic.sic_company_id = keyed.svh_company_id
              AND sic.sic_branch_id  = keyed.svh_branch_id
              AND sic.sic_item_id    = keyed.svi_item_id
              AND sic.sic_is_deleted = false
        -- LOT_COST: the lot the line names, or the one its identity resolves to.
        LEFT JOIN LATERAL (
          SELECT l.slt_cost_rate, l.slt_cost_rate_wot
            FROM stock.stock_lot l
           WHERE l.slt_is_deleted = false
             AND (
                   (keyed.svi_lot_id IS NOT NULL AND l.slt_id = keyed.svi_lot_id)
                OR (keyed.svi_lot_id IS NULL
                    AND l.slt_company_id  = keyed.svh_company_id
                    AND l.slt_item_id     = keyed.svi_item_id
                    AND l.slt_key_batch   = keyed.key_batch
                    AND l.slt_key_mrp     = keyed.key_mrp
                    AND l.slt_key_sp      = keyed.key_sp
                    AND l.slt_key_expiry  = keyed.key_expiry
                    AND l.slt_key_serial  = keyed.key_serial
                    AND l.slt_key_supplier = keyed.key_supplier)
             )
           LIMIT 1
        ) slc ON true
        -- TRANSFER_IN: the transit row this line receives against. The matcher
        -- is (out voucher, item, lot, destination godown); the bucket only
        -- breaks a tie, and the save refuses a two-bucket shipment anyway.
        LEFT JOIN LATERAL (
          SELECT t.stt_id, t.stt_cost_rate, t.stt_cost_rate_wot
            FROM stock.stock_transit t
           WHERE ${shape === 'TRANSFER_IN'}::boolean
             AND t.stt_out_voucher_id = keyed.svh_link_src_doc_id
             AND t.stt_out_acc_year   = keyed.svh_link_src_acc_year
             AND t.stt_item_id        = keyed.svi_item_id
             AND t.stt_lot_id         = keyed.svi_lot_id
             AND t.stt_to_godown_id   = keyed.svi_godown_id
             AND t.stt_is_deleted     = false
           ORDER BY (t.stt_bucket = keyed.svi_bucket) DESC
           LIMIT 1
        ) stt ON true
    ),
    costed AS (
      -- The without-tax cost, when nothing stated one: the with-tax cost net
      -- of the line's own tax rate (20 at 5% → 19.047619), as
      -- fn_sml_cost_default derived it. No tax rate means the two are equal.
      SELECT priced.*,
             COALESCE(priced.stated_cost_rate_wot,
                      ROUND(priced.line_cost_rate / (1 + COALESCE(priced.svi_tax_perc, 0) / 100), 6),
                      0)                                     AS line_cost_rate_wot
        FROM priced
    )
  `;
}
async function pickIssueLots(tx, params) {
    const { rules, svhId, accYear, actor, postedOn } = params;
    const author = auditColumnActor(actor);
    const lines = await tx.$queryRaw `
    WITH ${postingCte(svhId, accYear, rules)}
    SELECT keyed.svi_id, keyed.svi_line_no, keyed.svi_split_no, keyed.svi_item_id,
           itm.item_name_en AS item_name,
           keyed.svi_godown_id, keyed.svi_bucket, keyed.svi_base_qty, keyed.svi_free_base_qty,
           keyed.svi_to_base_factor, keyed.svh_company_id, keyed.svh_branch_id,
           keyed.issue_strategy,
           keyed.track_batch, keyed.track_mrp, keyed.track_sale_price,
           keyed.track_expiry, keyed.track_serial, keyed.track_supplier,
           keyed.key_batch, keyed.key_mrp, keyed.key_sp, keyed.key_expiry, keyed.key_serial, keyed.key_supplier
      FROM keyed
      JOIN inventory.item_master itm ON itm.item_id = keyed.svi_item_id
     WHERE keyed.line_direction < 0
       AND ${lotlessOutwardLine()}
       AND (keyed.svi_base_qty + keyed.svi_free_base_qty) > 0
     ORDER BY keyed.svi_line_no, keyed.svi_split_no
  `;
    if (lines.length === 0) {
        return;
    }
    const errors = [];
    for (const line of lines) {
        const strategy = line.issue_strategy?.toUpperCase() ?? 'FEFO';
        if (strategy === 'MANUAL') {
            errors.push({
                field: `lines.${line.svi_line_no}`,
                message: `Line ${line.svi_line_no} (${line.item_name}): the issue strategy for this item is MANUAL, so the line must name the lot it issues from.`,
            });
            continue;
        }
        const order = strategy === 'LIFO'
            ? client_1.Prisma.sql `b.sbl_first_in_date DESC NULLS LAST, slt.slt_created_on DESC`
            : strategy === 'FIFO'
                ? client_1.Prisma.sql `b.sbl_first_in_date ASC NULLS LAST, slt.slt_created_on ASC`
                : client_1.Prisma.sql `slt.slt_expiry_date ASC NULLS LAST, b.sbl_first_in_date ASC NULLS LAST, slt.slt_created_on ASC`;
        const lots = await tx.$queryRaw `
      SELECT b.sbl_lot_id, b.sbl_available_qty AS available
        FROM stock.stock_balance b
        JOIN stock.stock_lot slt ON slt.slt_id = b.sbl_lot_id AND slt.slt_is_deleted = false
       WHERE b.sbl_company_id = ${line.svh_company_id}::uuid
         AND b.sbl_branch_id  = ${line.svh_branch_id}::uuid
         AND b.sbl_godown_id  = ${line.svi_godown_id}::uuid
         AND b.sbl_item_id    = ${line.svi_item_id}::uuid
         AND b.sbl_bucket     = ${line.svi_bucket}
         AND b.sbl_is_deleted = false
         AND b.sbl_available_qty > 0
         AND slt.slt_status IN ('ACTIVE', 'CLOSED')
         -- Whatever identity the line DID supply narrows the pick.
         AND (NOT ${line.track_batch}::boolean      OR ${line.key_batch} = '~'  OR slt.slt_key_batch    = ${line.key_batch})
         AND (NOT ${line.track_mrp}::boolean        OR ${line.key_mrp}::numeric = -1 OR slt.slt_key_mrp = ${line.key_mrp}::numeric)
         AND (NOT ${line.track_sale_price}::boolean OR ${line.key_sp}::numeric = -1  OR slt.slt_key_sp  = ${line.key_sp}::numeric)
         AND (NOT ${line.track_expiry}::boolean     OR ${line.key_expiry}::date = DATE '0001-01-01' OR slt.slt_key_expiry = ${line.key_expiry}::date)
         AND (NOT ${line.track_serial}::boolean     OR ${line.key_serial} = '~' OR slt.slt_key_serial   = ${line.key_serial})
         AND (NOT ${line.track_supplier}::boolean   OR ${line.key_supplier}::uuid = '00000000-0000-0000-0000-000000000000'::uuid
                                                     OR slt.slt_key_supplier = ${line.key_supplier}::uuid)
       ORDER BY ${order}
    `;
        if (lots.length === 0) {
            errors.push({
                field: `lines.${line.svi_line_no}`,
                message: `Line ${line.svi_line_no} (${line.item_name}): names no lot and this godown holds no stock of the item to issue from. Name the lot, or receive the stock first.`,
            });
            continue;
        }
        const need = new client_1.Prisma.Decimal(line.svi_base_qty).plus(line.svi_free_base_qty);
        const factor = new client_1.Prisma.Decimal(line.svi_to_base_factor).gt(0)
            ? new client_1.Prisma.Decimal(line.svi_to_base_factor)
            : new client_1.Prisma.Decimal(1);
        const takes = [];
        let remaining = need;
        for (const [i, lot] of lots.entries()) {
            if (remaining.lte(0)) {
                break;
            }
            const last = i === lots.length - 1;
            const take = last ? remaining : client_1.Prisma.Decimal.min(remaining, new client_1.Prisma.Decimal(lot.available));
            if (take.lte(0)) {
                continue;
            }
            takes.push({ lotId: lot.sbl_lot_id, qty: take });
            remaining = remaining.minus(take);
        }
        let freeLeft = new client_1.Prisma.Decimal(line.svi_free_base_qty);
        const splits = takes.map((t) => {
            const free = client_1.Prisma.Decimal.min(freeLeft, t.qty);
            freeLeft = freeLeft.minus(free);
            const base = t.qty.minus(free);
            return {
                lotId: t.lotId,
                base,
                free,
                qty: base.div(factor).toDecimalPlaces(6),
                freeQty: free.div(factor).toDecimalPlaces(6),
            };
        });
        const [first, ...rest] = splits;
        await tx.$executeRaw `
      UPDATE stock.stock_voucher_item svi
         SET svi_lot_id        = slt.slt_id,
             svi_batch_no      = COALESCE(slt.slt_batch_no,    svi.svi_batch_no),
             svi_mfg_date      = COALESCE(slt.slt_mfg_date,    svi.svi_mfg_date),
             svi_expiry_date   = COALESCE(slt.slt_expiry_date, svi.svi_expiry_date),
             svi_mrp           = COALESCE(slt.slt_mrp,         svi.svi_mrp),
             svi_sale_price    = COALESCE(slt.slt_sale_price,  svi.svi_sale_price),
             svi_serial_no     = COALESCE(slt.slt_serial_no,   svi.svi_serial_no),
             svi_supplier_id   = COALESCE(slt.slt_supplier_id, svi.svi_supplier_id),
             svi_qty           = ${first.qty}::numeric,
             svi_base_qty      = ${first.base}::numeric,
             svi_free_qty      = ${first.freeQty}::numeric,
             svi_free_base_qty = ${first.free}::numeric,
             svi_modified_on   = ${postedOn},
             svi_modified_by   = ${author}
        FROM stock.stock_lot slt
       WHERE slt.slt_id       = ${first.lotId}::uuid
         AND svi.svi_id       = ${line.svi_id}::uuid
         AND svi.svi_acc_year = ${accYear}::bpchar
    `;
        for (const [k, split] of rest.entries()) {
            await tx.$executeRaw `
        INSERT INTO stock.stock_voucher_item (
          svi_voucher_id, svi_company_id, svi_branch_id, svi_tenant_id, svi_acc_year,
          svi_line_no, svi_split_no, svi_item_id, svi_uom_id, svi_base_uom_id, svi_to_base_factor,
          svi_godown_id, svi_lot_id, svi_bucket, svi_barcode,
          svi_batch_no, svi_mfg_date, svi_expiry_date, svi_mrp, svi_sale_price, svi_serial_no, svi_supplier_id,
          svi_qty, svi_base_qty, svi_free_qty, svi_free_base_qty, svi_weight_qty,
          svi_cost_rate, svi_cost_rate_wot, svi_landed_rate, svi_tax_perc,
          svi_reason_id, svi_remarks, svi_sync_date, svi_created_on, svi_created_by
        )
        SELECT svi.svi_voucher_id, svi.svi_company_id, svi.svi_branch_id, svi.svi_tenant_id, svi.svi_acc_year,
               svi.svi_line_no,
               (SELECT MAX(x.svi_split_no) FROM stock.stock_voucher_item x
                 WHERE x.svi_voucher_id = svi.svi_voucher_id AND x.svi_acc_year = svi.svi_acc_year
                   AND x.svi_line_no = svi.svi_line_no) + 1,
               svi.svi_item_id, svi.svi_uom_id, svi.svi_base_uom_id, svi.svi_to_base_factor,
               svi.svi_godown_id, slt.slt_id, svi.svi_bucket, svi.svi_barcode,
               COALESCE(slt.slt_batch_no,    svi.svi_batch_no),
               COALESCE(slt.slt_mfg_date,    svi.svi_mfg_date),
               COALESCE(slt.slt_expiry_date, svi.svi_expiry_date),
               COALESCE(slt.slt_mrp,         svi.svi_mrp),
               COALESCE(slt.slt_sale_price,  svi.svi_sale_price),
               COALESCE(slt.slt_serial_no,   svi.svi_serial_no),
               COALESCE(slt.slt_supplier_id, svi.svi_supplier_id),
               ${split.qty}::numeric, ${split.base}::numeric, ${split.freeQty}::numeric, ${split.free}::numeric, 0,
               svi.svi_cost_rate, svi.svi_cost_rate_wot, svi.svi_landed_rate, svi.svi_tax_perc,
               svi.svi_reason_id,
               COALESCE(svi.svi_remarks, '') || CASE WHEN svi.svi_remarks IS NULL THEN '' ELSE ' ' END
                 || 'split ' || ${k + 2}::text || ' by ' || ${strategy},
               svi.svi_sync_date, ${postedOn}, ${author}
          FROM stock.stock_voucher_item svi
          JOIN stock.stock_lot slt ON slt.slt_id = ${split.lotId}::uuid
         WHERE svi.svi_id       = ${line.svi_id}::uuid
           AND svi.svi_acc_year = ${accYear}::bpchar
      `;
        }
        logger.log(`${rules.displayName} ${svhId}: line ${line.svi_line_no} picked ${splits.length} lot(s) by ${strategy}`);
    }
    if (errors.length) {
        (0, module_service_utils_1.throwStockUnprocessable)(`This ${rules.displayName.toLowerCase()} cannot be posted`, errors);
    }
}
async function resolveLots(tx, params) {
    const { rules, svhId, accYear, actor } = params;
    await tx.$executeRaw `
    WITH ${postingCte(svhId, accYear, rules)}
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
           ${params.ledgerSource?.srcModule ?? exports.STOCK_LEDGER_SRC_MODULE},
           ${params.ledgerSource?.srcDocType ?? rules.voucherType}, c.svi_voucher_id,
           c.svi_acc_year, COALESCE(${params.ledgerSource?.srcRefno ?? null}::varchar, c.svh_refno),
           c.line_cost_rate, c.line_cost_rate, c.line_cost_rate_wot, c.svi_landed_rate, c.svi_tax_perc,
           ${auditColumnActor(actor)}
      FROM costed c
     WHERE c.svi_lot_id IS NULL
       -- Under a per-line direction an OUTWARD line never opens a lot: stock
       -- that was never received cannot be issued, and the negative policy
       -- (BLOCK for the adjustment family) says so by name.
       AND (${rules.lineDirection !== 'REASON'}::boolean OR c.line_direction > 0)
     ORDER BY c.svh_company_id, c.svi_item_id, c.key_batch, c.key_mrp,
              c.key_sp, c.key_expiry, c.key_serial, c.key_supplier,
              c.svi_line_no, c.svi_split_no
    ON CONFLICT DO NOTHING
  `;
}
async function attachLotsToLines(tx, { rules, svhId, accYear, postedOn, actor }) {
    await tx.$executeRaw `
    WITH ${postingCte(svhId, accYear, rules)}
    UPDATE stock.stock_voucher_item svi
       SET svi_lot_id        = COALESCE(svi.svi_lot_id, slt.slt_id),
           svi_cost_rate     = c.line_cost_rate,
           svi_cost_rate_wot = c.line_cost_rate_wot,
           svi_modified_on   = ${postedOn},
           svi_modified_by   = ${auditColumnActor(actor)}
      FROM costed c
      LEFT JOIN stock.stock_lot slt
        ON c.svi_lot_id IS NULL
       AND slt.slt_company_id  = c.svh_company_id
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
async function assertInwardCost(tx, { rules, svhId, accYear }) {
    const isCount = rules.quantityMode === 'COUNT';
    if (!isCount && !rules.isInward && rules.lineDirection !== 'REASON') {
        return;
    }
    const rows = await tx.$queryRaw `
    WITH ${postingCte(svhId, accYear, rules)}
    SELECT c.svi_line_no, c.svi_split_no, itm.item_name_en AS item_name
      FROM costed c
      JOIN inventory.item_master itm ON itm.item_id = c.svi_item_id
     WHERE c.line_cost_rate = 0
       AND CASE WHEN ${isCount}::boolean
                THEN COALESCE(c.svi_diff_qty, 0) > 0
                ELSE c.line_direction > 0 AND c.svi_base_qty > 0 END
     ORDER BY c.svi_line_no, c.svi_split_no
  `;
    if (rows.length) {
        (0, module_service_utils_1.throwStockUnprocessable)(`This ${rules.displayName.toLowerCase()} cannot be posted`, rows.map((r) => ({
            field: `lines.${r.svi_line_no}`,
            message: `Line ${r.svi_line_no}${r.svi_split_no > 1 ? ` split ${r.svi_split_no}` : ''} (${r.item_name}): brings stock in at a cost of 0 — the rate source resolved nothing. Set a cost on the line or a rate source the engine can derive one from.`,
        })));
    }
}
async function writeLedger(tx, params) {
    const { rules, svhId, accYear, actor, postedOn, ledgerSource } = params;
    const isCount = rules.quantityMode === 'COUNT';
    const shape = rules.postShape;
    const [plusTxnType, minusTxnType] = isCount
        ? [rules.ledgerTxnTypes[0], rules.ledgerTxnTypes[1] ?? rules.ledgerTxnTypes[0]]
        : [rules.ledgerTxnTypes[0], rules.ledgerTxnTypes[0]];
    const direction = rules.isInward ? DIRECTION_IN : DIRECTION_OUT;
    const sides = shape === 'TRANSFER_OUT'
        ? [
            client_1.Prisma.sql `(${DIRECTION_OUT}::int, 'TRANSFER_OUT'::text, false, false, false)`,
            client_1.Prisma.sql `(${DIRECTION_IN}::int, 'TRANSFER_IN'::text, true, true, false)`,
        ]
        : shape === 'TRANSFER_IN'
            ? [client_1.Prisma.sql `(${DIRECTION_IN}::int, 'TRANSFER_IN'::text, false, false, false)`]
            : [client_1.Prisma.sql `(${direction}::int, ${plusTxnType}::text, false, false, true)`];
    return tx.$executeRaw `
    WITH ${postingCte(svhId, accYear, rules)}
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
      sml_reason_id, sml_doc_rate, sml_party_id, sml_created_by
    )
    SELECT c.svh_company_id, c.svh_branch_id, c.svh_tenant_id, c.svi_acc_year,
           CASE WHEN side.to_godown THEN c.svh_to_godown_id ELSE c.svi_godown_id END,
           c.svi_item_id, svi.svi_lot_id, c.svi_uom_id, c.svi_base_uom_id, c.svi_to_base_factor,
           ${ledgerSource?.srcModule ?? exports.STOCK_LEDGER_SRC_MODULE},
           ${ledgerSource?.srcDocType ?? rules.voucherType}, c.svi_voucher_id, c.svi_acc_year,
           COALESCE(${ledgerSource?.srcRefno ?? null}::varchar, c.svh_refno),
           c.svi_line_no, c.svi_split_no,
           CASE WHEN ${isCount}::boolean
                THEN CASE WHEN COALESCE(c.svi_diff_qty, 0) >= 0 THEN ${plusTxnType} ELSE ${minusTxnType} END
                WHEN side.from_line THEN c.line_txn_type
                ELSE side.txn_type END,
           CASE WHEN ${isCount}::boolean
                THEN CASE WHEN COALESCE(c.svi_diff_qty, 0) >= 0 THEN ${DIRECTION_IN} ELSE ${DIRECTION_OUT} END
                WHEN side.from_line THEN c.line_direction
                ELSE side.direction END,
           c.svi_bucket,
           c.svh_doc_date, c.svh_doc_datetime, ${postedOn},
           c.move_qty, c.move_base_qty, c.move_free_qty, c.move_free_base_qty, c.svi_weight_qty,
           c.line_cost_rate,     ROUND(c.line_cost_rate     * (c.move_base_qty + c.move_free_base_qty), 2),
           c.line_cost_rate_wot, ROUND(c.line_cost_rate_wot * (c.move_base_qty + c.move_free_base_qty), 2),
           c.svi_landed_rate,    ROUND(c.svi_landed_rate    * (c.move_base_qty + c.move_free_base_qty), 2),
           c.svi_mrp, c.svi_batch_no, c.svi_expiry_date,
           COALESCE(c.svi_reason_id, c.svh_reason_id),
           -- What the owning document charged (a sale's rate): the moving
           -- average's last-sale stamp reads it. Stock vouchers have none, and
           -- the column is NOT NULL DEFAULT 0, so "none" is written as 0 and
           -- phase 5 reads 0 as "no rate" (NULLIF there), never as a price.
           COALESCE(c.svi_sale_price, 0),
           ${ledgerSource?.partyId ?? null}::uuid,
           ${auditColumnActor(actor)}
      FROM costed c
      JOIN stock.stock_voucher_item svi
        ON svi.svi_id = c.svi_id AND svi.svi_acc_year = c.svi_acc_year
      CROSS JOIN (VALUES ${client_1.Prisma.join(sides)}) AS side(direction, txn_type, to_godown, same_branch_only, from_line)
     WHERE (c.move_base_qty + c.move_free_base_qty) <> 0
       AND (NOT side.same_branch_only OR c.same_branch)
     ORDER BY c.svi_line_no, c.svi_split_no, side.direction DESC
  `;
}
async function assertDespatchable(tx, params, header) {
    const { rules, svhId, accYear } = params;
    const lotless = await tx.$queryRaw `
    SELECT svi_line_no FROM stock.stock_voucher_item
     WHERE svi_voucher_id = ${svhId}::uuid AND svi_acc_year = ${accYear}::bpchar
       AND svi_is_deleted = false AND svi_lot_id IS NULL
     ORDER BY svi_line_no
  `;
    if (lotless.length) {
        (0, module_service_utils_1.throwStockUnprocessable)(`This ${rules.displayName.toLowerCase()} cannot be despatched`, lotless.map((r) => ({
            field: `lines.${r.svi_line_no}`,
            message: `Line ${r.svi_line_no} names no lot — a transfer moves existing stock; pick it from the balance.`,
        })));
    }
    const sameBranch = header.toBranchId === null || header.toBranchId === header.branchId;
    if (!sameBranch && !header.toGodownId) {
        (0, module_service_utils_1.throwStockUnprocessable)(`This ${rules.displayName.toLowerCase()} cannot be despatched`, [{ field: 'toGodownId', message: 'An inter-branch transfer must name the destination godown.' }]);
    }
    return { sameBranch, outId: svhId, outAccYear: accYear, outRefno: header.refno };
}
async function assertReceivable(tx, params, header) {
    const { rules, svhId, accYear } = params;
    if (!header.linkSrcDocId) {
        (0, module_service_utils_1.throwStockConflict)('Receipt links no transfer', [
            {
                field: 'linkSrcDocId',
                message: `${header.refno} names no despatch. A receipt cannot be posted without the transfer it is against.`,
            },
        ]);
    }
    const outAccYear = (header.linkSrcAccYear ?? accYear).trim();
    const [out] = await tx.$queryRaw `
    SELECT svh_status, svh_refno, svh_is_deleted, svh_to_branch_id
      FROM stock.stock_voucher
     WHERE svh_id = ${header.linkSrcDocId}::uuid
       AND svh_acc_year = ${outAccYear}::bpchar
       AND svh_voucher_type = 'TRANSFER_OUT'
       FOR UPDATE
  `;
    if (!out) {
        (0, module_service_utils_1.throwStockConflict)('Transfer not found', [
            {
                field: 'linkSrcDocId',
                message: `${header.refno} answers a despatch that does not exist.`,
            },
        ]);
    }
    if (out.svh_is_deleted) {
        (0, module_service_utils_1.throwStockConflict)('Transfer is deleted', [
            {
                field: 'linkSrcDocId',
                message: `${out.svh_refno} has been deleted by the sending branch. Nothing can be received against it.`,
            },
        ]);
    }
    if (out.svh_to_branch_id !== header.branchId) {
        (0, module_service_utils_1.throwStockConflict)('Transfer is for another branch', [
            {
                field: 'branchId',
                message: `${out.svh_refno} was sent to another branch. A transfer can only be received where it was addressed.`,
            },
        ]);
    }
    if (out.svh_status !== 'IN_TRANSIT') {
        (0, module_service_utils_1.throwStockConflict)(`Transfer is ${out.svh_status}`, [
            {
                field: 'linkSrcDocId',
                message: out.svh_status === 'RECEIVED'
                    ? `${out.svh_refno} has already been received in full.`
                    : `${out.svh_refno} is ${out.svh_status}; only a despatched transfer can be received.`,
            },
        ]);
    }
    const claims = await tx.$queryRaw `
    WITH line AS (
      SELECT svi.svi_line_no, svi.svi_item_id, svi.svi_lot_id, svi.svi_godown_id, svi.svi_bucket,
             svi.svi_base_qty + svi.svi_free_base_qty AS qty
        FROM stock.stock_voucher_item svi
       WHERE svi.svi_voucher_id = ${svhId}::uuid AND svi.svi_acc_year = ${accYear}::bpchar
         AND svi.svi_is_deleted = false
    ),
    matched AS (
      SELECT line.*,
             (SELECT count(*) FROM stock.stock_transit t
               WHERE t.stt_out_voucher_id = ${header.linkSrcDocId}::uuid AND t.stt_out_acc_year = ${outAccYear}::bpchar
                 AND t.stt_item_id = line.svi_item_id AND t.stt_lot_id = line.svi_lot_id
                 AND t.stt_to_godown_id = line.svi_godown_id AND t.stt_is_deleted = false) AS matches,
             (SELECT t.stt_id FROM stock.stock_transit t
               WHERE t.stt_out_voucher_id = ${header.linkSrcDocId}::uuid AND t.stt_out_acc_year = ${outAccYear}::bpchar
                 AND t.stt_item_id = line.svi_item_id AND t.stt_lot_id = line.svi_lot_id
                 AND t.stt_to_godown_id = line.svi_godown_id AND t.stt_is_deleted = false
               ORDER BY (t.stt_bucket = line.svi_bucket) DESC LIMIT 1) AS stt_id
        FROM line
    )
    SELECT m.svi_line_no, m.stt_id, m.matches,
           SUM(m.qty) OVER (PARTITION BY m.stt_id) AS claimed,
           t.stt_sent_qty - t.stt_received_qty - t.stt_damage_qty AS remaining
      FROM matched m
      LEFT JOIN stock.stock_transit t ON t.stt_id = m.stt_id
     ORDER BY m.svi_line_no
  `;
    const errors = [];
    const reported = new Set();
    for (const c of claims) {
        const field = `lines.${c.svi_line_no}`;
        if (!c.stt_id) {
            errors.push({
                field,
                message: `Line ${c.svi_line_no}: nothing of this lot is in transit to this godown.`,
            });
            continue;
        }
        if (Number(c.matches) > 1) {
            errors.push({
                field,
                message: `Line ${c.svi_line_no}: this item and lot were shipped in more than one bucket, and the receipt cannot tell them apart. The sender must ship them as separate transfers.`,
            });
            continue;
        }
        if (!reported.has(c.stt_id) && new client_1.Prisma.Decimal(c.claimed).gt(c.remaining ?? 0)) {
            reported.add(c.stt_id);
            errors.push({
                field,
                message: `Line ${c.svi_line_no} receives ${c.claimed.toString()} but only ${(c.remaining ?? new client_1.Prisma.Decimal(0)).toString()} of that lot is still in transit. A second receipt opens with the remainder, not the original quantity.`,
            });
        }
    }
    if (errors.length) {
        (0, module_service_utils_1.throwStockUnprocessable)(`This ${rules.displayName.toLowerCase()} cannot be posted`, errors);
    }
    return {
        sameBranch: false,
        outId: header.linkSrcDocId,
        outAccYear,
        outRefno: out.svh_refno,
    };
}
async function writeTransitRows(tx, params) {
    const { actor, postedOn } = params;
    return tx.$executeRaw `
    INSERT INTO stock.stock_transit (
      stt_company_id, stt_tenant_id, stt_from_branch_id, stt_from_godown_id,
      stt_to_branch_id, stt_to_godown_id,
      stt_item_id, stt_lot_id, stt_base_uom_id, stt_bucket,
      stt_out_voucher_id, stt_out_acc_year, stt_out_refno,
      stt_sent_qty, stt_cost_rate, stt_cost_rate_wot, stt_transit_value,
      stt_sent_on, stt_status, stt_created_on, stt_created_by
    )
    SELECT sml.sml_company_id, sml.sml_tenant_id, sml.sml_branch_id, sml.sml_godown_id,
           doc.svh_to_branch_id, doc.svh_to_godown_id,
           sml.sml_item_id, sml.sml_lot_id, sml.sml_base_uom_id, sml.sml_bucket,
           sml.sml_src_doc_id, sml.sml_acc_year, doc.svh_refno,
           SUM(sml.sml_base_qty + sml.sml_free_base_qty),
           MAX(sml.sml_cost_rate), MAX(sml.sml_cost_rate_wot), SUM(sml.sml_cost_value),
           ${postedOn}, 'IN_TRANSIT', ${postedOn}, ${auditColumnActor(actor)}
      FROM stock.stock_ledger sml
      JOIN stock.stock_voucher doc
        ON doc.svh_id = sml.sml_src_doc_id AND doc.svh_acc_year = sml.sml_acc_year
     WHERE ${ledgerRowsOf({ ...params, reversal: false })}
       AND sml.sml_txn_type = 'TRANSFER_OUT'
     GROUP BY sml.sml_company_id, sml.sml_tenant_id, sml.sml_branch_id, sml.sml_godown_id,
              doc.svh_to_branch_id, doc.svh_to_godown_id,
              sml.sml_item_id, sml.sml_lot_id, sml.sml_base_uom_id, sml.sml_bucket,
              sml.sml_src_doc_id, sml.sml_acc_year, doc.svh_refno
  `;
}
async function settleTransitRows(tx, params, transit) {
    const { svhId, accYear, actor, postedOn } = params;
    const author = auditColumnActor(actor);
    const rows = await tx.$executeRaw `
    WITH got AS (
      SELECT stt.stt_id, doc.svh_refno,
             SUM(CASE WHEN sml.sml_bucket = 'DAMAGED' AND stt.stt_bucket <> 'DAMAGED'
                      THEN 0 ELSE sml.sml_base_qty + sml.sml_free_base_qty END) AS received,
             SUM(CASE WHEN sml.sml_bucket = 'DAMAGED' AND stt.stt_bucket <> 'DAMAGED'
                      THEN sml.sml_base_qty + sml.sml_free_base_qty ELSE 0 END) AS damaged
        FROM stock.stock_ledger sml
        JOIN stock.stock_voucher doc
          ON doc.svh_id = sml.sml_src_doc_id AND doc.svh_acc_year = sml.sml_acc_year
        JOIN LATERAL (
          SELECT t.stt_id, t.stt_bucket
            FROM stock.stock_transit t
           WHERE t.stt_out_voucher_id = ${transit.outId}::uuid
             AND t.stt_out_acc_year   = ${transit.outAccYear}::bpchar
             AND t.stt_item_id        = sml.sml_item_id
             AND t.stt_lot_id         = sml.sml_lot_id
             AND t.stt_to_godown_id   = sml.sml_godown_id
             AND t.stt_is_deleted     = false
           ORDER BY (t.stt_bucket = sml.sml_bucket) DESC
           LIMIT 1
        ) stt ON true
       WHERE ${ledgerRowsOf({ ...params, reversal: false })}
         AND sml.sml_txn_type = 'TRANSFER_IN'
       GROUP BY stt.stt_id, doc.svh_refno
    )
    UPDATE stock.stock_transit t
       SET stt_received_qty = t.stt_received_qty + got.received,
           stt_damage_qty   = t.stt_damage_qty   + got.damaged,
           stt_status       = CASE WHEN t.stt_sent_qty - (t.stt_received_qty + got.received)
                                                       - (t.stt_damage_qty + got.damaged) <= 0
                                   THEN 'RECEIVED' ELSE 'PARTIAL' END,
           stt_in_voucher_id = ${svhId}::uuid,
           stt_in_acc_year   = ${accYear}::bpchar,
           stt_in_refno      = got.svh_refno,
           stt_received_on   = ${postedOn},
           stt_modified_on   = ${postedOn},
           stt_modified_by   = ${author}
      FROM got
     WHERE t.stt_id = got.stt_id
  `;
    const closed = await tx.$queryRaw `
    UPDATE stock.stock_voucher o
       SET svh_status      = 'RECEIVED',
           svh_version_no  = o.svh_version_no + 1,
           svh_modified_on = ${postedOn},
           svh_modified_by = ${author}
     WHERE o.svh_id       = ${transit.outId}::uuid
       AND o.svh_acc_year = ${transit.outAccYear}::bpchar
       AND o.svh_status   = 'IN_TRANSIT'
       AND NOT EXISTS (
             SELECT 1 FROM stock.stock_transit t
              WHERE t.stt_out_voucher_id = o.svh_id AND t.stt_out_acc_year = o.svh_acc_year
                AND t.stt_is_deleted = false
                AND t.stt_sent_qty - t.stt_received_qty - t.stt_damage_qty > 0)
    RETURNING o.svh_id, o.svh_acc_year, o.svh_refno
  `;
    return {
        rows,
        closedOut: closed[0]
            ? { svhId: closed[0].svh_id, accYear: closed[0].svh_acc_year.trim(), refno: closed[0].svh_refno }
            : null,
    };
}
async function settleTransitShort(tx, params) {
    const { outId, outAccYear, companyId, branchId, reasonId, remarks, actor, settledOn } = params;
    const author = auditColumnActor(actor);
    const [out] = await tx.$queryRaw `
    SELECT svh_status, svh_refno, svh_is_deleted, svh_voucher_type
      FROM stock.stock_voucher
     WHERE svh_id = ${outId}::uuid AND svh_acc_year = ${outAccYear}::bpchar
       AND svh_company_id = ${companyId}::uuid AND svh_branch_id = ${branchId}::uuid
       FOR UPDATE
  `;
    if (!out || out.svh_is_deleted || out.svh_voucher_type !== 'TRANSFER_OUT') {
        (0, module_service_utils_1.throwStockConflict)('Transfer not found', [
            { field: 'outVoucherId', message: `No live TRANSFER_OUT ${outId} in ${outAccYear} for this branch.` },
        ]);
    }
    if (out.svh_status !== 'IN_TRANSIT') {
        (0, module_service_utils_1.throwStockConflict)(`Transfer is ${out.svh_status}`, [
            {
                field: 'outVoucherId',
                message: out.svh_status === 'RECEIVED'
                    ? `${out.svh_refno} is already closed: nothing is short.`
                    : `${out.svh_refno} is ${out.svh_status}; only a despatched transfer can be short-settled.`,
            },
        ]);
    }
    const untouched = await tx.$queryRaw `
    SELECT count(*)::bigint AS n FROM stock.stock_transit
     WHERE stt_out_voucher_id = ${outId}::uuid AND stt_out_acc_year = ${outAccYear}::bpchar
       AND stt_is_deleted = false AND stt_status = 'IN_TRANSIT'
  `;
    if (Number(untouched[0]?.n ?? 0) > 0) {
        (0, module_service_utils_1.throwStockConflict)('Nothing has been received yet', [
            {
                field: 'outVoucherId',
                message: `${out.svh_refno} has lines nothing has been received against. A short is settled after the receipt, not instead of it — receive what arrived first.`,
            },
        ]);
    }
    const rows = await tx.$queryRaw `
    UPDATE stock.stock_transit t
       SET stt_status      = 'RECEIVED',
           stt_remarks     = COALESCE(${remarks}::varchar, t.stt_remarks),
           stt_received_on = COALESCE(t.stt_received_on, ${settledOn}),
           stt_modified_on = ${settledOn},
           stt_modified_by = ${author}
     WHERE t.stt_out_voucher_id = ${outId}::uuid AND t.stt_out_acc_year = ${outAccYear}::bpchar
       AND t.stt_is_deleted = false AND t.stt_status = 'PARTIAL'
    RETURNING t.stt_id, t.stt_item_id, t.stt_lot_id, t.stt_to_godown_id, t.stt_bucket,
              t.stt_sent_qty - t.stt_received_qty - t.stt_damage_qty AS short_qty, t.stt_cost_rate
  `;
    await tx.$executeRaw `
    UPDATE stock.stock_voucher
       SET svh_status = 'RECEIVED', svh_version_no = svh_version_no + 1,
           svh_reason_id = ${reasonId}::uuid,
           svh_modified_on = ${settledOn}, svh_modified_by = ${author}
     WHERE svh_id = ${outId}::uuid AND svh_acc_year = ${outAccYear}::bpchar
  `;
    await refreshTransitIn(tx, transitHoldingsOf(outId, outAccYear), actor, settledOn);
    return {
        refno: out.svh_refno,
        rows: rows.map((r) => ({
            sttId: r.stt_id,
            itemId: r.stt_item_id,
            lotId: r.stt_lot_id,
            toGodownId: r.stt_to_godown_id,
            bucket: r.stt_bucket,
            shortQty: new client_1.Prisma.Decimal(r.short_qty),
            costRate: new client_1.Prisma.Decimal(r.stt_cost_rate),
            shortValue: new client_1.Prisma.Decimal(r.short_qty).times(r.stt_cost_rate).toDecimalPlaces(2),
        })),
    };
}
function transitHoldingsOf(outId, outAccYear) {
    return client_1.Prisma.sql `
    SELECT DISTINCT t.stt_company_id AS company_id, t.stt_to_branch_id AS branch_id,
           t.stt_tenant_id AS tenant_id, t.stt_to_godown_id AS godown_id,
           t.stt_item_id AS item_id, t.stt_lot_id AS lot_id, t.stt_base_uom_id AS base_uom_id,
           t.stt_bucket AS bucket
      FROM stock.stock_transit t
     WHERE t.stt_out_voucher_id = ${outId}::uuid
       AND t.stt_out_acc_year   = ${outAccYear}::bpchar
       AND t.stt_is_deleted     = false
  `;
}
function reservationHoldingsOf(srcDocType, srcDocId) {
    return client_1.Prisma.sql `
    SELECT DISTINCT r.srv_company_id AS company_id, r.srv_branch_id AS branch_id,
           r.srv_tenant_id AS tenant_id, r.srv_godown_id AS godown_id,
           r.srv_item_id AS item_id, r.srv_lot_id AS lot_id, r.srv_base_uom_id AS base_uom_id,
           r.srv_bucket AS bucket
      FROM stock.stock_reservation r
     WHERE r.srv_src_doc_type = ${srcDocType}
       AND r.srv_src_doc_id   = ${srcDocId}::uuid
       AND r.srv_is_deleted   = false
  `;
}
function openReservationHoldings(companyId) {
    return client_1.Prisma.sql `
    SELECT DISTINCT r.srv_company_id AS company_id, r.srv_branch_id AS branch_id,
           r.srv_tenant_id AS tenant_id, r.srv_godown_id AS godown_id,
           r.srv_item_id AS item_id, r.srv_lot_id AS lot_id, r.srv_base_uom_id AS base_uom_id,
           r.srv_bucket AS bucket
      FROM stock.stock_reservation r
     WHERE (${companyId ?? null}::uuid IS NULL OR r.srv_company_id = ${companyId ?? null}::uuid)
       AND r.srv_is_deleted = false
  `;
}
async function lockHoldingItems(tx, holdings) {
    await tx.$queryRaw `
    SELECT count(pg_advisory_xact_lock(hashtextextended(
             t.company_id::text || ':' || t.branch_id::text || ':' || t.item_id::text, 0)))::int AS locked
      FROM (SELECT DISTINCT h.company_id, h.branch_id, h.item_id
              FROM (${holdings}) h
             ORDER BY 1, 2, 3) t
  `;
}
async function ensureBalanceRows(tx, holdings, actor) {
    await lockHoldingItems(tx, holdings);
    await tx.$executeRaw `
    INSERT INTO stock.stock_balance (
      sbl_company_id, sbl_branch_id, sbl_tenant_id, sbl_godown_id, sbl_item_id,
      sbl_lot_id, sbl_base_uom_id, sbl_bucket,
      sbl_batch_no, sbl_mrp, sbl_sale_price, sbl_expiry_date, sbl_supplier_id,
      sbl_created_by
    )
    SELECT h.company_id, h.branch_id, h.tenant_id, h.godown_id, h.item_id,
           h.lot_id, h.base_uom_id, h.bucket,
           slt.slt_batch_no, slt.slt_mrp, slt.slt_sale_price, slt.slt_expiry_date, slt.slt_supplier_id,
           ${auditColumnActor(actor)}
      FROM (${holdings}) h
      JOIN stock.stock_lot slt ON slt.slt_id = h.lot_id
    ON CONFLICT (sbl_company_id, sbl_branch_id, sbl_godown_id, sbl_item_id, sbl_lot_id, sbl_bucket)
    WHERE sbl_is_deleted = false
    DO NOTHING
  `;
}
async function refreshReserved(tx, holdings, actor, on) {
    await lockHoldingItems(tx, holdings);
    return tx.$executeRaw `
    UPDATE stock.stock_balance b
       SET sbl_reserved_qty = COALESCE(r.qty, 0),
           sbl_row_version  = b.sbl_row_version + 1,
           sbl_modified_on  = ${on},
           sbl_modified_by  = ${auditColumnActor(actor)}
      FROM (${holdings}) h
      LEFT JOIN LATERAL (
        SELECT SUM(x.srv_open_qty) AS qty
          FROM stock.stock_reservation x
         WHERE x.srv_company_id = h.company_id AND x.srv_branch_id = h.branch_id
           AND x.srv_godown_id  = h.godown_id  AND x.srv_item_id   = h.item_id
           AND x.srv_lot_id     = h.lot_id     AND x.srv_bucket    = h.bucket
           AND x.srv_is_deleted = false
           AND x.srv_status IN ('OPEN', 'PARTIAL')
      ) r ON true
     WHERE b.sbl_company_id = h.company_id AND b.sbl_branch_id = h.branch_id
       AND b.sbl_godown_id  = h.godown_id  AND b.sbl_item_id   = h.item_id
       AND b.sbl_lot_id     = h.lot_id     AND b.sbl_bucket    = h.bucket
       AND b.sbl_is_deleted = false
       AND b.sbl_reserved_qty IS DISTINCT FROM COALESCE(r.qty, 0)
  `;
}
async function refreshTransitIn(tx, holdings, actor, on) {
    await lockHoldingItems(tx, holdings);
    return tx.$executeRaw `
    UPDATE stock.stock_balance b
       SET sbl_transit_in_qty = COALESCE(t.qty, 0),
           sbl_row_version    = b.sbl_row_version + 1,
           sbl_modified_on    = ${on},
           sbl_modified_by    = ${auditColumnActor(actor)}
      FROM (${holdings}) h
      LEFT JOIN LATERAL (
        SELECT SUM(x.stt_sent_qty - x.stt_received_qty - x.stt_damage_qty) AS qty
          FROM stock.stock_transit x
         WHERE x.stt_company_id   = h.company_id AND x.stt_to_branch_id = h.branch_id
           AND x.stt_to_godown_id = h.godown_id  AND x.stt_item_id      = h.item_id
           AND x.stt_lot_id       = h.lot_id     AND x.stt_bucket       = h.bucket
           AND x.stt_is_deleted   = false
           AND x.stt_status IN ('IN_TRANSIT', 'PARTIAL')
      ) t ON true
     WHERE b.sbl_company_id = h.company_id AND b.sbl_branch_id = h.branch_id
       AND b.sbl_godown_id  = h.godown_id  AND b.sbl_item_id   = h.item_id
       AND b.sbl_lot_id     = h.lot_id     AND b.sbl_bucket    = h.bucket
       AND b.sbl_is_deleted = false
       AND b.sbl_transit_in_qty IS DISTINCT FROM COALESCE(t.qty, 0)
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
             -- 0 is "no rate" (the column is NOT NULL): it must not overwrite
             -- the stamp a priced sale left, so it reads as NULL here.
             (array_agg(NULLIF(sml.sml_doc_rate, 0) ORDER BY sml.sml_line_no DESC, sml.sml_split_no DESC)
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
    const forceBlock = (isTransferShape(rules.postShape) || rules.blockNegative === true) && !params.reversal;
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
           CASE WHEN ${forceBlock}::boolean THEN 'BLOCK'
                ELSE COALESCE(stp.stp_allow_negative, 'ALLOW') END AS "allowNegative"
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
       AND (${forceBlock}::boolean OR COALESCE(stp.stp_allow_negative, 'ALLOW') <> 'ALLOW')
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
async function recomputeHeaderTotals(tx, params) {
    const { rules, svhId, accYear } = params;
    const isCount = rules.quantityMode === 'COUNT';
    const netted = isCount || rules.lineDirection === 'REASON';
    const outOnly = rules.postShape === 'TRANSFER_OUT';
    await tx.$executeRaw `
    WITH led AS (
      SELECT sml.sml_line_no, sml.sml_is_reversal,
             CASE WHEN sml.sml_is_reversal THEN -1 ELSE 1 END                                     AS rev_sign,
             CASE WHEN ${netted}::boolean THEN sml.sml_direction ELSE 1 END                      AS doc_sign,
             sml.sml_base_qty + sml.sml_free_base_qty                                            AS qty,
             sml.sml_cost_value, sml.sml_cost_value_wot
        FROM stock.stock_ledger sml
       WHERE sml.sml_src_doc_id = ${svhId}::uuid
         AND sml.sml_acc_year   = ${accYear}::bpchar
         AND sml.sml_is_deleted = false
         AND (NOT ${outOnly}::boolean OR sml.sml_txn_type = 'TRANSFER_OUT')
    ),
    totals AS (
      SELECT (SELECT count(*) FROM stock.stock_voucher_item svi
               WHERE svi.svi_voucher_id = ${svhId}::uuid AND svi.svi_acc_year = ${accYear}::bpchar
                 AND svi.svi_is_deleted = false)                                                  AS line_count,
             -- On a COUNT the ledger signs the variance and a reversal flips the
             -- direction, so the direction alone already nets a cancel to 0.
             COALESCE(SUM(CASE WHEN ${netted}::boolean THEN doc_sign ELSE rev_sign END * qty), 0)               AS total_qty,
             COALESCE(SUM(CASE WHEN ${netted}::boolean THEN doc_sign ELSE rev_sign END * sml_cost_value), 0)    AS total_value,
             COALESCE(SUM(CASE WHEN ${netted}::boolean THEN doc_sign ELSE rev_sign END * sml_cost_value_wot), 0) AS total_value_wot
        FROM led
    )
    UPDATE stock.stock_voucher svh
       SET svh_line_count      = t.line_count,
           svh_total_qty       = t.total_qty,
           svh_total_value     = t.total_value,
           svh_total_value_wot = t.total_value_wot
      FROM totals t
     WHERE svh.svh_id       = ${svhId}::uuid
       AND svh.svh_acc_year = ${accYear}::bpchar
  `;
}
async function cancelStockVoucher(tx, params) {
    const { rules, svhId, accYear, actor, cancelledOn } = params;
    const author = auditColumnActor(actor);
    await assertTransferCancellable(tx, params);
    await lockHeaderInStatus(tx, params, 'POSTED');
    const rowsReversed = await writeReversalLedger(tx, params);
    const apply = { rules, svhId, accYear, actor, postedOn: cancelledOn };
    await applyLedgerRows(tx, { ...apply, reversal: true });
    await recomputeHeaderTotals(tx, apply);
    await tx.stockVoucher.update({
        where: { svhId_svhAccYear: { svhId, svhAccYear: accYear } },
        data: {
            svhStatus: 'CANCELLED',
            svhVersionNo: { increment: 1 },
            svhModifiedOn: cancelledOn,
            svhModifiedBy: author,
        },
    });
    return rowsReversed;
}
async function assertTransferCancellable(tx, { rules, svhId, accYear }) {
    if (!isTransferShape(rules.postShape)) {
        return;
    }
    const [header] = await tx.$queryRaw `
    SELECT svh_status AS status, svh_refno AS refno
      FROM stock.stock_voucher
     WHERE svh_id = ${svhId}::uuid AND svh_acc_year = ${accYear}::bpchar AND svh_is_deleted = false
  `;
    if (!header) {
        return;
    }
    if (rules.postShape === 'TRANSFER_OUT' && (header.status === 'IN_TRANSIT' || header.status === 'RECEIVED')) {
        (0, module_service_utils_1.throwStockConflict)(`${rules.displayName} is ${header.status}`, [
            {
                field: 'svhId',
                message: `${header.refno} is ${header.status}: goods that left cannot be cancelled on paper. Receive what arrived and transfer it back, or short-settle what never arrived.`,
            },
        ]);
    }
    if (rules.postShape === 'TRANSFER_IN' && header.status === 'POSTED') {
        (0, module_service_utils_1.throwStockConflict)(`${rules.displayName} is POSTED`, [
            {
                field: 'svhId',
                message: `${header.refno} has been received: un-receiving is a reverse transfer back to the sender, not a cancellation.`,
            },
        ]);
    }
}
async function cancelDraftVoucher(tx, params) {
    const { svhId, accYear, actor, cancelledOn } = params;
    await lockHeaderInStatus(tx, params, 'DRAFT');
    await tx.stockVoucher.update({
        where: { svhId_svhAccYear: { svhId, svhAccYear: accYear } },
        data: {
            svhStatus: 'CANCELLED',
            svhVersionNo: { increment: 1 },
            svhModifiedOn: cancelledOn,
            svhModifiedBy: auditColumnActor(actor),
        },
    });
    return 0;
}
async function lockHeaderInStatus(tx, { rules, svhId, accYear }, expected) {
    const [header] = await tx.$queryRaw `
    SELECT svh.svh_status AS status, svh.svh_refno AS refno, svh.svh_voucher_type AS voucher_type,
           svh.svh_branch_id AS branch_id, svh.svh_to_branch_id AS to_branch_id,
           svh.svh_to_godown_id AS to_godown_id,
           svh.svh_link_src_doc_id AS link_src_doc_id, svh.svh_link_src_acc_year AS link_src_acc_year
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
                message: `${svhId} no longer exists in ${accYear}, so there is nothing to ${expected === 'DRAFT' ? 'post' : 'cancel'}.`,
            },
        ]);
    }
    if (header.status !== expected) {
        (0, module_service_utils_1.throwStockConflict)(`${rules.displayName} is ${header.status}`, [
            {
                field: 'svhId',
                message: header.status === 'CANCELLED'
                    ? `${header.refno} was already cancelled.`
                    :
                        `${header.refno} is ${header.status}, not ${expected}: it changed while this request was waiting. Reload it and decide again.`,
            },
        ]);
    }
    return {
        status: header.status,
        refno: header.refno,
        voucherType: header.voucher_type,
        branchId: header.branch_id,
        toBranchId: header.to_branch_id,
        toGodownId: header.to_godown_id,
        linkSrcDocId: header.link_src_doc_id,
        linkSrcAccYear: header.link_src_acc_year,
    };
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