"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.APPLY_QTY_PRICES_SETTING_KEY = exports.SELLING_SLAB_LEVELS = exports.QTY_PRICE_MODES = void 0;
exports.dayOf = dayOf;
exports.qtySlabOf = qtySlabOf;
exports.isSellingSlabLevel = isSellingSlabLevel;
exports.slabSpecificity = slabSpecificity;
exports.slabInForce = slabInForce;
exports.slabInForceOnOrAfter = slabInForceOnOrAfter;
exports.slabAppliesTo = slabAppliesTo;
exports.rankSlabs = rankSlabs;
exports.slabsFor = slabsFor;
exports.slabHoldsQty = slabHoldsQty;
exports.pickSlab = pickSlab;
exports.toTaxBasis = toTaxBasis;
exports.slabUnitPrice = slabUnitPrice;
exports.slabLineRate = slabLineRate;
exports.isApplyQtyPricesOn = isApplyQtyPricesOn;
exports.judgeSlab = judgeSlab;
const client_1 = require("@prisma/client");
const ZERO = new client_1.Prisma.Decimal(0);
const HUNDRED = new client_1.Prisma.Decimal(100);
exports.QTY_PRICE_MODES = ['P', 'R', 'F'];
exports.SELLING_SLAB_LEVELS = [1, 2, 3, 4];
exports.APPLY_QTY_PRICES_SETTING_KEY = 'sales.apply_qty_prices';
function dayOf(value) {
    return value.toISOString().slice(0, 10);
}
function qtySlabOf(record) {
    return {
        iqpId: record.iqpId,
        companyId: record.iqpCompanyId,
        branchId: record.iqpBranchId,
        partyId: record.iqpPartyId,
        priceLevel: record.iqpPriceLevel,
        fromQty: new client_1.Prisma.Decimal(record.iqpFromQty),
        toQty: record.iqpToQty === null ? null : new client_1.Prisma.Decimal(record.iqpToQty),
        priceMode: (record.iqpPriceMode || 'P').trim().toUpperCase(),
        discPct: record.iqpDiscPct === null ? null : new client_1.Prisma.Decimal(record.iqpDiscPct),
        flatOff: record.iqpFlatOff === null ? null : new client_1.Prisma.Decimal(record.iqpFlatOff),
        price: record.iqpPrice === null ? null : new client_1.Prisma.Decimal(record.iqpPrice),
        isTaxIncl: record.iqpIsTaxIncl,
        effectiveFrom: dayOf(record.iqpEffectiveFrom),
        effectiveTo: record.iqpEffectiveTo ? dayOf(record.iqpEffectiveTo) : null,
        isActive: record.iqpIsActive,
        modifiedOn: record.iqpModifiedOn ? record.iqpModifiedOn.toISOString() : null,
    };
}
function isSellingSlabLevel(level, activeLevels) {
    if (level === null || level === undefined) {
        return true;
    }
    const active = new Set(activeLevels);
    return exports.SELLING_SLAB_LEVELS.includes(level) && active.has(level);
}
function slabSpecificity(slab) {
    return ((slab.partyId !== null ? 8 : 0) +
        (slab.priceLevel !== null ? 4 : 0) +
        (slab.branchId !== null ? 2 : 0) +
        (slab.companyId !== null ? 1 : 0));
}
function slabInForce(slab, day) {
    const d = day.slice(0, 10);
    return (slab.effectiveFrom.slice(0, 10) <= d &&
        (slab.effectiveTo === null || d <= slab.effectiveTo.slice(0, 10)));
}
function slabInForceOnOrAfter(slab, day) {
    return slab.effectiveTo === null || slab.effectiveTo.slice(0, 10) >= day.slice(0, 10);
}
function slabAppliesTo(slab, scope) {
    if (!exports.SELLING_SLAB_LEVELS.includes(scope.priceLevel)) {
        return false;
    }
    if (!slab.isActive || !slabInForce(slab, scope.onDate)) {
        return false;
    }
    const same = (row, line) => row === null || (line !== undefined && line !== null && row === line);
    return (same(slab.companyId, scope.companyId) &&
        same(slab.branchId, scope.branchId) &&
        same(slab.partyId, scope.partyId) &&
        (slab.priceLevel === null || slab.priceLevel === scope.priceLevel));
}
function rankSlabs(slabs) {
    return [...slabs].sort((a, b) => slabSpecificity(b) - slabSpecificity(a) ||
        a.fromQty.comparedTo(b.fromQty) ||
        compareText(b.effectiveFrom, a.effectiveFrom) ||
        compareText(b.modifiedOn ?? '', a.modifiedOn ?? '') ||
        compareText(a.iqpId, b.iqpId));
}
function slabsFor(slabs, scope) {
    return rankSlabs(slabs.filter((slab) => slabAppliesTo(slab, scope)));
}
function slabHoldsQty(slab, qty) {
    return slab.fromQty.lte(qty) && (slab.toQty === null || qty.lt(slab.toQty));
}
function pickSlab(ranked, qty) {
    return ranked.find((slab) => slabHoldsQty(slab, qty)) ?? null;
}
function toTaxBasis(amount, fromInclTax, toInclTax, taxPerc) {
    if (fromInclTax === toInclTax) {
        return amount;
    }
    const factor = HUNDRED.plus(taxPerc).div(HUNDRED);
    if (factor.lte(0)) {
        return amount;
    }
    return fromInclTax ? amount.div(factor) : amount.times(factor);
}
function slabUnitPrice(base, slab, basis) {
    const mode = (slab.priceMode || 'P').toUpperCase();
    let each;
    if (mode === 'F') {
        if (slab.price === null) {
            return null;
        }
        each = toTaxBasis(slab.price, slab.isTaxIncl, basis.inclTax, basis.taxPerc);
    }
    else if (mode === 'R') {
        if (slab.flatOff === null) {
            return null;
        }
        each = base.minus(toTaxBasis(slab.flatOff, slab.isTaxIncl, basis.inclTax, basis.taxPerc));
    }
    else {
        if (slab.discPct === null) {
            return null;
        }
        each = base.times(HUNDRED.minus(slab.discPct)).div(HUNDRED);
    }
    return each.toDecimalPlaces(2, client_1.Prisma.Decimal.ROUND_HALF_UP);
}
function slabLineRate(base, slab, basis) {
    const each = slabUnitPrice(base, slab, basis);
    return each !== null && each.lt(base) ? each : null;
}
function isApplyQtyPricesOn(effective) {
    const value = effective
        .find((entry) => entry.asdKey === exports.APPLY_QTY_PRICES_SETTING_KEY)
        ?.value?.trim()
        .toLowerCase();
    return !['false', '0', 'no', 'off', 'n'].includes(value ?? '');
}
function judgeSlab(slab, card, activeLevels) {
    const active = new Set(activeLevels);
    const priced = (level) => card.hasPriceRow && level >= 1 && level <= 4 && card.prices[level - 1].gt(0);
    const levels = slab.priceLevel !== null
        ? [slab.priceLevel]
        : card.hasPriceRow
            ? exports.SELLING_SLAB_LEVELS.filter((l) => active.has(l) && priced(l))
            : [null];
    if (!levels.length) {
        levels.push(null);
    }
    const mode = (slab.priceMode || 'P').toUpperCase();
    const out = [];
    for (const level of levels) {
        const base = level !== null && priced(level) ? card.prices[level - 1] : null;
        if (base === null && mode !== 'F') {
            continue;
        }
        const each = slabUnitPrice(base ?? ZERO, slab, card.basis);
        if (each === null) {
            continue;
        }
        const verdict = each.lte(0)
            ? 'ZERO_OR_LESS'
            : base !== null && card.mrp.gt(0) && each.gt(card.mrp)
                ? 'ABOVE_MRP'
                : base !== null && card.min.gt(0) && each.lt(card.min)
                    ? 'BELOW_MIN'
                    : card.cost.gt(0) && each.lt(card.cost)
                        ? 'BELOW_COST'
                        : null;
        if (verdict) {
            out.push({ level, base, each, verdict });
        }
    }
    return out;
}
function compareText(a, b) {
    return a < b ? -1 : a > b ? 1 : 0;
}
//# sourceMappingURL=qty-slab.rules.js.map