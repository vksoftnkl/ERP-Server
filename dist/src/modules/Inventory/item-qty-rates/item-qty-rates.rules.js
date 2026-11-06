"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BY_USER = void 0;
exports.dec = dec;
exports.storedCardRowOf = storedCardRowOf;
exports.sameKey = sameKey;
exports.cardRowOf = cardRowOf;
exports.scheduledFromOf = scheduledFromOf;
exports.pricesAfter = pricesAfter;
exports.cardProblems = cardProblems;
exports.unitCardAfter = unitCardAfter;
exports.storedSlabOf = storedSlabOf;
exports.slabAfterSave = slabAfterSave;
exports.slabsToJudge = slabsToJudge;
exports.belowCostSeverity = belowCostSeverity;
exports.slabProblems = slabProblems;
exports.judgeSlabs = judgeSlabs;
const client_1 = require("@prisma/client");
const price_resolver_1 = require("../items-price-master/price-resolver");
const qty_slab_rules_1 = require("../items-qty-price-master/qty-slab.rules");
const item_qty_price_error_codes_1 = require("../items-qty-price-master/types/item-qty-price-error-codes");
const cost_price_bulk_rules_1 = require("../../stocks/cost-price-bulk/cost-price-bulk.rules");
const ZERO = new client_1.Prisma.Decimal(0);
exports.BY_USER = 'By User';
function dec(value) {
    if (value === null || value === undefined) {
        return ZERO;
    }
    return value instanceof client_1.Prisma.Decimal ? value : new client_1.Prisma.Decimal(String(value));
}
function storedCardRowOf(row) {
    return {
        ipmId: row.ipmId,
        costPrice: dec(row.ipmCostPrice),
        costWot: dec(row.ipmCostWot),
        maxPrice: dec(row.ipmMaxPrice),
        minPrice: dec(row.ipmMinPrice),
        profitType: row.ipmProfitType ?? exports.BY_USER,
        prices: [
            dec(row.ipmSalesPriceA),
            dec(row.ipmSalesPriceB),
            dec(row.ipmSalesPriceC),
            dec(row.ipmSalesPriceD),
        ],
    };
}
const sameAmount = (a, b) => a === null || b === null ? a === b : Math.abs(a - b) < 5e-7;
function sameKey(a, b) {
    return sameAmount(a.mrp, b.mrp) && sameAmount(a.salePrice, b.salePrice);
}
function cardRowOf(unitRows, today, caller) {
    const headline = (0, price_resolver_1.resolveEffectivePrice)(unitRows, price_resolver_1.HEADLINE_KEY, today, caller);
    if (headline) {
        return { key: { ...price_resolver_1.HEADLINE_KEY }, row: headline.row };
    }
    const keys = (0, price_resolver_1.livePriceRows)(unitRows, today, caller)
        .map((row) => (0, price_resolver_1.bucketKeyOfRow)(row))
        .filter((key) => !(0, price_resolver_1.isHeadlineKey)(key))
        .sort((a, b) => (b.mrp ?? -1) - (a.mrp ?? -1) || (b.salePrice ?? -1) - (a.salePrice ?? -1));
    if (!keys.length) {
        return null;
    }
    const answer = (0, price_resolver_1.resolveEffectivePrice)(unitRows, keys[0], today, caller);
    return answer ? { key: keys[0], row: answer.row } : null;
}
function scheduledFromOf(unitRows, key, today, caller) {
    const days = [
        ...new Set(unitRows
            .filter((row) => !row.ipmIsDeleted)
            .map((row) => (0, qty_slab_rules_1.dayOf)(row.ipmEffectiveFrom))
            .filter((day) => day > today)),
    ].sort();
    for (const day of days) {
        const answer = (0, price_resolver_1.resolveEffectivePrice)(unitRows, key, day, caller);
        if (answer && (0, qty_slab_rules_1.dayOf)(answer.row.ipmEffectiveFrom) === day) {
            return day;
        }
    }
    return null;
}
function pricesAfter(row) {
    return [1, 2, 3, 4].map((level) => {
        const sent = row.levels.find((entry) => entry.level === level);
        return sent ? sent.price : (row.stored?.prices[level - 1] ?? ZERO);
    });
}
function who(row) {
    return `Line ${row.lineNo}${row.unitName ? ` · ${row.unitName}` : ''}`;
}
function levelName(ctx, level) {
    return ctx.levelNames.get(level) ?? `Level ${level}`;
}
function cardProblems(rows, ctx) {
    const out = [];
    for (const row of rows) {
        const prices = pricesAfter(row);
        if ((0, price_resolver_1.isHeadlineKey)(row.key)) {
            const mrp = row.maxPrice ?? row.stored?.maxPrice ?? ZERO;
            if (mrp.gt(0)) {
                for (const level of ctx.activeLevels) {
                    const price = prices[level - 1];
                    if (price.gt(0) && price.gt(mrp)) {
                        out.push({
                            source: 'CARD',
                            code: item_qty_price_error_codes_1.ItemQtyPriceErrorCode.ABOVE_MRP,
                            severity: 'REFUSE',
                            lineNo: row.lineNo,
                            slabIndex: null,
                            iqpId: null,
                            uomId: row.uomId,
                            unitName: row.unitName,
                            level,
                            price: price.toNumber(),
                            cost: null,
                            field: `rates.rows.${row.index}.levels`,
                            message: `${who(row)}: ${levelName(ctx, level)} ${(0, cost_price_bulk_rules_1.money)(price)} is above the MRP ${(0, cost_price_bulk_rules_1.money)(mrp)}.`,
                        });
                    }
                }
            }
        }
        const profitType = row.profitType ?? row.stored?.profitType ?? null;
        const stored = row.stored;
        if (profitType === exports.BY_USER &&
            stored &&
            row.costPrice !== null &&
            !row.costPrice.eq(stored.costPrice) &&
            ctx.activeLevels.every((level) => prices[level - 1].eq(stored.prices[level - 1]))) {
            out.push({
                source: 'CARD',
                code: item_qty_price_error_codes_1.ItemQtyPriceErrorCode.BY_USER_PRICES_KEPT,
                severity: 'ASK',
                lineNo: row.lineNo,
                slabIndex: null,
                iqpId: null,
                uomId: row.uomId,
                unitName: row.unitName,
                level: null,
                price: null,
                cost: row.costPrice.toNumber(),
                field: `rates.rows.${row.index}.levels`,
                message: `${who(row)}: the cost changed from ${(0, cost_price_bulk_rules_1.money)(stored.costPrice)} to ${(0, cost_price_bulk_rules_1.money)(row.costPrice)}, ` +
                    'but this By User unit still has its old prices.',
            });
        }
    }
    return out;
}
function unitCardAfter(input) {
    const { stored, sent } = input;
    const prices = sent
        ? pricesAfter(sent)
        : (stored?.prices ?? [ZERO, ZERO, ZERO, ZERO]);
    const cost = sent?.costPrice ??
        (input.plainStock ? (stored ? stored.costPrice : input.costBasisRate) : input.costBasisRate);
    const mrp = input.key.mrp !== null ? dec(input.key.mrp) : (sent?.maxPrice ?? stored?.maxPrice ?? ZERO);
    return {
        prices,
        hasPriceRow: stored !== null || sent !== null,
        cost,
        mrp,
        min: sent?.minPrice ?? stored?.minPrice ?? ZERO,
        basis: { inclTax: input.inclTax, taxPerc: input.taxPerc },
    };
}
function storedSlabOf(record) {
    return { slab: (0, qty_slab_rules_1.qtySlabOf)(record), uomId: record.iqpItemUnitId };
}
const optionalDec = (value, stored) => value === undefined ? stored : value === null ? null : dec(value);
function slabAfterSave(dto, stored) {
    const base = stored?.slab ?? {
        iqpId: '',
        companyId: null,
        branchId: null,
        partyId: null,
        priceLevel: null,
        fromQty: ZERO,
        toQty: null,
        priceMode: 'P',
        discPct: null,
        flatOff: null,
        price: null,
        isTaxIncl: false,
        effectiveFrom: '',
        effectiveTo: null,
        isActive: true,
        modifiedOn: null,
    };
    const day = (value, keep) => value === undefined ? keep : value === null ? null : value.slice(0, 10);
    return {
        uomId: dto.iqp_item_unit_id,
        slab: {
            ...base,
            iqpId: dto.iqp_id ?? base.iqpId,
            companyId: dto.iqp_company_id !== undefined ? dto.iqp_company_id : base.companyId,
            branchId: dto.iqp_branch_id !== undefined ? dto.iqp_branch_id : base.branchId,
            partyId: dto.iqp_party_id !== undefined ? dto.iqp_party_id : base.partyId,
            priceLevel: dto.iqp_price_level !== undefined ? dto.iqp_price_level : base.priceLevel,
            fromQty: dto.iqp_from_qty !== undefined ? dec(dto.iqp_from_qty) : base.fromQty,
            toQty: optionalDec(dto.iqp_to_qty, base.toQty),
            priceMode: (dto.iqp_price_mode ?? base.priceMode).toUpperCase(),
            discPct: optionalDec(dto.iqp_disc_pct, base.discPct),
            flatOff: optionalDec(dto.iqp_flat_off, base.flatOff),
            price: optionalDec(dto.iqp_price, base.price),
            isTaxIncl: dto.iqp_is_tax_incl ?? base.isTaxIncl,
            effectiveFrom: day(dto.iqp_effective_from, base.effectiveFrom) ?? base.effectiveFrom,
            effectiveTo: day(dto.iqp_effective_to, base.effectiveTo),
            isActive: dto.iqp_is_active ?? base.isActive,
        },
    };
}
function slabsToJudge(args) {
    const deleted = new Set(args.deleteIds);
    const sentIds = new Set(args.sent.map((s) => s.iqp_id).filter((id) => !!id));
    const byId = new Map(args.stored.map((s) => [s.slab.iqpId, s]));
    const all = [
        ...args.stored
            .filter((s) => !sentIds.has(s.slab.iqpId))
            .map((s) => ({ ...s, slabIndex: null, iqpId: s.slab.iqpId })),
        ...args.sent.map((dto, index) => {
            const after = slabAfterSave(dto, dto.iqp_id ? (byId.get(dto.iqp_id) ?? null) : null);
            return { ...after, slabIndex: index, iqpId: dto.iqp_id ?? null };
        }),
    ];
    return all.filter(({ slab, iqpId }) => !(iqpId && deleted.has(iqpId)) &&
        slab.isActive &&
        (0, qty_slab_rules_1.slabInForceOnOrAfter)(slab, args.today) &&
        (slab.companyId === null || slab.companyId === args.companyId) &&
        (slab.branchId === null || slab.branchId === args.branchId));
}
function rangeText(slab) {
    const from = slab.fromQty.toFixed();
    return slab.toQty === null ? `${from} and more` : `${from} up to ${slab.toQty.toFixed()}`;
}
const SLAB_CODES = {
    ZERO_OR_LESS: item_qty_price_error_codes_1.ItemQtyPriceErrorCode.ZERO_OR_LESS,
    ABOVE_MRP: item_qty_price_error_codes_1.ItemQtyPriceErrorCode.ABOVE_MRP,
    BELOW_MIN: item_qty_price_error_codes_1.ItemQtyPriceErrorCode.BELOW_MIN,
    BELOW_COST: item_qty_price_error_codes_1.ItemQtyPriceErrorCode.BELOW_COST,
};
function belowCostSeverity(policy) {
    return policy === 'restrict' ? 'REFUSE' : policy === 'warning' ? 'ASK' : 'INFO';
}
function slabProblems(judged, ctx) {
    const out = [];
    for (const { entry, unitName, card, judgements } of judged) {
        const name = `${entry.slabIndex !== null ? `Slab ${entry.slabIndex + 1}` : 'Saved slab'} · ` +
            `${unitName ? `${unitName} ` : ''}${rangeText(entry.slab)}`;
        for (const j of judgements) {
            const at = j.level !== null ? ` at ${levelName(ctx, j.level)}` : '';
            const each = (0, cost_price_bulk_rules_1.money)(j.each);
            const text = j.verdict === 'ZERO_OR_LESS'
                ? `takes more off than the price${j.base ? ` ${(0, cost_price_bulk_rules_1.money)(j.base)}` : ''}: ${each} each.`
                : j.verdict === 'ABOVE_MRP'
                    ? `${each} each is above the MRP ${(0, cost_price_bulk_rules_1.money)(card.mrp)}.`
                    : j.verdict === 'BELOW_MIN'
                        ? `${each} each is below the Min ${(0, cost_price_bulk_rules_1.money)(card.min)}.`
                        : `${each} each is below the cost ${(0, cost_price_bulk_rules_1.money)(card.cost)}.`;
            out.push({
                source: 'SLAB',
                code: SLAB_CODES[j.verdict],
                severity: j.verdict === 'BELOW_COST' ? belowCostSeverity(ctx.policy) : 'REFUSE',
                lineNo: null,
                slabIndex: entry.slabIndex,
                iqpId: entry.iqpId,
                uomId: entry.uomId,
                unitName,
                level: j.level,
                price: j.each.toNumber(),
                cost: card.cost.gt(0) ? card.cost.toNumber() : null,
                field: entry.slabIndex !== null ? `slabs.${entry.slabIndex}` : 'iqp_id',
                message: `${name}${at}: ${text}`,
            });
        }
    }
    return out;
}
function judgeSlabs(entries, cards, activeLevels, basis) {
    return entries.map((entry) => {
        const known = cards.get(entry.uomId);
        const card = known?.card ?? {
            prices: [ZERO, ZERO, ZERO, ZERO],
            hasPriceRow: false,
            cost: ZERO,
            mrp: ZERO,
            min: ZERO,
            basis,
        };
        return {
            entry,
            unitName: known?.unitName ?? null,
            card,
            judgements: (0, qty_slab_rules_1.judgeSlab)(entry.slab, card, activeLevels),
        };
    });
}
//# sourceMappingURL=item-qty-rates.rules.js.map