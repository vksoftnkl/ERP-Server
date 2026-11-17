"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UUID_PATTERN = exports.dec = exports.DC_ORDER_REF_FIELDS = exports.DC_ZERO_CHARGE_FIELDS = void 0;
exports.allocateDcDocNumber = allocateDcDocNumber;
exports.nextRegisterVoucherNo = nextRegisterVoucherNo;
exports.daysBetween = daysBetween;
exports.ageLevelOf = ageLevelOf;
exports.isPastReturnWindow = isPastReturnWindow;
exports.dcReturnWindowOf = dcReturnWindowOf;
exports.dcAgeing = dcAgeing;
exports.dcEwayStateOf = dcEwayStateOf;
exports.dcEwayVerdict = dcEwayVerdict;
exports.dcPartBMissing = dcPartBMissing;
exports.dcLineNames = dcLineNames;
exports.assertNoCharges = assertNoCharges;
exports.dcOrderLineOf = dcOrderLineOf;
exports.orderLineFreeOf = orderLineFreeOf;
exports.checkDcFreeLines = checkDcFreeLines;
exports.orderLineRefsOf = orderLineRefsOf;
exports.orderLineKeysOf = orderLineKeysOf;
exports.applyDcLineLevels = applyDcLineLevels;
exports.orderLinesOfDcLines = orderLinesOfDcLines;
exports.dcSourceOrdersOfLines = dcSourceOrdersOfLines;
exports.lockChallansOfLines = lockChallansOfLines;
exports.lockDcLines = lockDcLines;
exports.dcQtyInOrderTerms = dcQtyInOrderTerms;
exports.dcFreeTypeOf = dcFreeTypeOf;
exports.checkDcMoney = checkDcMoney;
exports.dcTotals = dcTotals;
exports.registerLineTaxability = registerLineTaxability;
exports.registerDocTaxability = registerDocTaxability;
const client_1 = require("@prisma/client");
const voucher_sequence_helper_1 = require("../../../common/Sequence/voucher-sequence.helper");
const stock_voucher_numbering_helper_1 = require("../../stocks/stock-voucher/stock-voucher-numbering.helper");
const stock_error_codes_1 = require("../../stocks/types/stock-error-codes");
const statutory_types_1 = require("../../../common/posting/statutory.types");
const sales_errors_1 = require("../posting/sales.errors");
const sales_doc_utils_1 = require("../posting/sales-doc.utils");
const sales_guards_1 = require("../posting/sales.guards");
const posting_types_1 = require("../posting/types/posting.types");
const D = (v) => new client_1.Prisma.Decimal(v === null || v === undefined || v === '' ? 0 : v);
exports.dec = D;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
exports.UUID_PATTERN = UUID;
async function allocateDcDocNumber(tx, q) {
    const deviceId = (q.deviceId ?? '').trim();
    if (!UUID.test(deviceId)) {
        (0, sales_errors_1.throwSalesRefused)(`The device "${deviceId}" is not a registered PC: challans and returns are numbered per PC`, stock_error_codes_1.StockErrorCode.DEVICE_NOT_FOUND, q.field);
    }
    const deviceCode = await (0, stock_voucher_numbering_helper_1.resolveDeviceCode)(tx, deviceId);
    const n = await (0, voucher_sequence_helper_1.allocateVoucherNumber)(tx, {
        vchrTypeId: q.vchrTypeId,
        companyId: q.companyId,
        branchId: q.branchId,
        accYear: q.accYear,
        deviceCode,
        documentDate: q.documentDate,
    });
    return { lastNo: n.lastNo, refno: n.refno };
}
async function nextRegisterVoucherNo(tx, q) {
    const key = [q.companyId, q.branchId, q.accYear, q.voucherTypeId].join('|');
    await tx.$queryRaw `
    SELECT count(pg_advisory_xact_lock(hashtext('accounts.acc_voucher_doc_register.dc_serial'), hashtext(${key})))::int AS locked`;
    const [row] = await tx.$queryRaw `
    SELECT COALESCE(MAX(gdr_voucher_no), 0) + 1 AS n
      FROM accounts.acc_voucher_doc_register
     WHERE gdr_company_id = ${q.companyId}::uuid AND gdr_branch_id = ${q.branchId}::uuid
       AND gdr_acc_year = ${q.accYear}::char(9) AND gdr_voucher_type_id = ${q.voucherTypeId}::int`;
    return BigInt(row?.n ?? 1);
}
const AMBER_DAYS_KEY = 'sales.delivery_amber_days';
const OLD_DAYS_KEY = 'sales.delivery_old_days';
const DEFAULT_AMBER_DAYS = 7;
const DEFAULT_OLD_DAYS = 30;
const intOr = (v, d) => {
    const n = Number.parseInt((v ?? '').trim(), 10);
    return Number.isFinite(n) && n >= 0 ? n : d;
};
function daysBetween(docDate, today) {
    const a = Date.parse(`${docDate}T00:00:00Z`);
    const b = Date.parse(`${today}T00:00:00Z`);
    return Number.isFinite(a) && Number.isFinite(b) ? Math.max(0, Math.round((b - a) / 86_400_000)) : 0;
}
function ageLevelOf(purpose, ageDays, limits, status) {
    if (status !== 'POSTED') {
        return '';
    }
    if ((purpose ?? 'SUPPLY').toUpperCase() === 'SUPPLY') {
        return ageDays > limits.oldDays ? 'RED' : ageDays > limits.amberDays ? 'AMBER' : '';
    }
    return isPastReturnWindow(purpose, ageDays, limits.windowDays, status) ? 'RED' : '';
}
function isPastReturnWindow(purpose, ageDays, windowDays, status) {
    return (status === 'POSTED' &&
        (purpose ?? 'SUPPLY').toUpperCase() !== 'SUPPLY' &&
        windowDays !== null &&
        ageDays > windowDays);
}
async function dcReturnWindowOf(statutory, companyId, docDate) {
    const window = await statutory.limit(companyId, statutory_types_1.STATUTORY_CODES.DC_RETURN_WINDOW_DAYS, docDate);
    const value = window?.value === null || window?.value === undefined ? null : Number(window.value);
    if (value === null || !Number.isFinite(value)) {
        return null;
    }
    return {
        days: value,
        source: window?.isCompanyOverride ? 'COMPANY' : 'SHIPPED',
        effectiveFrom: window?.effectiveFrom ?? null,
    };
}
async function dcAgeing(salesContext, statutory, q) {
    const [settings, returnWindow] = await Promise.all([
        salesContext.values(q.companyId, q.branchId, null, [AMBER_DAYS_KEY, OLD_DAYS_KEY]),
        dcReturnWindowOf(statutory, q.companyId, q.docDate),
    ]);
    const ageDays = daysBetween(q.docDate, q.today);
    const windowDays = returnWindow?.days ?? null;
    return {
        ageDays,
        ageLevel: q.open === false
            ? ''
            : ageLevelOf(q.purpose, ageDays, {
                amberDays: intOr(settings[AMBER_DAYS_KEY], DEFAULT_AMBER_DAYS),
                oldDays: intOr(settings[OLD_DAYS_KEY], DEFAULT_OLD_DAYS),
                windowDays,
            }, q.status),
        returnWindow,
        pastWindow: isPastReturnWindow(q.purpose, ageDays, windowDays, q.status),
    };
}
const trimmed = (v) => (v ?? '').trim() || null;
function dcEwayStateOf(companyStateCode, posStateCode) {
    const pos = trimmed(posStateCode);
    if (pos !== null) {
        return { stateCode: pos, posFromCompany: false };
    }
    const company = trimmed(companyStateCode);
    return { stateCode: company, posFromCompany: company !== null };
}
async function dcEwayVerdict(c, statutory, q) {
    const nature = (0, sales_doc_utils_1.supplyNatureOf)(q.companyStateCode, q.posStateCode);
    const value = D(q.value);
    const from = trimmed(q.companyStateCode);
    const dest = dcEwayStateOf(q.companyStateCode, q.posStateCode);
    const to = dest.stateCode;
    const codes = [...new Set([from, to].filter((v) => v !== null))];
    const [eway, states] = await Promise.all([
        statutory.ewayApplicable(q.companyId, value.toNumber(), q.docDate, { interState: nature === 'INTER', stateCode: to }, c),
        codes.length === 0
            ? []
            : c.$queryRaw `
          SELECT btrim(state_code) AS code, state_name AS name FROM fixed.state_codes
           WHERE btrim(state_code) = ANY(${codes}::text[])`,
    ]);
    const nameOf = new Map(states.map((r) => [r.code, r.name]));
    const limit = eway.limit;
    return {
        needed: eway.applicable,
        supplyNature: nature === 'INTER' ? 'INTER_STATE' : 'INTRA_STATE',
        fromStateCode: from,
        fromStateName: from === null ? null : (nameOf.get(from) ?? null),
        toStateCode: to,
        toStateName: to === null ? null : (nameOf.get(to) ?? null),
        posFromCompany: dest.posFromCompany,
        value: value.toFixed(2),
        onDate: q.docDate,
        limit: limit
            ? {
                value: limit.value == null ? null : D(limit.value).toFixed(2),
                appliesTo: limit.appliesTo ?? (nature === 'INTER' ? 'INTER_STATE' : 'INTRA_STATE'),
                source: limit.isCompanyOverride ? 'COMPANY' : 'SHIPPED',
                effectiveFrom: limit.effectiveFrom ?? null,
            }
            : null,
    };
}
function dcPartBMissing(band, row) {
    const mode = (band?.mode ?? 'ROAD').toUpperCase();
    const hasVehicle = (mode === 'ROAD' || mode === '1') &&
        !!((row.sdcVehicleNo ?? '').trim() || row.sdcVehicleId);
    return !(band?.transporterId || band?.transporterName || band?.lrNo) && !hasVehicle;
}
async function dcLineNames(c, lines) {
    const ids = (pick) => [
        ...new Set(lines.map(pick).filter((v) => typeof v === 'string' && UUID.test(v))),
    ];
    const itemIds = ids((l) => l.itemId);
    const unitIds = ids((l) => l.itemUnitId);
    const godownIds = ids((l) => l.godownId);
    const lotIds = ids((l) => l.lotId);
    const [items, units, godowns, lots] = await Promise.all([
        itemIds.length === 0
            ? []
            : c.$queryRaw `
          SELECT item_id AS id, item_name_en AS name, item_code AS code FROM inventory.item_master
           WHERE item_id = ANY(${itemIds}::uuid[])`,
        unitIds.length === 0
            ? []
            : c.$queryRaw `
          SELECT iuc.iuc_id AS id, um.unit_name AS name, iuc.iuc_uom_weight AS kg
            FROM inventory.item_unit_conversion iuc
            LEFT JOIN inventory.item_unit_master um ON um.unit_id = iuc.iuc_unit_id
           WHERE iuc.iuc_id = ANY(${unitIds}::uuid[])`,
        godownIds.length === 0
            ? []
            : c.$queryRaw `
          SELECT gdl_id AS id, gdl_name AS name FROM inventory.godown_locations
           WHERE gdl_id = ANY(${godownIds}::uuid[])`,
        lotIds.length === 0
            ? []
            : c.$queryRaw `
          SELECT slt_id AS id, slt_batch_no AS name FROM stock.stock_lot
           WHERE slt_id = ANY(${lotIds}::uuid[])`,
    ]);
    const item = new Map(items.map((r) => [r.id, r]));
    const unit = new Map(units.map((r) => [r.id, r]));
    const godown = new Map(godowns.map((r) => [r.id, r.name]));
    const lot = new Map(lots.map((r) => [r.id, r.name]));
    return (l) => ({
        itemName: item.get(l.itemId)?.name ?? null,
        itemCode: item.get(l.itemId)?.code ?? null,
        unitName: unit.get(l.itemUnitId)?.name ?? null,
        godownName: godown.get(l.godownId) ?? null,
        lotNo: lot.get(l.lotId) ?? null,
        unitKg: D(unit.get(l.itemUnitId)?.kg ?? 0).toFixed(3),
    });
}
function assertNoCharges(charges) {
    if (Array.isArray(charges) && charges.length > 0) {
        (0, sales_errors_1.throwSalesRefused)('A challan or a challan return carries no charges: put freight and other charges on the Sales Bill', posting_types_1.SALES_ERROR_CODES.DC_CHARGES_NOT_ALLOWED, 'charges');
    }
}
exports.DC_ZERO_CHARGE_FIELDS = [
    'sdcOtherAmt',
    'sdcFreightAmt',
    'sdcLoadAmt',
    'sdcUnloadAmt',
];
function dcOrderLineOf(l) {
    return l.sdiSrcDocType === 'SALES_ORDER' && typeof l.sdiSrcItemId === 'string' && l.sdiSrcItemId
        ? l.sdiSrcItemId
        : null;
}
async function orderLineFreeOf(tx, soiIds) {
    const ids = [...new Set(soiIds)];
    if (ids.length === 0) {
        return new Map();
    }
    const rows = await tx.$queryRaw `
    SELECT soi_id, soi_is_free, soi_free_type FROM sales.sale_order_item
     WHERE soi_id = ANY(${ids}::uuid[]) AND soi_is_deleted = false`;
    return new Map(rows.map((r) => [r.soi_id, { isFree: r.soi_is_free === true, freeType: r.soi_free_type ?? null }]));
}
function checkDcFreeLines(g, lines, orderFree) {
    for (const [idx, l] of lines.entries()) {
        const n = l.sdiLineNo ?? idx + 1;
        const free = l.sdiIsFree === true;
        const soiId = dcOrderLineOf(l);
        const src = soiId ? orderFree.get(soiId) : undefined;
        let why = null;
        if (free && !soiId) {
            why = `Line ${n}: only an order's free line comes free onto a challan, and this line names no order line`;
        }
        else if (src && src.isFree !== free) {
            why = src.isFree
                ? `Line ${n}: its order line is free, so the challan line must be free too`
                : `Line ${n}: its order line is not free, so the challan line cannot be free`;
        }
        else if (free &&
            (!D(l.sdiRate).isZero() || !D(l.sdiTaxableAmt).isZero())) {
            why = `Line ${n}: a free line carries no price (rate and taxable 0)`;
        }
        if (why) {
            (0, sales_guards_1.refuse)(g, posting_types_1.SALES_ERROR_CODES.AMOUNT_MISMATCH, why, {
                field: 'items',
                line: n,
                rule: 'FREE_LINE',
                params: { n },
            });
        }
    }
}
exports.DC_ORDER_REF_FIELDS = {
    docId: 'sdiSrcItemId',
    accYear: 'sdiSrcDocAccYear',
    lineNo: 'sdiSrcLineNo',
};
async function orderLineRefsOf(tx, soiIds) {
    const ids = [...new Set(soiIds.filter((v) => typeof v === 'string' && UUID.test(v)))];
    if (ids.length === 0) {
        return [];
    }
    const rows = await tx.$queryRaw `
    SELECT soi_id, soi_acc_year FROM sales.sale_order_item
     WHERE soi_id = ANY(${ids}::uuid[]) AND soi_is_deleted = false`;
    return (rows ?? [])
        .filter((r) => typeof r?.soi_id === 'string' && typeof r.soi_acc_year === 'string')
        .map((r) => ({
        srcDocId: r.soi_id,
        srcAccYear: r.soi_acc_year.trim(),
        soLineNo: null,
        fields: { ...exports.DC_ORDER_REF_FIELDS },
    }));
}
async function orderLineKeysOf(tx, soiIds) {
    const ids = [...new Set(soiIds.filter((v) => typeof v === 'string' && UUID.test(v)))];
    const out = new Map();
    if (ids.length === 0) {
        return out;
    }
    const rows = await tx.$queryRaw `
    SELECT soi_order_id, soi_line_no FROM sales.sale_order_item
     WHERE soi_id = ANY(${ids}::uuid[]) AND soi_is_deleted = false`;
    for (const r of rows ?? []) {
        if (typeof r?.soi_order_id !== 'string' || typeof r.soi_line_no !== 'number') {
            continue;
        }
        out.set(r.soi_order_id, [...(out.get(r.soi_order_id) ?? []), r.soi_line_no]);
    }
    return out;
}
function applyDcLineLevels(dto) {
    const level = dto.sdcPriceLevel;
    if (typeof level !== 'number' || !Number.isInteger(level) || level <= 0) {
        return;
    }
    for (const i of dto.items ?? []) {
        if (i.sdiPriceLevel === undefined || i.sdiPriceLevel === null || i.sdiPriceLevel === 0) {
            i.sdiPriceLevel = level;
        }
    }
}
async function orderLinesOfDcLines(tx, sdiIds) {
    const ids = [...new Set(sdiIds.filter((v) => typeof v === 'string' && UUID.test(v)))];
    if (ids.length === 0) {
        return [];
    }
    const rows = await tx.$queryRaw `
    SELECT DISTINCT sdi_src_item_id AS soi_id FROM sales.sale_dc_item
     WHERE sdi_id = ANY(${ids}::uuid[]) AND sdi_src_doc_type = 'SALES_ORDER'
       AND sdi_src_item_id IS NOT NULL`;
    return (rows ?? []).map((r) => r?.soi_id).filter((v) => typeof v === 'string');
}
async function dcSourceOrdersOfLines(tx, sdiIds) {
    const ids = [...new Set(sdiIds.filter((v) => typeof v === 'string' && UUID.test(v)))];
    if (ids.length === 0) {
        return { orderIds: [], orderLineIds: [] };
    }
    const rows = await tx.$queryRaw `
    SELECT CASE WHEN d.sdi_src_doc_type = 'SALES_ORDER' THEN d.sdi_src_doc_id::text END AS line_so_id,
           CASE WHEN d.sdi_src_doc_type = 'SALES_ORDER' THEN d.sdi_src_item_id::text END AS soi_id,
           CASE WHEN c.sdc_src_doc_type = 'SALES_ORDER' THEN c.sdc_src_doc_id::text END AS head_so_id
      FROM sales.sale_dc_item d
      JOIN sales.sale_dc c ON c.sdc_id = d.sdi_dc_id AND c.sdc_acc_year = d.sdi_acc_year
     WHERE d.sdi_id = ANY(${ids}::uuid[])`;
    const orderIds = new Set();
    const orderLineIds = new Set();
    for (const r of rows ?? []) {
        for (const id of [r?.line_so_id, r?.head_so_id]) {
            if (typeof id === 'string' && UUID.test(id)) {
                orderIds.add(id);
            }
        }
        if (typeof r?.soi_id === 'string' && UUID.test(r.soi_id)) {
            orderLineIds.add(r.soi_id);
        }
    }
    return { orderIds: [...orderIds], orderLineIds: [...orderLineIds] };
}
async function lockChallansOfLines(tx, sdiIds) {
    const ids = [...new Set(sdiIds.filter((v) => typeof v === 'string' && UUID.test(v)))].sort();
    if (ids.length === 0) {
        return;
    }
    await tx.$queryRaw `
    SELECT c.sdc_id FROM sales.sale_dc c
     WHERE (c.sdc_id, c.sdc_acc_year) IN (SELECT d.sdi_dc_id, d.sdi_acc_year FROM sales.sale_dc_item d
                                          WHERE d.sdi_id = ANY(${ids}::uuid[]))
     ORDER BY c.sdc_id
       FOR UPDATE OF c`;
    await tx.$queryRaw `
    SELECT sdi_id FROM sales.sale_dc_item
     WHERE sdi_id = ANY(${ids}::uuid[])
     ORDER BY sdi_id
       FOR UPDATE`;
}
async function lockDcLines(tx, dcId, accYear) {
    await tx.$queryRaw `
    SELECT sdi_id FROM sales.sale_dc_item
     WHERE sdi_dc_id = ${dcId}::uuid AND sdi_acc_year = ${accYear.trim()}::char(9)
       AND sdi_is_deleted = false
     ORDER BY sdi_id
       FOR UPDATE`;
}
function dcQtyInOrderTerms(l, o) {
    const qty = D(l.sdiDcQty);
    if (!o.soi_item_unit_id || l.sdiItemUnitId === o.soi_item_unit_id) {
        return qty;
    }
    const f = (v) => {
        const x = D(v);
        return x.isZero() ? D(1) : x;
    };
    return qty
        .times(f(l.sdiToBaseFactor))
        .dividedBy(f(o.soi_to_base_factor))
        .toDecimalPlaces(3, client_1.Prisma.Decimal.ROUND_HALF_UP);
}
function dcFreeTypeOf(l, orderFree) {
    const soiId = dcOrderLineOf(l);
    const src = soiId ? orderFree.get(soiId) : undefined;
    return l.sdiIsFree === true && src?.isFree ? src.freeType : null;
}
const PAISA = new client_1.Prisma.Decimal('0.01');
const off = (a, b, tol) => a.minus(b).abs().greaterThan(tol);
const differs = (a, b) => !a.minus(b).isZero();
function checkDcMoney(g, header, lines, nature) {
    let taxable = new client_1.Prisma.Decimal(0);
    let tax = new client_1.Prisma.Decimal(0);
    for (const [idx, l] of lines.entries()) {
        const lineNo = l.sdiLineNo ?? idx + 1;
        if (nature !== undefined) {
            const some = (...ks) => ks.some((k) => !D(l[k]).isZero());
            const wrong = nature === 'INTER'
                ? some('sdiCgstPerc', 'sdiSgstPerc', 'sdiCgstAmt', 'sdiSgstAmt')
                : some('sdiIgstPerc', 'sdiIgstAmt');
            if (wrong) {
                (0, sales_guards_1.refuse)(g, posting_types_1.SALES_ERROR_CODES.AMOUNT_MISMATCH, nature === 'INTER'
                    ? `Line ${lineNo}: an inter-state challan carries IGST only, not CGST / SGST`
                    : `Line ${lineNo}: an intra-state challan carries CGST + SGST, not IGST`, {
                    field: 'items',
                    line: lineNo,
                    rule: 'TAX_SPLIT',
                    params: { n: lineNo, nature: nature === 'INTER' ? 'INTER_STATE' : 'INTRA_STATE' },
                });
            }
        }
        const lineTaxable = D(l.sdiTaxableAmt);
        const parts = D(l.sdiCgstAmt)
            .plus(D(l.sdiSgstAmt))
            .plus(D(l.sdiIgstAmt));
        const lineTax = parts.plus(D(l.sdiCessAmt));
        const expectedParts = lineTaxable
            .times(D(l.sdiTaxPerc))
            .dividedBy(100)
            .toDecimalPlaces(2, client_1.Prisma.Decimal.ROUND_HALF_UP);
        const ceiling = D(l.sdiDcQty)
            .times(D(l.sdiRate))
            .plus(D(l.sdiChrgBeforeTax));
        const problems = [];
        if (off(parts, expectedParts, PAISA)) {
            problems.push(`GST ${parts.toFixed(2)} is not ${expectedParts.toFixed(2)} (taxable × rate)`);
        }
        if (l.sdiTaxAmt !== null && l.sdiTaxAmt !== undefined && differs(D(l.sdiTaxAmt), lineTax)) {
            problems.push(`tax ${D(l.sdiTaxAmt).toFixed(2)} is not the components' ${lineTax.toFixed(2)}`);
        }
        if (differs(D(l.sdiNetAmt), lineTaxable.plus(lineTax))) {
            problems.push(`amount ${D(l.sdiNetAmt).toFixed(2)} is not taxable + tax ${lineTaxable.plus(lineTax).toFixed(2)}`);
        }
        if (lineTaxable.minus(ceiling).greaterThan(PAISA)) {
            problems.push(`taxable ${lineTaxable.toFixed(2)} is above qty × rate ${ceiling.toFixed(2)}`);
        }
        if (problems.length > 0) {
            (0, sales_guards_1.refuse)(g, posting_types_1.SALES_ERROR_CODES.AMOUNT_MISMATCH, `Line ${lineNo}: ${problems.join('; ')}`, {
                field: 'items',
                line: lineNo,
            });
        }
        taxable = taxable.plus(lineTaxable);
        tax = tax.plus(lineTax);
    }
    const hTaxable = D(header.sdcTaxableAmt);
    const hTax = D(header.sdcTaxAmt);
    const hAmt = D(header.sdcDcAmt);
    const expectedAmt = hTaxable.plus(hTax).plus(D(header.sdcRoundOff));
    for (const [field, got, want] of [
        ['sdcTaxableAmt', hTaxable, taxable],
        ['sdcTaxAmt', hTax, tax],
        ['sdcDcAmt', hAmt, expectedAmt],
    ]) {
        if (differs(got, want)) {
            (0, sales_guards_1.refuse)(g, posting_types_1.SALES_ERROR_CODES.AMOUNT_MISMATCH, `${field} is ${got.toFixed(2)}; the lines make ${want.toFixed(2)}`, { field });
        }
    }
}
function dcTotals(header, lines, unitKgOf) {
    let pkgs = new client_1.Prisma.Decimal(0);
    let kg = new client_1.Prisma.Decimal(0);
    let taxable = new client_1.Prisma.Decimal(0);
    let tax = new client_1.Prisma.Decimal(0);
    for (const l of lines) {
        const qty = D(l.sdiDcQty).plus(D(l.sdiFreeQty));
        pkgs = pkgs.plus(qty);
        const weight = D(l.sdiWeightQty);
        kg = kg.plus(weight.greaterThan(0) ? weight : qty.times(unitKgOf(l)));
        taxable = taxable.plus(D(l.sdiTaxableAmt));
        tax = tax
            .plus(D(l.sdiCgstAmt))
            .plus(D(l.sdiSgstAmt))
            .plus(D(l.sdiIgstAmt))
            .plus(D(l.sdiCessAmt));
    }
    return {
        lines: lines.length,
        pkgs: pkgs.toFixed(3),
        weightKg: kg.toFixed(3),
        taxable: taxable.toFixed(2),
        tax: tax.toFixed(2),
        value: taxable.plus(tax).plus(D(header.sdcRoundOff)).toFixed(2),
    };
}
function registerLineTaxability(l) {
    const figures = [
        l.totalTaxRate,
        l.cgstRate,
        l.sgstRate,
        l.igstRate,
        l.cessRate,
        l.cgstAmount,
        l.sgstAmount,
        l.igstAmount,
        l.cessAmount,
    ];
    return figures.some((v) => v !== 0) ? 'TAXABLE' : 'EXEMPT';
}
function registerDocTaxability(lines) {
    const taxed = lines.filter((l) => l.taxability === 'TAXABLE').length;
    return taxed === 0 ? 'EXEMPT' : taxed === lines.length ? 'TAXABLE' : 'MIXED';
}
//# sourceMappingURL=dc-common.js.map