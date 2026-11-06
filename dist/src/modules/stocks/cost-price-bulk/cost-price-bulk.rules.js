"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_MARKUP_PERC = exports.TOKEN_IGNORED_COLUMNS = exports.UNIT_FACTOR_TOLERANCE = void 0;
exports.dec = dec;
exports.leftOutReasonOf = leftOutReasonOf;
exports.trackedAsOf = trackedAsOf;
exports.leftOutReasonText = leftOutReasonText;
exports.unitLink = unitLink;
exports.exclusiveOfTax = exclusiveOfTax;
exports.levelFigures = levelFigures;
exports.money = money;
exports.planRow = planRow;
exports.isOverridden = isOverridden;
exports.blockingNotes = blockingNotes;
exports.countsOf = countsOf;
exports.tickedReason = tickedReason;
const client_1 = require("@prisma/client");
const price_change_diff_1 = require("../../Inventory/item-price-log/price-change-diff");
const cost_price_bulk_types_1 = require("./types/cost-price-bulk.types");
const ZERO = new client_1.Prisma.Decimal(0);
const HUNDRED = new client_1.Prisma.Decimal(100);
const SCALE = 6;
function dec(value) {
    return value instanceof client_1.Prisma.Decimal ? value : new client_1.Prisma.Decimal(String(value));
}
function round6(value) {
    return value.toDecimalPlaces(SCALE, client_1.Prisma.Decimal.ROUND_HALF_UP);
}
function leftOutReasonOf(flags) {
    if (!flags.isActive) {
        return 'INACTIVE';
    }
    if (flags.presetTracks) {
        return 'NOT_PLAIN_STOCK';
    }
    if (flags.isBatchBased) {
        return 'OLD_BATCH_TICK';
    }
    return null;
}
function trackedAsOf(presetName) {
    return presetName?.trim() || 'Plain stock';
}
function leftOutReasonText(reason, trackedAs) {
    switch (reason) {
        case 'INACTIVE':
            return 'The item is not active.';
        case 'NOT_PLAIN_STOCK':
            return `Tracked as ${trackedAs} — not Plain stock. Change its prices in Change Selling Price (menu 30).`;
        case 'OLD_BATCH_TICK':
            return 'The old "batch" tick is on, so it is treated as batch. Change its prices in Change Selling Price (menu 30).';
        case 'NO_PRICE_ROW':
        default:
            return 'No price in force today at this branch. Set its prices on the item card.';
    }
}
exports.UNIT_FACTOR_TOLERANCE = new client_1.Prisma.Decimal('0.0001');
function unitLink(input) {
    if (input.parentToBase === null) {
        return { unitsPerParent: null, factorsAgree: true };
    }
    if (input.toBase.lte(0)) {
        return { unitsPerParent: null, factorsAgree: false };
    }
    const ratio = round6(input.parentToBase.div(input.toBase));
    const agree = input.unitFactor.gt(0) &&
        ratio.minus(input.unitFactor).abs().lte(input.unitFactor.times(exports.UNIT_FACTOR_TOLERANCE));
    return { unitsPerParent: agree ? input.unitFactor : ratio, factorsAgree: agree };
}
function exclusiveOfTax(withTax, taxPerc) {
    const divisor = HUNDRED.plus(taxPerc).div(HUNDRED);
    return divisor.lte(0) ? round6(withTax) : round6(withTax.div(divisor));
}
function levelFigures(price, taxPerc, cost) {
    const p = round6(price);
    if (p.lte(0)) {
        return { price: ZERO, priceWot: ZERO, markupPerc: ZERO };
    }
    return {
        price: p,
        priceWot: exclusiveOfTax(p, taxPerc),
        markupPerc: cost.gt(0) ? round6(p.minus(cost).div(cost).times(HUNDRED)) : ZERO,
    };
}
exports.TOKEN_IGNORED_COLUMNS = price_change_diff_1.IGNORED_COLUMNS.IPM;
exports.MAX_MARKUP_PERC = new client_1.Prisma.Decimal('999999.999');
function money(value) {
    return value.decimalPlaces() > 2 ? value.toFixed() : value.toFixed(2);
}
function note(code, level, request, who, text, field) {
    return {
        code,
        level,
        message: `Line ${request.lineNo} · ${who}: ${text}`,
        field: `rows.${request.index}.${field}`,
        line: request.lineNo,
        ipmId: request.ipmId,
        overridable: level === 'WARN' && cost_price_bulk_types_1.OVERRIDABLE_CODES.includes(code),
    };
}
function whoOf(row, request) {
    if (!row) {
        return `price row ${request.ipmId}`;
    }
    const item = [row.itemCode, row.itemName].filter(Boolean).join(' ');
    return row.unitName ? `${item} · ${row.unitName}` : item;
}
function planRow(request, row, ctx) {
    const plan = {
        lineNo: request.lineNo,
        ipmId: request.ipmId,
        refusals: [],
        warnings: [],
        changed: false,
        companyCopy: row?.companyShared === true,
        write: null,
    };
    const who = whoOf(row, request);
    const refuse = (code, text, field = 'ipmId') => plan.refusals.push(note(code, 'REFUSE', request, who, text, field));
    if (!row || !row.usable) {
        refuse(cost_price_bulk_types_1.COST_BULK.ROW_NOT_CURRENT, 'this price row is not there now. Load the items again.');
        return plan;
    }
    const reason = leftOutReasonOf(row.eligibility);
    if (reason === 'INACTIVE') {
        refuse(cost_price_bulk_types_1.COST_BULK.INACTIVE, 'the item is not active.');
        return plan;
    }
    if (reason) {
        refuse(cost_price_bulk_types_1.COST_BULK.NOT_PLAIN_STOCK, reason === 'OLD_BATCH_TICK'
            ? 'the old "batch" tick is on, so it is not Plain stock. Use Change Selling Price.'
            : 'it is not Plain stock any more. Use Change Selling Price.');
        return plan;
    }
    if (!row.current) {
        refuse(cost_price_bulk_types_1.COST_BULK.ROW_NOT_CURRENT, "this is no longer today's price at this branch. Load the items again.");
        return plan;
    }
    if (row.rowToken !== request.rowToken) {
        refuse(cost_price_bulk_types_1.COST_BULK.ROW_CHANGED, 'the price was changed after you loaded it. Load the items again.', 'rowToken');
        return plan;
    }
    const cost = request.costPrice;
    const mrp = request.mrp ?? row.maxPrice;
    const min = request.minPrice ?? row.minPrice;
    const profitType = request.profitType ?? row.profitType;
    const prices = row.prices.map((stored, index) => {
        const sent = request.levels?.find((level) => level.level === index + 1);
        return sent ? sent.price : stored;
    });
    const pricesKept = prices.every((price, index) => price.eq(row.prices[index]));
    plan.changed =
        !cost.eq(row.costPrice) ||
            !mrp.eq(row.maxPrice) ||
            !min.eq(row.minPrice) ||
            profitType !== row.profitType ||
            !pricesKept;
    if (!plan.changed) {
        return plan;
    }
    if (row.isChain && !ctx.isHq) {
        refuse(cost_price_bulk_types_1.COST_BULK.CHAIN_NEEDS_HQ, 'this price is for all branches; only head office may change it.');
    }
    const levels = prices.map((price, index) => ({
        price,
        name: ctx.levelNames[index],
        level: index + 1,
    }));
    const inUse = levels.filter((level) => level.price.gt(0) && ctx.levelActive[level.level - 1]);
    const list = (picked) => picked.map((l) => `${l.name} ${money(l.price)}`).join(', ');
    const verb = (picked) => (picked.length === 1 ? 'is' : 'are');
    const aboveMrp = mrp.gt(0) ? inUse.filter((level) => level.price.gt(mrp)) : [];
    if (aboveMrp.length) {
        refuse(cost_price_bulk_types_1.COST_BULK.ABOVE_MRP, `${list(aboveMrp)} ${verb(aboveMrp)} above the MRP ${money(mrp)}.`, 'levels');
    }
    const belowMin = min.gt(0) ? inUse.filter((level) => level.price.lt(min)) : [];
    if (belowMin.length) {
        refuse(cost_price_bulk_types_1.COST_BULK.BELOW_MIN, `${list(belowMin)} ${verb(belowMin)} below the Min ${money(min)}.`, 'levels');
    }
    const belowCost = cost.gt(0) ? inUse.filter((level) => level.price.lt(cost)) : [];
    if (belowCost.length && ctx.belowCostPolicy !== 'allow') {
        const text = `${list(belowCost)} ${verb(belowCost)} below the new cost ${money(cost)}.`;
        const field = 'levels';
        if (ctx.belowCostPolicy === 'restrict') {
            refuse(cost_price_bulk_types_1.COST_BULK.BELOW_COST, text, field);
        }
        else {
            plan.warnings.push(note(cost_price_bulk_types_1.COST_BULK.BELOW_COST, 'WARN', request, who, text, field));
        }
    }
    const activeKept = prices.every((price, index) => !ctx.levelActive[index] || price.eq(row.prices[index]));
    if (profitType === cost_price_bulk_types_1.BY_USER && !cost.eq(row.costPrice) && activeKept) {
        plan.warnings.push(note(cost_price_bulk_types_1.COST_BULK.BY_USER_PRICES_KEPT, 'WARN', request, who, `the cost changed from ${money(row.costPrice)} to ${money(cost)}, but this By User unit still has its old prices.`, 'levels'));
    }
    const figures = prices.map((price) => levelFigures(price, ctx.taxPerc, cost));
    const tooHigh = levels.filter((level) => figures[level.level - 1].markupPerc
        .toDecimalPlaces(3, client_1.Prisma.Decimal.ROUND_HALF_UP)
        .abs()
        .gt(exports.MAX_MARKUP_PERC));
    if (tooHigh.length) {
        refuse(cost_price_bulk_types_1.COST_BULK.COST_TOO_LOW, `the new cost ${money(cost)} is too low for ${list(tooHigh)}: the profit would be over ` +
            '999,999.999 %, which cannot be stored. Check the New Cost.', 'costPrice');
    }
    plan.write = {
        ipmId: row.ipmId,
        costPrice: round6(cost),
        costWot: exclusiveOfTax(cost, ctx.taxPerc),
        maxPrice: round6(mrp),
        minPrice: round6(min),
        profitType,
        levels: figures,
    };
    return plan;
}
function isOverridden(warning, overrides) {
    return (warning.overridable &&
        overrides.some((o) => o.code === warning.code &&
            (o.line === undefined || o.line === null || o.line === warning.line)));
}
function blockingNotes(plans, overrides) {
    return plans.flatMap((plan) => [
        ...plan.refusals,
        ...plan.warnings.filter((warning) => !isOverridden(warning, overrides)),
    ]);
}
function countsOf(plans) {
    return {
        rows: plans.length,
        changed: plans.filter((plan) => plan.changed).length,
        unchanged: plans.filter((plan) => !plan.changed && !plan.refusals.length).length,
        refused: plans.filter((plan) => plan.refusals.length > 0).length,
        warned: plans.filter((plan) => plan.warnings.length > 0).length,
    };
}
function tickedReason(plan) {
    if (!plan.warnings.length) {
        return null;
    }
    return `Warnings ticked at save: ${plan.warnings.map((w) => `${w.code} (${w.message})`).join('; ')}`;
}
//# sourceMappingURL=cost-price-bulk.rules.js.map