"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TxnStatusEvent = exports.TxnStatusDocType = exports.SRC_MODULE = exports.dateOf = exports.isoDate = exports.num2 = exports.r2 = exports.ZERO = exports.D = void 0;
exports.allocateDocNumber = allocateDocNumber;
exports.loadUnits = loadUnits;
exports.loadTaxRates = loadTaxRates;
exports.supplierRow = supplierRow;
exports.isInterState = isInterState;
exports.voucherTypeId = voucherTypeId;
exports.stockRules = stockRules;
exports.postShadowStock = postShadowStock;
exports.cancelShadowStock = cancelShadowStock;
exports.raiseBillRow = raiseBillRow;
exports.assertBillsUnsettled = assertBillsUnsettled;
exports.assertNoLiveReturns = assertNoLiveReturns;
exports.assertShortagesUntouched = assertShortagesUntouched;
exports.withdrawBillRows = withdrawBillRows;
exports.statusLog = statusLog;
exports.unitNames = unitNames;
exports.jsonSafe = jsonSafe;
const client_1 = require("@prisma/client");
const txn_status_log_helper_1 = require("../../../common/txn-status-log/txn-status-log.helper");
Object.defineProperty(exports, "TxnStatusDocType", { enumerable: true, get: function () { return txn_status_log_helper_1.TxnStatusDocType; } });
Object.defineProperty(exports, "TxnStatusEvent", { enumerable: true, get: function () { return txn_status_log_helper_1.TxnStatusEvent; } });
const stock_voucher_source_1 = require("../../stocks/posting/stock-voucher.source");
const stock_voucher_numbering_helper_1 = require("../../stocks/stock-voucher/stock-voucher-numbering.helper");
const purchase_errors_1 = require("./purchase.errors");
const D = (v) => new client_1.Prisma.Decimal(v ?? 0);
exports.D = D;
exports.ZERO = (0, exports.D)(0);
const r2 = (v) => v.toDecimalPlaces(2, client_1.Prisma.Decimal.ROUND_HALF_UP);
exports.r2 = r2;
const num2 = (v) => Number(v.toFixed(2));
exports.num2 = num2;
const isoDate = (d) => d.toISOString().slice(0, 10);
exports.isoDate = isoDate;
const dateOf = (iso) => (iso ? new Date(`${iso.slice(0, 10)}T00:00:00Z`) : null);
exports.dateOf = dateOf;
exports.SRC_MODULE = 'PURCHASE';
const NUMBER_TABLES = {
    PO: { table: 'purchase.pur_order', p: 'po' },
    GRN: { table: 'purchase.pur_grn', p: 'grn' },
    PRN: { table: 'purchase.pur_return', p: 'pr' },
    SHR: { table: 'purchase.pur_shortage_receipt', p: 'psr' },
};
async function allocateDocNumber(tx, kind, companyId, branchId, accYear, deviceId) {
    const { table, p } = NUMBER_TABLES[kind];
    const devCode = await (0, stock_voucher_numbering_helper_1.resolveDeviceCode)(tx, deviceId);
    const lockKey = [kind, companyId, branchId, accYear, deviceId].join('|');
    await tx.$queryRaw `SELECT count(pg_advisory_xact_lock(hashtext('purchase_doc_no'), hashtext(${lockKey})))::int AS locked`;
    const [r] = await tx.$queryRaw(client_1.Prisma.sql `
    SELECT COALESCE(MAX(${client_1.Prisma.raw(`${p}_slno`)}), 0) + 1 AS n FROM ${client_1.Prisma.raw(table)}
     WHERE ${client_1.Prisma.raw(`${p}_company_id`)} = ${companyId}::uuid AND ${client_1.Prisma.raw(`${p}_branch_id`)} = ${branchId}::uuid
       AND ${client_1.Prisma.raw(`${p}_acc_year`)} = ${accYear}::bpchar AND ${client_1.Prisma.raw(`${p}_device_id`)} = ${deviceId}::uuid`);
    const slno = BigInt(r.n);
    return { slno, refno: [kind, accYear.trim(), devCode, slno.toString().padStart(5, '0')].join('/') };
}
async function loadUnits(tx, uomIds) {
    const ids = [...new Set(uomIds)];
    const rows = ids.length
        ? await tx.$queryRaw `
        SELECT iuc.iuc_id, iuc.iuc_item_id, iuc.iuc_to_base_factor, COALESCE(base.iuc_id, iuc.iuc_id) AS base_iuc_id,
               im.item_default_tax_id, im.item_hsn_code, im.item_name_en AS item_name
          FROM inventory.item_unit_conversion iuc
          JOIN inventory.item_master im ON im.item_id = iuc.iuc_item_id
          LEFT JOIN LATERAL (SELECT b.iuc_id FROM inventory.item_unit_conversion b
                              WHERE b.iuc_item_id = iuc.iuc_item_id AND b.iuc_is_base_unit AND NOT b.iuc_is_deleted
                              ORDER BY b.iuc_unit_slno LIMIT 1) base ON true
         WHERE iuc.iuc_id = ANY(${ids}::uuid[]) AND NOT iuc.iuc_is_deleted`
        : [];
    return new Map(rows.map((r) => [r.iuc_id, r]));
}
async function loadTaxRates(tx, taxIds) {
    const ids = [...new Set(taxIds.filter((t) => !!t))];
    const rows = ids.length
        ? await tx.$queryRaw `
        SELECT tax_id, tax_rate_perc, tax_cess_perc, tax_cess_per_unit FROM inventory.tax_rate_master WHERE tax_id = ANY(${ids}::uuid[])`
        : [];
    return new Map(rows.map((t) => [t.tax_id, t]));
}
async function supplierRow(tx, supplierId) {
    const [s] = await tx.$queryRaw `
    SELECT sup_id, sup_name, sup_state_code, sup_gst_type, sup_gst_no, sup_credit_days FROM purchase.suppliers WHERE sup_id = ${supplierId}::uuid AND NOT sup_is_deleted`;
    if (!s)
        (0, purchase_errors_1.purRefuse)(`Supplier ${supplierId} not found`, purchase_errors_1.PUR.SUPPLIER_NOT_FOUND, 'header.supplierId', 404);
    return s;
}
async function isInterState(tx, branchId, supplier) {
    const [b] = await tx.$queryRaw `
    SELECT COALESCE(NULLIF(trim(b.br_state_code), ''), NULLIF(trim(c.comp_state_code), '')) AS state
      FROM public.branch_master b JOIN public.companys c ON c.comp_id = b.br_comp_id WHERE b.br_id = ${branchId}::uuid`;
    const ours = (b?.state ?? '').trim();
    const theirs = (supplier.sup_state_code ?? '').trim() || (supplier.sup_gst_no ?? '').slice(0, 2);
    return !!ours && !!theirs && ours !== theirs;
}
async function voucherTypeId(tx, code) {
    const [vt] = await tx.$queryRaw `SELECT vchr_type_id AS id FROM accounts.acc_voucher_types WHERE vchr_type_code = ${code} AND vchr_is_active LIMIT 1`;
    if (!vt)
        (0, purchase_errors_1.purRefuse)(`Voucher type ${code} is missing (migration 20261028100000).`, purchase_errors_1.PUR.VOUCHER_TYPE_MISSING);
    return vt.id;
}
function stockRules(direction, typeCode, display, txnType, statusDocType) {
    const inward = direction === 'IN';
    return {
        voucherType: inward ? 'RECEIPT' : 'ISSUE', typeCode, displayName: display,
        requiresToGodown: inward, requiresFromGodown: !inward, isInward: inward, ledgerTxnTypes: [txnType],
        quantityMode: 'QTY', defaultRateSource: inward ? 'MANUAL' : 'AVG_COST', allowsCount: false, allowsToBranch: false,
        postShape: 'SIMPLE', auditScreenName: display, statusDocType,
    };
}
async function postShadowStock(tx, stockPosting, doc, rules, rows, actor, postedOn) {
    const live = rows.filter((r) => r.qty.plus(r.freeQty).greaterThan(0));
    if (!live.length)
        return { svhId: null, perRow: [] };
    const inward = rules.isInward;
    const slno = await (0, stock_voucher_numbering_helper_1.nextStockVoucherSlno)(tx, { companyId: doc.companyId, branchId: doc.branchId, accYear: doc.accYear, voucherType: rules.voucherType, deviceId: doc.deviceId });
    const total = live.reduce((s, r) => s.plus(r.qty).plus(r.freeQty), exports.ZERO);
    const godown = live[0].godownId;
    const [hdr] = await tx.$queryRaw `
    INSERT INTO stock.stock_voucher (
      svh_company_id, svh_branch_id, svh_acc_year, svh_device_id, svh_session_id,
      svh_voucher_type, svh_slno, svh_refno, svh_usr_refno, svh_doc_date, svh_doc_datetime,
      svh_from_godown_id, svh_to_godown_id, svh_supplier_id, svh_party_ref,
      svh_link_src_module, svh_link_src_doc_type, svh_link_src_doc_id, svh_link_src_acc_year,
      svh_line_count, svh_total_qty, svh_status, svh_rate_source, svh_remarks, svh_created_on, svh_created_by)
    VALUES (${doc.companyId}::uuid, ${doc.branchId}::uuid, ${doc.accYear}::bpchar, ${doc.deviceId}::uuid, ${doc.sessionId}::uuid,
      ${rules.voucherType}, ${slno}::bigint, ${`${doc.docType}/${doc.refno}/r${doc.revision}`}, ${doc.usrRefno}, ${doc.docDate}::date, ${postedOn},
      ${inward ? null : godown}::uuid, ${inward ? godown : null}::uuid, ${doc.supplierId}::uuid, ${doc.supplierId},
      ${exports.SRC_MODULE}, ${doc.docType}, ${doc.docId}::uuid, ${doc.accYear}::bpchar,
      ${live.length}::int, ${total}::numeric, 'DRAFT', ${inward ? 'MANUAL' : 'AVG_COST'}, ${doc.remarks}, ${postedOn}, ${actor})
    RETURNING svh_id`;
    const values = live.map((r, k) => client_1.Prisma.sql `(
    ${hdr.svh_id}::uuid, ${doc.companyId}::uuid, ${doc.branchId}::uuid, ${doc.accYear}::bpchar, ${k + 1}::int, 1,
    ${r.itemId}::uuid, ${r.uomId}::uuid, ${r.baseUomId}::uuid, ${r.factor}::numeric,
    ${r.godownId}::uuid, ${r.lotId ?? null}::uuid, ${r.bucket}, ${r.batchNo ?? null}, ${r.mfgDate ?? null}::date, ${r.expiryDate ?? null}::date,
    ${r.mrp ?? null}::numeric, ${r.salePrice ?? null}::numeric, ${r.serialNo ?? null}, ${r.supplierId ?? null}::uuid,
    ${r.qty}::numeric, ${r.qty.times(r.factor)}::numeric, ${r.freeQty}::numeric, ${r.freeQty.times(r.factor)}::numeric,
    ${r.costRate}::numeric, ${r.costRate}::numeric, ${r.costRate}::numeric, 0::numeric, ${postedOn}, ${actor})`);
    await tx.$executeRaw `
    INSERT INTO stock.stock_voucher_item (
      svi_voucher_id, svi_company_id, svi_branch_id, svi_acc_year, svi_line_no, svi_split_no,
      svi_item_id, svi_uom_id, svi_base_uom_id, svi_to_base_factor,
      svi_godown_id, svi_lot_id, svi_bucket, svi_batch_no, svi_mfg_date, svi_expiry_date,
      svi_mrp, svi_sale_price, svi_serial_no, svi_supplier_id,
      svi_qty, svi_base_qty, svi_free_qty, svi_free_base_qty,
      svi_cost_rate, svi_cost_rate_wot, svi_landed_rate, svi_tax_perc, svi_created_on, svi_created_by) VALUES ${client_1.Prisma.join(values)}`;
    await stockPosting.post(tx, new stock_voucher_source_1.StockVoucherSource({ svhId: hdr.svh_id, accYear: doc.accYear, companyId: doc.companyId, branchId: doc.branchId, rules }), { actor, postedOn, ledgerSource: { srcModule: exports.SRC_MODULE, srcDocType: doc.docType, srcRefno: doc.refno, partyId: doc.supplierId } });
    const back = await tx.$queryRaw `
    SELECT svi.svi_line_no, svi.svi_lot_id, svi.svi_id, SUM(sml.sml_cost_value) AS cost, SUM(sml.sml_qty + sml.sml_free_qty) AS qty
      FROM stock.stock_voucher_item svi
      LEFT JOIN stock.stock_ledger sml ON sml.sml_src_doc_id = svi.svi_voucher_id AND sml.sml_acc_year = svi.svi_acc_year
           AND sml.sml_line_no = svi.svi_line_no AND sml.sml_split_no = svi.svi_split_no AND NOT sml.sml_is_reversal AND NOT sml.sml_is_deleted
     WHERE svi.svi_voucher_id = ${hdr.svh_id}::uuid AND svi.svi_acc_year = ${doc.accYear}::bpchar
     GROUP BY svi.svi_line_no, svi.svi_lot_id, svi.svi_id ORDER BY svi.svi_line_no`;
    const moved = back.reduce((s, b) => s.plus((0, exports.D)(b.qty)), exports.ZERO);
    if (!moved.toDecimalPlaces(4).equals(total.toDecimalPlaces(4))) {
        throw new Error(`${purchase_errors_1.PUR.STOCK_QTY_MISMATCH}: ${doc.refno} moved ${moved.toString()} against ${total.toString()}`);
    }
    const perRow = [];
    let k = 0;
    for (const r of rows) {
        if (!r.qty.plus(r.freeQty).greaterThan(0)) {
            perRow.push({ lotId: null, sviId: '', cost: exports.ZERO });
            continue;
        }
        const b = back[k++];
        perRow.push({ lotId: b?.svi_lot_id ?? null, sviId: b?.svi_id ?? '', cost: (0, exports.r2)((0, exports.D)(b?.cost)) });
    }
    return { svhId: hdr.svh_id, perRow };
}
async function cancelShadowStock(tx, stockPosting, docType, docId, accYear, companyId, branchId, rules, actor, reason) {
    const shadows = await tx.$queryRaw `
    SELECT svh_id FROM stock.stock_voucher WHERE svh_link_src_module = ${exports.SRC_MODULE} AND svh_link_src_doc_type = ${docType}
       AND svh_link_src_doc_id = ${docId}::uuid AND svh_acc_year = ${accYear}::bpchar AND svh_status = 'POSTED' AND NOT svh_is_deleted`;
    for (const s of shadows) {
        await stockPosting.cancel(tx, new stock_voucher_source_1.StockVoucherSource({ svhId: s.svh_id, accYear, companyId, branchId, rules }), { actor, reason, cancelledOn: new Date() });
    }
}
async function raiseBillRow(tx, a) {
    if (!a.amount.greaterThan(0))
        return;
    await tx.accBillBalance.create({
        data: {
            ablCompanyId: a.companyId, ablBranchId: a.branchId, ablAccYear: a.accYear, ablPartyId: a.partyId, ablBillType: a.billType,
            ablSrcModule: exports.SRC_MODULE, ablSrcDocType: a.docType, ablSrcDocId: a.docId, ablSrcAccYear: a.accYear,
            ablVoucherId: a.voucherId, ablVoucherTypeId: a.voucherTypeId, ablVoucherNo: a.voucherNo, ablVoucherDate: (0, exports.dateOf)(a.voucherDate),
            ablVoucherRefno: a.refno, ablDocRefno: a.refSuffix ? `${a.refno}/${a.refSuffix}` : a.refno, ablDocDate: a.docDate,
            ablDueDate: a.dueDate ?? null, ablCreditDays: a.creditDays ?? 0, ablDrCr: a.drCr, ablBillAmount: (0, exports.r2)(a.amount),
            ablNarration: a.narration, ablCreatedBy: a.actor,
        },
    });
}
async function assertBillsUnsettled(tx, docType, docId, refno) {
    const [paid] = await tx.$queryRaw `
    SELECT count(*) AS n FROM accounts.acc_bill_balance WHERE abl_src_module = ${exports.SRC_MODULE} AND abl_src_doc_type = ${docType}
       AND abl_src_doc_id = ${docId}::uuid AND NOT abl_is_deleted AND (abl_alloc_amount + abl_disc_amount + abl_writeoff_amount) <> 0`;
    if (Number(paid.n) > 0)
        (0, purchase_errors_1.purRefuse)(`${refno} is already paid or adjusted — undo that first.`, purchase_errors_1.PUR.EDIT_LOCKED_PAID, 'id', 409);
}
async function assertNoLiveReturns(tx, srcDocId, refno) {
    const rows = await tx.$queryRaw `
    SELECT DISTINCT pr.pr_refno FROM purchase.pur_return pr
     WHERE pr.pr_src_doc_id = ${srcDocId}::uuid AND pr.pr_status <> 'CANCELLED' AND NOT pr.pr_is_deleted
     ORDER BY 1 LIMIT 5`;
    if (rows.length)
        (0, purchase_errors_1.purRefuse)(`${refno} has return ${rows.map((r) => r.pr_refno).join(', ')} against it — cancel the return first.`, purchase_errors_1.PUR.EDIT_LOCKED_PAID, 'id', 409);
}
async function assertShortagesUntouched(tx, srcDocId, refno) {
    const [t] = await tx.$queryRaw `
    SELECT count(*) AS n FROM purchase.pur_shortage s
     WHERE (s.psh_src_doc_id = ${srcDocId}::uuid OR s.psh_bill_doc_id = ${srcDocId}::uuid) AND NOT s.psh_is_deleted
       AND (EXISTS (SELECT 1 FROM purchase.pur_shortage_receipt_item i JOIN purchase.pur_shortage_receipt r ON r.psr_id = i.psri_psr_id AND r.psr_acc_year = i.psri_acc_year
                     WHERE i.psri_shortage_id = s.psh_id AND NOT i.psri_is_deleted AND NOT r.psr_is_deleted AND r.psr_status <> 'CANCELLED')
         OR COALESCE((SELECT SUM(c.psc_qty_base) FROM purchase.pur_shortage_close c WHERE c.psc_shortage_id = s.psh_id AND NOT c.psc_is_deleted), 0) <> 0)`;
    if (Number(t.n) > 0)
        (0, purchase_errors_1.purRefuse)(`${refno}: a shortage of it is already received or closed — cancel that first.`, purchase_errors_1.PUR.EDIT_LOCKED_PAID, 'id', 409);
}
async function withdrawBillRows(tx, docType, docId, actor) {
    await tx.accBillBalance.updateMany({
        where: { ablSrcModule: exports.SRC_MODULE, ablSrcDocType: docType, ablSrcDocId: docId, ablIsDeleted: false },
        data: { ablIsDeleted: true, ablModifiedBy: actor },
    });
}
async function statusLog(tx, a) {
    await (0, txn_status_log_helper_1.appendTxnStatusLog)(tx, {
        companyId: a.companyId, branchId: a.branchId, accYear: a.accYear, srcModule: txn_status_log_helper_1.TxnStatusSrcModule.PURCHASE, srcDocType: a.docType,
        srcDocId: a.docId, srcDocRefno: a.refno, event: a.event, fromStatus: a.from, toStatus: a.to, changedBy: a.actor,
        deviceId: a.deviceId ?? null, remarks: a.remarks ?? null,
    });
}
async function unitNames(db, uomIds) {
    if (!uomIds.length)
        return new Map();
    const rows = await db.$queryRaw `
    SELECT iuc.iuc_id, im.item_name_en AS item_name, u.unit_name
      FROM inventory.item_unit_conversion iuc
      JOIN inventory.item_master im ON im.item_id = iuc.iuc_item_id
      JOIN inventory.item_unit_master u ON u.unit_id = iuc.iuc_unit_id
     WHERE iuc.iuc_id = ANY(${[...new Set(uomIds)]}::uuid[])`;
    return new Map(rows.map((r) => [r.iuc_id, { itemName: r.item_name, unitName: r.unit_name }]));
}
function jsonSafe(v) {
    if (typeof v === 'bigint')
        return v.toString();
    if (Array.isArray(v))
        return v.map((x) => jsonSafe(x));
    if (v && typeof v === 'object' && !(v instanceof Date) && !(v instanceof client_1.Prisma.Decimal)) {
        const out = {};
        for (const [k, x] of Object.entries(v))
            out[k] = jsonSafe(x);
        return out;
    }
    return v;
}
//# sourceMappingURL=purchase-doc.helpers.js.map