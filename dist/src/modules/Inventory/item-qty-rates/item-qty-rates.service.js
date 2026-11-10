"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ItemQtyRatesService = void 0;
const common_1 = require("@nestjs/common");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const app_setting_value_service_1 = require("../../settings/appSettings/app-setting-value.service");
const rights_1 = require("../../../common/posting/rights");
const cost_price_bulk_gateway_1 = require("../../stocks/cost-price-bulk/cost-price-bulk.gateway");
const cost_price_bulk_rules_1 = require("../../stocks/cost-price-bulk/cost-price-bulk.rules");
const cost_price_bulk_types_1 = require("../../stocks/cost-price-bulk/types/cost-price-bulk.types");
const below_cost_policy_helper_1 = require("../../stocks/selling-price-bulk/below-cost-policy.helper");
const list_selling_price_query_dto_1 = require("../../stocks/selling-price-bulk/dto/list-selling-price-query.dto");
const price_bucket_gateway_1 = require("../../stocks/selling-price-bulk/price-bucket.gateway");
const selling_price_bulk_service_1 = require("../../stocks/selling-price-bulk/selling-price-bulk.service");
const selling_price_math_helper_1 = require("../../stocks/selling-price-bulk/selling-price-math.helper");
const selling_price_bulk_types_1 = require("../../stocks/selling-price-bulk/types/selling-price-bulk.types");
const stock_error_codes_1 = require("../../stocks/types/stock-error-codes");
const price_change_log_types_1 = require("../item-price-log/types/price-change-log.types");
const price_resolver_1 = require("../items-price-master/price-resolver");
const items_qty_price_master_service_1 = require("../items-qty-price-master/items-qty-price-master.service");
const item_qty_price_error_codes_1 = require("../items-qty-price-master/types/item-qty-price-error-codes");
const item_tax_rate_helper_1 = require("../utils/item-tax-rate.helper");
const item_qty_rates_gateway_1 = require("./item-qty-rates.gateway");
const item_qty_rates_rules_1 = require("./item-qty-rates.rules");
const item_qty_rates_types_1 = require("./types/item-qty-rates.types");
const TX = { timeout: 60_000, maxWait: 10_000 };
const num = (value) => value === null || value === undefined ? 0 : typeof value === 'number' ? value : value.toNumber();
function withScreenLevelNames(slabs, levels) {
    const names = new Map(levels.map((level) => [level.level, level.name]));
    return slabs.map((slab) => slab.iqp_price_level == null || !names.has(slab.iqp_price_level)
        ? slab
        : { ...slab, iqp_price_level_name: names.get(slab.iqp_price_level) });
}
function dayDate(day) {
    return new Date(`${day}T00:00:00.000Z`);
}
const lower = (id) => (id ?? '').toLowerCase();
let ItemQtyRatesService = class ItemQtyRatesService {
    prisma;
    requestContext;
    appSettingValueService;
    gateway;
    costGateway;
    bulk;
    bulkGateway;
    slabService;
    constructor(prisma, requestContext, appSettingValueService, gateway, costGateway, bulk, bulkGateway, slabService) {
        this.prisma = prisma;
        this.requestContext = requestContext;
        this.appSettingValueService = appSettingValueService;
        this.gateway = gateway;
        this.costGateway = costGateway;
        this.bulk = bulk;
        this.bulkGateway = bulkGateway;
        this.slabService = slabService;
    }
    async getWithRates(query) {
        const qtyRights = await this.slabService.assertRight('view', 'open Qty-wise Prices');
        const userId = this.requestContext.getUserId();
        const cardRights = userId
            ? await (0, rights_1.loadRights)(this.prisma, userId, price_change_log_types_1.PRICE_MENU_ID.CHANGE_SELLING_PRICE)
            : { ...rights_1.NO_RIGHTS };
        const { companyId, branchId, itemId } = query;
        const policy = await this.belowCostPolicy(companyId, branchId);
        const found = await this.findItemOr404(this.prisma, companyId, branchId, itemId);
        const today = await this.gateway.today(this.prisma);
        const [taxes, barcode, names, levels, units, priceRows, slabs, grid] = await Promise.all([
            (0, item_tax_rate_helper_1.resolveItemTaxRates)(this.prisma, [itemId], dayDate(today)),
            this.gateway.barcode(this.prisma, itemId),
            this.gateway.groupAndBrand(this.prisma, itemId),
            this.gateway.levels(this.prisma),
            this.gateway.units(this.prisma, itemId),
            this.gateway.priceRows(this.prisma, itemId, companyId, branchId),
            this.slabService.listForItem(itemId),
            this.bulk.listPrices({
                companyId,
                branchId,
                itemId,
                activeOnly: false,
                limit: list_selling_price_query_dto_1.MAX_PRICE_GRID_LIMIT,
                offset: 0,
            }),
        ]);
        const tax = taxes.get(itemId);
        const plainStock = !found.presetTracks && !found.isBatchBased;
        const rights = {
            view: qtyRights.view,
            createSlab: qtyRights.create,
            editSlab: qtyRights.edit,
            deleteSlab: qtyRights.delete,
            editCard: cardRights.edit,
            allBranchSlab: (0, selling_price_bulk_types_1.isHqUserType)(this.requestContext.getUserType()),
        };
        const caller = { companyId, branchId };
        const unitsById = new Map(units.map((unit) => [unit.uomId, unit]));
        const rows = [];
        for (const row of grid.items) {
            const unit = unitsById.get(row.uomId);
            if (!unit) {
                continue;
            }
            const unitRows = priceRows.filter((price) => price.ipmUcUnitId === row.uomId);
            const answering = row.bucketId
                ? (priceRows.find((price) => price.ipmId === row.bucketId) ?? null)
                : null;
            const headline = row.mrp === null && row.salePrice === null;
            const link = (0, cost_price_bulk_rules_1.unitLink)({
                parentToBase: unit.parentToBase,
                toBase: unit.toBase,
                unitFactor: unit.unitFactor,
            });
            const rowCost = answering ? num(answering.ipmCostPrice) : null;
            const cardCost = plainStock && headline && rowCost !== null ? rowCost : row.costRate;
            const editable = plainStock && headline && rights.editCard;
            const key = { mrp: row.mrp, salePrice: row.salePrice };
            rows.push({
                lineNo: rows.length + 1,
                uomId: row.uomId,
                unitName: row.unitName,
                unitSlno: unit.unitSlno,
                parentUomId: unit.parentUomId,
                parentUnitName: unit.parentUnitName,
                unitsPerParent: link.unitsPerParent ? link.unitsPerParent.toNumber() : null,
                factorsAgree: link.factorsAgree,
                bucketId: row.bucketId,
                priceScope: row.priceScope,
                priceSource: row.priceSource,
                mrp: row.mrp,
                salePrice: row.salePrice,
                maxPrice: row.maxPrice,
                stockQty: row.stockQty,
                costRate: row.costRate,
                costWot: row.costWot,
                costBasis: row.costBasis,
                stockAvg: row.costBasis === 'ITEM' || row.costBasis === 'MRP' ? row.costRate : null,
                rowCost,
                rowCostWot: answering ? num(answering.ipmCostWot) : null,
                cardCost,
                profitType: answering?.ipmProfitType ?? null,
                roundOff: row.roundOff,
                minPrice: row.minPrice,
                levels: row.levels.map((level) => {
                    const value = (0, selling_price_math_helper_1.recomputeLevel)(level.level, level.price, row.taxPerc, cardCost);
                    return {
                        level: value.level,
                        price: value.price,
                        priceWot: value.priceWot,
                        markupPerc: value.markupPerc,
                    };
                }),
                costEditable: editable,
                mrpEditable: editable,
                scheduledFrom: (0, item_qty_rates_rules_1.scheduledFromOf)(unitRows, key, today, caller),
            });
        }
        return {
            item: {
                itemId: found.itemId,
                itemCode: found.itemCode,
                itemName: found.itemName,
                barcode,
                groupName: names.groupName,
                brandName: names.brandName,
                taxPerc: tax?.taxPerc ?? 0,
                inclTax: tax?.inclTax ?? false,
                hasCess: tax?.hasCess ?? false,
                plainStock,
                trackedAs: (0, cost_price_bulk_rules_1.trackedAsOf)(found.presetName),
                leftOutReason: (0, cost_price_bulk_rules_1.leftOutReasonOf)({
                    isActive: found.isActive,
                    isBatchBased: found.isBatchBased,
                    presetTracks: found.presetTracks,
                }),
            },
            rights,
            belowCostPolicy: policy,
            today,
            levels: levels
                .filter((level) => level.active)
                .map((level) => ({ level: level.level, name: level.name, short: level.short })),
            units: rows,
            slabs: withScreenLevelNames(slabs, levels),
        };
    }
    async saveWithRates(dto) {
        const slabRows = dto.slabs ?? [];
        const deleteIds = dto.deleteSlabIds ?? [];
        const cardRows = dto.rates?.rows ?? [];
        await this.slabService.assertRight('view', 'open Qty-wise Prices');
        if (slabRows.some((slab) => !slab.iqp_id)) {
            await this.slabService.assertRight('create', 'add qty-wise prices');
        }
        if (slabRows.some((slab) => slab.iqp_id)) {
            await this.slabService.assertRight('edit', 'change qty-wise prices');
        }
        if (deleteIds.length) {
            await this.slabService.assertRight('delete', 'remove qty-wise prices');
        }
        if (cardRows.length) {
            await this.bulk.assertCanEditPrices();
        }
        this.assertShape(dto.itemId, cardRows, slabRows, deleteIds);
        const { companyId, branchId, itemId } = dto;
        const policy = await this.belowCostPolicy(companyId, branchId);
        const actor = (0, module_service_utils_1.resolveActor)(undefined, this.requestContext.getUserId());
        const via = cardRows.length ? await this.bulk.describeOriginMenu(item_qty_rates_types_1.QTY_RATES_MENU_ID) : null;
        const confirmed = dto.confirmed === true;
        return this.prisma.$transaction(async (tx) => {
            await this.gateway.lockItem(tx, itemId);
            const stored = await this.slabService.readStoredSlabs(tx, [
                ...slabRows.map((slab) => slab.iqp_id).filter((id) => !!id),
                ...deleteIds,
            ]);
            this.assertNamedSlabs(itemId, slabRows, deleteIds, stored);
            await this.slabService.assertSellingLevels(tx, slabRows, 'slabs.', stored);
            await this.slabService.assertChainSlabsAllowed(tx, slabRows, 'slabs.', stored);
            await this.slabService.assertOwnBranchSlabs(tx, slabRows, 'slabs.', stored);
            await this.slabService.assertOwnBranchSlabIds(tx, deleteIds, (index) => `deleteSlabIds.${index}`, stored);
            const found = await this.findItemOr404(tx, companyId, branchId, itemId);
            const plainStock = !found.presetTracks && !found.isBatchBased;
            this.assertPlainStockFields(cardRows, plainStock, (0, cost_price_bulk_rules_1.trackedAsOf)(found.presetName));
            const today = await this.gateway.today(tx);
            const caller = { companyId, branchId };
            const levels = await this.gateway.levels(tx);
            const priceRows = await this.gateway.priceRows(tx, itemId, companyId, branchId);
            const ctx = {
                activeLevels: levels.filter((level) => level.active).map((level) => level.level),
                levelNames: new Map(levels.map((level) => [level.level, level.name])),
            };
            const prepared = cardRows.length
                ? await this.bulk.prepareBulk(tx, this.bulkDtoOf(dto, cardRows), {
                    actor,
                    policy,
                    activeLevels: ctx.activeLevels,
                    keepCost: (_index, row, key) => {
                        const stored = this.storedRowFor(priceRows, row.uomId, key, today, caller);
                        return stored && row.costPrice !== undefined && row.costPrice !== null &&
                            (0, item_qty_rates_rules_1.sameCost)((0, item_qty_rates_rules_1.dec)(row.costPrice), stored.costPrice)
                            ? { costRate: stored.costPrice.toNumber(), costWot: stored.costWot.toNumber() }
                            : null;
                    },
                })
                : null;
            const taxes = await (0, item_tax_rate_helper_1.resolveItemTaxRates)(tx, [itemId], dayDate(today));
            const tax = taxes.get(itemId);
            const basis = { inclTax: tax?.inclTax ?? false, taxPerc: (0, item_qty_rates_rules_1.dec)(tax?.taxPerc ?? 0) };
            const units = await this.gateway.units(tx, itemId);
            const liveSlabs = await this.gateway.liveSlabs(tx, itemId);
            const unitsById = new Map(units.map((unit) => [unit.uomId, unit]));
            const sent = prepared ? this.sentRowsOf(prepared, priceRows, unitsById, today, caller) : [];
            const problems = [];
            if (prepared) {
                problems.push(...this.cardBelowCost(prepared, sent, policy));
            }
            problems.push(...(0, item_qty_rates_rules_1.cardProblems)(sent, ctx));
            const cards = await this.unitCards(tx, {
                itemId,
                companyId,
                branchId,
                today,
                caller,
                units,
                priceRows,
                sent,
                prepared,
                plainStock,
                basis,
            });
            const entries = (0, item_qty_rates_rules_1.slabsToJudge)({
                stored: liveSlabs.map(item_qty_rates_rules_1.storedSlabOf),
                sent: slabRows,
                deleteIds,
                companyId,
                branchId,
                today,
            });
            problems.push(...(0, item_qty_rates_rules_1.slabProblems)((0, item_qty_rates_rules_1.judgeSlabs)(entries, cards, ctx.activeLevels, basis), { ...ctx, policy }));
            const refusals = problems.filter((problem) => problem.severity === 'REFUSE');
            if (refusals.length) {
                throw new common_1.UnprocessableEntityException({
                    success: false,
                    message: 'These prices cannot be saved',
                    errors: refusals.map((problem) => ({
                        field: problem.field,
                        code: problem.code,
                        message: problem.message,
                    })),
                    problems,
                    belowCostPolicy: policy,
                });
            }
            if (!confirmed && problems.some((problem) => problem.severity === 'ASK')) {
                return {
                    needsConfirm: true,
                    rates: null,
                    slabs: [],
                    deletedSlabIds: [],
                    problems,
                    belowCostPolicy: policy,
                };
            }
            const deleted = deleteIds.length ? await this.slabService.softDelete(deleteIds, tx) : [];
            const rates = prepared
                ? await this.bulk.writeBulkInTx(tx, prepared, { confirmed, via, policy })
                : null;
            const saved = slabRows.length
                ? await this.slabService.save(slabRows, tx, { fieldPrefix: 'slabs.' })
                : [];
            return {
                needsConfirm: false,
                rates,
                slabs: withScreenLevelNames(saved, levels),
                deletedSlabIds: deleted.map((entry) => entry.iqp_id),
                problems,
                belowCostPolicy: policy,
            };
        }, TX);
    }
    buildSaveMessage(result) {
        if (result.needsConfirm) {
            const asks = result.problems.filter((problem) => problem.severity === 'ASK').length;
            return `${asks} price${asks === 1 ? '' : 's'} need${asks === 1 ? 's' : ''} your OK. Save anyway to keep ${asks === 1 ? 'it' : 'them'}.`;
        }
        const parts = [
            `Saved · cost + card rate ${result.rates?.saved ?? 0} row${result.rates?.saved === 1 ? '' : 's'}`,
            `slabs ${result.slabs.length}`,
        ];
        if (result.deletedSlabIds.length) {
            parts.push(`${result.deletedSlabIds.length} removed`);
        }
        return parts.join(' · ');
    }
    assertShape(itemId, cardRows, slabRows, deleteIds) {
        if (!cardRows.length && !slabRows.length && !deleteIds.length) {
            (0, module_service_utils_1.throwInventoryBadRequest)('Nothing to save', [
                {
                    field: 'request',
                    code: item_qty_price_error_codes_1.ItemQtyPriceErrorCode.NOTHING_TO_SAVE,
                    message: 'Nothing was changed: send a card row, a slab, or a slab to remove.',
                },
            ]);
        }
        const mismatch = slabRows
            .map((slab, index) => ({ slab, index }))
            .filter(({ slab }) => lower(slab.iqp_item_id) !== lower(itemId));
        if (mismatch.length) {
            (0, module_service_utils_1.throwInventoryBadRequest)('A slab of another item was sent', [
                ...mismatch.map(({ index }) => ({
                    field: `slabs.${index}.iqp_item_id`,
                    code: item_qty_price_error_codes_1.ItemQtyPriceErrorCode.ITEM_MISMATCH,
                    message: `Slab ${index + 1} is for another item; this form saves item ${itemId} only.`,
                })),
            ]);
        }
        const seen = new Map();
        const named = [
            ...slabRows.flatMap((slab, index) => slab.iqp_id ? [{ id: lower(slab.iqp_id), field: `slabs.${index}.iqp_id` }] : []),
            ...deleteIds.map((id, index) => ({ id: lower(id), field: `deleteSlabIds.${index}` })),
        ];
        for (const { id, field } of named) {
            const first = seen.get(id);
            if (first) {
                (0, module_service_utils_1.throwInventoryBadRequest)('Validation failed', [
                    {
                        field,
                        code: 'VALIDATION_ARRAY_UNIQUE',
                        message: `Slab ${id} is named twice (${first} and ${field}); save it, or remove it, once.`,
                    },
                ]);
            }
            seen.set(id, field);
        }
    }
    assertNamedSlabs(itemId, slabRows, deleteIds, stored) {
        const named = [
            ...slabRows.flatMap((slab, index) => slab.iqp_id ? [{ id: slab.iqp_id, field: `slabs.${index}.iqp_id`, edit: true }] : []),
            ...deleteIds.map((id, index) => ({ id, field: `deleteSlabIds.${index}`, edit: false })),
        ];
        for (const { id, field, edit } of named) {
            const slab = stored.get(lower(id));
            if (!slab || (edit && slab.isDeleted)) {
                (0, module_service_utils_1.throwInventoryNotFound)('Item qty price not found', field, `No item qty price found with id ${id}. Load the item again.`, item_qty_price_error_codes_1.ItemQtyPriceErrorCode.NOT_FOUND);
            }
            if (lower(slab.itemId) !== lower(itemId)) {
                (0, module_service_utils_1.throwInventoryBadRequest)('A slab of another item was sent', [
                    {
                        field,
                        code: item_qty_price_error_codes_1.ItemQtyPriceErrorCode.ITEM_MISMATCH,
                        message: `Slab ${id} belongs to another item; this form saves item ${itemId} only.`,
                    },
                ]);
            }
        }
    }
    assertPlainStockFields(cardRows, plainStock, trackedAs) {
        if (plainStock) {
            return;
        }
        const errors = [];
        cardRows.forEach((row, index) => {
            const line = row.lineNo ?? index + 1;
            if (row.costPrice !== undefined && row.costPrice !== null) {
                errors.push({
                    field: `rates.rows.${index}.costPrice`,
                    code: item_qty_price_error_codes_1.ItemQtyPriceErrorCode.COST_NOT_PLAIN_STOCK,
                    message: `Line ${line}: this item is tracked as ${trackedAs}, so its cost comes from stock and can't be typed here.`,
                });
            }
            if (row.maxPrice !== undefined && row.maxPrice !== null) {
                errors.push({
                    field: `rates.rows.${index}.maxPrice`,
                    code: item_qty_price_error_codes_1.ItemQtyPriceErrorCode.MRP_NOT_PLAIN_STOCK,
                    message: `Line ${line}: this item is tracked as ${trackedAs}, so its MRP belongs to the stock and can't be typed here.`,
                });
            }
        });
        if (errors.length) {
            (0, module_service_utils_1.throwUnprocessable)('These prices cannot be saved', errors);
        }
    }
    bulkDtoOf(dto, rows) {
        return {
            companyId: dto.companyId,
            branchId: dto.branchId,
            scope: 'BRANCH',
            confirmed: dto.confirmed === true,
            rows: rows.map((row) => ({ ...row, itemId: dto.itemId })),
            originMenuId: item_qty_rates_types_1.QTY_RATES_MENU_ID,
        };
    }
    sentRowsOf(prepared, priceRows, unitsById, today, caller) {
        return prepared.candidates.map((candidate, index) => {
            const raw = prepared.dto.rows[index];
            const key = { mrp: candidate.mrp, salePrice: candidate.salePrice };
            const stored = this.storedRowFor(priceRows, candidate.uomId, key, today, caller);
            const headline = key.mrp === null && key.salePrice === null;
            const sentCost = raw.costPrice !== undefined && raw.costPrice !== null ? (0, item_qty_rates_rules_1.dec)(raw.costPrice) : null;
            return {
                index,
                lineNo: candidate.lineNo,
                uomId: candidate.uomId,
                unitName: unitsById.get(candidate.uomId)?.unitName ?? null,
                key,
                levels: candidate.levels.map((level) => ({ level: level.level, price: (0, item_qty_rates_rules_1.dec)(level.price) })),
                costPrice: sentCost && stored && (0, item_qty_rates_rules_1.sameCost)(sentCost, stored.costPrice) ? stored.costPrice : sentCost,
                maxPrice: headline && raw.maxPrice !== undefined && raw.maxPrice !== null
                    ? (0, item_qty_rates_rules_1.dec)(raw.maxPrice)
                    : null,
                minPrice: raw.minPrice !== undefined && raw.minPrice !== null ? (0, item_qty_rates_rules_1.dec)(raw.minPrice) : null,
                profitType: raw.profitType ?? null,
                stored,
            };
        });
    }
    storedRowFor(priceRows, uomId, key, today, caller) {
        const unitRows = priceRows.filter((row) => row.ipmUcUnitId === uomId);
        const answer = (0, price_resolver_1.resolveEffectivePrice)(unitRows, key, today, caller);
        return answer ? (0, item_qty_rates_rules_1.storedCardRowOf)(answer.row) : null;
    }
    cardBelowCost(prepared, sent, policy) {
        return prepared.belowCost.map((problem) => {
            const index = prepared.candidates.findIndex((c) => c.lineNo === problem.lineNo);
            const candidate = prepared.candidates[index];
            const row = sent[index];
            const price = candidate?.levels.find((level) => level.level === problem.level)?.price ?? null;
            return {
                source: 'CARD',
                code: stock_error_codes_1.StockErrorCode.PRICE_BELOW_COST,
                severity: (0, item_qty_rates_rules_1.belowCostSeverity)(policy),
                lineNo: problem.lineNo,
                slabIndex: null,
                iqpId: null,
                uomId: problem.uomId,
                unitName: row?.unitName ?? null,
                level: problem.level,
                price,
                cost: candidate ? candidate.costRate : null,
                field: `rates.rows.${index < 0 ? 0 : index}.levels`,
                message: `Line ${problem.lineNo}${row?.unitName ? ` · ${row.unitName}` : ''}: ${problem.message}`,
            };
        });
    }
    async unitCards(tx, args) {
        const plans = args.units.map((unit) => {
            const unitRows = args.priceRows.filter((row) => row.ipmUcUnitId === unit.uomId);
            const standing = (0, item_qty_rates_rules_1.cardRowOf)(unitRows, args.today, args.caller);
            const key = standing?.key ?? { ...price_resolver_1.HEADLINE_KEY };
            const sentRow = args.sent.find((row) => row.uomId === unit.uomId && (0, item_qty_rates_rules_1.sameKey)(row.key, key)) ?? null;
            return { unit, standing, key, sentRow };
        });
        const needCost = plans.filter((plan) => plan.sentRow === null);
        const costs = needCost.length
            ? await this.bulkGateway.loadRowCosts(tx, needCost.map((plan) => ({
                itemId: args.itemId,
                uomId: plan.unit.uomId,
                mrp: plan.key.mrp,
                salePrice: plan.key.salePrice,
            })), args.companyId, args.branchId)
            : [];
        const cards = new Map();
        plans.forEach((plan) => {
            const costBasisRate = plan.sentRow
                ? (args.prepared?.costs[plan.sentRow.index]?.costRate ?? 0)
                : (costs[needCost.indexOf(plan)]?.costRate ?? 0);
            cards.set(plan.unit.uomId, {
                unitName: plan.unit.unitName,
                card: (0, item_qty_rates_rules_1.unitCardAfter)({
                    stored: plan.standing ? (0, item_qty_rates_rules_1.storedCardRowOf)(plan.standing.row) : null,
                    key: plan.key,
                    sent: plan.sentRow,
                    plainStock: args.plainStock,
                    costBasisRate: (0, item_qty_rates_rules_1.dec)(costBasisRate),
                    inclTax: args.basis.inclTax,
                    taxPerc: args.basis.taxPerc,
                }),
            });
        });
        return cards;
    }
    async findItemOr404(client, companyId, branchId, itemId) {
        const item = await this.costGateway.findItem(client, companyId, branchId, itemId);
        if (!item) {
            (0, module_service_utils_1.throwInventoryNotFound)('Item not found', 'itemId', `No live item ${itemId} at this company and branch.`, cost_price_bulk_types_1.COST_BULK_ITEM_NOT_FOUND);
        }
        return item;
    }
    async belowCostPolicy(companyId, branchId) {
        const effective = await this.appSettingValueService.resolveEffective({
            companyId,
            branchId,
            deviceId: this.requestContext.getDeviceId() ?? undefined,
            userId: this.requestContext.getUserId() ?? undefined,
        });
        return (0, below_cost_policy_helper_1.resolveBelowCostPolicy)(effective);
    }
};
exports.ItemQtyRatesService = ItemQtyRatesService;
exports.ItemQtyRatesService = ItemQtyRatesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        request_context_service_1.RequestContextService,
        app_setting_value_service_1.AppSettingValueService,
        item_qty_rates_gateway_1.ItemQtyRatesGateway,
        cost_price_bulk_gateway_1.CostPriceBulkGateway,
        selling_price_bulk_service_1.SellingPriceBulkService,
        price_bucket_gateway_1.PriceBucketGateway,
        items_qty_price_master_service_1.ItemsQtyPriceMasterService])
], ItemQtyRatesService);
//# sourceMappingURL=item-qty-rates.service.js.map