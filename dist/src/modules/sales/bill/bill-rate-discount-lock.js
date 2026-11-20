"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RATE_TOLERANCE = void 0;
exports.lineDiscountBase = lineDiscountBase;
exports.priorOf = priorOf;
exports.linesNeedingNormal = linesNeedingNormal;
exports.judgeRateDiscount = judgeRateDiscount;
exports.readRateLockUser = readRateLockUser;
exports.readLineNormals = readLineNormals;
exports.readAllowedLevels = readAllowedLevels;
exports.isLockExempt = isLockExempt;
exports.rateDiscountRefusalsFor = rateDiscountRefusalsFor;
exports.rateDiscountRefusals = rateDiscountRefusals;
exports.throwRateDiscountRefusals = throwRateDiscountRefusals;
exports.asSalesRefusals = asSalesRefusals;
exports.lockLineOfStored = lockLineOfStored;
exports.lockLineOfDto = lockLineOfDto;
exports.lockChargeOf = lockChargeOf;
exports.lockHeaderOf = lockHeaderOf;
const client_1 = require("@prisma/client");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const sale_line_price_1 = require("../../Inventory/items-price-master/sale-line-price");
const qty_slab_rules_1 = require("../../Inventory/items-qty-price-master/qty-slab.rules");
const posting_types_1 = require("../posting/types/posting.types");
const ZERO = new client_1.Prisma.Decimal(0);
const HUNDRED = new client_1.Prisma.Decimal(100);
exports.RATE_TOLERANCE = new client_1.Prisma.Decimal('0.01');
const PAISA = new client_1.Prisma.Decimal('0.01');
const RELATIVE_TOLERANCE = new client_1.Prisma.Decimal('0.0001');
const dec = (v) => {
    if (v === null || v === undefined || v === '') {
        return ZERO;
    }
    try {
        const d = new client_1.Prisma.Decimal(v);
        return d.isFinite() ? d : ZERO;
    }
    catch {
        return ZERO;
    }
};
const decOrNull = (v) => v === null || v === undefined || v === '' ? null : dec(v);
function lineDiscountBase(line, discAlterBase) {
    const preTax = line.netQty.times(line.ratePreTax);
    const asTyped = line.netQty.times(line.rate);
    const base = discAlterBase || preTax.lte(0) ? asTyped : preTax;
    return base.gt(0) ? base : ZERO;
}
function baselineAmount(base, netQty, b) {
    const item = b.itemPerc.gt(0)
        ? base.times(b.itemPerc).div(HUNDRED)
        : b.itemQty.gt(0)
            ? netQty.times(b.itemQty)
            : ZERO;
    const spl = b.splPerc.gt(0)
        ? base.minus(item).times(b.splPerc).div(HUNDRED)
        : b.splQty.gt(0)
            ? netQty.times(b.splQty)
            : ZERO;
    return item.plus(spl);
}
function amountTolerance(base) {
    return PAISA.plus(base.times(RELATIVE_TOLERANCE));
}
const lineDisc = (l) => l.itemDiscAmt.plus(l.splDiscAmt);
function priorOf(line, prior) {
    const byId = line.id ? prior.find((p) => p.id === line.id) : undefined;
    const found = byId ?? prior.find((p) => p.lineNo === line.lineNo && p.itemId === line.itemId);
    return found && found.itemId === line.itemId && found.unitId === line.unitId ? found : null;
}
function levelChanged(user, line, prior, allowedLevels) {
    return (!user.editRate &&
        !line.isPromo &&
        allowedLevels.size > 0 &&
        !allowedLevels.has(line.priceLevel) &&
        !(prior && prior.priceLevel === line.priceLevel));
}
function linesNeedingNormal(user, input, allowedLevels = new Set()) {
    const out = [];
    input.lines.forEach((line, idx) => {
        if (line.isFree) {
            return;
        }
        const prior = priorOf(line, input.priorLines);
        const rateChanged = !user.editRate &&
            !line.isPromo &&
            !(prior && line.rate.minus(prior.rate).abs().lte(exports.RATE_TOLERANCE));
        const base = lineDiscountBase(line, input.header.discAlterBase);
        const disc = lineDisc(line);
        const discChanged = disc.gt(amountTolerance(base)) &&
            !(prior && disc.minus(lineDisc(prior)).abs().lte(amountTolerance(base))) &&
            (!user.editRate || user.maxDiscPerc !== null);
        if (rateChanged || discChanged || levelChanged(user, line, prior, allowedLevels)) {
            out.push(idx);
        }
    });
    return out;
}
function judgeRateDiscount(user, input, normals, chargeRules, allowedLevels = new Set(), sourceCharges = new Map()) {
    const refusals = [];
    const max = user.maxDiscPerc;
    const maxText = max === null ? undefined : max.toDecimalPlaces(2).toString();
    const { header } = input;
    const headerLevelRefused = !user.editRate &&
        allowedLevels.size > 0 &&
        !allowedLevels.has(header.priceLevel) &&
        input.priorHeaderLevel !== header.priceLevel;
    if (headerLevelRefused) {
        refusals.push({
            code: posting_types_1.SALES_ERROR_CODES.PRICE_LEVEL_NOT_ALLOWED,
            message: `You may not change the bill's price level (${header.priceLevel})`,
            field: 'sbPriceLevel',
        });
    }
    input.lines.forEach((line, idx) => {
        if (line.isFree) {
            return;
        }
        const prior = priorOf(line, input.priorLines);
        const normal = normals.get(idx) ?? null;
        if (levelChanged(user, line, prior, allowedLevels) &&
            normal?.sourceLevel !== line.priceLevel &&
            !(headerLevelRefused && line.priceLevel === header.priceLevel)) {
            refusals.push({
                code: posting_types_1.SALES_ERROR_CODES.PRICE_LEVEL_NOT_ALLOWED,
                message: `Line ${line.lineNo}: you may not change the price level (${line.priceLevel})`,
                field: 'items',
                line: line.lineNo,
            });
        }
        if (!user.editRate &&
            !line.isPromo &&
            !(prior && line.rate.minus(prior.rate).abs().lte(exports.RATE_TOLERANCE)) &&
            normal &&
            !normal.skipRate &&
            normal.rates.length > 0 &&
            !normal.rates.some((r) => line.rate.minus(r).abs().lte(exports.RATE_TOLERANCE))) {
            refusals.push({
                code: posting_types_1.SALES_ERROR_CODES.RATE_CHANGE_NOT_ALLOWED,
                message: `Line ${line.lineNo}: you may not change the rate (${line.rate.toString()})`,
                field: 'items',
                line: line.lineNo,
            });
        }
        const base = lineDiscountBase(line, header.discAlterBase);
        const tol = amountTolerance(base);
        const disc = lineDisc(line);
        if (disc.lte(tol)) {
            return;
        }
        if (prior && disc.minus(lineDisc(prior)).abs().lte(tol)) {
            return;
        }
        const untouched = (normal?.baselines ?? []).reduce((most, b) => client_1.Prisma.Decimal.max(most, baselineAmount(base, line.netQty, b)), ZERO);
        if (disc.lte(untouched.plus(tol))) {
            return;
        }
        if (!user.editRate) {
            refusals.push({
                code: posting_types_1.SALES_ERROR_CODES.DISC_NOT_ALLOWED,
                message: `Line ${line.lineNo}: you may not give a discount`,
                field: 'items',
                line: line.lineNo,
            });
            return;
        }
        if (max !== null && disc.gt(base.times(max).div(HUNDRED).plus(tol))) {
            refusals.push({
                code: posting_types_1.SALES_ERROR_CODES.LINE_DISC_OVER_USER_MAX,
                message: `Line ${line.lineNo}: the discount is more than your limit of ${maxText}%`,
                field: 'items',
                line: line.lineNo,
                max: maxText,
            });
        }
    });
    const valueBeforeTax = input.lines.reduce((sum, l) => sum.plus(lineValueBeforeTax(l, header.discAlterBase)), ZERO);
    const valueWithTax = input.lines.reduce((sum, l) => sum.plus(l.netAmt.gt(0) ? l.netAmt : ZERO), ZERO);
    const typedRows = typedBillDiscounts(input, chargeRules, sourceCharges, {
        beforeTax: valueBeforeTax,
        withTax: valueWithTax,
    });
    const headerTyped = header.headerDisc.minus(input.priorHeaderDisc).abs().lte(PAISA)
        ? ZERO
        : header.headerDisc;
    const total = typedRows.reduce((sum, row) => sum.plus(row.amount), headerTyped);
    if (total.gt(PAISA)) {
        if (!user.editRate) {
            refusals.push({
                code: posting_types_1.SALES_ERROR_CODES.DISC_NOT_ALLOWED,
                message: 'You may not give a bill discount',
                field: 'charges',
            });
        }
        else if (max !== null) {
            const rows = [
                ...typedRows.map((r) => ({
                    amount: r.amount,
                    base: r.beforeTax ? valueBeforeTax : valueWithTax,
                })),
                ...(headerTyped.gt(0) ? [{ amount: headerTyped, base: valueBeforeTax }] : []),
            ];
            const share = rows.reduce((sum, r) => r.base.lte(0)
                ? sum.plus(r.amount.gt(PAISA) ? HUNDRED : ZERO)
                : sum.plus(client_1.Prisma.Decimal.max(ZERO, r.amount.minus(PAISA)).div(r.base)), ZERO);
            if (share.times(HUNDRED).gt(max)) {
                refusals.push({
                    code: posting_types_1.SALES_ERROR_CODES.BILL_DISC_OVER_USER_MAX,
                    message: `The bill discount is more than your limit of ${maxText}%`,
                    field: 'charges',
                    max: maxText,
                });
            }
        }
    }
    return refusals;
}
function lineValueBeforeTax(line, discAlterBase) {
    if (line.netGross !== null && line.netGross.gt(0)) {
        return line.netGross;
    }
    const v = lineDiscountBase(line, discAlterBase)
        .minus(lineDisc(line))
        .minus(line.schDiscAmt)
        .minus(line.billSchAmt);
    return v.gt(0) ? v : ZERO;
}
function untouchedValue(row, rule, sourceCharges, bases) {
    if (row.srcCdId) {
        return sourceCharges.get(row.srcCdId)?.abs() ?? null;
    }
    if (!rule?.autoApply) {
        return null;
    }
    const defaultRate = rule.defaultRate ?? ZERO;
    if (defaultRate.lte(0)) {
        return ZERO;
    }
    const method = (row.method ?? rule.method ?? '').toUpperCase();
    if (method === 'FIXED') {
        return defaultRate;
    }
    if (method === 'PERCENT') {
        return (row.beforeTax ? bases.beforeTax : bases.withTax).times(defaultRate).div(HUNDRED);
    }
    return undefined;
}
function typedBillDiscounts(input, chargeRules, sourceCharges, bases) {
    const priorLeft = input.priorCharges.filter((c) => isDeduct(c));
    const typed = [];
    for (const row of input.charges) {
        const amount = row.amount.abs();
        if (!isDeduct(row) || amount.lte(PAISA)) {
            continue;
        }
        const same = priorLeft.findIndex((p) => p.chgId === row.chgId && p.amount.abs().minus(amount).abs().lte(PAISA));
        if (same >= 0) {
            priorLeft.splice(same, 1);
            continue;
        }
        const rule = row.chgId ? chargeRules.get(row.chgId) : undefined;
        const untouched = untouchedValue(row, rule, sourceCharges, bases);
        if (untouched === undefined) {
            const atDefault = rule?.defaultRate !== null &&
                rule?.defaultRate !== undefined &&
                row.rate !== null &&
                row.rate.minus(rule.defaultRate).abs().lte(new client_1.Prisma.Decimal('0.0001'));
            if (atDefault) {
                continue;
            }
        }
        else if (untouched !== null && amount.lte(untouched.plus(amountTolerance(untouched)))) {
            continue;
        }
        typed.push({ ...row, amount });
    }
    return typed;
}
const isDeduct = (c) => (c.type ?? '').toUpperCase() === 'DEDUCT';
async function readRateLockUser(client, usrId) {
    if (!usrId) {
        return null;
    }
    const row = await client.userMaster.findUnique({
        where: { usrId },
        select: { usrId: true, usrEditRate: true, usrMaxDiscPerc: true },
    });
    return row
        ? { usrId: row.usrId, editRate: row.usrEditRate, maxDiscPerc: row.usrMaxDiscPerc }
        : null;
}
async function sourceFactsOf(client, lines) {
    const orderIds = [
        ...new Set(lines.filter((l) => l.srcDocType === 'SALES_ORDER' && l.srcItemId).map((l) => l.srcItemId)),
    ];
    const dcIds = [
        ...new Set(lines
            .filter((l) => l.srcDocType === 'DELIVERY_CHALLAN' && l.srcItemId)
            .map((l) => l.srcItemId)),
    ];
    const rows = [];
    if (orderIds.length) {
        rows.push(...(await client.$queryRaw `
        SELECT soi_id::text AS id, soi_rate AS rate, soi_price_level AS price_level,
               soi_item_disc_perc AS item_perc, soi_item_disc_qty AS item_qty,
               soi_spl_disc_perc AS spl_perc, soi_spl_disc_qty AS spl_qty
          FROM sales.sale_order_item
         WHERE soi_id = ANY(${orderIds}::uuid[])`));
    }
    if (dcIds.length) {
        rows.push(...(await client.$queryRaw `
        SELECT sdi_id::text AS id, sdi_rate AS rate, sdi_price_level AS price_level,
               sdi_item_disc_perc AS item_perc, NULL::numeric AS item_qty,
               sdi_spl_disc_perc AS spl_perc, NULL::numeric AS spl_qty
          FROM sales.sale_dc_item
         WHERE sdi_id = ANY(${dcIds}::uuid[])`));
    }
    return new Map((rows ?? []).map((r) => [
        r.id,
        {
            rate: dec(r.rate),
            priceLevel: r.price_level === null || r.price_level === undefined ? null : Number(r.price_level),
            itemPerc: dec(r.item_perc),
            itemQty: dec(r.item_qty),
            splPerc: dec(r.spl_perc),
            splQty: dec(r.spl_qty),
        },
    ]));
}
async function readLineNormals(client, header, lines, indexes, qtyPriceSetting) {
    const out = new Map();
    if (!indexes.length) {
        return out;
    }
    const sources = await sourceFactsOf(client, indexes.map((i) => lines[i]));
    for (const idx of indexes) {
        const line = lines[idx];
        const source = line.srcItemId ? sources.get(line.srcItemId) : undefined;
        const normal = {
            rates: [],
            skipRate: false,
            baselines: [],
            sourceLevel: source?.priceLevel ?? null,
        };
        if (source) {
            if (source.rate.gt(0)) {
                normal.rates.push(source.rate);
            }
            normal.baselines.push({
                itemPerc: source.itemPerc,
                itemQty: source.itemQty,
                splPerc: source.splPerc,
                splQty: source.splQty,
            });
        }
        const answer = await (0, sale_line_price_1.resolveSaleLinePrice)(client, {
            itemId: line.itemId,
            unitId: line.unitId,
            companyId: header.companyId,
            branchId: header.branchId,
            customerId: header.custId,
            priceLevel: line.priceLevel,
            docDate: header.billDate,
            mrp: line.mrp,
            lotId: line.lotId,
        });
        if (answer.ok) {
            normal.skipRate = answer.item.itemWeighScale === true;
            const sales = dec(answer.salesPrice);
            const basePrice = dec(answer.basePrice);
            if (sales.gt(0)) {
                normal.rates.push(sales);
                if (!basePrice.equals(sales) && basePrice.gt(0)) {
                    normal.rates.push(basePrice);
                }
                const slabs = await (0, sale_line_price_1.rankedQtySlabs)(client, {
                    itemId: line.itemId,
                    iucId: answer.rate.itemUnitConversion.iucId,
                    companyId: header.companyId,
                    branchId: header.branchId,
                    partyId: header.custId,
                    priceLevel: line.priceLevel,
                    onDate: header.billDate,
                }, qtyPriceSetting);
                for (const qty of [line.billQty, line.netQty]) {
                    const slab = slabs.length ? (0, qty_slab_rules_1.pickSlab)(slabs, qty) : null;
                    const slabRate = slab
                        ? (0, qty_slab_rules_1.slabLineRate)(sales, slab, { inclTax: line.isTaxIncl, taxPerc: line.taxPerc })
                        : null;
                    if (slabRate) {
                        normal.rates.push(slabRate);
                    }
                }
            }
            else if (!source) {
                normal.rates = [];
            }
            normal.baselines.push({
                itemPerc: dec(answer.rate.ipmDiscPerc),
                itemQty: dec(answer.rate.ipmDiscQty),
                splPerc: ZERO,
                splQty: ZERO,
            });
        }
        out.set(idx, normal);
    }
    return out;
}
async function readChargeRules(client, charges) {
    const ids = [...new Set(charges.filter((c) => isDeduct(c) && c.chgId).map((c) => c.chgId))];
    if (!ids.length) {
        return new Map();
    }
    const rows = await client.chargeMaster.findMany({
        where: { chgId: { in: ids } },
        select: { chgId: true, chgAutoApply: true, chgDefaultRate: true, chgMethod: true },
    });
    return new Map(rows.map((r) => [
        r.chgId,
        { autoApply: r.chgAutoApply, defaultRate: r.chgDefaultRate, method: r.chgMethod },
    ]));
}
async function readSourceCharges(client, charges) {
    const ids = [...new Set(charges.filter((c) => isDeduct(c) && c.srcCdId).map((c) => c.srcCdId))];
    if (!ids.length) {
        return new Map();
    }
    const rows = await client.transactionChargeDetail.findMany({
        where: { cdId: { in: ids } },
        select: { cdId: true, cdAmount: true },
    });
    return new Map(rows.map((r) => [r.cdId, dec(r.cdAmount)]));
}
async function readAllowedLevels(client, header, defaultPriceLevel) {
    const levels = new Set();
    if (header.custId) {
        const customer = await client.customer.findFirst({
            where: { cusId: header.custId },
            select: { cusPriceLevelId: true },
        });
        if (customer && customer.cusPriceLevelId > 0) {
            levels.add(customer.cusPriceLevelId);
        }
    }
    const fallback = defaultPriceLevel ? await defaultPriceLevel(header) : null;
    if (fallback !== null && Number.isInteger(fallback) && fallback > 0) {
        levels.add(fallback);
    }
    return levels;
}
function isLockExempt(user) {
    return !user || (user.editRate && user.maxDiscPerc === null);
}
async function rateDiscountRefusalsFor(client, user, input, options = {}) {
    if (isLockExempt(user)) {
        return [];
    }
    const allowedLevels = user.editRate
        ? new Set()
        : await readAllowedLevels(client, input.header, options.defaultPriceLevel);
    const indexes = linesNeedingNormal(user, input, allowedLevels);
    const [normals, chargeRules, sourceCharges] = await Promise.all([
        readLineNormals(client, input.header, input.lines, indexes, options.qtyPriceSetting),
        readChargeRules(client, input.charges),
        readSourceCharges(client, input.charges),
    ]);
    return judgeRateDiscount(user, input, normals, chargeRules, allowedLevels, sourceCharges);
}
async function rateDiscountRefusals(client, usrId, input, options = {}) {
    const user = await readRateLockUser(client, usrId);
    return user ? rateDiscountRefusalsFor(client, user, input, options) : [];
}
function throwRateDiscountRefusals(refusals) {
    if (!refusals.length) {
        return;
    }
    (0, module_service_utils_1.throwSalesForbidden)(refusals[0].message, refusals.map((r) => ({
        field: r.field,
        message: r.message,
        code: r.code,
        ...(r.line === undefined ? {} : { line: r.line }),
        ...(r.max === undefined ? {} : { max: r.max }),
    })));
}
function asSalesRefusals(refusals) {
    return refusals.map((r) => ({
        code: r.code,
        message: r.message,
        field: r.field,
        ...(r.line === undefined ? {} : { line: r.line }),
        ...(r.max === undefined ? {} : { params: { max: r.max } }),
    }));
}
function lockLineOfStored(row) {
    return {
        lineNo: row.sbiLineNo,
        id: row.sbiId,
        itemId: row.sbiItemId,
        unitId: row.sbiItemUnitId,
        priceLevel: row.sbiPriceLevel,
        lotId: row.sbiLotId,
        mrp: row.sbiMaxPrice !== null && dec(row.sbiMaxPrice).gt(0)
            ? dec(row.sbiMaxPrice).toNumber()
            : null,
        isTaxIncl: row.sbiIsTaxIncl,
        taxPerc: dec(row.sbiTaxPerc),
        billQty: dec(row.sbiBillQty),
        netQty: dec(row.sbiNetQty),
        rate: dec(row.sbiRate),
        ratePreTax: dec(row.sbiRatePreTax),
        isFree: row.sbiIsFree,
        isPromo: row.sbiIsPromo || !!row.sbiSchemeId || !!row.sbiPromoUsageId,
        srcDocType: row.sbiSrcDocType,
        srcItemId: row.sbiSrcItemId,
        itemDiscPerc: dec(row.sbiItemDiscPerc),
        itemDiscQty: dec(row.sbiItemDiscQty),
        itemDiscAmt: dec(row.sbiItemDiscAmt),
        splDiscPerc: dec(row.sbiSplDiscPerc),
        splDiscQty: dec(row.sbiSplDiscQty),
        splDiscAmt: dec(row.sbiSplDiscAmt),
        schDiscAmt: dec(row.sbiSchDiscAmt),
        billSchAmt: dec(row.sbiBillSchAmt),
        netGross: decOrNull(row.sbiNetGross),
        netAmt: dec(row.sbiNetAmt),
    };
}
function lockLineOfDto(row, index, headerLevel) {
    const mrp = dec(row.sbiMaxPrice);
    return {
        lineNo: row.sbiLineNo ?? index + 1,
        id: row.sbiId ?? null,
        itemId: row.sbiItemId,
        unitId: row.sbiItemUnitId,
        priceLevel: row.sbiPriceLevel ?? headerLevel,
        lotId: row.sbiLotId ?? null,
        mrp: mrp.gt(0) ? mrp.toNumber() : null,
        isTaxIncl: row.sbiIsTaxIncl ?? false,
        taxPerc: dec(row.sbiTaxPerc),
        billQty: dec(row.sbiBillQty),
        netQty: dec(row.sbiNetQty),
        rate: dec(row.sbiRate),
        ratePreTax: dec(row.sbiRatePreTax),
        isFree: row.sbiIsFree ?? false,
        isPromo: (row.sbiIsPromo ?? false) || !!row.sbiSchemeId || !!row.sbiPromoUsageId,
        srcDocType: row.sbiSrcDocType ?? null,
        srcItemId: row.sbiSrcItemId ?? null,
        itemDiscPerc: dec(row.sbiItemDiscPerc),
        itemDiscQty: dec(row.sbiItemDiscQty),
        itemDiscAmt: dec(row.sbiItemDiscAmt),
        splDiscPerc: dec(row.sbiSplDiscPerc),
        splDiscQty: dec(row.sbiSplDiscQty),
        splDiscAmt: dec(row.sbiSplDiscAmt),
        schDiscAmt: dec(row.sbiSchDiscAmt),
        billSchAmt: dec(row.sbiBillSchAmt),
        netGross: decOrNull(row.sbiNetGross),
        netAmt: dec(row.sbiNetAmt),
    };
}
function lockChargeOf(row) {
    return {
        chgId: row.cdChgId ?? null,
        type: row.cdType ?? 'ADD',
        method: row.cdMethod ?? null,
        rate: decOrNull(row.cdRate),
        amount: dec(row.cdAmount),
        beforeTax: row.cdBeforeTax === true,
        srcCdId: row.cdSrcCdId ?? null,
    };
}
function lockHeaderOf(bill) {
    const date = bill.sbBillDate instanceof Date
        ? bill.sbBillDate.toISOString().slice(0, 10)
        : typeof bill.sbBillDate === 'string' && bill.sbBillDate
            ? bill.sbBillDate.slice(0, 10)
            : new Date().toISOString().slice(0, 10);
    return {
        companyId: bill.sbCompanyId,
        branchId: bill.sbBranchId,
        deviceId: bill.sbDeviceId ?? null,
        custId: bill.sbCustId ?? null,
        priceLevel: bill.sbPriceLevel ?? 0,
        billDate: date,
        discAlterBase: bill.sbDiscAlterBase === true,
        headerDisc: dec(bill.sbAddlDisc1).plus(dec(bill.sbAddlDisc2)).plus(dec(bill.sbCashDisc)),
    };
}
//# sourceMappingURL=bill-rate-discount-lock.js.map