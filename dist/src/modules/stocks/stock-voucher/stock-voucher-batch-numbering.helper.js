"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BATCH_VOUCHER_TYPE_CODE = exports.AUTO_BATCH_NO_SETTING = void 0;
exports.assignAutoBatchNumbers = assignAutoBatchNumbers;
exports.autoBatchNoIsOn = autoBatchNoIsOn;
const client_1 = require("@prisma/client");
const voucher_sequence_helper_1 = require("../../../common/Sequence/voucher-sequence.helper");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const stock_error_codes_1 = require("../types/stock-error-codes");
const stock_voucher_posting_helper_1 = require("./stock-voucher-posting.helper");
exports.AUTO_BATCH_NO_SETTING = 'stock.auto_batch_no';
exports.BATCH_VOUCHER_TYPE_CODE = 'BATCH';
const BATCH_DEVICE_CODE = 'MAIN';
const BATCH_PREFIX_MISSING_MESSAGE = 'Set a bill prefix on this branch to number batches.';
async function assignAutoBatchNumbers(tx, scope, lines) {
    const result = [...lines];
    const numbered = new Set();
    const done = () => ({ lines: result, numbered });
    const blank = lines.flatMap((line, index) => (line.batchNo?.trim() ? [] : [index]));
    if (blank.length === 0 || !(await autoBatchNoIsOn(tx, scope.companyId, scope.branchId))) {
        return done();
    }
    const tracked = await batchTrackedItems(tx, scope, [
        ...new Set(blank.map((i) => lines[i].itemId)),
    ]);
    let due = blank.filter((i) => tracked.has(lines[i].itemId));
    if (due.length === 0) {
        return done();
    }
    const stored = await storedBatchNumbers(tx, scope, due.flatMap((i) => lines[i].sviId ?? []));
    for (const i of due) {
        const kept = lines[i].sviId ? stored.get(lines[i].sviId) : undefined;
        if (kept) {
            result[i] = { ...lines[i], batchNo: kept };
        }
    }
    due = due.filter((i) => !stored.has(lines[i].sviId ?? ''));
    if (due.length === 0) {
        return done();
    }
    const prefix = `${await branchBatchCode(tx, scope.branchId)}${scope.accYear.slice(2, 4)}-`;
    const vchrTypeId = await batchVoucherTypeId(tx);
    for (const i of due) {
        const { refno } = await (0, voucher_sequence_helper_1.allocateVoucherNumber)(tx, {
            vchrTypeId,
            companyId: scope.companyId,
            branchId: scope.branchId,
            accYear: scope.accYear,
            deviceCode: BATCH_DEVICE_CODE,
        });
        result[i] = { ...lines[i], batchNo: `${prefix}${refno}` };
        numbered.add(i);
    }
    return done();
}
async function autoBatchNoIsOn(tx, companyId, branchId) {
    const [row] = await tx.$queryRaw `
    SELECT out_effective_value AS value
      FROM public.fn_app_settings_effective(${companyId}::uuid, ${branchId}::uuid, NULL::uuid, NULL::uuid)
     WHERE out_asd_key = ${exports.AUTO_BATCH_NO_SETTING}`;
    const token = row?.value?.trim().toLowerCase();
    return token !== undefined && ['true', '1', 'yes', 'y', 'on'].includes(token);
}
async function batchTrackedItems(tx, scope, itemIds) {
    const rows = await tx.$queryRaw `
    SELECT itm.item_id
      FROM inventory.item_master itm
      ${(0, stock_voucher_posting_helper_1.effectivePolicyLateral)({
        companyId: client_1.Prisma.sql `${scope.companyId}::uuid`,
        branchId: client_1.Prisma.sql `${scope.branchId}::uuid`,
        itemId: client_1.Prisma.raw('itm.item_id'),
        itemGroupId: client_1.Prisma.raw('itm.item_group_id'),
        onDate: client_1.Prisma.sql `${scope.docDate}::date`,
    })}
     WHERE itm.item_id = ANY(${itemIds}::uuid[])
       AND COALESCE(stp.stp_track_batch, false)`;
    return new Set(rows.map((row) => row.item_id));
}
async function storedBatchNumbers(tx, scope, sviIds) {
    if (!scope.svhId || sviIds.length === 0) {
        return new Map();
    }
    const rows = await tx.$queryRaw `
    SELECT svi_id, svi_batch_no
      FROM stock.stock_voucher_item
     WHERE svi_voucher_id = ${scope.svhId}::uuid
       AND svi_acc_year   = ${scope.accYear}::bpchar
       AND svi_id = ANY(${sviIds}::uuid[])
       AND svi_is_deleted = false
       AND NULLIF(btrim(svi_batch_no), '') IS NOT NULL`;
    return new Map(rows.map((row) => [row.svi_id, row.svi_batch_no]));
}
async function branchBatchCode(tx, branchId) {
    const [row] = await tx.$queryRaw `
    SELECT upper(COALESCE(NULLIF(btrim(br_bill_prefix), ''), NULLIF(btrim(br_code), ''))) AS code
      FROM public.branch_master
     WHERE br_id = ${branchId}::uuid`;
    if (!row?.code) {
        (0, module_service_utils_1.throwStockUnprocessable)(BATCH_PREFIX_MISSING_MESSAGE, [
            {
                field: 'branchId',
                code: stock_error_codes_1.StockErrorCode.BATCH_PREFIX_MISSING,
                message: BATCH_PREFIX_MISSING_MESSAGE,
            },
        ]);
    }
    return row.code;
}
async function batchVoucherTypeId(tx) {
    const [row] = await tx.$queryRaw `
    SELECT vchr_type_id FROM accounts.acc_voucher_types
     WHERE vchr_type_code = ${exports.BATCH_VOUCHER_TYPE_CODE} AND vchr_is_active = true LIMIT 1`;
    if (!row) {
        throw new Error(`Voucher type '${exports.BATCH_VOUCHER_TYPE_CODE}' is missing — apply the migration that seeds it`);
    }
    return row.vchr_type_id;
}
//# sourceMappingURL=stock-voucher-batch-numbering.helper.js.map