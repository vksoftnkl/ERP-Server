"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.STOCK_LOT_ID_NAMESPACE = exports.BUCKET_MOVE_TXN_TYPES = exports.STOCK_LEDGER_SRC_MODULE = void 0;
exports.postStockVoucher = postStockVoucher;
exports.effectivePolicyLateral = effectivePolicyLateral;
exports.effectivePolicyCte = effectivePolicyCte;
exports.lotIdentityKeyColumns = lotIdentityKeyColumns;
exports.bucketKeyFor = bucketKeyFor;
exports.bucketKeySql = bucketKeySql;
exports.readBucketTrackFlags = readBucketTrackFlags;
exports.lineReasonJoin = lineReasonJoin;
exports.lineDirectionColumn = lineDirectionColumn;
exports.lotlessOutwardLine = lotlessOutwardLine;
exports.unreversedLedgerRow = unreversedLedgerRow;
exports.lotIdentityUuid = lotIdentityUuid;
exports.settleTransitShort = settleTransitShort;
exports.transitHoldingsOf = transitHoldingsOf;
exports.reservationHoldingsOf = reservationHoldingsOf;
exports.openReservationHoldings = openReservationHoldings;
exports.ensureBalanceRows = ensureBalanceRows;
exports.refreshReserved = refreshReserved;
exports.refreshTransitIn = refreshTransitIn;
exports.rebuildStockDerivedFigures = rebuildStockDerivedFigures;
exports.cancelStockVoucher = cancelStockVoucher;
exports.cancelDraftVoucher = cancelDraftVoucher;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const stock_voucher_types_1 = require("./types/stock-voucher.types");
const price_resolver_1 = require("../../Inventory/items-price-master/price-resolver");
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
exports.BUCKET_MOVE_TXN_TYPES = ['BUCKET_OUT', 'BUCKET_IN'];
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
    else if (shape === 'BUCKET_MOVE') {
        await assertLotsNamed(tx, params, 'moved', 'a stock move moves one lot from one bucket to another; pick it from the balance.');
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
    await lockHoldingItems(tx, touchedHoldings(params));
    await applyBalances(tx, params);
    await applyLotCost(tx, params);
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
             COALESCE(stp.stp_issue_strategy,   'FEFO') AS issue_strategy,
             -- Notes 92 — how a holding of this item is COSTED. WAVG is the
             -- no-policy default and what every plain (untracked) item keeps:
             -- the item's branch moving average. LOT_ACTUAL costs each lot on
             -- its own in this branch. The policy service and
             -- ck_stp_valuation_tracks hold the column to the track flags, so
             -- no tracked item is ever averaged across its lots.
             COALESCE(stp.stp_valuation_method, 'WAVG') AS valuation_method
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
function bucketKeyFor(policy, value) {
    return {
        mrp: policy?.trackMrp ? (0, price_resolver_1.normalizeBucketValue)(value.mrp) : null,
        salePrice: policy?.trackSalePrice ? (0, price_resolver_1.normalizeBucketValue)(value.salePrice) : null,
    };
}
function bucketKeySql(args) {
    return {
        mrp: client_1.Prisma.sql `CASE WHEN ${args.trackMrp} AND ${args.mrp} > 0 THEN ${args.mrp} END`,
        salePrice: client_1.Prisma.sql `CASE WHEN ${args.trackSalePrice} AND ${args.salePrice} > 0 THEN ${args.salePrice} END`,
    };
}
async function readBucketTrackFlags(client, scopes, onDate) {
    if (!scopes.length) {
        return [];
    }
    const rows = await client.$queryRaw `
    SELECT q.ord,
           COALESCE(stp.stp_track_mrp,        false) AS "trackMrp",
           COALESCE(stp.stp_track_sale_price, false) AS "trackSalePrice"
      FROM unnest(${scopes.map((s) => s.itemId)}::text[],
                  ${scopes.map((s) => s.companyId ?? '')}::text[],
                  ${scopes.map((s) => s.branchId ?? '')}::text[])
           WITH ORDINALITY AS q(item_id, company_id, branch_id, ord)
      JOIN inventory.item_master itm ON itm.item_id = q.item_id::uuid
      ${effectivePolicyLateral({
        companyId: client_1.Prisma.raw("NULLIF(q.company_id, '')::uuid"),
        branchId: client_1.Prisma.raw("NULLIF(q.branch_id, '')::uuid"),
        itemId: client_1.Prisma.raw('itm.item_id'),
        itemGroupId: client_1.Prisma.raw('itm.item_group_id'),
        onDate: client_1.Prisma.sql `${onDate}::date`,
    })}
     ORDER BY q.ord
  `;
    const byOrd = new Map(rows.map((row) => [Number(row.ord), row]));
    return scopes.map((_, index) => {
        const row = byOrd.get(index + 1);
        return { trackMrp: row?.trackMrp ?? false, trackSalePrice: row?.trackSalePrice ?? false };
    });
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
    const [plus, minus] = [
        rules.ledgerTxnTypes[0],
        rules.ledgerTxnTypes[1] ?? rules.ledgerTxnTypes[0],
    ];
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
             policy.issue_strategy, policy.valuation_method,
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
    lotted AS (
      -- Notes 92 — the line's LOT, and what that lot costs IN THIS BRANCH.
      -- slc resolves the lot the line names or the one its identity keys
      -- to; lc reads the lot's own rate off its balance rows here (every
      -- godown and bucket of a lot carries ONE rate — applyLotCost), and
      -- only for an item the policy costs LOT_ACTUAL. A WAVG line reads NULL
      -- in both lot_rate columns and prices exactly as it always did. A 0 is
      -- "no rate" (a row ensureBalanceRows opened ahead of a transit), so a
      -- lot new to the branch falls through to the item average below.
      SELECT keyed.*,
             slc.slt_id            AS line_lot_id,
             slc.slt_cost_rate     AS slt_cost_rate,
             slc.slt_cost_rate_wot AS slt_cost_rate_wot,
             lc.lot_rate,
             lc.lot_rate_wot
        FROM keyed
        -- The lot the line names, or the one its identity resolves to.
        LEFT JOIN LATERAL (
          SELECT l.slt_id, l.slt_cost_rate, l.slt_cost_rate_wot
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
        LEFT JOIN LATERAL (
          SELECT NULLIF(MAX(b.sbl_avg_cost_rate), 0)     AS lot_rate,
                 NULLIF(MAX(b.sbl_avg_cost_rate_wot), 0) AS lot_rate_wot
            FROM stock.stock_balance b
           WHERE keyed.valuation_method = 'LOT_ACTUAL'
             AND b.sbl_company_id = keyed.svh_company_id
             AND b.sbl_branch_id  = keyed.svh_branch_id
             AND b.sbl_item_id    = keyed.svi_item_id
             AND b.sbl_lot_id     = slc.slt_id
             AND b.sbl_is_deleted = false
        ) lc ON true
    ),
    priced AS (
      SELECT keyed.*,
             ${lineTxnTypeColumn(rules, 'keyed')},
             stt.stt_id AS transit_id,
             CASE WHEN ${shape === 'TRANSFER_IN'}::boolean THEN COALESCE(stt.stt_cost_rate, 0)
                  -- AN OUTWARD LINE IS RELIEVED AT WHAT THE STOCK COST US,
                  -- whatever the document's rate source says and whatever was
                  -- keyed: a write-off, an issue or a count shortage cannot
                  -- value itself (physical plan §3.3, adjustments plan §2).
                  -- Notes 92: for a tracked (LOT_ACTUAL) item that is the
                  -- LOT's own cost in this branch; for a plain item, and for a
                  -- lot this branch has never held, the branch's moving
                  -- average. Only when neither exists does a keyed figure stand.
                  WHEN keyed.line_direction < 0
                    OR (${isCount}::boolean AND COALESCE(keyed.svi_diff_qty, 0) < 0)
                  THEN COALESCE(keyed.lot_rate, NULLIF(sic.sic_avg_cost_rate, 0), NULLIF(keyed.svi_cost_rate, 0), 0)
                  -- The IN half of a re-lot receives the SAME GOODS its OUT
                  -- half relieved, so it inherits what they cost: the OUT
                  -- lots' rates, weighted by quantity (notes 92 §3.2). Only
                  -- under LOT_ACTUAL — a plain item's two halves both read
                  -- the item average anyway.
                  WHEN relot.qty > 0 THEN ROUND(relot.value / relot.qty, 6)
                  ELSE
             -- Only a zero falls through — see the note on this function.
             COALESCE(NULLIF(keyed.svi_cost_rate, 0),
                      CASE keyed.svh_rate_source
                        -- AVG_COST on a lot this branch already holds is that
                        -- lot's own cost (a count overage or an adjustment
                        -- gain lands on the shelf at what the shelf cost);
                        -- the item average only for a lot new to the branch.
                        WHEN 'AVG_COST'      THEN COALESCE(keyed.lot_rate, sic.sic_avg_cost_rate)
                        WHEN 'LAST_PURCHASE' THEN sic.sic_last_purchase_rate
                        -- LOT_COST: the lot's running cost here, else the
                        -- cost on its first receipt (slt_cost_rate is written
                        -- once, when the lot is opened, and never after).
                        WHEN 'LOT_COST'      THEN COALESCE(keyed.lot_rate, keyed.slt_cost_rate)
                        WHEN 'MRP'           THEN keyed.svi_mrp
                        ELSE NULL
                      END,
                      0) END                                 AS line_cost_rate,
             -- The without-tax rate comes from WHERE THE COST CAME FROM, never a
             -- mix (notes 77): the lot's wot only with the lot's cost, the
             -- average's only with the average's, the line's own only with
             -- the line's. A 0 is "not stated" — costed derives it from the
             -- cost and the tax rate — never a rate: an average carrying cost
             -- but a 0 wot used to receive and relieve stock at a 0
             -- without-tax cost.
             CASE WHEN ${shape === 'TRANSFER_IN'}::boolean THEN COALESCE(stt.stt_cost_rate_wot, 0)
                  WHEN keyed.line_direction < 0
                    OR (${isCount}::boolean AND COALESCE(keyed.svi_diff_qty, 0) < 0)
                  THEN CASE WHEN keyed.lot_rate IS NOT NULL
                            THEN keyed.lot_rate_wot
                            WHEN NULLIF(sic.sic_avg_cost_rate, 0) IS NOT NULL
                            THEN NULLIF(sic.sic_avg_cost_rate_wot, 0)
                            ELSE NULLIF(keyed.svi_cost_rate_wot, 0) END
                  WHEN relot.qty > 0 THEN NULLIF(ROUND(relot.value_wot / relot.qty, 6), 0)
                  WHEN NULLIF(keyed.svi_cost_rate, 0) IS NOT NULL
                  THEN NULLIF(keyed.svi_cost_rate_wot, 0)
                  ELSE
                      CASE keyed.svh_rate_source
                        WHEN 'AVG_COST'      THEN CASE WHEN keyed.lot_rate IS NOT NULL
                                                       THEN keyed.lot_rate_wot
                                                       ELSE NULLIF(sic.sic_avg_cost_rate_wot, 0) END
                        WHEN 'LOT_COST'      THEN CASE WHEN keyed.lot_rate IS NOT NULL
                                                       THEN keyed.lot_rate_wot
                                                       ELSE NULLIF(keyed.slt_cost_rate_wot, 0) END
                        ELSE NULL
                      END END                                AS stated_cost_rate_wot
        FROM lotted keyed
        LEFT JOIN stock.stock_item_cost sic
               ON sic.sic_company_id = keyed.svh_company_id
              AND sic.sic_branch_id  = keyed.svh_branch_id
              AND sic.sic_item_id    = keyed.svi_item_id
              AND sic.sic_is_deleted = false
        -- Notes 92 — for the IN half of a re-lot: the OUT half (or halves) of
        -- the same item in this document, each at what ITS lot cost, so the
        -- goods arrive in the new lot at what they left the old one at.
        LEFT JOIN LATERAL (
          SELECT SUM(o.move_base_qty + o.move_free_base_qty)                                              AS qty,
                 SUM((o.move_base_qty + o.move_free_base_qty)
                     * COALESCE(o.lot_rate, NULLIF(sic.sic_avg_cost_rate, 0), NULLIF(o.svi_cost_rate, 0), 0)) AS value,
                 SUM((o.move_base_qty + o.move_free_base_qty)
                     * CASE WHEN o.lot_rate IS NOT NULL THEN COALESCE(o.lot_rate_wot, 0)
                            WHEN NULLIF(sic.sic_avg_cost_rate, 0) IS NOT NULL
                            THEN COALESCE(NULLIF(sic.sic_avg_cost_rate_wot, 0), 0)
                            ELSE COALESCE(NULLIF(o.svi_cost_rate_wot, 0), 0) END)                       AS value_wot
            FROM lotted o
           WHERE keyed.valuation_method = 'LOT_ACTUAL'
             AND keyed.line_direction > 0
             AND keyed.reason_code    = ${stock_voucher_types_1.RELOT_REASON_CODES.in}
             AND o.svi_item_id        = keyed.svi_item_id
             AND o.line_direction     < 0
             AND o.reason_code        = ${stock_voucher_types_1.RELOT_REASON_CODES.out}
        ) relot ON true
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
      -- A COUNT line carries no tax rate (the save strips it, §3.3), so it
      -- takes the item's own as at the document date — item_tax_history's
      -- latest window, else item_default_tax_id, the rule of
      -- item-tax-rate.helper — or a count of a taxed item would value its
      -- gain at the inclusive rate on the without-tax side (notes 77).
      SELECT priced.*,
             COALESCE(priced.stated_cost_rate_wot,
                      ROUND(priced.line_cost_rate / (1 + COALESCE(
                        CASE WHEN ${isCount}::boolean THEN item_tax.tax_rate_perc
                             ELSE priced.svi_tax_perc END, 0) / 100), 6),
                      0)                                     AS line_cost_rate_wot
        FROM priced
        LEFT JOIN LATERAL (
          SELECT t.tax_rate_perc
            FROM inventory.tax_rate_master t
           WHERE ${isCount}::boolean
             AND t.tax_id = COALESCE(
                   (SELECT h.ith_tax_id
                      FROM inventory.item_tax_history h
                     WHERE h.ith_item_id = priced.svi_item_id
                       AND h.ith_effective_from <= priced.svh_doc_date
                       AND (h.ith_effective_to IS NULL OR h.ith_effective_to >= priced.svh_doc_date)
                     ORDER BY h.ith_effective_from DESC
                     LIMIT 1),
                   (SELECT i.item_default_tax_id
                      FROM inventory.item_master i
                     WHERE i.item_id = priced.svi_item_id))
        ) item_tax ON true
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
            const take = last
                ? remaining
                : client_1.Prisma.Decimal.min(remaining, new client_1.Prisma.Decimal(lot.available));
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
      slt_id, slt_company_id, slt_tenant_id, slt_item_id, slt_base_uom_id,
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
           ${lotIdentityUuid('c')},
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
    -- No conflict target on purpose: the identity's own id (slt_id, below)
    -- and ux_slt_identity both say "this lot exists", and a lot opened
    -- before ids were deterministic conflicts only on the second.
    ON CONFLICT DO NOTHING
  `;
}
exports.STOCK_LOT_ID_NAMESPACE = '2f0b7c1e-5d3a-4e8f-9b61-7c4d2a9e0f53';
function lotIdentityUuid(alias) {
    const c = client_1.Prisma.raw(alias);
    return client_1.Prisma.sql `
    (SELECT overlay(
              overlay(substr(encode(h.b, 'hex'), 1, 32) placing '5' from 13 for 1)
              placing substr('89ab', ((get_byte(h.b, 8) >> 4) & 3) + 1, 1) from 17 for 1
            )::uuid
       FROM (SELECT digest(
                      decode(replace(${exports.STOCK_LOT_ID_NAMESPACE}::text, '-', ''), 'hex')
                      || convert_to(
                           ${c}.svh_company_id::text
                           || '|' || ${c}.svi_item_id::text
                           || '|' || ${c}.key_batch
                           || '|' || ${c}.key_mrp::numeric(18, 6)::text
                           || '|' || ${c}.key_sp::numeric(18, 6)::text
                           || '|' || to_char(${c}.key_expiry, 'YYYY-MM-DD')
                           || '|' || ${c}.key_serial
                           || '|' || ${c}.key_supplier::text,
                           'UTF8'),
                      'sha1') AS b) h)
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
            client_1.Prisma.sql `(${DIRECTION_OUT}::int, 'TRANSFER_OUT'::text, false, false, false, false)`,
            client_1.Prisma.sql `(${DIRECTION_IN}::int, 'TRANSFER_IN'::text, true, true, false, false)`,
        ]
        : shape === 'TRANSFER_IN'
            ? [client_1.Prisma.sql `(${DIRECTION_IN}::int, 'TRANSFER_IN'::text, false, false, false, false)`]
            : shape === 'BUCKET_MOVE'
                ? [
                    client_1.Prisma.sql `(${DIRECTION_OUT}::int, 'BUCKET_OUT'::text, false, false, false, false)`,
                    client_1.Prisma.sql `(${DIRECTION_IN}::int, 'BUCKET_IN'::text, false, false, false, true)`,
                ]
                : [client_1.Prisma.sql `(${direction}::int, ${plusTxnType}::text, false, false, true, false)`];
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
           CASE WHEN side.to_bucket THEN c.svi_to_bucket ELSE c.svi_bucket END,
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
      CROSS JOIN (VALUES ${client_1.Prisma.join(sides)}) AS side(direction, txn_type, to_godown, same_branch_only, from_line, to_bucket)
     WHERE (c.move_base_qty + c.move_free_base_qty) <> 0
       AND (NOT side.same_branch_only OR c.same_branch)
     ORDER BY c.svi_line_no, c.svi_split_no, side.direction DESC
  `;
}
async function assertLotsNamed(tx, { rules, svhId, accYear }, verb, why) {
    const lotless = await tx.$queryRaw `
    SELECT svi_line_no FROM stock.stock_voucher_item
     WHERE svi_voucher_id = ${svhId}::uuid AND svi_acc_year = ${accYear}::bpchar
       AND svi_is_deleted = false AND svi_lot_id IS NULL
     ORDER BY svi_line_no
  `;
    if (lotless.length) {
        (0, module_service_utils_1.throwStockUnprocessable)(`This ${rules.displayName.toLowerCase()} cannot be ${verb}`, lotless.map((r) => ({
            field: `lines.${r.svi_line_no}`,
            message: `Line ${r.svi_line_no} names no lot — ${why}`,
        })));
    }
}
async function assertDespatchable(tx, params, header) {
    const { rules, svhId, accYear } = params;
    await assertLotsNamed(tx, params, 'despatched', 'a transfer moves existing stock; pick it from the balance.');
    const sameBranch = header.toBranchId === null || header.toBranchId === header.branchId;
    if (!sameBranch && !header.toGodownId) {
        (0, module_service_utils_1.throwStockUnprocessable)(`This ${rules.displayName.toLowerCase()} cannot be despatched`, [
            {
                field: 'toGodownId',
                message: 'An inter-branch transfer must name the destination godown.',
            },
        ]);
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
            ? {
                svhId: closed[0].svh_id,
                accYear: closed[0].svh_acc_year.trim(),
                refno: closed[0].svh_refno,
            }
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
            {
                field: 'outVoucherId',
                message: `No live TRANSFER_OUT ${outId} in ${outAccYear} for this branch.`,
            },
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
    await rebuildBalances(tx, touchedHoldings(params), params.actor, params.postedOn);
}
function touchedHoldings(params) {
    return client_1.Prisma.sql `
    SELECT DISTINCT sml.sml_company_id AS company_id, sml.sml_branch_id AS branch_id,
           sml.sml_godown_id AS godown_id, sml.sml_item_id AS item_id,
           sml.sml_lot_id AS lot_id, sml.sml_bucket AS bucket
      FROM stock.stock_ledger sml
     WHERE ${ledgerRowsOf(params)}
  `;
}
function reversalJoin(alias, rev) {
    const a = client_1.Prisma.raw(alias);
    const r = client_1.Prisma.raw(rev);
    return client_1.Prisma.sql `
        LEFT JOIN stock.stock_ledger ${r}
          ON ${r}.sml_reverses_id = ${a}.sml_id
         AND ${r}.sml_acc_year    = ${a}.sml_acc_year
         AND ${r}.sml_is_reversal = true
         AND ${r}.sml_is_deleted  = false
  `;
}
async function rebuildBalances(tx, holdings, actor, on) {
    return tx.$executeRaw `
    WITH holding AS (${holdings}),
    led AS (
      SELECT h.company_id, h.branch_id, h.godown_id, h.item_id, h.lot_id, h.bucket,
             MAX(sml.sml_tenant_id::text)::uuid                                                        AS tenant_id,
             (array_agg(sml.sml_base_uom_id ORDER BY sml.sml_doc_datetime DESC, sml.sml_id DESC))[1]  AS base_uom_id,
             SUM(CASE WHEN sml.sml_direction > 0 THEN sml.sml_base_qty      ELSE 0 END)                AS in_qty,
             SUM(CASE WHEN sml.sml_direction < 0 THEN sml.sml_base_qty      ELSE 0 END)                AS out_qty,
             SUM(CASE WHEN sml.sml_direction > 0 THEN sml.sml_free_base_qty ELSE 0 END)                AS free_in_qty,
             SUM(CASE WHEN sml.sml_direction < 0 THEN sml.sml_free_base_qty ELSE 0 END)                AS free_out_qty,
             MIN(sml.sml_doc_date) FILTER (WHERE sml.sml_direction > 0 AND NOT sml.sml_is_reversal AND rev.sml_id IS NULL) AS first_in_date,
             MAX(sml.sml_doc_date) FILTER (WHERE sml.sml_direction > 0 AND NOT sml.sml_is_reversal AND rev.sml_id IS NULL) AS last_in_date,
             MAX(sml.sml_doc_date) FILTER (WHERE sml.sml_direction < 0 AND NOT sml.sml_is_reversal AND rev.sml_id IS NULL) AS last_out_date
        FROM holding h
        JOIN stock.stock_ledger sml
          ON sml.sml_company_id = h.company_id AND sml.sml_branch_id = h.branch_id
         AND sml.sml_godown_id  = h.godown_id  AND sml.sml_item_id   = h.item_id
         AND sml.sml_lot_id     = h.lot_id     AND sml.sml_bucket    = h.bucket
         AND sml.sml_is_deleted = false
        ${reversalJoin('sml', 'rev')}
       GROUP BY 1, 2, 3, 4, 5, 6
    )
    INSERT INTO stock.stock_balance (
      sbl_company_id, sbl_branch_id, sbl_tenant_id, sbl_godown_id, sbl_item_id,
      sbl_lot_id, sbl_base_uom_id, sbl_bucket,
      sbl_in_qty, sbl_out_qty, sbl_free_in_qty, sbl_free_out_qty,
      sbl_first_in_date, sbl_last_in_date, sbl_last_out_date,
      sbl_batch_no, sbl_mrp, sbl_sale_price, sbl_expiry_date, sbl_supplier_id,
      sbl_created_by
    )
    SELECT m.company_id, m.branch_id, m.tenant_id, m.godown_id, m.item_id,
           m.lot_id, m.base_uom_id, m.bucket,
           m.in_qty, m.out_qty, m.free_in_qty, m.free_out_qty,
           m.first_in_date, m.last_in_date, m.last_out_date,
           slt.slt_batch_no, slt.slt_mrp, slt.slt_sale_price, slt.slt_expiry_date, slt.slt_supplier_id,
           ${auditColumnActor(actor)}
      FROM led m
      JOIN stock.stock_lot slt ON slt.slt_id = m.lot_id
    ON CONFLICT (sbl_company_id, sbl_branch_id, sbl_godown_id, sbl_item_id, sbl_lot_id, sbl_bucket)
    WHERE sbl_is_deleted = false
    DO UPDATE SET
      -- ASSIGNED, not added: EXCLUDED carries the whole history's sum.
      sbl_in_qty        = EXCLUDED.sbl_in_qty,
      sbl_out_qty       = EXCLUDED.sbl_out_qty,
      sbl_free_in_qty   = EXCLUDED.sbl_free_in_qty,
      sbl_free_out_qty  = EXCLUDED.sbl_free_out_qty,
      sbl_first_in_date = EXCLUDED.sbl_first_in_date,
      sbl_last_in_date  = EXCLUDED.sbl_last_in_date,
      sbl_last_out_date = EXCLUDED.sbl_last_out_date,
      sbl_batch_no      = EXCLUDED.sbl_batch_no,
      sbl_mrp           = EXCLUDED.sbl_mrp,
      sbl_sale_price    = EXCLUDED.sbl_sale_price,
      sbl_expiry_date   = EXCLUDED.sbl_expiry_date,
      sbl_supplier_id   = EXCLUDED.sbl_supplier_id,
      sbl_row_version   = stock.stock_balance.sbl_row_version + 1,
      sbl_modified_on   = ${on},
      sbl_modified_by   = ${auditColumnActor(actor)}
    WHERE stock.stock_balance.sbl_in_qty        IS DISTINCT FROM EXCLUDED.sbl_in_qty
       OR stock.stock_balance.sbl_out_qty       IS DISTINCT FROM EXCLUDED.sbl_out_qty
       OR stock.stock_balance.sbl_free_in_qty   IS DISTINCT FROM EXCLUDED.sbl_free_in_qty
       OR stock.stock_balance.sbl_free_out_qty  IS DISTINCT FROM EXCLUDED.sbl_free_out_qty
       OR stock.stock_balance.sbl_first_in_date IS DISTINCT FROM EXCLUDED.sbl_first_in_date
       OR stock.stock_balance.sbl_last_in_date  IS DISTINCT FROM EXCLUDED.sbl_last_in_date
       OR stock.stock_balance.sbl_last_out_date IS DISTINCT FROM EXCLUDED.sbl_last_out_date
       OR stock.stock_balance.sbl_batch_no      IS DISTINCT FROM EXCLUDED.sbl_batch_no
       OR stock.stock_balance.sbl_mrp           IS DISTINCT FROM EXCLUDED.sbl_mrp
       OR stock.stock_balance.sbl_sale_price    IS DISTINCT FROM EXCLUDED.sbl_sale_price
       OR stock.stock_balance.sbl_expiry_date   IS DISTINCT FROM EXCLUDED.sbl_expiry_date
       OR stock.stock_balance.sbl_supplier_id   IS DISTINCT FROM EXCLUDED.sbl_supplier_id
  `;
}
async function applyLotCost(tx, params) {
    await rebuildLotCosts(tx, touchedLotActualLots(params));
}
function touchedItems(params) {
    const { svhId, accYear } = params;
    return client_1.Prisma.sql `
    SELECT t.company_id, t.branch_id, t.item_id,
           COALESCE(stp.stp_valuation_method, 'WAVG') AS valuation_method
      FROM (SELECT DISTINCT sml.sml_company_id AS company_id, sml.sml_branch_id AS branch_id,
                   sml.sml_item_id AS item_id
              FROM stock.stock_ledger sml
             WHERE ${ledgerRowsOf(params)}) t
      CROSS JOIN (SELECT svh.svh_doc_date
                    FROM stock.stock_voucher svh
                   WHERE svh.svh_id = ${svhId}::uuid AND svh.svh_acc_year = ${accYear}::bpchar) doc
      JOIN inventory.item_master itm ON itm.item_id = t.item_id
      ${effectivePolicyLateral({
        companyId: client_1.Prisma.raw('t.company_id'),
        branchId: client_1.Prisma.raw('t.branch_id'),
        itemId: client_1.Prisma.raw('t.item_id'),
        itemGroupId: client_1.Prisma.raw('itm.item_group_id'),
        onDate: client_1.Prisma.raw('doc.svh_doc_date'),
    })}
  `;
}
function touchedLotActualLots(params) {
    return client_1.Prisma.sql `
    SELECT t.company_id, t.branch_id, t.item_id, t.lot_id
      FROM (SELECT DISTINCT sml.sml_company_id AS company_id, sml.sml_branch_id AS branch_id,
                   sml.sml_item_id AS item_id, sml.sml_lot_id AS lot_id
              FROM stock.stock_ledger sml
             WHERE ${ledgerRowsOf(params)}) t
      JOIN (${touchedItems(params)}) i
        ON i.company_id = t.company_id AND i.branch_id = t.branch_id AND i.item_id = t.item_id
     WHERE i.valuation_method = 'LOT_ACTUAL'
  `;
}
async function rebuildLotCosts(tx, lots) {
    return tx.$executeRaw `
    WITH lot AS (${lots}),
    led AS (
      SELECT l.company_id, l.branch_id, l.item_id, l.lot_id,
             COALESCE(SUM(sml.sml_signed_base_qty), 0)                                                AS qty,
             COALESCE(SUM(sml.sml_direction * sml.sml_cost_value), 0)                                 AS value,
             COALESCE(SUM(sml.sml_direction * sml.sml_cost_value_wot), 0)                             AS value_wot,
             (array_agg(sml.sml_cost_rate     ORDER BY sml.sml_doc_datetime DESC, sml.sml_id DESC))[1] AS last_rate,
             (array_agg(sml.sml_cost_rate_wot ORDER BY sml.sml_doc_datetime DESC, sml.sml_id DESC))[1] AS last_rate_wot
        FROM lot l
        LEFT JOIN stock.stock_ledger sml
               ON sml.sml_company_id = l.company_id AND sml.sml_branch_id = l.branch_id
              AND sml.sml_item_id    = l.item_id    AND sml.sml_lot_id    = l.lot_id
              AND sml.sml_is_deleted = false
       GROUP BY 1, 2, 3, 4
    ),
    rated AS (
      SELECT led.*,
             CASE WHEN led.qty > 0 THEN ROUND(led.value     / led.qty, 6) ELSE COALESCE(led.last_rate, 0)     END AS rate,
             CASE WHEN led.qty > 0 THEN ROUND(led.value_wot / led.qty, 6) ELSE COALESCE(led.last_rate_wot, 0) END AS rate_wot
        FROM led
    )
    UPDATE stock.stock_balance b
       SET sbl_avg_cost_rate     = r.rate,
           sbl_avg_cost_rate_wot = r.rate_wot,
           sbl_stock_value       = ROUND(b.sbl_on_hand_qty * r.rate,     2),
           sbl_stock_value_wot   = ROUND(b.sbl_on_hand_qty * r.rate_wot, 2)
      FROM rated r
     WHERE b.sbl_company_id = r.company_id
       AND b.sbl_branch_id  = r.branch_id
       AND b.sbl_item_id    = r.item_id
       AND b.sbl_lot_id     = r.lot_id
       AND b.sbl_is_deleted = false
       AND (b.sbl_avg_cost_rate     IS DISTINCT FROM r.rate
         OR b.sbl_avg_cost_rate_wot IS DISTINCT FROM r.rate_wot
         OR b.sbl_stock_value       IS DISTINCT FROM ROUND(b.sbl_on_hand_qty * r.rate,     2)
         OR b.sbl_stock_value_wot   IS DISTINCT FROM ROUND(b.sbl_on_hand_qty * r.rate_wot, 2))
  `;
}
async function applyItemCost(tx, params) {
    const items = touchedItems(params);
    await rebuildItemCosts(tx, items, params.actor, params.postedOn);
    await stampItemAverage(tx, items);
}
async function rebuildItemCosts(tx, items, actor, on) {
    const bucketMoves = exports.BUCKET_MOVE_TXN_TYPES;
    return tx.$executeRaw `
    WITH item AS (${items}),
    led AS (
      SELECT i.company_id, i.branch_id, i.item_id,
             (array_agg(sml.sml_base_uom_id ORDER BY sml.sml_doc_datetime, sml.sml_id))[1]               AS base_uom_id,
             COALESCE(SUM(sml.sml_signed_base_qty), 0)                                                  AS qty,
             COALESCE(SUM(sml.sml_direction * sml.sml_cost_value), 0)                                   AS value,
             COALESCE(SUM(sml.sml_direction * sml.sml_cost_value_wot), 0)                               AS value_wot,
             (array_agg(sml.sml_cost_rate     ORDER BY sml.sml_doc_datetime DESC, sml.sml_id DESC))[1]   AS last_rate,
             (array_agg(sml.sml_cost_rate_wot ORDER BY sml.sml_doc_datetime DESC, sml.sml_id DESC))[1]   AS last_rate_wot,
             -- The stamps: live, unreversed, forward INWARD rows, bucket moves aside.
             COALESCE(MAX(sml.sml_cost_rate) FILTER (
               WHERE sml.sml_direction > 0 AND NOT sml.sml_is_reversal AND rev.sml_id IS NULL
                 AND sml.sml_txn_type <> ALL(${bucketMoves}::text[])), 0)                                AS max_in_rate,
             (array_agg(sml.sml_cost_rate ORDER BY sml.sml_doc_datetime DESC, sml.sml_id DESC) FILTER (
               WHERE sml.sml_direction > 0 AND NOT sml.sml_is_reversal AND rev.sml_id IS NULL
                 AND sml.sml_txn_type <> ALL(${bucketMoves}::text[])))[1]                                AS last_in_rate,
             (array_agg(sml.sml_doc_date  ORDER BY sml.sml_doc_datetime DESC, sml.sml_id DESC) FILTER (
               WHERE sml.sml_direction > 0 AND NOT sml.sml_is_reversal AND rev.sml_id IS NULL
                 AND sml.sml_txn_type <> ALL(${bucketMoves}::text[])))[1]                                AS last_in_date,
             -- The latest unreversed SALE that carried a document rate.
             (array_agg(sml.sml_doc_rate ORDER BY sml.sml_doc_datetime DESC, sml.sml_id DESC) FILTER (
               WHERE sml.sml_direction < 0 AND NOT sml.sml_is_reversal AND rev.sml_id IS NULL
                 AND sml.sml_txn_type = 'SALE' AND sml.sml_doc_rate <> 0))[1]                            AS last_sale_rate,
             (array_agg(sml.sml_doc_date ORDER BY sml.sml_doc_datetime DESC, sml.sml_id DESC) FILTER (
               WHERE sml.sml_direction < 0 AND NOT sml.sml_is_reversal AND rev.sml_id IS NULL
                 AND sml.sml_txn_type = 'SALE' AND sml.sml_doc_rate <> 0))[1]                            AS last_sale_date
        FROM item i
        JOIN stock.stock_ledger sml
          ON sml.sml_company_id = i.company_id AND sml.sml_branch_id = i.branch_id
         AND sml.sml_item_id    = i.item_id    AND sml.sml_is_deleted = false
        ${reversalJoin('sml', 'rev')}
       GROUP BY 1, 2, 3
    ),
    next AS (
      SELECT led.*,
             CASE WHEN led.qty > 0 THEN ROUND(led.value     / led.qty, 6) ELSE COALESCE(led.last_rate, 0)     END AS avg,
             CASE WHEN led.qty > 0 THEN ROUND(led.value_wot / led.qty, 6) ELSE COALESCE(led.last_rate_wot, 0) END AS avg_wot
        FROM led
    )
    MERGE INTO stock.stock_item_cost c
    USING next n
       ON c.sic_company_id = n.company_id
      AND c.sic_branch_id  = n.branch_id
      AND c.sic_item_id    = n.item_id
      AND c.sic_is_deleted = false
    WHEN MATCHED AND (
            c.sic_total_qty          IS DISTINCT FROM n.qty
         OR c.sic_total_value        IS DISTINCT FROM n.value
         OR c.sic_total_value_wot    IS DISTINCT FROM n.value_wot
         OR c.sic_avg_cost_rate      IS DISTINCT FROM n.avg
         OR c.sic_avg_cost_rate_wot  IS DISTINCT FROM n.avg_wot
         OR c.sic_max_cost_rate      IS DISTINCT FROM n.max_in_rate
         OR c.sic_last_purchase_rate IS DISTINCT FROM COALESCE(n.last_in_rate, 0)
         OR c.sic_last_purchase_date IS DISTINCT FROM n.last_in_date
         OR c.sic_last_sale_rate     IS DISTINCT FROM COALESCE(n.last_sale_rate, 0)
         OR c.sic_last_sale_date     IS DISTINCT FROM n.last_sale_date)
    THEN UPDATE SET
         sic_total_qty          = n.qty,
         sic_total_value        = n.value,
         sic_total_value_wot    = n.value_wot,
         sic_avg_cost_rate      = n.avg,
         sic_avg_cost_rate_wot  = n.avg_wot,
         sic_max_cost_rate      = n.max_in_rate,
         sic_last_purchase_rate = COALESCE(n.last_in_rate, 0),
         sic_last_purchase_date = n.last_in_date,
         sic_last_sale_rate     = COALESCE(n.last_sale_rate, 0),
         sic_last_sale_date     = n.last_sale_date,
         sic_row_version        = c.sic_row_version + 1,
         sic_modified_on        = ${on},
         sic_modified_by        = ${auditColumnActor(actor)}
    WHEN NOT MATCHED THEN INSERT (
         sic_company_id, sic_branch_id, sic_item_id, sic_base_uom_id,
         sic_total_qty, sic_total_value, sic_total_value_wot,
         sic_avg_cost_rate, sic_avg_cost_rate_wot, sic_max_cost_rate,
         sic_last_purchase_rate, sic_last_purchase_date,
         sic_last_sale_rate, sic_last_sale_date, sic_created_by)
       VALUES (
         n.company_id, n.branch_id, n.item_id, n.base_uom_id,
         n.qty, n.value, n.value_wot,
         n.avg, n.avg_wot, n.max_in_rate,
         COALESCE(n.last_in_rate, 0), n.last_in_date,
         COALESCE(n.last_sale_rate, 0), n.last_sale_date, ${auditColumnActor(actor)})
  `;
}
async function stampItemAverage(tx, items) {
    return tx.$executeRaw `
    WITH item AS (${items})
    UPDATE stock.stock_balance b
       SET sbl_avg_cost_rate     = c.sic_avg_cost_rate,
           sbl_avg_cost_rate_wot = c.sic_avg_cost_rate_wot,
           sbl_stock_value       = ROUND(b.sbl_on_hand_qty * c.sic_avg_cost_rate,     2),
           sbl_stock_value_wot   = ROUND(b.sbl_on_hand_qty * c.sic_avg_cost_rate_wot, 2)
      FROM item i
      JOIN stock.stock_item_cost c
        ON c.sic_company_id = i.company_id
       AND c.sic_branch_id  = i.branch_id
       AND c.sic_item_id    = i.item_id
       AND c.sic_is_deleted = false
     WHERE i.valuation_method <> 'LOT_ACTUAL'
       AND b.sbl_company_id = c.sic_company_id
       AND b.sbl_branch_id  = c.sic_branch_id
       AND b.sbl_item_id    = c.sic_item_id
       AND b.sbl_is_deleted = false
       AND (b.sbl_avg_cost_rate     IS DISTINCT FROM c.sic_avg_cost_rate
         OR b.sbl_avg_cost_rate_wot IS DISTINCT FROM c.sic_avg_cost_rate_wot
         OR b.sbl_stock_value       IS DISTINCT FROM ROUND(b.sbl_on_hand_qty * c.sic_avg_cost_rate,     2)
         OR b.sbl_stock_value_wot   IS DISTINCT FROM ROUND(b.sbl_on_hand_qty * c.sic_avg_cost_rate_wot, 2))
  `;
}
function scopedLedgerRows(scope) {
    const companyId = scope.companyId ?? null;
    const branchId = scope.branchId ?? null;
    const itemId = scope.itemId ?? null;
    return client_1.Prisma.sql `
             sml.sml_is_deleted = false
         AND (${companyId}::uuid IS NULL OR sml.sml_company_id = ${companyId}::uuid)
         AND (${branchId}::uuid  IS NULL OR sml.sml_branch_id  = ${branchId}::uuid)
         AND (${itemId}::uuid    IS NULL OR sml.sml_item_id    = ${itemId}::uuid)
  `;
}
function scopedItems(scope) {
    return client_1.Prisma.sql `
    SELECT t.company_id, t.branch_id, t.item_id,
           COALESCE(stp.stp_valuation_method, 'WAVG') AS valuation_method
      FROM (SELECT DISTINCT sml.sml_company_id AS company_id, sml.sml_branch_id AS branch_id,
                   sml.sml_item_id AS item_id
              FROM stock.stock_ledger sml
             WHERE ${scopedLedgerRows(scope)}) t
      JOIN inventory.item_master itm ON itm.item_id = t.item_id
      ${effectivePolicyLateral({
        companyId: client_1.Prisma.raw('t.company_id'),
        branchId: client_1.Prisma.raw('t.branch_id'),
        itemId: client_1.Prisma.raw('t.item_id'),
        itemGroupId: client_1.Prisma.raw('itm.item_group_id'),
        onDate: client_1.Prisma.raw('CURRENT_DATE'),
    })}
  `;
}
async function rebuildStockDerivedFigures(tx, scope, actor, on) {
    const holdings = client_1.Prisma.sql `
    SELECT DISTINCT sml.sml_company_id AS company_id, sml.sml_branch_id AS branch_id,
           sml.sml_godown_id AS godown_id, sml.sml_item_id AS item_id,
           sml.sml_lot_id AS lot_id, sml.sml_bucket AS bucket
      FROM stock.stock_ledger sml
     WHERE ${scopedLedgerRows(scope)}
  `;
    const items = scopedItems(scope);
    const lots = client_1.Prisma.sql `
    SELECT t.company_id, t.branch_id, t.item_id, t.lot_id
      FROM (SELECT DISTINCT sml.sml_company_id AS company_id, sml.sml_branch_id AS branch_id,
                   sml.sml_item_id AS item_id, sml.sml_lot_id AS lot_id
              FROM stock.stock_ledger sml
             WHERE ${scopedLedgerRows(scope)}) t
      JOIN (${items}) i
        ON i.company_id = t.company_id AND i.branch_id = t.branch_id AND i.item_id = t.item_id
     WHERE i.valuation_method = 'LOT_ACTUAL'
  `;
    const lotIds = client_1.Prisma.sql `
    SELECT DISTINCT sml.sml_lot_id AS lot_id
      FROM stock.stock_ledger sml
     WHERE ${scopedLedgerRows(scope)}
  `;
    await lockHoldingItems(tx, holdings);
    const balances = await rebuildBalances(tx, holdings, actor, on);
    const lotRates = await rebuildLotCosts(tx, lots);
    const itemCosts = await rebuildItemCosts(tx, items, actor, on);
    const stamps = await stampItemAverage(tx, items);
    const lotTotals = await rebuildLotTotals(tx, lotIds, actor, on);
    return { balances, lotRates, itemCosts, stamps, lotTotals };
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
    await rebuildLotTotals(tx, client_1.Prisma.sql `
      SELECT DISTINCT sml.sml_lot_id AS lot_id
        FROM stock.stock_ledger sml
       WHERE ${ledgerRowsOf(params)}
    `, params.actor, params.postedOn);
}
async function rebuildLotTotals(tx, lots, actor, on) {
    return tx.$executeRaw `
    WITH lot AS (${lots}),
    totals AS (
      SELECT l.lot_id, COALESCE(SUM(sbl.sbl_on_hand_qty), 0) AS on_hand
        FROM lot l
        LEFT JOIN stock.stock_balance sbl
               ON sbl.sbl_lot_id     = l.lot_id
              AND sbl.sbl_is_deleted = false
       GROUP BY l.lot_id
    )
    UPDATE stock.stock_lot slt
       SET slt_total_on_hand = t.on_hand,
           slt_status        = CASE
                                 WHEN t.on_hand <= 0 AND slt.slt_status = 'ACTIVE' THEN 'CLOSED'
                                 WHEN t.on_hand >  0 AND slt.slt_status = 'CLOSED' THEN 'ACTIVE'
                                 ELSE slt.slt_status
                               END,
           slt_closed_on     = CASE
                                 WHEN t.on_hand <= 0 AND slt.slt_status = 'ACTIVE' THEN ${on}
                                 WHEN t.on_hand >  0 AND slt.slt_status = 'CLOSED' THEN NULL
                                 ELSE slt.slt_closed_on
                               END,
           slt_row_version   = slt.slt_row_version + 1,
           slt_modified_on   = ${on},
           slt_modified_by   = ${auditColumnActor(actor)}
      FROM totals t
     WHERE slt.slt_id = t.lot_id
       AND (slt.slt_total_on_hand IS DISTINCT FROM t.on_hand
            OR (t.on_hand <= 0 AND slt.slt_status = 'ACTIVE')
            OR (t.on_hand >  0 AND slt.slt_status = 'CLOSED'))
  `;
}
async function recomputeHeaderTotals(tx, params) {
    const { rules, svhId, accYear } = params;
    const isCount = rules.quantityMode === 'COUNT';
    const netted = isCount || (rules.lineDirection === 'REASON' && rules.postShape !== 'BUCKET_MOVE');
    const outTxnType = rules.postShape === 'TRANSFER_OUT'
        ? 'TRANSFER_OUT'
        : rules.postShape === 'BUCKET_MOVE'
            ? 'BUCKET_OUT'
            : null;
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
         AND (${outTxnType}::text IS NULL OR sml.sml_txn_type = ${outTxnType}::text)
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
    if (rules.postShape === 'TRANSFER_OUT' &&
        (header.status === 'IN_TRANSIT' || header.status === 'RECEIVED')) {
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