"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bucketOfCondition = void 0;
exports.buildReturnMoney = buildReturnMoney;
exports.dbDate = dbDate;
exports.lineFieldsOf = lineFieldsOf;
exports.headerFieldsOf = headerFieldsOf;
exports.storesCharge = storesCharge;
exports.chargeRowsOf = chargeRowsOf;
exports.chargeAsksOfBody = chargeAsksOfBody;
exports.chargeAsksOfStored = chargeAsksOfStored;
exports.lineBucketOf = lineBucketOf;
exports.bringsStock = bringsStock;
exports.totalsJson = totalsJson;
exports.previewOf = previewOf;
exports.billLinesJson = billLinesJson;
exports.chargeJson = chargeJson;
const client_1 = require("@prisma/client");
const sales_doc_utils_1 = require("../posting/sales-doc.utils");
const posting_types_1 = require("../posting/types/posting.types");
const sale_return_money_1 = require("./sale-return-money");
const dq = (v) => v === null || v === undefined || v === ''
    ? sale_return_money_1.ZERO
    : v instanceof client_1.Prisma.Decimal
        ? v
        : (0, sale_return_money_1.D)(v);
function emptyLine(ask, billItemId) {
    const percent = Object.fromEntries([
        'itemDiscPerc',
        'splDiscPerc',
        'schDiscPerc',
        'billSchPerc',
        'addlDisc1Perc',
        'addlDisc2Perc',
        'cashDiscPerc',
        'taxPerc',
        'cgstPerc',
        'sgstPerc',
        'igstPerc',
        'cessPerc',
        'acessPerc',
    ].map((k) => [k, sale_return_money_1.ZERO]));
    const perUnit = Object.fromEntries([
        'rate',
        'ratePreTax',
        'maxPrice',
        'minPrice',
        'actPrice',
        'itemDiscQty',
        'splDiscQty',
        'schDiscQty',
        'billSchQty',
        'cessPerUnit',
        'acessPerUnit',
    ].map((k) => [k, null]));
    return {
        index: ask.index,
        lineNo: ask.lineNo,
        splitNo: ask.splitNo,
        billItemId,
        billAccYear: null,
        billLineNo: null,
        itemId: ask.itemId,
        itemUnitId: ask.itemUnitId,
        qty: ask.qty,
        factor: ask.factor,
        qtyBase: ask.qty.times(ask.factor),
        parts: (0, sale_return_money_1.zeroParts)(),
        perUnit,
        percent,
        copy: null,
        discAmt: sale_return_money_1.ZERO,
        taxAmt: sale_return_money_1.ZERO,
        netAmt: sale_return_money_1.ZERO,
        costPerBase: null,
        takesRemainder: false,
        rateSource: { kind: 'BILL', sbRefno: null, sbDate: null, billItemId, accYear: null },
        overQty: false,
        leftBaseBefore: null,
    };
}
const qtyOf = (i) => dq(i.sriReturnQty).plus(dq(i.sriFreeQty));
async function buildReturnMoney(reader, c, input) {
    const issues = [];
    const bill = input.againstBill && input.billId && input.billAccYear
        ? await reader.billHeader(c, input.billId, input.billAccYear.trim())
        : null;
    const company = await reader.company(c, input.companyId);
    const nature = (0, sales_doc_utils_1.supplyNatureOf)(company.stateCode, input.posStcd ?? bill?.posStcd ?? null);
    const [billLines, prior, priorHeader, drafts, billCharges] = bill
        ? await Promise.all([
            reader.billLines(c, bill),
            reader.priorBack(c, bill, input.srId),
            reader.priorHeader(c, bill, input.srId),
            reader.onDrafts(c, bill, input.srId),
            reader.billCharges(c, bill, input.srId),
        ])
        : [[], new Map(), null, new Map(), []];
    const units = await reader.units(c, input.items.map((i) => i.sriItemUnitId));
    const billLineById = new Map(billLines.map((l) => [l.billItemId, l]));
    const billed = [];
    const free = [];
    const lines = input.items.map(() => null);
    input.items.forEach((item, index) => {
        const lineNo = item.sriLineNo ?? index + 1;
        const splitNo = item.sriSplitNo ?? 1;
        const itemId = item.sriItemId;
        const itemUnitId = item.sriItemUnitId;
        const unit = units.get(itemUnitId);
        const base = {
            index,
            lineNo,
            splitNo,
            itemId,
            itemUnitId,
            qty: qtyOf(item),
            factor: unit?.factor ?? sale_return_money_1.ONE,
        };
        if (!unit || unit.itemId !== itemId) {
            issues.push({
                level: 'REFUSE',
                code: posting_types_1.SALES_ERROR_CODES.RETURN_UNIT,
                message: `Line ${lineNo}: unit ${itemUnitId} is not one of this item's units`,
                field: 'sriItemUnitId',
                line: lineNo,
            });
            lines[index] = emptyLine(base, item.sriBillItemId ?? null);
            return;
        }
        if (!bill) {
            free.push(base);
            return;
        }
        let billItemId = item.sriBillItemId ?? null;
        if (!billItemId) {
            const same = billLines.filter((l) => l.itemId === itemId);
            if (same.length === 1) {
                billItemId = same[0].billItemId;
            }
            else if (same.length > 1) {
                issues.push({
                    level: 'REFUSE',
                    code: posting_types_1.SALES_ERROR_CODES.LINE_FIELD_REQUIRED,
                    message: `Line ${lineNo}: the item is on ${same.length} lines of the bill — name the bill line (sriBillItemId)`,
                    field: 'sriBillItemId',
                    line: lineNo,
                });
                lines[index] = emptyLine(base, null);
                return;
            }
        }
        const bl = billItemId ? billLineById.get(billItemId) : undefined;
        if (!bl || bl.itemId !== itemId) {
            issues.push({
                level: 'REFUSE',
                code: posting_types_1.SALES_ERROR_CODES.RETURN_NOT_ON_BILL,
                message: `Line ${lineNo}: this item is not on bill ${bill.refno ?? bill.sbId}`,
                field: 'sriBillItemId',
                line: lineNo,
                params: { bill: bill.refno ?? '' },
            });
            lines[index] = emptyLine(base, billItemId);
            return;
        }
        const factor = itemUnitId === bl.itemUnitId ? bl.factor : unit.factor;
        billed.push({ ...base, factor, billItemId: bl.billItemId });
    });
    if (bill) {
        for (const m of (0, sale_return_money_1.mirrorBilledLines)({ refno: bill.refno, date: bill.date }, billLines, prior, billed)) {
            lines[m.index] = m;
            if (m.overQty) {
                const bl = billLineById.get(m.billItemId);
                issues.push({
                    level: 'REFUSE',
                    code: posting_types_1.SALES_ERROR_CODES.RETURN_OVER_QTY,
                    message: `Line ${m.lineNo}: ${m.qtyBase.toString()} base units back, the bill line has ${client_1.Prisma.Decimal.max(sale_return_money_1.ZERO, m.leftBaseBefore ?? sale_return_money_1.ZERO).toString()} left (of ${(0, sale_return_money_1.baseOf)(bl).toString()})`,
                    field: 'sriReturnQty',
                    line: m.lineNo,
                    params: {
                        qty: (0, sale_return_money_1.r3)(client_1.Prisma.Decimal.max(sale_return_money_1.ZERO, m.leftBaseBefore ?? sale_return_money_1.ZERO).dividedBy(bl.factor)).toString(),
                    },
                });
            }
        }
    }
    if (free.length > 0) {
        if (!input.settings.freeReturnAllowed) {
            issues.push({
                level: 'REFUSE',
                code: posting_types_1.SALES_ERROR_CODES.RETURN_NO_BILL_OFF,
                message: 'Returns without a bill are switched off (sales.free_return_allowed)',
                field: 'srBillId',
            });
        }
        for (const ask of free) {
            const item = input.items[ask.index];
            const src = input.custId
                ? await reader.lastSale(c, {
                    companyId: input.companyId,
                    custId: input.custId,
                    itemId: ask.itemId,
                    windowDays: input.settings.returnWindowDays,
                    returnDate: input.returnDate,
                    srcItemId: item.sriRateSrcItemId ?? null,
                    srcAccYear: (item.sriRateSrcAccYear ?? null)?.trim() ?? null,
                })
                : null;
            if (src) {
                lines[ask.index] = (0, sale_return_money_1.lastSaleLine)(src.facts, { refno: src.refno, date: src.date }, ask, nature);
                continue;
            }
            if (item.sriRateSrcItemId) {
                issues.push({
                    level: 'REFUSE',
                    code: posting_types_1.SALES_ERROR_CODES.RETURN_NOT_ON_BILL,
                    message: `Line ${ask.lineNo}: bill line ${item.sriRateSrcItemId} is not a posted sale of this item to this customer`,
                    field: 'sriRateSrcItemId',
                    line: ask.lineNo,
                });
            }
            const price = await reader.todayPrice(c, {
                companyId: input.companyId,
                branchId: input.branchId,
                itemId: ask.itemId,
                itemUnitId: ask.itemUnitId,
                priceLevel: input.priceLevel,
            }, ask.factor);
            lines[ask.index] = (0, sale_return_money_1.todayPriceLine)(price, ask, nature);
            if (price.rateWot.lte(0)) {
                issues.push({
                    level: 'WARN',
                    code: posting_types_1.SALES_ERROR_CODES.RETURN_NO_PRICE,
                    message: `Line ${ask.lineNo}: no price for this item at the customer's price level; it comes back at 0.00`,
                    field: 'sriRate',
                    line: ask.lineNo,
                });
                continue;
            }
            issues.push({
                level: 'INFO',
                code: posting_types_1.SALES_ERROR_CODES.RETURN_NEVER_SOLD,
                message: `Line ${ask.lineNo}: no sale of this item to this customer${input.settings.returnWindowDays > 0 ? ` in the last ${input.settings.returnWindowDays} days` : ''}; today's price is used`,
                field: 'sriRate',
                line: ask.lineNo,
            });
        }
    }
    const done = lines.map((l, i) => l ??
        emptyLine({
            index: i,
            lineNo: input.items[i].sriLineNo ?? i + 1,
            splitNo: 1,
            itemId: input.items[i].sriItemId,
            itemUnitId: input.items[i].sriItemUnitId,
            qty: qtyOf(input.items[i]),
            factor: sale_return_money_1.ONE,
        }, null));
    const empties = bill ? (0, sale_return_money_1.emptiesBill)(billLines, prior, done) : false;
    const freightCalcType = input.settings.freightCalcType ?? bill?.freightCalcType ?? null;
    const loadingCalcType = input.settings.loadingCalcType ?? bill?.loadingCalcType ?? null;
    const reason = await reader.reason(c, input.reasonId);
    const charges = bill
        ? (0, sale_return_money_1.mirrorCharges)({
            charges: billCharges,
            asks: input.chargeAsks,
            billBasis: (0, sale_return_money_1.basisTotals)(billLines.map((l) => ({ qtyBase: (0, sale_return_money_1.baseOf)(l), parts: l.parts }))),
            returnBasis: (0, sale_return_money_1.basisTotals)(done),
            emptiesBill: empties,
            manual: {
                freight: (freightCalcType ?? '').toLowerCase() === 'manual',
                loading: (loadingCalcType ?? '').toLowerCase() === 'manual',
            },
            defaultGiveBack: reason?.refundCharges ?? true,
        })
        : [];
    for (const ch of charges.filter((x) => x.overCap)) {
        issues.push({
            level: 'REFUSE',
            code: posting_types_1.SALES_ERROR_CODES.CHARGE_OVER_CARRY,
            message: `${ch.bill.name ?? 'Charge'}: ${ch.cap.toString()} is left of it to give back`,
            field: 'charges',
        });
    }
    const lineTaxable = done.reduce((t, l) => t.plus(l.parts.taxableAmt), sale_return_money_1.ZERO);
    const cashDisc = bill && priorHeader
        ? (0, sale_return_money_1.cashDiscShare)({
            billCashDisc: bill.cashDisc,
            priorCashDisc: priorHeader.cashDisc,
            billLineTaxable: billLines.reduce((t, l) => t.plus(l.parts.taxableAmt), sale_return_money_1.ZERO),
            returnLineTaxable: lineTaxable,
            emptiesBill: empties,
        })
        : sale_return_money_1.ZERO;
    const roundOffStep = bill?.roundOffStep ?? (0, sale_return_money_1.D)(input.settings.roundOffStep);
    const totals = (0, sale_return_money_1.totalsOf)({
        lines: done,
        charges,
        cashDisc,
        roundOffStep,
        billRoundOffLeft: bill && priorHeader && empties && (0, sale_return_money_1.everyChargeBack)(charges)
            ? bill.roundOff.minus(priorHeader.roundOff)
            : null,
    });
    if (bill) {
        const noted = new Set();
        for (const l of done) {
            const hold = l.billItemId ? drafts.get(l.billItemId) : undefined;
            if (!hold || noted.has(l.billItemId) || hold.base.lte(0)) {
                continue;
            }
            noted.add(l.billItemId);
            const bl = billLineById.get(l.billItemId);
            const qty = bl ? (0, sale_return_money_1.r3)(hold.base.dividedBy(bl.factor)) : hold.base;
            issues.push({
                level: 'INFO',
                code: posting_types_1.SALES_ERROR_CODES.RETURN_ON_DRAFTS,
                message: `Line ${l.lineNo}: ${qty.toString()} of this bill line are on other draft returns (${hold.refnos.join(', ')})`,
                field: 'sriReturnQty',
                line: l.lineNo,
                params: { qty: qty.toString(), refnos: hold.refnos.join(', ') },
            });
        }
    }
    const lotIds = done
        .map((l, i) => l.copy?.lotId ?? input.items[i].sriLotId ?? null)
        .filter((x) => !!x);
    const lots = await reader.lots(c, lotIds);
    done.forEach((l, i) => {
        if (l.qtyBase.lte(0)) {
            return;
        }
        const lotId = l.copy?.lotId ?? input.items[i].sriLotId ?? null;
        const lot = lotId ? lots.get(lotId) : undefined;
        const expiry = lot?.expiryDate ?? l.copy?.expiryDate ?? isoOf(input.items[i].sriExpiryDate) ?? null;
        if (!expiry || expiry >= input.returnDate) {
            return;
        }
        const days = (0, sales_doc_utils_1.daysBetween)(expiry, input.returnDate);
        if (days > input.settings.expiredLotDays) {
            const name = lot?.batchNo ?? l.copy?.batchNo ?? input.items[i].sriBatchNo ?? '';
            issues.push({
                level: 'WARN',
                code: posting_types_1.SALES_ERROR_CODES.RETURN_LOT_EXPIRED,
                message: `Line ${l.lineNo}: lot ${name || lotId || ''} expired on ${expiry}, ${days} days before the return (sales.return_expired_lot_days = ${input.settings.expiredLotDays})`,
                field: 'sriLotId',
                line: l.lineNo,
                params: { lot: name, n: days },
            });
        }
    });
    return {
        bill,
        billLines,
        prior,
        priorHeader,
        drafts,
        units,
        lots,
        lines: done,
        charges,
        totals,
        emptiesBill: empties,
        nature,
        roundOffStep,
        freightCalcType,
        loadingCalcType,
        issues,
    };
}
function isoOf(v) {
    if (v instanceof Date) {
        return v.toISOString().slice(0, 10);
    }
    return typeof v === 'string' && v ? v.slice(0, 10) : null;
}
const pu = (v) => (v === null ? null : (0, sale_return_money_1.r4)(v));
function dbDate(iso) {
    return iso ? new Date(`${iso.slice(0, 10)}T00:00:00.000Z`) : null;
}
function lineFieldsOf(l, item, headerPriceLevel) {
    const p = l.parts;
    const billed = l.rateSource.kind === 'BILL' && l.copy !== null;
    const copy = l.copy;
    return {
        sriBillItemId: l.billItemId,
        sriBillAccYear: l.billAccYear,
        sriBillLineNo: l.billLineNo,
        sriToBaseFactor: (0, sale_return_money_1.r6)(l.factor),
        sriNetQty: l.qty,
        sriHsnCode: copy?.hsnCode ?? item.sriHsnCode ?? null,
        sriTaxId: copy?.taxId ?? null,
        sriIsTaxIncl: copy?.isTaxIncl ?? false,
        sriIsFree: copy?.isFree ?? false,
        sriFreeType: copy?.freeType ?? null,
        sriIsService: copy?.isService ?? false,
        sriSchemeId: copy?.schemeId ?? null,
        sriSchemeName: copy?.schemeName ?? null,
        sriPriceLevel: copy?.priceLevel ?? headerPriceLevel ?? 1,
        sriEanCode: item.sriEanCode ?? copy?.eanCode ?? null,
        sriSalesmanId: copy?.salesmanId ?? null,
        sriPromoUsageId: copy?.promoUsageId ?? null,
        sriQtyPriceId: copy?.qtyPriceId ?? null,
        sriSize: copy?.size ?? item.sriSize ?? null,
        sriSizeUom: copy?.sizeUom ?? item.sriSizeUom ?? null,
        ...(billed && copy
            ? {
                sriLotId: copy.lotId,
                sriBatchNo: copy.batchNo,
                sriBatchDate: dbDate(copy.batchDate),
                sriExpiryDate: dbDate(copy.expiryDate),
                sriSerialNo: copy.serialNo,
            }
            : {}),
        sriGrossAmt: p.grossAmt,
        sriItemDiscAmt: p.itemDiscAmt,
        sriSplDiscAmt: p.splDiscAmt,
        sriSchDiscAmt: p.schDiscAmt,
        sriBillSchAmt: p.billSchAmt,
        sriAddlDisc1Amt: p.addlDisc1Amt,
        sriAddlDisc2Amt: p.addlDisc2Amt,
        sriCashDiscAmt: p.cashDiscAmt,
        sriDiscAmt: l.discAmt,
        sriNetGross: p.netGross,
        sriChrgBeforeTax: p.chrgBeforeTax,
        sriChrgAfterTax: sale_return_money_1.ZERO,
        sriTaxableAmt: p.taxableAmt,
        sriCgstAmt: p.cgstAmt,
        sriSgstAmt: p.sgstAmt,
        sriIgstAmt: p.igstAmt,
        sriCessAmt: p.cessAmt,
        sriAcessAmt: p.acessAmt,
        sriTaxAmt: l.taxAmt,
        sriRoundOff: sale_return_money_1.ZERO,
        sriNetAmt: l.netAmt,
        sriCogsAmt: p.cogsAmt,
        sriWeightQty: p.weightQty,
        sriLoyaltyPv: p.loyaltyPv,
        sriLoyaltyPoints: p.loyaltyPoints,
        sriItemDiscPerc: l.percent.itemDiscPerc,
        sriSplDiscPerc: l.percent.splDiscPerc,
        sriSchDiscPerc: l.percent.schDiscPerc,
        sriBillSchPerc: l.percent.billSchPerc,
        sriAddlDisc1Perc: l.percent.addlDisc1Perc,
        sriAddlDisc2Perc: l.percent.addlDisc2Perc,
        sriCashDiscPerc: l.percent.cashDiscPerc,
        sriTaxPerc: l.percent.taxPerc,
        sriCgstPerc: l.percent.cgstPerc,
        sriSgstPerc: l.percent.sgstPerc,
        sriIgstPerc: l.percent.igstPerc,
        sriCessPerc: l.percent.cessPerc,
        sriAcessPerc: l.percent.acessPerc,
        sriRate: pu(l.perUnit.rate) ?? sale_return_money_1.ZERO,
        sriRatePreTax: pu(l.perUnit.ratePreTax) ?? sale_return_money_1.ZERO,
        sriMaxPrice: pu(l.perUnit.maxPrice),
        sriMinPrice: pu(l.perUnit.minPrice),
        sriActPrice: pu(l.perUnit.actPrice),
        sriItemDiscQty: (0, sale_return_money_1.r3)(l.perUnit.itemDiscQty ?? sale_return_money_1.ZERO),
        sriSplDiscQty: (0, sale_return_money_1.r3)(l.perUnit.splDiscQty ?? sale_return_money_1.ZERO),
        sriSchDiscQty: (0, sale_return_money_1.r3)(l.perUnit.schDiscQty ?? sale_return_money_1.ZERO),
        sriBillSchQty: (0, sale_return_money_1.r3)(l.perUnit.billSchQty ?? sale_return_money_1.ZERO),
        sriCessPerUnit: pu(l.perUnit.cessPerUnit) ?? sale_return_money_1.ZERO,
        sriAcessPerUnit: pu(l.perUnit.acessPerUnit) ?? sale_return_money_1.ZERO,
        sriCostPrice: l.costPerBase ? (0, sale_return_money_1.r4)(l.costPerBase.times(l.factor)) : null,
        sriRateSource: l.rateSource.kind,
        sriRateSrcItemId: l.rateSource.kind === 'LAST_SALE' ? l.rateSource.billItemId : null,
        sriRateSrcAccYear: l.rateSource.kind === 'LAST_SALE' ? l.rateSource.accYear : null,
    };
}
function headerFieldsOf(m) {
    const t = m.totals;
    return {
        srTotItems: m.lines.filter((l) => l.qty.gt(0)).length,
        srTotWeight: (0, sale_return_money_1.r3)(t.weight),
        srGrossAmt: t.gross,
        srDiscAmt: t.discAmt,
        srItemDisc: t.itemDisc,
        srSplDisc: t.splDisc,
        srSchDisc: t.schDisc,
        srBillSchDisc: t.billSchDisc,
        srCashDisc: t.cashDisc,
        srTaxableAmt: t.taxable,
        srCgstAmt: t.cgst,
        srSgstAmt: t.sgst,
        srIgstAmt: t.igst,
        srCessAmt: t.cess,
        srTaxAmt: t.tax,
        srOtherAmt: t.otherAmt,
        srFreightAmt: t.freight,
        srLoadAmt: t.load,
        srUnloadAmt: t.unload,
        srRoundOff: t.roundOff,
        srRoundOffStep: m.roundOffStep,
        srReturnAmt: t.creditNote,
        srTotalCost: t.cogs,
        srFreightCalcType: m.freightCalcType,
        srLoadingCalcType: m.loadingCalcType,
    };
}
function storesCharge(c) {
    return c.bill.onBill.amount.gt(0) && (c.kind === 'CARRIED' || c.bill.sepPost);
}
function chargeRowsOf(m, existing) {
    const basis = (0, sale_return_money_1.basisTotals)(m.lines);
    return m.charges.filter(storesCharge).map((c, i) => {
        const gst = c.back.cgst.plus(c.back.sgst).plus(c.back.igst).plus(c.back.cess);
        const b = c.bill;
        return {
            ...(existing.get(b.cdId) ? { cdId: existing.get(b.cdId) } : {}),
            cdSlno: i + 1,
            cdChgId: b.chgId,
            cdChgName: b.name,
            cdRole: b.role,
            cdMethod: b.method,
            cdType: b.type,
            cdApplyOn: b.applyOn,
            cdLedgerCode: b.ledgerId,
            cdLandingCost: false,
            cdBeforeTax: b.beforeTax,
            cdTaxApl: b.taxApl,
            cdSepPost: b.sepPost,
            cdUnit: b.unit,
            cdQtyVal: (0, sale_return_money_1.r3)(basis.qtyBase).toString(),
            cdWeight: (0, sale_return_money_1.r3)(basis.weight).toString(),
            cdRate: '0',
            cdAmount: c.back.amount.toString(),
            cdTaxCode: b.taxApl && !b.beforeTax ? b.taxCode : null,
            cdHsn: b.hsn,
            cdTaxPerc: b.taxPerc.toString(),
            cdTaxAmt: gst.toString(),
            cdCgstPerc: b.cgstPerc.toString(),
            cdCgstAmt: c.back.cgst.toString(),
            cdSgstPerc: b.sgstPerc.toString(),
            cdSgstAmt: c.back.sgst.toString(),
            cdIgstPerc: b.igstPerc.toString(),
            cdIgstAmt: c.back.igst.toString(),
            cdCessPerc: b.cessPerc.toString(),
            cdCessAmt: c.back.cess.toString(),
            cdNetAmt: c.back.amount.plus(gst).toString(),
            cdIsActive: true,
            cdSrcCdId: b.cdId,
            cdSrcAccYear: b.accYear,
            cdCarryBasis: !c.giveBack ? 'NONE' : c.typed ? 'MANUAL' : 'PRORATA',
        };
    });
}
function chargeAsksOfBody(charges) {
    const out = new Map();
    for (const c of charges ?? []) {
        const src = c.cdSrcCdId;
        if (!src) {
            continue;
        }
        const amount = c.cdAmount;
        out.set(src, {
            giveBack: typeof c.giveBack === 'boolean' ? c.giveBack : null,
            amount: amount === undefined || amount === null || amount === '' ? null : dq(amount).abs(),
        });
    }
    return out;
}
function chargeAsksOfStored(rows) {
    const out = new Map();
    for (const r of rows) {
        if (!r.cdSrcCdId) {
            continue;
        }
        out.set(r.cdSrcCdId, {
            giveBack: r.cdCarryBasis !== 'NONE',
            amount: r.cdCarryBasis === 'MANUAL' ? dq(r.cdAmount).abs() : null,
        });
    }
    return out;
}
const BUCKET_BY_CONDITION = {
    RESTOCK: 'SALEABLE',
    GOOD: 'SALEABLE',
    DAMAGED: 'DAMAGED',
    EXPIRED: 'EXPIRED',
    SCRAP: 'QUARANTINE',
};
const bucketOfCondition = (condition) => BUCKET_BY_CONDITION[(condition ?? 'RESTOCK').toUpperCase()] ?? 'SALEABLE';
exports.bucketOfCondition = bucketOfCondition;
function lineBucketOf(item, claim) {
    const condition = item.sriCondition ?? null;
    if (claim) {
        return (condition ?? '').toUpperCase() === 'EXPIRED' ? 'EXPIRED' : 'DAMAGED';
    }
    return (0, exports.bucketOfCondition)(condition);
}
function bringsStock(item, claim) {
    return !(claim && (item.sriClaimGoods ?? '').toUpperCase() === 'DESTROYED');
}
function lineJson(l) {
    const p = l.parts;
    const pc = l.percent;
    const u = l.perUnit;
    return {
        lineNo: l.lineNo,
        splitNo: l.splitNo,
        billItemId: l.billItemId,
        itemId: l.itemId,
        itemUnitId: l.itemUnitId,
        qty: (0, sale_return_money_1.n)(l.qty),
        toBaseFactor: (0, sale_return_money_1.n)(l.factor),
        qtyBase: (0, sale_return_money_1.n)(l.qtyBase),
        rate: (0, sale_return_money_1.n)(u.rate),
        ratePreTax: (0, sale_return_money_1.n)(u.ratePreTax),
        grossAmt: (0, sale_return_money_1.n)(p.grossAmt),
        itemDisc: { perc: (0, sale_return_money_1.n)(pc.itemDiscPerc), qty: (0, sale_return_money_1.n)(u.itemDiscQty), amt: (0, sale_return_money_1.n)(p.itemDiscAmt) },
        splDisc: { perc: (0, sale_return_money_1.n)(pc.splDiscPerc), qty: (0, sale_return_money_1.n)(u.splDiscQty), amt: (0, sale_return_money_1.n)(p.splDiscAmt) },
        schDisc: { perc: (0, sale_return_money_1.n)(pc.schDiscPerc), qty: (0, sale_return_money_1.n)(u.schDiscQty), amt: (0, sale_return_money_1.n)(p.schDiscAmt) },
        billSch: { perc: (0, sale_return_money_1.n)(pc.billSchPerc), qty: (0, sale_return_money_1.n)(u.billSchQty), amt: (0, sale_return_money_1.n)(p.billSchAmt) },
        addlDisc1: { perc: (0, sale_return_money_1.n)(pc.addlDisc1Perc), amt: (0, sale_return_money_1.n)(p.addlDisc1Amt) },
        addlDisc2: { perc: (0, sale_return_money_1.n)(pc.addlDisc2Perc), amt: (0, sale_return_money_1.n)(p.addlDisc2Amt) },
        cashDisc: { perc: (0, sale_return_money_1.n)(pc.cashDiscPerc), amt: (0, sale_return_money_1.n)(p.cashDiscAmt) },
        discAmt: (0, sale_return_money_1.n)(l.discAmt),
        netGross: (0, sale_return_money_1.n)(p.netGross),
        chrgBeforeTax: (0, sale_return_money_1.n)(p.chrgBeforeTax),
        taxableAmt: (0, sale_return_money_1.n)(p.taxableAmt),
        taxId: l.copy?.taxId ?? null,
        taxPerc: (0, sale_return_money_1.n)(pc.taxPerc),
        cgst: { perc: (0, sale_return_money_1.n)(pc.cgstPerc), amt: (0, sale_return_money_1.n)(p.cgstAmt) },
        sgst: { perc: (0, sale_return_money_1.n)(pc.sgstPerc), amt: (0, sale_return_money_1.n)(p.sgstAmt) },
        igst: { perc: (0, sale_return_money_1.n)(pc.igstPerc), amt: (0, sale_return_money_1.n)(p.igstAmt) },
        cess: { perc: (0, sale_return_money_1.n)(pc.cessPerc), perUnit: (0, sale_return_money_1.n)(u.cessPerUnit), amt: (0, sale_return_money_1.n)(p.cessAmt) },
        acess: { perc: (0, sale_return_money_1.n)(pc.acessPerc), perUnit: (0, sale_return_money_1.n)(u.acessPerUnit), amt: (0, sale_return_money_1.n)(p.acessAmt) },
        taxAmt: (0, sale_return_money_1.n)(l.taxAmt),
        netAmt: (0, sale_return_money_1.n)(l.netAmt),
        weightQty: (0, sale_return_money_1.n)(p.weightQty),
        costPerBase: l.costPerBase ? (0, sale_return_money_1.n)((0, sale_return_money_1.r6)(l.costPerBase)) : null,
        cogsAmt: (0, sale_return_money_1.n)(p.cogsAmt),
        loyaltyPoints: (0, sale_return_money_1.n)(p.loyaltyPoints),
        lotId: l.copy?.lotId ?? null,
        batchNo: l.copy?.batchNo ?? null,
        expiryDate: l.copy?.expiryDate ?? null,
        takesRemainder: l.takesRemainder,
        overQty: l.overQty,
        rateSource: { ...l.rateSource },
    };
}
function chargeJson(c) {
    const b = c.bill;
    const gst = (f) => f.cgst.plus(f.sgst).plus(f.igst).plus(f.cess);
    const sg = (v) => (0, sale_return_money_1.n)((0, sale_return_money_1.signed)(c, v));
    return {
        cdSrcCdId: b.cdId,
        cdSrcAccYear: b.accYear,
        chgId: b.chgId,
        name: b.name,
        type: b.type,
        kind: c.kind,
        sign: c.sign,
        role: b.role,
        method: b.method,
        basis: c.basis,
        beforeTax: b.beforeTax,
        sepPost: b.sepPost,
        taxApl: b.taxApl,
        ledgerId: b.ledgerId,
        ledgerName: b.ledgerName,
        giveBack: c.giveBack,
        locked: c.kind === 'IN_LINES' || c.sign < 0,
        manual: c.manual,
        typed: c.typed,
        onBill: sg(b.onBill.amount),
        onBillGst: sg(gst(b.onBill)),
        backBefore: sg(b.backBefore.amount),
        cap: sg(c.cap),
        proposed: sg(c.proposed),
        backNow: sg(c.back.amount),
        gst: {
            cgst: sg(c.back.cgst),
            sgst: sg(c.back.sgst),
            igst: sg(c.back.igst),
            cess: sg(c.back.cess),
        },
        net: sg(c.back.amount.plus(gst(c.back))),
        inCreditNote: c.kind === 'CARRIED',
        takesRemainder: c.takesRemainder,
    };
}
function totalsJson(t) {
    return {
        gross: (0, sale_return_money_1.n)(t.gross),
        discount: (0, sale_return_money_1.n)(t.discAmt),
        goods: (0, sale_return_money_1.n)(t.goods),
        taxable: (0, sale_return_money_1.n)(t.taxable),
        cgst: (0, sale_return_money_1.n)(t.cgst),
        sgst: (0, sale_return_money_1.n)(t.sgst),
        igst: (0, sale_return_money_1.n)(t.igst),
        cess: (0, sale_return_money_1.n)(t.cess),
        acess: (0, sale_return_money_1.n)(t.acess),
        tax: (0, sale_return_money_1.n)(t.tax),
        chargesNet: (0, sale_return_money_1.n)(t.chargesNet),
        cashDisc: (0, sale_return_money_1.n)(t.cashDisc),
        roundOff: (0, sale_return_money_1.n)(t.roundOff),
        creditNote: (0, sale_return_money_1.n)(t.creditNote),
        qty: (0, sale_return_money_1.n)(t.qty),
        weight: (0, sale_return_money_1.n)(t.weight),
        cogs: (0, sale_return_money_1.n)(t.cogs),
        takesBillRoundOff: t.takesBillRoundOff,
    };
}
function previewOf(m, items, claim = false) {
    const buckets = new Map();
    m.lines.forEach((l, i) => {
        if (l.qtyBase.lte(0) || l.copy?.isService || !bringsStock(items[i], claim)) {
            return;
        }
        const bucket = lineBucketOf(items[i], claim);
        const b = buckets.get(bucket) ?? { bucket, qtyBase: sale_return_money_1.ZERO, lines: 0 };
        b.qtyBase = b.qtyBase.plus(l.qtyBase);
        b.lines += 1;
        buckets.set(bucket, b);
    });
    const billLineById = new Map(m.billLines.map((l) => [l.billItemId, l]));
    return {
        lines: m.lines.map(lineJson),
        totals: totalsJson(m.totals),
        charges: m.charges.map(chargeJson),
        emptiesBill: m.emptiesBill,
        onOtherDrafts: [...m.drafts.entries()].map(([billItemId, h]) => {
            const bl = billLineById.get(billItemId);
            return {
                billItemId,
                qtyBase: (0, sale_return_money_1.n)(h.base),
                qty: bl ? (0, sale_return_money_1.n)((0, sale_return_money_1.r3)(h.base.dividedBy(bl.factor))) : (0, sale_return_money_1.n)(h.base),
                refnos: h.refnos,
            };
        }),
        stockByBucket: [...buckets.values()].map((b) => ({
            bucket: b.bucket,
            qtyBase: (0, sale_return_money_1.n)(b.qtyBase),
            lines: b.lines,
        })),
        loyaltyReverse: null,
        pointsBack: null,
        voucherShare: null,
        agentCommBack: null,
        promoCheck: [],
        customerBalance: null,
        settlement: null,
        approvals: [],
    };
}
function billLinesJson(input) {
    const b = input.bill;
    return {
        bill: {
            sbId: b.sbId,
            accYear: b.accYear,
            refno: b.refno,
            date: b.date,
            mode: b.billType,
            billMode: b.billMode,
            payMode: b.payMode,
            branchId: b.branchId,
            status: b.status,
            billAmount: (0, sale_return_money_1.n)(b.billAmt),
            due: (0, sale_return_money_1.n)(input.due),
            returnedAmt: (0, sale_return_money_1.n)(b.returnedAmt),
            returnStatus: b.returnStatus,
            custId: b.custId,
            custName: b.custName,
            posStcd: b.posStcd,
            priceLevel: b.priceLevel,
            salesmanIds: b.salesmanIds,
            loadmanIds: b.loadmanIds,
            agentId: b.agentId,
            supervisorId: b.supervisorId,
            driverId: b.driverId,
            vehicleId: b.vehicleId,
            vehicleNo: b.vehicleNo,
            hasFreight: b.hasFreight,
            hasLoad: b.hasLoad,
            hasUnload: b.hasUnload,
            freightCalcType: b.freightCalcType,
            loadingCalcType: b.loadingCalcType,
            roundOff: (0, sale_return_money_1.n)(b.roundOff),
            roundOffStep: (0, sale_return_money_1.n)(b.roundOffStep),
            tenders: {
                money: (0, sale_return_money_1.n)(input.tenders.money),
                points: (0, sale_return_money_1.n)(input.tenders.points),
                pointsRate: input.tenders.pointsUnits.gt(0)
                    ? (0, sale_return_money_1.n)((0, sale_return_money_1.r4)(input.tenders.points.dividedBy(input.tenders.pointsUnits)))
                    : null,
                voucher: (0, sale_return_money_1.n)(input.tenders.voucher),
                credit: (0, sale_return_money_1.n)(input.tenders.credit),
            },
            receivedLater: (0, sale_return_money_1.n)(input.receivedLater),
            refundCap: (0, sale_return_money_1.n)(input.refundCap),
        },
        lines: input.lines.map((l) => {
            const billBase = (0, sale_return_money_1.baseOf)(l);
            const back = input.prior.get(l.billItemId)?.base ?? sale_return_money_1.ZERO;
            const left = client_1.Prisma.Decimal.max(sale_return_money_1.ZERO, billBase.minus(back));
            const drafts = input.drafts.get(l.billItemId);
            const p = l.parts;
            const pc = l.percent;
            const u = l.perUnit;
            return {
                billItemId: l.billItemId,
                accYear: l.accYear,
                lineNo: l.lineNo,
                itemId: l.itemId,
                itemName: l.itemName,
                hsnCode: l.copy.hsnCode,
                itemUnitId: l.itemUnitId,
                unitName: l.unitName,
                toBaseFactor: (0, sale_return_money_1.n)(l.factor),
                units: (input.itemUnits.get(l.itemId) ?? []).map((x) => ({
                    itemUnitId: x.itemUnitId,
                    unitName: x.unitName,
                    toBaseFactor: (0, sale_return_money_1.n)(x.itemUnitId === l.itemUnitId ? l.factor : x.factor),
                    isBase: x.isBase,
                })),
                billQty: (0, sale_return_money_1.n)(l.qty),
                billQtyBase: (0, sale_return_money_1.n)(billBase),
                returnedQtyBase: (0, sale_return_money_1.n)(back),
                qtyLeftBase: (0, sale_return_money_1.n)(left),
                qtyLeft: (0, sale_return_money_1.n)((0, sale_return_money_1.r3)(left.dividedBy(l.factor))),
                onOtherDraftsBase: (0, sale_return_money_1.n)(drafts?.base ?? sale_return_money_1.ZERO),
                onOtherDraftsRefnos: drafts?.refnos ?? [],
                fullyReturned: left.lte(0),
                isTaxIncl: l.copy.isTaxIncl,
                rate: (0, sale_return_money_1.n)(u.rate),
                ratePreTax: (0, sale_return_money_1.n)(u.ratePreTax),
                priceLevel: l.copy.priceLevel,
                itemDisc: { perc: (0, sale_return_money_1.n)(pc.itemDiscPerc), qty: (0, sale_return_money_1.n)(u.itemDiscQty), amt: (0, sale_return_money_1.n)(p.itemDiscAmt) },
                splDisc: { perc: (0, sale_return_money_1.n)(pc.splDiscPerc), qty: (0, sale_return_money_1.n)(u.splDiscQty), amt: (0, sale_return_money_1.n)(p.splDiscAmt) },
                schDisc: { perc: (0, sale_return_money_1.n)(pc.schDiscPerc), qty: (0, sale_return_money_1.n)(u.schDiscQty), amt: (0, sale_return_money_1.n)(p.schDiscAmt) },
                billSch: { perc: (0, sale_return_money_1.n)(pc.billSchPerc), qty: (0, sale_return_money_1.n)(u.billSchQty), amt: (0, sale_return_money_1.n)(p.billSchAmt) },
                addlDisc1: { perc: (0, sale_return_money_1.n)(pc.addlDisc1Perc), amt: (0, sale_return_money_1.n)(p.addlDisc1Amt) },
                addlDisc2: { perc: (0, sale_return_money_1.n)(pc.addlDisc2Perc), amt: (0, sale_return_money_1.n)(p.addlDisc2Amt) },
                cashDisc: { perc: (0, sale_return_money_1.n)(pc.cashDiscPerc), amt: (0, sale_return_money_1.n)(p.cashDiscAmt) },
                grossAmt: (0, sale_return_money_1.n)(p.grossAmt),
                netGross: (0, sale_return_money_1.n)(p.netGross),
                chrgBeforeTax: (0, sale_return_money_1.n)(p.chrgBeforeTax),
                chrgAfterTax: (0, sale_return_money_1.n)(l.chrgAfterTax),
                taxableAmt: (0, sale_return_money_1.n)(p.taxableAmt),
                taxId: l.copy.taxId,
                taxPerc: (0, sale_return_money_1.n)(pc.taxPerc),
                cgst: { perc: (0, sale_return_money_1.n)(pc.cgstPerc), amt: (0, sale_return_money_1.n)(p.cgstAmt) },
                sgst: { perc: (0, sale_return_money_1.n)(pc.sgstPerc), amt: (0, sale_return_money_1.n)(p.sgstAmt) },
                igst: { perc: (0, sale_return_money_1.n)(pc.igstPerc), amt: (0, sale_return_money_1.n)(p.igstAmt) },
                cess: { perc: (0, sale_return_money_1.n)(pc.cessPerc), perUnit: (0, sale_return_money_1.n)(u.cessPerUnit), amt: (0, sale_return_money_1.n)(p.cessAmt) },
                acess: { perc: (0, sale_return_money_1.n)(pc.acessPerc), perUnit: (0, sale_return_money_1.n)(u.acessPerUnit), amt: (0, sale_return_money_1.n)(p.acessAmt) },
                netAmt: (0, sale_return_money_1.n)(l.netAmt),
                weightQty: (0, sale_return_money_1.n)(p.weightQty),
                costPerBase: p.cogsAmt.gt(0) && billBase.gt(0) ? (0, sale_return_money_1.n)((0, sale_return_money_1.r6)(p.cogsAmt.dividedBy(billBase))) : null,
                lotId: l.copy.lotId,
                batchNo: l.copy.batchNo ?? l.lotBatchNo,
                expiryDate: l.copy.expiryDate ?? l.lotExpiry,
                lotBarcode: l.lotBatchNo ?? l.copy.batchNo,
                eanCode: l.copy.eanCode,
                barcodes: input.barcodes.get(l.itemId) ?? [],
                godownId: l.godownId,
                isFree: l.copy.isFree,
                freeType: l.copy.freeType,
                schemeId: l.copy.schemeId,
                schemeName: l.copy.schemeName,
                salesmanId: l.copy.salesmanId,
                unitWeight: (0, sale_return_money_1.n)(l.unitWeight),
                allowReturn: l.allowReturn,
            };
        }),
        charges: input.charges,
    };
}
//# sourceMappingURL=sale-return-preview.js.map