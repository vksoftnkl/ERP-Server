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
exports.SellingPriceBulkService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const audit_log_service_1 = require("../../audit-log/audit-log.service");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const app_setting_value_service_1 = require("../../settings/appSettings/app-setting-value.service");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const stock_voucher_posting_helper_1 = require("../stock-voucher/stock-voucher-posting.helper");
const item_tax_rate_helper_1 = require("../../Inventory/utils/item-tax-rate.helper");
const list_selling_price_query_dto_1 = require("./dto/list-selling-price-query.dto");
const below_cost_policy_helper_1 = require("./below-cost-policy.helper");
const selling_price_math_helper_1 = require("./selling-price-math.helper");
const selling_price_scope_helper_1 = require("./selling-price-scope.helper");
const price_bucket_gateway_1 = require("./price-bucket.gateway");
const selling_price_bulk_types_1 = require("./types/selling-price-bulk.types");
const stock_error_codes_1 = require("../types/stock-error-codes");
const price_master_writer_service_1 = require("../../Inventory/item-price-log/price-master-writer.service");
const price_change_log_types_1 = require("../../Inventory/item-price-log/types/price-change-log.types");
const rights_1 = require("../../../common/posting/rights");
const PRICE_VERDICT_CODES = {
    ABOVE_MRP: stock_error_codes_1.StockErrorCode.PRICE_ABOVE_MRP,
    BELOW_MIN: stock_error_codes_1.StockErrorCode.PRICE_BELOW_MIN,
    BELOW_COST: stock_error_codes_1.StockErrorCode.PRICE_BELOW_COST,
};
const ITEM_PRICE_TABLE_NAME = 'item price master';
const ITEM_PRICE_AUDIT_SCREEN_NAME = 'Item Price Master';
const AUDIT_SCREEN_NAME = 'Change Selling Price';
function displayDay(day) {
    return day.split('-').reverse().join('-');
}
function dayDate(day) {
    return new Date(`${day}T00:00:00.000Z`);
}
let SellingPriceBulkService = class SellingPriceBulkService {
    prisma;
    auditLogService;
    requestContext;
    appSettingValueService;
    gateway;
    writer;
    constructor(prisma, auditLogService, requestContext, appSettingValueService, gateway, writer) {
        this.prisma = prisma;
        this.auditLogService = auditLogService;
        this.requestContext = requestContext;
        this.appSettingValueService = appSettingValueService;
        this.gateway = gateway;
        this.writer = writer;
    }
    async listPrices(queryDto) {
        const limit = Math.min(queryDto.limit ?? list_selling_price_query_dto_1.DEFAULT_PRICE_GRID_LIMIT, list_selling_price_query_dto_1.MAX_PRICE_GRID_LIMIT);
        const offset = Math.max(queryDto.offset ?? 0, 0);
        const page = await this.gateway.listPrices({
            companyId: queryDto.companyId,
            branchId: queryDto.branchId,
            itemGroupId: queryDto.itemGroupId,
            itemBrandId: queryDto.itemBrandId,
            itemSectionId: queryDto.itemSectionId,
            supplierId: queryDto.supplierId,
            itemId: queryDto.itemId,
            search: queryDto.search,
            itemCategoryId: queryDto.itemCategoryId,
            trackPresetId: queryDto.trackPresetId,
            taxId: queryDto.taxId,
            activeOnly: queryDto.activeOnly ?? true,
            limit,
            offset,
        });
        return { items: await this.toGridRows(page.items, offset), meta: page.meta };
    }
    async listBuckets(itemId, queryDto) {
        const records = await this.gateway.listBuckets(itemId, queryDto.companyId, queryDto.branchId);
        return this.toGridRows(records, 0);
    }
    async saveBulk(dto) {
        await this.assertCanEditPrices();
        this.assertScopeAllowed(dto.scope);
        const via = dto.originMenuId ? await this.describeOriginMenu(dto.originMenuId) : null;
        const confirmed = dto.confirmed === true;
        const policy = await this.resolveBelowCostPolicy(dto);
        const actor = (0, module_service_utils_1.resolveActor)(dto.userId, this.requestContext.getUserId());
        return this.prisma.$transaction(async (tx) => {
            const { from, scheduledFrom } = await this.resolveStartDay(tx, dto.effectiveFrom);
            const itemIds = dto.rows.map((row) => row.itemId);
            const taxRates = scheduledFrom
                ? await this.resolveItemTaxRates(tx, itemIds, dayDate(scheduledFrom))
                : await this.resolveItemTaxRates(tx, itemIds);
            const costs = await this.gateway.loadRowCosts(tx, dto.rows.map((row) => ({
                itemId: row.itemId,
                uomId: row.uomId,
                mrp: row.mrp ?? null,
                salePrice: row.salePrice ?? null,
            })), dto.companyId, dto.branchId, scheduledFrom);
            this.assertUnitsBelong(dto.rows, costs);
            const candidates = dto.rows.map((row, index) => this.toCandidate(row, index, dto.companyId, actor, taxRates, costs[index]));
            const resolutions = dto.rows.map((row) => (0, selling_price_scope_helper_1.resolveTargetScope)(dto.scope, this.rowScopeOf(row), dto.branchId));
            this.assertOneRowPerBucket(candidates, resolutions);
            const problems = this.gateway.validateRows(candidates, costs.map((cost) => cost.minPrice));
            const blocking = problems.filter((problem) => !selling_price_bulk_types_1.CONFIRMABLE_VERDICTS.includes(problem.verdict));
            if (blocking.length) {
                this.throwProblems(blocking, 'These prices cannot be saved');
            }
            const belowCost = problems.filter((problem) => problem.verdict === 'BELOW_COST');
            if (belowCost.length) {
                const action = (0, below_cost_policy_helper_1.resolveBelowCostAction)(policy, confirmed);
                if (action === 'ABORT') {
                    this.throwProblems(belowCost, 'Prices below cost are not allowed (inventory.below_cost_price = restrict)');
                }
                if (action === 'CONFIRM') {
                    return {
                        saved: 0,
                        effectiveFrom: from,
                        rows: [],
                        masterRowsSaved: 0,
                        noStock: [],
                        needsConfirm: true,
                        problems: belowCost,
                        belowCostPolicy: policy,
                    };
                }
            }
            const applied = [];
            for (let index = 0; index < candidates.length; index += 1) {
                const confirmedHere = confirmed
                    ? belowCost.filter((problem) => problem.lineNo === candidates[index].lineNo)
                    : [];
                const reason = [
                    confirmedHere.length
                        ? `Confirmed below cost: ${confirmedHere.map((p) => p.message).join('; ')}`
                        : null,
                    via,
                ]
                    .filter(Boolean)
                    .join(' · ');
                applied.push(await this.applyBucketPrice(tx, candidates[index], resolutions[index], scheduledFrom, reason
                    ? { ...price_change_log_types_1.PRICE_ORIGIN.CHANGE_SELLING_PRICE, reason }
                    : price_change_log_types_1.PRICE_ORIGIN.CHANGE_SELLING_PRICE));
            }
            const ipmIds = applied.map((row) => row.ipmId);
            const shown = await this.gateway.loadRowCosts(tx, dto.rows.map((row) => ({
                itemId: row.itemId,
                uomId: row.uomId,
                mrp: row.mrp ?? null,
                salePrice: row.salePrice ?? null,
            })), dto.companyId, dto.branchId, scheduledFrom);
            const noStock = await this.gateway.listNoStock(tx, ipmIds, dto.companyId, dto.branchId);
            const after = await this.auditWrites(tx, dto, applied, {
                actor,
                confirmedBelowCost: confirmed ? belowCost : [],
                scheduledFrom,
            });
            return {
                saved: ipmIds.length,
                effectiveFrom: from,
                rows: applied.map((row, index) => this.toSavedRow(row, after.get(row.ipmId), scheduledFrom, shown[index])),
                masterRowsSaved: 0,
                noStock,
                needsConfirm: false,
                problems,
                belowCostPolicy: policy,
            };
        });
    }
    buildSaveMessage(result) {
        if (result.needsConfirm) {
            return `${result.problems.length} price(s) are below cost. Confirm to save them.`;
        }
        const parts = [];
        if (result.saved) {
            const scheduled = result.rows.length > 0 && result.rows.every((row) => row.scheduled);
            parts.push(`${result.saved} price${result.saved === 1 ? '' : 's'} ` +
                (scheduled ? `scheduled from ${displayDay(result.effectiveFrom)}` : 'saved'));
        }
        if (!parts.length) {
            parts.push('Nothing to save');
        }
        if (result.noStock.length) {
            parts.push(`${result.noStock.length} ${result.noStock.length === 1 ? 'has' : 'have'} no stock on hand — the price applies when stock arrives`);
        }
        return `${parts.join(' · ')}.`;
    }
    async applyBucketPrice(tx, candidate, scope, scheduledFrom, origin = price_change_log_types_1.PRICE_ORIGIN.CHANGE_SELLING_PRICE) {
        const existing = await this.gateway.findBucketRowForUpdate(tx, candidate, scope, scheduledFrom);
        if (!existing) {
            return {
                ipmId: await this.writer.insertBucketPrice(tx, candidate, scope, scheduledFrom, origin),
                before: null,
                lineNo: candidate.lineNo,
                itemName: candidate.itemName,
            };
        }
        const [before] = (await this.gateway.snapshotRows(tx, [existing.ipmId])).values();
        if (!scheduledFrom || existing.effectiveFrom === scheduledFrom) {
            return {
                ipmId: await this.writer.updateBucketPrice(tx, existing.ipmId, candidate, origin),
                before: before ?? null,
                lineNo: candidate.lineNo,
                itemName: candidate.itemName,
            };
        }
        await this.writer.closePriceRowBefore(tx, existing.ipmId, scheduledFrom, candidate.actor, origin);
        return {
            ipmId: await this.writer.insertSplitPrice(tx, existing.ipmId, candidate, { from: scheduledFrom, to: existing.effectiveTo }, origin),
            before: null,
            lineNo: candidate.lineNo,
            itemName: candidate.itemName,
            closed: { ipmId: existing.ipmId, before: before ?? null },
        };
    }
    async listSchedule(queryDto) {
        const records = await this.gateway.listScheduled(queryDto.companyId, queryDto.branchId, queryDto.itemId);
        const taxByDay = new Map();
        for (const day of new Set(records.map((record) => record.effectiveFrom))) {
            taxByDay.set(day, await this.resolveItemTaxRates(this.prisma, records.filter((record) => record.effectiveFrom === day).map((record) => record.itemId), dayDate(day)));
        }
        return records.map((record, index) => {
            const tax = taxByDay.get(record.effectiveFrom)?.get(record.itemId);
            const row = this.toGridRow(record, index + 1, tax);
            return {
                ...row,
                effectiveFrom: record.effectiveFrom,
                effectiveTo: record.effectiveTo,
                previous: record.previous && {
                    bucketId: record.previous.bucketId,
                    priceScope: record.previous.priceScope,
                    levels: selling_price_bulk_types_1.PRICE_LEVELS.map((level) => (0, selling_price_math_helper_1.recomputeLevel)(level, record.previous.prices[level - 1], row.taxPerc, record.costRate)),
                },
            };
        });
    }
    async cancelSchedule(ipmId) {
        await this.assertCanEditPrices();
        const actor = (0, module_service_utils_1.resolveActor)(undefined, this.requestContext.getUserId());
        return this.prisma.$transaction(async (tx) => {
            const row = await this.gateway.lockScheduledRow(tx, ipmId);
            if (!row || row.isDeleted) {
                (0, module_service_utils_1.throwStockNotFound)('Scheduled price not found', 'ipmId', `No live price row ${ipmId}.`, stock_error_codes_1.StockErrorCode.PRICE_SCHEDULE_NOT_FOUND);
            }
            if (row.started) {
                (0, module_service_utils_1.throwStockConflict)('This price is already in force', [
                    {
                        field: 'ipmId',
                        code: stock_error_codes_1.StockErrorCode.PRICE_SCHEDULE_STARTED,
                        message: `The price started on ${displayDay(row.effectiveFrom)}; bills may already carry ` +
                            'it. Save a new price instead.',
                    },
                ]);
            }
            if (row.branchId === null) {
                this.assertScopeAllowed('CHAIN');
            }
            const previous = await this.gateway.findRowBeforeForUpdate(tx, ipmId);
            const ids = previous ? [ipmId, previous.ipmId] : [ipmId];
            const before = await this.gateway.snapshotRows(tx, ids);
            const origin = {
                ...price_change_log_types_1.PRICE_ORIGIN.CHANGE_SELLING_PRICE,
                reason: `The price scheduled from ${displayDay(row.effectiveFrom)} was cancelled`,
            };
            await this.writer.softDeletePriceRow(tx, ipmId, actor, origin);
            if (previous) {
                await this.writer.extendPriceRowTo(tx, previous.ipmId, row.effectiveTo, actor, origin);
            }
            const after = await this.gateway.snapshotRows(tx, ids);
            const from = displayDay(row.effectiveFrom);
            const displayName = await this.describeRow(tx, after.get(ipmId) ?? null);
            await this.auditLogService.logEntityChange({
                action: 'cancel',
                tableName: ITEM_PRICE_TABLE_NAME,
                screenName: ITEM_PRICE_AUDIT_SCREEN_NAME,
                screenType: 'master',
                pk: ipmId,
                displayName,
                originalRecord: before.get(ipmId) ?? null,
                modifiedRecord: after.get(ipmId) ?? null,
                userId: actor,
                notes: `${AUDIT_SCREEN_NAME} (menu 30) — the price scheduled from ${from} cancelled`,
            }, tx);
            if (previous) {
                await this.auditLogService.logEntityChange({
                    action: 'update',
                    tableName: ITEM_PRICE_TABLE_NAME,
                    screenName: ITEM_PRICE_AUDIT_SCREEN_NAME,
                    screenType: 'master',
                    pk: previous.ipmId,
                    displayName,
                    originalRecord: before.get(previous.ipmId) ?? null,
                    modifiedRecord: after.get(previous.ipmId) ?? null,
                    userId: actor,
                    notes: `${AUDIT_SCREEN_NAME} (menu 30) — runs to ${displayDay(row.effectiveTo)} again: ` +
                        `the price scheduled from ${from} was cancelled`,
                }, tx);
            }
            return {
                bucketId: ipmId,
                restoredId: previous?.ipmId ?? null,
                restoredTo: previous ? row.effectiveTo : null,
            };
        });
    }
    async auditWrites(tx, dto, applied, context) {
        const after = await this.gateway.snapshotRows(tx, [
            ...applied.map((row) => row.ipmId),
            ...applied.flatMap((row) => (row.closed ? [row.closed.ipmId] : [])),
        ]);
        const scopeLabel = dto.scope === 'CHAIN' ? 'all branches' : 'this branch';
        const fromLabel = context.scheduledFrom ? `, from ${displayDay(context.scheduledFrom)}` : '';
        for (const row of applied) {
            const modified = after.get(row.ipmId) ?? null;
            const confirmed = context.confirmedBelowCost.filter((p) => p.lineNo === row.lineNo);
            const displayName = `${row.itemName} · ${this.describeBucket(modified)}`;
            if (row.closed) {
                await this.auditLogService.logEntityChange({
                    action: 'update',
                    tableName: ITEM_PRICE_TABLE_NAME,
                    screenName: ITEM_PRICE_AUDIT_SCREEN_NAME,
                    screenType: 'master',
                    pk: row.closed.ipmId,
                    displayName,
                    originalRecord: row.closed.before,
                    modifiedRecord: after.get(row.closed.ipmId) ?? null,
                    userId: context.actor,
                    notes: `${AUDIT_SCREEN_NAME} (menu 30), ${scopeLabel} — ends the day before the new price${fromLabel}`,
                }, tx);
            }
            await this.auditLogService.logEntityChange({
                action: row.before ? 'update' : 'New',
                tableName: ITEM_PRICE_TABLE_NAME,
                screenName: ITEM_PRICE_AUDIT_SCREEN_NAME,
                screenType: 'master',
                pk: row.ipmId,
                displayName,
                originalRecord: row.before,
                modifiedRecord: modified,
                userId: context.actor,
                notes: `${AUDIT_SCREEN_NAME} (menu 30), ${scopeLabel}${fromLabel}` +
                    (confirmed.length
                        ? ` — confirmed below cost: ${confirmed.map((p) => p.message).join('; ')}`
                        : ''),
            }, tx);
        }
        return after;
    }
    describeBucket(row) {
        const amount = (value) => (typeof value === 'number' ? value : null);
        const mrp = amount(row?.ipm_bucket_mrp);
        const salePrice = amount(row?.ipm_bucket_sp);
        const bucket = [
            mrp !== null ? `MRP ${mrp}` : null,
            salePrice !== null ? `sale price ${salePrice}` : null,
        ].filter(Boolean);
        return bucket.length ? bucket.join(', ') : 'headline';
    }
    async describeRow(tx, row) {
        const itemId = typeof row?.ipm_item_id === 'string' ? row.ipm_item_id : null;
        const item = itemId
            ? await tx.itemMaster.findUnique({ where: { itemId }, select: { itemNameEn: true } })
            : null;
        return `${item?.itemNameEn ?? itemId ?? ''} · ${this.describeBucket(row)}`;
    }
    async resolveStartDay(tx, sent) {
        const { today, latest } = await this.gateway.calendar(tx);
        const from = sent ?? today;
        if (from < today) {
            (0, module_service_utils_1.throwStockBadRequest)('These prices cannot be saved', [
                {
                    field: 'effectiveFrom',
                    code: stock_error_codes_1.StockErrorCode.PRICE_FROM_IN_PAST,
                    message: `${displayDay(from)} is in the past. A price can start today ` +
                        `(${displayDay(today)}) or later; bills already made keep their prices.`,
                },
            ]);
        }
        if (from > latest) {
            (0, module_service_utils_1.throwStockBadRequest)('These prices cannot be saved', [
                {
                    field: 'effectiveFrom',
                    code: stock_error_codes_1.StockErrorCode.PRICE_FROM_TOO_FAR,
                    message: `${displayDay(from)} is more than a year ahead (latest ${displayDay(latest)}). Check the year.`,
                },
            ]);
        }
        return { from, scheduledFrom: from > today ? from : undefined };
    }
    toSavedRow(row, stored, scheduledFrom, shown) {
        const day = (value) => (typeof value === 'string' ? value.slice(0, 10) : '');
        return {
            lineNo: row.lineNo,
            bucketId: row.ipmId,
            scheduled: scheduledFrom !== undefined,
            effectiveFrom: day(stored?.ipm_effective_from),
            effectiveTo: day(stored?.ipm_effective_to),
            costRate: shown?.costRate ?? 0,
            costWot: shown?.costWot ?? 0,
            costBasis: shown?.costBasis ?? null,
        };
    }
    assertScopeAllowed(scope) {
        if (scope !== 'CHAIN' || (0, selling_price_bulk_types_1.isHqUserType)(this.requestContext.getUserType())) {
            return;
        }
        (0, module_service_utils_1.throwStockForbidden)('These prices cannot be saved', [
            {
                field: 'scope',
                code: stock_error_codes_1.StockErrorCode.PRICE_CHAIN_HQ_ONLY,
                message: 'Only an HQ user may save prices for all branches. Save at This branch scope instead.',
            },
        ]);
    }
    async assertCanEditPrices() {
        await (0, rights_1.assertMenuRight)(this.prisma, {
            userId: this.requestContext.getUserId(),
            menuId: price_change_log_types_1.PRICE_MENU_ID.CHANGE_SELLING_PRICE,
            right: 'edit',
            codePrefix: 'STOCK_PRICE',
            action: 'change selling prices',
        });
    }
    async describeOriginMenu(menuId) {
        const [menu] = await this.prisma.$queryRaw `
      SELECT menu_name FROM fixed.menu_master WHERE menu_id = ${menuId}::int`;
        const name = menu?.menu_name.replace(/&/g, '').trim();
        return name ? `via ${name} (menu ${menuId})` : `via menu ${menuId}`;
    }
    async resolveBelowCostPolicy(dto) {
        const effective = await this.appSettingValueService.resolveEffective({
            companyId: dto.companyId,
            branchId: dto.branchId,
            deviceId: this.requestContext.getDeviceId() ?? undefined,
            userId: dto.userId ?? this.requestContext.getUserId() ?? undefined,
        });
        return (0, below_cost_policy_helper_1.resolveBelowCostPolicy)(effective);
    }
    rowScopeOf(row) {
        return row.priceScope ?? null;
    }
    assertUnitsBelong(rows, costs) {
        const wrong = rows
            .map((row, index) => ({ row, index }))
            .filter(({ index }) => !costs[index].uomBelongs);
        if (!wrong.length) {
            return;
        }
        (0, module_service_utils_1.throwStockUnprocessable)('These prices cannot be saved', wrong.map(({ row, index }) => ({
            field: `rows.${row.lineNo ?? index + 1}`,
            code: stock_error_codes_1.StockErrorCode.PRICE_UNIT_NOT_OF_ITEM,
            message: `Line ${row.lineNo ?? index + 1}: unit ${row.uomId} is not one of item ${row.itemId}'s units.`,
        })));
    }
    assertOneRowPerBucket(candidates, resolutions) {
        const firstAt = new Map();
        candidates.forEach((candidate, index) => {
            const key = [
                candidate.itemId,
                candidate.uomId,
                resolutions[index].targetBranchId ?? '',
                candidate.mrp ?? '',
                candidate.salePrice ?? '',
            ].join('|');
            const first = firstAt.get(key);
            if (first !== undefined) {
                (0, module_service_utils_1.throwStockUnprocessable)('These prices cannot be saved', [
                    {
                        field: `rows.${candidate.lineNo}`,
                        code: stock_error_codes_1.StockErrorCode.PRICE_DUPLICATE_BUCKET,
                        message: `Lines ${candidates[first].lineNo} and ${candidate.lineNo} price the same bucket of ` +
                            `${candidate.itemName || candidate.itemId} at the same scope. Keep one of them.`,
                    },
                ]);
            }
            firstAt.set(key, index);
        });
    }
    toCandidate(row, index, companyId, actor, taxRates, cost) {
        const taxPerc = taxRates.get(row.itemId)?.taxPerc ?? 0;
        const key = (0, stock_voucher_posting_helper_1.bucketKeyFor)(cost, { mrp: row.mrp ?? null, salePrice: row.salePrice ?? null });
        const keyedCost = row.costPrice ?? null;
        const costRate = keyedCost ?? cost.costRate;
        const costWot = keyedCost !== null ? (0, selling_price_math_helper_1.exclusiveOfTax)(keyedCost, taxPerc) : cost.costWot;
        return {
            lineNo: row.lineNo ?? index + 1,
            companyId,
            itemId: row.itemId,
            uomId: row.uomId,
            itemCode: cost.itemCode,
            itemName: cost.itemName,
            bucketId: row.bucketId ?? null,
            mrp: key.mrp,
            salePrice: key.salePrice,
            minPrice: row.minPrice ?? null,
            roundOff: row.roundOff ?? null,
            costRate,
            costWot,
            actor,
            levels: row.levels.map((level) => {
                const value = (0, selling_price_math_helper_1.recomputeLevel)(level.level, level.price, taxPerc, costRate);
                return {
                    level: value.level,
                    price: value.price,
                    priceWot: value.priceWot,
                    markupPerc: value.markupPerc,
                };
            }),
        };
    }
    async toGridRows(records, offset) {
        const taxRates = await this.resolveItemTaxRates(this.prisma, records.map((record) => record.itemId));
        return records.map((record, index) => this.toGridRow(record, offset + index + 1, taxRates.get(record.itemId)));
    }
    toGridRow(record, lineNo, tax) {
        const taxPerc = tax?.taxPerc ?? 0;
        return {
            lineNo,
            itemId: record.itemId,
            itemCode: record.itemCode,
            barcode: record.barcode,
            itemName: record.itemName,
            uomId: record.uomId,
            unitName: record.unitName,
            stockQty: record.stockQty,
            mrp: record.mrp,
            salePrice: record.salePrice,
            maxPrice: record.maxPrice,
            priceSource: record.priceSource,
            priceScope: record.priceScope,
            bucketId: record.bucketId,
            costRate: record.costRate,
            costWot: record.costWot,
            costBasis: record.costBasis,
            minPrice: record.minPrice,
            roundOff: record.roundOff,
            taxPerc,
            inclTax: tax?.inclTax ?? false,
            hasCess: tax?.hasCess ?? false,
            levels: selling_price_bulk_types_1.PRICE_LEVELS.map((level) => (0, selling_price_math_helper_1.recomputeLevel)(level, record.prices[level - 1], taxPerc, record.costRate)),
        };
    }
    throwProblems(problems, message) {
        (0, module_service_utils_1.throwStockUnprocessable)(message, problems.map((problem) => ({
            field: `rows.${problem.lineNo}`,
            code: PRICE_VERDICT_CODES[problem.verdict],
            message: `Line ${problem.lineNo}: ${problem.message}`,
        })));
    }
    async resolveItemTaxRates(tx, itemIds, asOf = new Date()) {
        return (0, item_tax_rate_helper_1.resolveItemTaxRates)(tx, itemIds, asOf);
    }
};
exports.SellingPriceBulkService = SellingPriceBulkService;
exports.SellingPriceBulkService = SellingPriceBulkService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_log_service_1.AuditLogService,
        request_context_service_1.RequestContextService,
        app_setting_value_service_1.AppSettingValueService,
        price_bucket_gateway_1.PriceBucketGateway,
        price_master_writer_service_1.PriceMasterWriter])
], SellingPriceBulkService);
//# sourceMappingURL=selling-price-bulk.service.js.map