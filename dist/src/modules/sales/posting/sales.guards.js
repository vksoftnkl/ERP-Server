"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NO_RIGHTS = exports.loadRights = exports.assertVoucherPartitionExists = exports.assertAccYearWritable = void 0;
exports.warn = warn;
exports.refuse = refuse;
exports.assertRight = assertRight;
exports.assertBackdate = assertBackdate;
exports.loadDayClosed = loadDayClosed;
exports.assertDayOpen = assertDayOpen;
exports.assertCreditLimit = assertCreditLimit;
exports.assertSalesmen = assertSalesmen;
exports.assertBillAdds = assertBillAdds;
exports.assertTenderTotal = assertTenderTotal;
exports.loadDeclaredLocks = loadDeclaredLocks;
exports.assertAmendable = assertAmendable;
exports.assertBandWritable = assertBandWritable;
exports.assertCancellable = assertCancellable;
const rights_1 = require("../../../common/posting/rights");
Object.defineProperty(exports, "loadRights", { enumerable: true, get: function () { return rights_1.loadRights; } });
Object.defineProperty(exports, "NO_RIGHTS", { enumerable: true, get: function () { return rights_1.NO_RIGHTS; } });
const receipt_guards_1 = require("../../accountsModule/receipt/receipt.guards");
Object.defineProperty(exports, "assertAccYearWritable", { enumerable: true, get: function () { return receipt_guards_1.assertAccYearWritable; } });
Object.defineProperty(exports, "assertVoucherPartitionExists", { enumerable: true, get: function () { return receipt_guards_1.assertVoucherPartitionExists; } });
const posting_types_1 = require("./types/posting.types");
const sales_errors_1 = require("./sales.errors");
function warn(ctx, code, message, opts = {}) {
    const overridable = opts.overridable ?? true;
    const accepted = overridable && ctx.overrides.includes(code) && ctx.canOverride;
    ctx.warnings.push({
        code,
        level: accepted ? 'INFO' : 'WARN',
        message,
        field: opts.field,
        line: opts.line,
        overridable,
        statutory: opts.statutory,
    });
    if (accepted || (overridable && ctx.dryRun)) {
        return;
    }
    refuse(ctx, code, message, opts);
}
function refuse(ctx, code, message, opts = {}) {
    ctx.refusals.push({
        code,
        message,
        field: opts.field,
        line: opts.line,
        statutory: opts.statutory,
    });
    if (ctx.throwOnRefusal) {
        (0, sales_errors_1.throwSalesRefused)(message, code, opts.field ?? 'document', {
            ...(opts.line === undefined ? {} : { line: opts.line }),
            ...(opts.statutory === undefined ? {} : { statutory: opts.statutory }),
        });
    }
}
const RIGHT_CODE = {
    view: posting_types_1.SALES_ERROR_CODES.RIGHT_VIEW,
    create: posting_types_1.SALES_ERROR_CODES.RIGHT_CREATE,
    edit: posting_types_1.SALES_ERROR_CODES.RIGHT_EDIT,
    delete: posting_types_1.SALES_ERROR_CODES.RIGHT_DELETE,
    print: posting_types_1.SALES_ERROR_CODES.RIGHT_PRINT,
    export: posting_types_1.SALES_ERROR_CODES.RIGHT_EXPORT,
    post: posting_types_1.SALES_ERROR_CODES.RIGHT_POST,
    cancel: posting_types_1.SALES_ERROR_CODES.RIGHT_CANCEL,
    amend: posting_types_1.SALES_ERROR_CODES.RIGHT_AMEND,
    override: posting_types_1.SALES_ERROR_CODES.RIGHT_OVERRIDE,
    retender: posting_types_1.SALES_ERROR_CODES.RIGHT_RETENDER,
};
async function assertRight(client, userId, menuId, right) {
    const rights = await (0, rights_1.loadRights)(client, userId, menuId);
    if (!rights[right]) {
        (0, sales_errors_1.throwSalesRight)(`This user may not ${right} on this menu (${rights_1.RIGHT_COLUMN[right]} is false)`, RIGHT_CODE[right]);
    }
    return rights;
}
function assertBackdate(ctx, docDate, settings, today = isoToday(), field = 'billDate') {
    if (docDate > today) {
        refuse(ctx, posting_types_1.SALES_ERROR_CODES.BACKDATE, `A document cannot be dated ${docDate}, which is in the future`, { field });
        return;
    }
    if (docDate === today || settings.backdateMode === 'ALLOW') {
        return;
    }
    const message = `This document is dated ${docDate}, before today (${today})`;
    if (settings.backdateMode === 'REFUSE') {
        refuse(ctx, posting_types_1.SALES_ERROR_CODES.BACKDATE, message, { field });
    }
    else {
        warn(ctx, posting_types_1.SALES_ERROR_CODES.BACKDATE, message, { field });
    }
}
async function loadDayClosed(client, companyId, branchId, docDate) {
    const [exists] = await client.$queryRaw `
    SELECT to_regclass('accounts.acc_day_close')::text AS tbl`;
    if (!exists?.tbl) {
        return false;
    }
    const rows = await client.$queryRawUnsafe(`SELECT COUNT(*) AS n
       FROM accounts.acc_day_close
      WHERE adc_company_id = $1::uuid
        AND adc_branch_id  = $2::uuid
        AND adc_close_date = $3::date
        AND adc_is_deleted = false
        AND adc_status     = 'CLOSED'`, companyId, branchId, docDate);
    return Number(rows[0]?.n ?? 0) > 0;
}
async function assertDayOpen(client, companyId, branchId, docDate, field = 'billDate') {
    if (await loadDayClosed(client, companyId, branchId, docDate)) {
        (0, sales_errors_1.throwSalesLocked)(`The books for ${docDate} are closed at this branch`, posting_types_1.SALES_ERROR_CODES.DAY_CLOSED, field);
    }
}
async function assertCreditLimit(client, ctx, party, companyId, billAmount, settings, docDate = isoToday()) {
    if (settings.creditLimitMode === 'OFF') {
        return;
    }
    const [limits] = await client.$queryRaw `
    SELECT cus_credit_amt_limit, cus_credit_bill_limit, cus_credit_days
      FROM sales.customers WHERE cus_id = ${party.custId}::uuid`;
    if (!limits) {
        return;
    }
    const [open] = await client.$queryRaw `
    SELECT SUM(abl_pending_amount)                AS pending,
           COUNT(*)                               AS bills,
           MIN(abl_doc_date)                      AS oldest
      FROM accounts.acc_bill_balance
     WHERE abl_company_id = ${companyId}::uuid
       AND abl_party_id   = ${party.partyLedgerId}::uuid
       AND abl_dr_cr      = 'DR'
       AND abl_status     = 'OPEN'
       AND abl_is_deleted = false`;
    const pending = Number(open?.pending ?? 0);
    const bills = Number(open?.bills ?? 0);
    const refuseIt = settings.creditLimitMode === 'REFUSE';
    const raise = refuseIt ? refuse : warn;
    const amtLimit = Number(limits.cus_credit_amt_limit ?? 0);
    if (amtLimit > 0 && pending + billAmount > amtLimit) {
        raise(ctx, posting_types_1.SALES_ERROR_CODES.CREDIT_LIMIT, `Outstanding ${round2(pending)} plus this bill ${round2(billAmount)} exceeds the credit limit ${amtLimit}`, { field: 'custId' });
    }
    const billLimit = limits.cus_credit_bill_limit ?? 0;
    if (billLimit > 0 && bills >= billLimit) {
        raise(ctx, posting_types_1.SALES_ERROR_CODES.CREDIT_LIMIT, `This customer already has ${bills} open bills; the limit is ${billLimit}`, { field: 'custId' });
    }
    const days = limits.cus_credit_days ?? 0;
    if (days > 0 && open?.oldest) {
        const age = daysBetween(open.oldest.toISOString().slice(0, 10), docDate);
        if (age > days) {
            raise(ctx, posting_types_1.SALES_ERROR_CODES.CREDIT_LIMIT, `This customer's oldest open bill is ${age} days old; the limit is ${days}`, { field: 'custId' });
        }
    }
}
async function assertSalesmen(client, companyId, ids, opts = {}) {
    const field = opts.field ?? 'salesmanId';
    if (ids === null || ids === undefined) {
        return;
    }
    if (ids.length === 0) {
        (0, sales_errors_1.throwSalesRefused)(`${field} is an empty array — use null for "nobody", not {}`, posting_types_1.SALES_ERROR_CODES.SALESMAN_INVALID, field);
    }
    const seen = new Set();
    for (const id of ids) {
        if (seen.has(id)) {
            (0, sales_errors_1.throwSalesRefused)(`${field} names ${id} twice — one person cannot be credited twice on one document`, posting_types_1.SALES_ERROR_CODES.SALESMAN_INVALID, field);
        }
        seen.add(id);
    }
    const found = await client.$queryRaw `
    SELECT emp_id
      FROM public.employee_master
     WHERE emp_id         = ANY(${ids}::uuid[])
       AND emp_is_deleted = false
       AND emp_company_id = ${companyId}::uuid`;
    const live = new Set(found.map((r) => r.emp_id));
    const bad = ids.filter((id) => !live.has(id));
    if (bad.length > 0) {
        (0, sales_errors_1.throwSalesRefused)(`${field} names ${bad.length === 1 ? 'an employee' : 'employees'} that do not exist, ` +
            `are deleted, or belong to another company: ${bad.join(', ')}`, posting_types_1.SALES_ERROR_CODES.SALESMAN_INVALID, field);
    }
}
function assertBillAdds(ctx, computed, declared, field = 'sbBillAmt') {
    const diff = round2(computed - declared);
    if (Math.abs(diff) > 0.01) {
        refuse(ctx, posting_types_1.SALES_ERROR_CODES.STOCK_QTY_MISMATCH, `The bill does not add up: the lines and charges make ${round2(computed)}, the bill says ${round2(declared)}`, { field });
    }
}
function assertTenderTotal(ctx, tendered, billAmount, settings, field = 'tenders') {
    if (settings.allowExcessTender || round2(tendered) <= round2(billAmount)) {
        return;
    }
    warn(ctx, posting_types_1.SALES_ERROR_CODES.TENDER_MIN_MAX, `Tenders total ${round2(tendered)} against a bill of ${round2(billAmount)}`, { field });
}
async function loadDeclaredLocks(client, gdrId) {
    if (!gdrId) {
        return { irnLive: false, ewbLive: false };
    }
    const [row] = await client.$queryRaw `
    SELECT EXISTS (SELECT 1 FROM accounts.acc_voucher_doc_einvoice
                    WHERE gde_gdr_id = ${gdrId}::uuid AND gde_status = 'GENERATED') AS irn_live,
           EXISTS (SELECT 1 FROM accounts.acc_voucher_doc_ewaybill
                    WHERE gdw_gdr_id = ${gdrId}::uuid AND gdw_status = 'GENERATED') AS ewb_live`;
    return { irnLive: row?.irn_live ?? false, ewbLive: row?.ewb_live ?? false };
}
async function assertAmendable(client, gdrId) {
    const { irnLive, ewbLive } = await loadDeclaredLocks(client, gdrId);
    if (irnLive) {
        (0, sales_errors_1.throwSalesLocked)('This document has a live IRN and cannot be amended — cancel it at the portal and raise a fresh one, or issue a credit note', posting_types_1.SALES_ERROR_CODES.IRN_LIVE, 'sbId');
    }
    if (ewbLive) {
        (0, sales_errors_1.throwSalesLocked)('This document has a live e-way bill and cannot be amended — cancel it at the portal and raise a fresh one', posting_types_1.SALES_ERROR_CODES.EWB_LIVE, 'sbId');
    }
}
async function assertBandWritable(client, gdrId) {
    const { irnLive, ewbLive } = await loadDeclaredLocks(client, gdrId);
    if (irnLive || ewbLive) {
        (0, sales_errors_1.throwSalesLocked)('The transport details have already been declared and cannot be edited — a later vehicle change is a portal operation (POST /gst/ewaybill/vehicle)', posting_types_1.SALES_ERROR_CODES.DECLARED_LOCKED, 'transport');
    }
}
async function assertCancellable(client, bill) {
    const [row] = await client.$queryRaw `
    SELECT
      (SELECT COUNT(*) FROM sales.sale_return r
        WHERE r.sr_bill_id    = ${bill.billId}::uuid
          AND r.sr_is_deleted = false
          AND r.sr_status <> 'CANCELLED')                                   AS returns,
      (SELECT COUNT(*) FROM accounts.acc_bill_adjustment j
         JOIN accounts.acc_bill_balance b
           ON b.abl_id       = j.abj_bill_id
          AND b.abl_acc_year = j.abj_bill_acc_year
        WHERE b.abl_src_doc_id = ${bill.billId}::uuid
          AND b.abl_acc_year   = ${bill.accYear}::char(9)
          AND j.abj_is_deleted = false
          -- The bill's OWN set-offs are not somebody else's allocation. /post
          -- writes them (bill-adjustment.helper) as ADVANCE_ADJUST /
          -- NOTE_ADJUST with no voucher: the invoice-side row names the ADVANCE
          -- as abj_against_bill_id, so matching on the bill's own id never
          -- excluded anything. A receipt's rows always carry its voucher.
          AND NOT (j.abj_adj_type IN ('ADVANCE_ADJUST', 'NOTE_ADJUST')
                   AND j.abj_voucher_id IS NULL)
          -- Nor is what was paid AT THE COUNTER (notes 49): /post writes an
          -- ALLOCATION row per settling tender, naming the bill's own tender
          -- row. Rows on the bill's own tenders — the counter rows, a bounce's
          -- reversal of a bill cheque, its re-presentation — are the bill's.
          AND NOT EXISTS (SELECT 1 FROM accounts.acc_tender_detail t
                           WHERE t.td_id = j.abj_tender_id
                             AND t.td_src_module = 'SALES' AND t.td_src_doc_type = 'SALE_BILL'
                             AND t.td_src_doc_id = ${bill.billId}::uuid))  AS allocations`;
    if (Number(row?.returns ?? 0) > 0) {
        (0, sales_errors_1.throwSalesLocked)('A sale return has been raised against this bill — cancel the return first', posting_types_1.SALES_ERROR_CODES.RETURN_LOCKS_BILL, 'sbId');
    }
    if (Number(row?.allocations ?? 0) > 0) {
        (0, sales_errors_1.throwSalesLocked)('A receipt or credit note has been allocated against this bill — cancel that first', posting_types_1.SALES_ERROR_CODES.ALLOCATION_LOCKS_BILL, 'sbId');
    }
}
function round2(v) {
    return Math.round((v + Number.EPSILON * Math.sign(v || 1)) * 100) / 100;
}
function isoToday() {
    return new Date().toISOString().slice(0, 10);
}
function daysBetween(from, to) {
    const a = Date.parse(`${from}T00:00:00Z`);
    const b = Date.parse(`${to}T00:00:00Z`);
    return Math.round((b - a) / 86_400_000);
}
//# sourceMappingURL=sales.guards.js.map