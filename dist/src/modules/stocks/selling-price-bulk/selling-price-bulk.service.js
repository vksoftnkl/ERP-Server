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
const ITEM_PRICE_TABLE_NAME = 'item price master';
const ITEM_PRICE_AUDIT_SCREEN_NAME = 'Item Price Master';
const AUDIT_SCREEN_NAME = 'Change Selling Price';
let SellingPriceBulkService = class SellingPriceBulkService {
    prisma;
    auditLogService;
    requestContext;
    appSettingValueService;
    gateway;
    constructor(prisma, auditLogService, requestContext, appSettingValueService, gateway) {
        this.prisma = prisma;
        this.auditLogService = auditLogService;
        this.requestContext = requestContext;
        this.appSettingValueService = appSettingValueService;
        this.gateway = gateway;
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
        this.assertScopeAllowed(dto.scope);
        const confirmed = dto.confirmed === true;
        const policy = await this.resolveBelowCostPolicy(dto);
        const actor = (0, module_service_utils_1.resolveActor)(dto.userId, this.requestContext.getUserId());
        return this.prisma.$transaction(async (tx) => {
            const taxRates = await this.resolveItemTaxRates(tx, dto.rows.map((row) => row.itemId));
            const costs = await this.gateway.loadRowCosts(tx, dto.rows.map((row) => ({
                itemId: row.itemId,
                uomId: row.uomId,
                mrp: row.mrp ?? null,
                salePrice: row.salePrice ?? null,
            })), dto.companyId, dto.branchId);
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
                applied.push(await this.applyBucketPrice(tx, candidates[index], resolutions[index]));
            }
            const ipmIds = applied.map((row) => row.ipmId);
            const noStock = await this.gateway.listNoStock(tx, ipmIds, dto.companyId, dto.branchId);
            await this.auditWrites(tx, dto, applied, {
                actor,
                confirmedBelowCost: confirmed ? belowCost : [],
            });
            return {
                saved: ipmIds.length,
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
            parts.push(`${result.saved} price${result.saved === 1 ? '' : 's'} saved`);
        }
        if (!parts.length) {
            parts.push('Nothing to save');
        }
        if (result.noStock.length) {
            parts.push(`${result.noStock.length} ${result.noStock.length === 1 ? 'has' : 'have'} no stock on hand — the price applies when stock arrives`);
        }
        return `${parts.join(' · ')}.`;
    }
    async applyBucketPrice(tx, candidate, scope) {
        const existing = await this.gateway.findBucketRowForUpdate(tx, candidate, scope);
        if (!existing) {
            return {
                ipmId: await this.gateway.insertBucketPrice(tx, candidate, scope),
                before: null,
                lineNo: candidate.lineNo,
                itemName: candidate.itemName,
            };
        }
        const [before] = (await this.gateway.snapshotRows(tx, [existing.ipmId])).values();
        return {
            ipmId: await this.gateway.updateBucketPrice(tx, existing.ipmId, candidate),
            before: before ?? null,
            lineNo: candidate.lineNo,
            itemName: candidate.itemName,
        };
    }
    async auditWrites(tx, dto, applied, context) {
        const after = await this.gateway.snapshotRows(tx, applied.map((row) => row.ipmId));
        const scopeLabel = dto.scope === 'CHAIN' ? 'all branches' : 'this branch';
        for (const row of applied) {
            const modified = after.get(row.ipmId) ?? null;
            const confirmed = context.confirmedBelowCost.filter((p) => p.lineNo === row.lineNo);
            const amount = (value) => (typeof value === 'number' ? value : null);
            const mrp = amount(modified?.ipm_bucket_mrp);
            const salePrice = amount(modified?.ipm_bucket_sp);
            const bucket = [
                mrp !== null ? `MRP ${mrp}` : null,
                salePrice !== null ? `sale price ${salePrice}` : null,
            ].filter(Boolean);
            await this.auditLogService.logEntityChange({
                action: row.before ? 'update' : 'New',
                tableName: ITEM_PRICE_TABLE_NAME,
                screenName: ITEM_PRICE_AUDIT_SCREEN_NAME,
                screenType: 'master',
                pk: row.ipmId,
                displayName: `${row.itemName} · ${bucket.length ? bucket.join(', ') : 'headline'}`,
                originalRecord: row.before,
                modifiedRecord: modified,
                userId: context.actor,
                notes: `${AUDIT_SCREEN_NAME} (menu 30), ${scopeLabel}` +
                    (confirmed.length
                        ? ` — confirmed below cost: ${confirmed.map((p) => p.message).join('; ')}`
                        : ''),
            }, tx);
        }
    }
    assertScopeAllowed(scope) {
        if (scope !== 'CHAIN' || (0, selling_price_bulk_types_1.isHqUserType)(this.requestContext.getUserType())) {
            return;
        }
        (0, module_service_utils_1.throwStockForbidden)('These prices cannot be saved', [
            {
                field: 'scope',
                message: 'Only an HQ user may save prices for all branches. Save at This branch scope instead.',
            },
        ]);
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
            costRate: cost.costRate,
            costWot: cost.costWot,
            actor,
            levels: row.levels.map((level) => {
                const value = (0, selling_price_math_helper_1.recomputeLevel)(level.level, level.price, taxPerc, cost.costRate);
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
        return records.map((record, index) => {
            const tax = taxRates.get(record.itemId);
            const taxPerc = tax?.taxPerc ?? 0;
            return {
                lineNo: offset + index + 1,
                itemId: record.itemId,
                itemCode: record.itemCode,
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
                minPrice: record.minPrice,
                roundOff: record.roundOff,
                taxPerc,
                inclTax: tax?.inclTax ?? false,
                hasCess: tax?.hasCess ?? false,
                levels: selling_price_bulk_types_1.PRICE_LEVELS.map((level) => (0, selling_price_math_helper_1.recomputeLevel)(level, record.prices[level - 1], taxPerc, record.costRate)),
            };
        });
    }
    throwProblems(problems, message) {
        (0, module_service_utils_1.throwStockUnprocessable)(message, problems.map((problem) => ({
            field: `rows.${problem.lineNo}`,
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
        price_bucket_gateway_1.PriceBucketGateway])
], SellingPriceBulkService);
//# sourceMappingURL=selling-price-bulk.service.js.map