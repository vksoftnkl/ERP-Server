"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BILL_VOUCHER_TYPE_ERRORS = exports.DEFAULT_BILL_PRINT_PURPOSE = exports.BILL_VOUCHER_TYPE_KEY = exports.OFFER_BASE_BILL_TYPE_KEY = exports.BILL_BASE_VCHR_TYPE_ID = void 0;
exports.billTypeDeliveryMode = billTypeDeliveryMode;
exports.billVoucherTypeOf = billVoucherTypeOf;
exports.billSeriesDeviceCode = billSeriesDeviceCode;
exports.activeBillChildCount = activeBillChildCount;
exports.offeredBillTypes = offeredBillTypes;
exports.billTypeChoices = billTypeChoices;
exports.judgeBillVoucherType = judgeBillVoucherType;
exports.resolveBillVoucherType = resolveBillVoucherType;
exports.billOfflineTypeRefusal = billOfflineTypeRefusal;
exports.assertBillTypeAtSite = assertBillTypeAtSite;
exports.billTypeLockRefusal = billTypeLockRefusal;
exports.assertBillTypeUnchanged = assertBillTypeUnchanged;
exports.billTypeRefusals = billTypeRefusals;
exports.designUsable = designUsable;
exports.billVoucherTypeBlock = billVoucherTypeBlock;
const client_1 = require("@prisma/client");
const module_shared_utils_1 = require("../../../common/utils/module-shared.utils");
const print_design_usable_sql_1 = require("../../settings/print-template-assignment/print-design-usable.sql");
const sales_doc_utils_1 = require("../posting/sales-doc.utils");
exports.BILL_BASE_VCHR_TYPE_ID = sales_doc_utils_1.SALES_VOUCHER_TYPE.BILL;
exports.OFFER_BASE_BILL_TYPE_KEY = 'sales.offer_base_bill_type';
exports.BILL_VOUCHER_TYPE_KEY = 'sales.bill_voucher_type';
exports.DEFAULT_BILL_PRINT_PURPOSE = 'SALE_INVOICE';
exports.BILL_VOUCHER_TYPE_ERRORS = {
    REQUIRED: 'VT_BILL_TYPE_REQUIRED',
    INVALID: 'VT_BILL_TYPE_INVALID',
    LOCKED: 'VT_BILL_TYPE_LOCKED',
    OFFLINE: 'VT_OFFLINE',
};
const BILL_DELIVERY_MODES = ['INSTANT', 'PICKUP', 'DISPATCH'];
function billTypeDeliveryMode(own, baseMode, billMode) {
    if ((billMode ?? '').trim().toUpperCase() === 'POS') {
        return 'INSTANT';
    }
    const pick = (own ?? '').trim().toUpperCase() || (baseMode ?? '').trim().toUpperCase();
    return BILL_DELIVERY_MODES.includes(pick)
        ? pick
        : 'INSTANT';
}
const pickBool = (v) => {
    const t = (v ?? '').trim().toLowerCase();
    return t === 'true' || t === '1' || t === 'yes';
};
const pickInt = (v) => {
    const n = Number.parseInt((v ?? '').trim(), 10);
    return Number.isInteger(n) && n > 0 ? n : null;
};
function billVoucherTypeOf(bill) {
    return bill.sbVchrTypeId ?? exports.BILL_BASE_VCHR_TYPE_ID;
}
function billSeriesDeviceCode(p) {
    const deviceId = p.deviceId?.trim() || null;
    return p.vchrTypeId === exports.BILL_BASE_VCHR_TYPE_ID &&
        (p.billMode ?? 'WHOLESALE') === 'POS' &&
        p.posSeriesPerDevice &&
        deviceId
        ? deviceId
        : null;
}
async function activeBillChildCount(client, companyId) {
    const [row] = await client.$queryRaw `
    SELECT count(*)::int AS n FROM accounts.acc_voucher_types
     WHERE vchr_parent_id = ${exports.BILL_BASE_VCHR_TYPE_ID}::int
       AND vchr_company_id = ${companyId}::uuid
       AND vchr_is_active = true`;
    return typeof row?.n === 'number' ? row.n : 0;
}
async function offeredBillTypes(client, companyId, offerBase, offlineSite = false) {
    const rows = await client.$queryRaw `
    SELECT vchr_type_id, vchr_type_code, vchr_type_name, vchr_type_short, vchr_parent_id,
           vchr_no_prefix, vchr_sort_order, vchr_delivery_mode
      FROM accounts.acc_voucher_types
     WHERE (vchr_parent_id = ${exports.BILL_BASE_VCHR_TYPE_ID}::int AND vchr_company_id = ${companyId}::uuid
            AND vchr_is_active = true)
        OR vchr_type_id = ${exports.BILL_BASE_VCHR_TYPE_ID}::int
     ORDER BY vchr_sort_order, vchr_type_id`;
    const all = rows.map((r) => ({
        vchrTypeId: r.vchr_type_id,
        vchrTypeCode: r.vchr_type_code,
        vchrTypeName: r.vchr_type_name,
        vchrTypeShort: r.vchr_type_short,
        vchrParentId: r.vchr_parent_id,
        vchrNoPrefix: r.vchr_no_prefix,
        vchrSortOrder: r.vchr_sort_order,
        vchrDeliveryMode: r.vchr_delivery_mode ?? null,
    }));
    if (offlineSite) {
        return all.filter((t) => t.vchrTypeId === exports.BILL_BASE_VCHR_TYPE_ID);
    }
    const children = all.filter((t) => t.vchrParentId === exports.BILL_BASE_VCHR_TYPE_ID);
    return children.length === 0 || offerBase ? all : children;
}
async function billTypeChoices(client, values, scope) {
    const settings = await values(scope.companyId, scope.branchId, scope.deviceId ?? null, [
        exports.OFFER_BASE_BILL_TYPE_KEY,
        exports.BILL_VOUCHER_TYPE_KEY,
    ]);
    const offerBase = pickBool(settings[exports.OFFER_BASE_BILL_TYPE_KEY]);
    const offered = await offeredBillTypes(client, scope.companyId, offerBase, scope.offlineSite === true);
    const deviceDefault = pickInt(settings[exports.BILL_VOUCHER_TYPE_KEY]);
    return {
        offered,
        defaultVchrTypeId: deviceDefault !== null && offered.some((t) => t.vchrTypeId === deviceDefault)
            ? deviceDefault
            : null,
        offerBase,
    };
}
const refusalOf = (code, message) => ({
    vchrTypeId: null,
    refusal: { field: 'sbVchrTypeId', code, message },
});
async function judgeBillVoucherType(client, values, dto, site = {}) {
    const requested = dto.sbVchrTypeId ?? null;
    if (site.offlineSite) {
        if (requested === null || requested === exports.BILL_BASE_VCHR_TYPE_ID) {
            return { vchrTypeId: exports.BILL_BASE_VCHR_TYPE_ID, refusal: null };
        }
        return refusalOf(exports.BILL_VOUCHER_TYPE_ERRORS.OFFLINE, `This install is an offline site (CLOUD_SYNC_ENABLED): it bills as Sales Bill (${exports.BILL_BASE_VCHR_TYPE_ID}) only; voucher type ${requested} is billed on the main server.`);
    }
    if ((await activeBillChildCount(client, dto.sbCompanyId)) === 0) {
        if (requested === null || requested === exports.BILL_BASE_VCHR_TYPE_ID) {
            return { vchrTypeId: exports.BILL_BASE_VCHR_TYPE_ID, refusal: null };
        }
        return refusalOf(exports.BILL_VOUCHER_TYPE_ERRORS.INVALID, `Voucher type ${requested} is not an active bill type of company ${dto.sbCompanyId}; it bills as Sales Bill.`);
    }
    const { offered, defaultVchrTypeId } = await billTypeChoices(client, values, {
        companyId: dto.sbCompanyId,
        branchId: dto.sbBranchId,
        deviceId: dto.sbDeviceId,
    });
    if (requested !== null) {
        if (!offered.some((t) => t.vchrTypeId === requested)) {
            return refusalOf(exports.BILL_VOUCHER_TYPE_ERRORS.INVALID, `Voucher type ${requested} is not offered for bills of company ${dto.sbCompanyId} (offered: ${offered
                .map((t) => t.vchrTypeId)
                .join(', ')}).`);
        }
        return { vchrTypeId: requested, refusal: null };
    }
    if (defaultVchrTypeId !== null) {
        return { vchrTypeId: defaultVchrTypeId, refusal: null };
    }
    if (offered.length === 1) {
        return { vchrTypeId: offered[0].vchrTypeId, refusal: null };
    }
    return refusalOf(exports.BILL_VOUCHER_TYPE_ERRORS.REQUIRED, `Company ${dto.sbCompanyId} bills under ${offered.length} voucher types; pick one (sbVchrTypeId).`);
}
async function resolveBillVoucherType(client, values, dto, site = {}) {
    const verdict = await judgeBillVoucherType(client, values, dto, site);
    if (verdict.refusal) {
        if (verdict.refusal.code === exports.BILL_VOUCHER_TYPE_ERRORS.OFFLINE) {
            (0, module_shared_utils_1.throwForbidden)(verdict.refusal.message, [verdict.refusal]);
        }
        (0, module_shared_utils_1.throwUnprocessable)(verdict.refusal.message, [verdict.refusal]);
    }
    return verdict.vchrTypeId;
}
function billOfflineTypeRefusal(existing, site) {
    const stored = existing.sbVchrTypeId ?? exports.BILL_BASE_VCHR_TYPE_ID;
    if (!site.offlineSite || stored === exports.BILL_BASE_VCHR_TYPE_ID) {
        return null;
    }
    return {
        field: 'sbVchrTypeId',
        code: exports.BILL_VOUCHER_TYPE_ERRORS.OFFLINE,
        message: `Bill ${existing.sbBillRefno ?? ''} is numbered under voucher type ${stored}; this install is an offline site (CLOUD_SYNC_ENABLED), which saves and posts Sales Bill (${exports.BILL_BASE_VCHR_TYPE_ID}) only. Do it on the main server.`,
    };
}
function assertBillTypeAtSite(existing, site) {
    const refusal = billOfflineTypeRefusal(existing, site);
    if (refusal) {
        (0, module_shared_utils_1.throwForbidden)(refusal.message, [refusal]);
    }
}
function billTypeLockRefusal(existing, requested) {
    if (requested === undefined || requested === null) {
        return null;
    }
    const stored = existing.sbVchrTypeId ?? exports.BILL_BASE_VCHR_TYPE_ID;
    if (requested === stored) {
        return null;
    }
    return {
        field: 'sbVchrTypeId',
        code: exports.BILL_VOUCHER_TYPE_ERRORS.LOCKED,
        message: `Bill ${existing.sbBillRefno ?? ''} is numbered under voucher type ${stored}; its type cannot change to ${requested}. Cancel it and bill again.`,
    };
}
function assertBillTypeUnchanged(existing, requested) {
    const refusal = billTypeLockRefusal(existing, requested);
    if (refusal) {
        (0, module_shared_utils_1.throwConflict)(refusal.message, [refusal]);
    }
}
async function billTypeRefusals(client, values, dto, site = {}) {
    if (dto.sbId) {
        const [saved] = await client.$queryRaw `
      SELECT sb_vchr_type_id, sb_bill_refno FROM sales.sale_bill
       WHERE sb_id = ${dto.sbId}::uuid
         AND (${dto.sbAccYear ?? null}::text IS NULL OR sb_acc_year = ${dto.sbAccYear ?? null}::char(9))
         AND sb_is_deleted = false
       LIMIT 1`;
        if (!saved || typeof saved.sb_vchr_type_id !== 'number') {
            return [];
        }
        const existing = { sbVchrTypeId: saved.sb_vchr_type_id, sbBillRefno: saved.sb_bill_refno };
        const refusal = billOfflineTypeRefusal(existing, site) ?? billTypeLockRefusal(existing, dto.sbVchrTypeId);
        return refusal ? [refusal] : [];
    }
    const verdict = await judgeBillVoucherType(client, values, dto, site);
    return verdict.refusal ? [verdict.refusal] : [];
}
function designUsable(d) {
    return !!d.code && d.live === true && d.layout === true && d.assigned === true;
}
async function billVoucherTypeBlock(client, bill) {
    const typeId = bill.sbVchrTypeId ?? exports.BILL_BASE_VCHR_TYPE_ID;
    const company = client_1.Prisma.sql `${bill.sbCompanyId}::uuid`;
    const rule = (text, alias) => (0, print_design_usable_sql_1.printDesignRuleSql)(text, alias, company);
    const [r] = await client.$queryRaw `
    SELECT t.vchr_type_id, t.vchr_type_name, t.vchr_type_short, t.vchr_parent_id,
           t.vchr_print_title AS own_title, b.vchr_print_title AS base_title,
           t.vchr_print_after_post AS print_after_post,
           op.ppo_code AS own_code, op.ppo_name AS own_name,
           (${rule(print_design_usable_sql_1.PRINT_DESIGN_LIVE_RULE, 'op')}) AS own_live,
           ${rule(print_design_usable_sql_1.PRINT_DESIGN_LAYOUT_RULE, 'op')} AS own_layout,
           ${rule(print_design_usable_sql_1.PRINT_DESIGN_ASSIGNMENT_RULE, 'op')} AS own_assigned,
           bp.ppo_code AS base_code, bp.ppo_name AS base_name,
           (${rule(print_design_usable_sql_1.PRINT_DESIGN_LIVE_RULE, 'bp')}) AS base_live,
           ${rule(print_design_usable_sql_1.PRINT_DESIGN_LAYOUT_RULE, 'bp')} AS base_layout,
           ${rule(print_design_usable_sql_1.PRINT_DESIGN_ASSIGNMENT_RULE, 'bp')} AS base_assigned,
           (SELECT d.ppo_name FROM public.print_purpose d
             WHERE d.ppo_company_id IS NULL AND d.ppo_code = ${exports.DEFAULT_BILL_PRINT_PURPOSE}
               AND d.ppo_is_deleted = false LIMIT 1) AS default_name
      FROM accounts.acc_voucher_types t
      LEFT JOIN accounts.acc_voucher_types b ON b.vchr_type_id = t.vchr_parent_id
      LEFT JOIN public.print_purpose op ON op.ppo_id = t.vchr_print_purpose_id
      LEFT JOIN public.print_purpose bp ON bp.ppo_id = b.vchr_print_purpose_id
     WHERE t.vchr_type_id = ${typeId}::int`;
    if (!r) {
        return {
            vchrTypeId: typeId,
            vchrTypeName: null,
            vchrTypeShort: null,
            vchrParentId: null,
            printTitle: null,
            printPurposeCode: exports.DEFAULT_BILL_PRINT_PURPOSE,
            printAfterPost: false,
        };
    }
    const own = {
        code: r.own_code,
        name: r.own_name,
        live: r.own_live,
        layout: r.own_layout,
        assigned: r.own_assigned,
    };
    const base = {
        code: r.base_code,
        name: r.base_name,
        live: r.base_live,
        layout: r.base_layout,
        assigned: r.base_assigned,
    };
    const design = designUsable(own)
        ? { code: own.code, name: own.name }
        : designUsable(base)
            ? { code: base.code, name: base.name }
            : { code: exports.DEFAULT_BILL_PRINT_PURPOSE, name: r.default_name };
    return {
        vchrTypeId: r.vchr_type_id,
        vchrTypeName: r.vchr_type_name,
        vchrTypeShort: r.vchr_type_short,
        vchrParentId: r.vchr_parent_id,
        printTitle: r.own_title?.trim() || r.base_title?.trim() || design.name || null,
        printPurposeCode: design.code,
        printAfterPost: r.print_after_post === true,
    };
}
//# sourceMappingURL=bill-voucher-type.helper.js.map