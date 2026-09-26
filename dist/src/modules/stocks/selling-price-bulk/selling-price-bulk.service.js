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
const items_price_master_service_1 = require("../../Inventory/items-price-master/items-price-master.service");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const list_selling_price_query_dto_1 = require("./dto/list-selling-price-query.dto");
const below_cost_policy_helper_1 = require("./below-cost-policy.helper");
const selling_price_math_helper_1 = require("./selling-price-math.helper");
const selling_price_scope_helper_1 = require("./selling-price-scope.helper");
const stock_mrp_price_gateway_1 = require("./stock-mrp-price.gateway");
const selling_price_bulk_types_1 = require("./types/selling-price-bulk.types");
const SMP_TABLE_NAME = 'stock_mrp_price';
const AUDIT_SCREEN_NAME = 'Change Selling Price';
const HEADLINE_PROFIT_TYPE = 'By User';
let SellingPriceBulkService = class SellingPriceBulkService {
    prisma;
    auditLogService;
    requestContext;
    appSettingValueService;
    itemsPriceMasterService;
    gateway;
    constructor(prisma, auditLogService, requestContext, appSettingValueService, itemsPriceMasterService, gateway) {
        this.prisma = prisma;
        this.auditLogService = auditLogService;
        this.requestContext = requestContext;
        this.appSettingValueService = appSettingValueService;
        this.itemsPriceMasterService = itemsPriceMasterService;
        this.gateway = gateway;
    }
    async listPrices(queryDto) {
        const limit = Math.min(queryDto.limit ?? list_selling_price_query_dto_1.DEFAULT_PRICE_GRID_LIMIT, list_selling_price_query_dto_1.MAX_PRICE_GRID_LIMIT);
        const offset = Math.max(queryDto.offset ?? 0, 0);
        return this.gateway.listPrices({
            companyId: queryDto.companyId,
            branchId: queryDto.branchId,
            itemGroupId: queryDto.itemGroupId,
            itemBrandId: queryDto.itemBrandId,
            itemSectionId: queryDto.itemSectionId,
            supplierId: queryDto.supplierId,
            limit,
            offset,
        });
    }
    async listBuckets(itemId, queryDto) {
        return this.gateway.listBuckets(itemId, queryDto.companyId, queryDto.branchId);
    }
    async saveBulk(dto) {
        this.assertScopeAllowed(dto.scope);
        const confirmed = dto.confirmed === true;
        const policy = await this.resolveBelowCostPolicy(dto);
        const actor = (0, module_service_utils_1.resolveActor)(dto.userId, this.requestContext.getUserId());
        return this.prisma.$transaction(async (tx) => {
            const taxRates = await this.resolveItemTaxRates(tx, dto.rows.map((row) => row.itemId));
            const masterRows = await this.loadMasterPriceRows(tx, dto);
            const identities = await this.loadItemIdentities(tx, dto.rows.map((row) => row.itemId));
            const bucketRows = [];
            const headlineRows = [];
            for (const row of dto.rows) {
                (this.isHeadlineRow(row) ? headlineRows : bucketRows).push(row);
            }
            const resolutions = bucketRows.map((row) => (0, selling_price_scope_helper_1.resolveTargetScope)(dto.scope, this.rowScopeOf(row), dto.branchId));
            const candidates = bucketRows.map((row, index) => this.toCandidate(row, index, dto.companyId, actor, taxRates, masterRows));
            const problems = [
                ...(candidates.length ? await this.gateway.validateRows(tx, candidates, resolutions) : []),
                ...this.validateHeadlineRows(headlineRows, taxRates, masterRows, identities),
            ];
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
            const smpIds = [];
            for (let index = 0; index < candidates.length; index += 1) {
                smpIds.push(await this.applyBucketPrice(tx, candidates[index], resolutions[index]));
            }
            const masterRowsSaved = await this.fanOutHeadlineRows(tx, dto, headlineRows, taxRates, masterRows, actor);
            const noStock = smpIds.length ? await this.gateway.listNoStock(tx, smpIds, dto.branchId) : [];
            await this.auditLogService.logEntityChange({
                action: 'update',
                tableName: SMP_TABLE_NAME,
                screenName: AUDIT_SCREEN_NAME,
                screenType: 'transaction',
                pk: smpIds[0] ?? dto.rows[0].itemId,
                displayName: `${dto.scope === 'CHAIN' ? 'All branches' : 'This branch'} · ${smpIds.length + masterRowsSaved} rows`,
                originalRecord: null,
                modifiedRecord: {
                    scope: dto.scope,
                    bucketRows: smpIds.length,
                    masterRows: masterRowsSaved,
                    belowCostPolicy: policy,
                    confirmedBelowCost: confirmed && belowCost.length > 0,
                    belowCostRows: confirmed ? belowCost : [],
                },
                userId: actor,
                notes: confirmed && belowCost.length
                    ? `Selling prices saved with ${belowCost.length} row(s) confirmed below cost`
                    : 'Selling prices saved',
            }, tx);
            return {
                saved: smpIds.length,
                masterRowsSaved,
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
            parts.push(`${result.saved} bucket${result.saved === 1 ? '' : 's'} saved`);
        }
        if (result.masterRowsSaved) {
            parts.push(`${result.masterRowsSaved} headline row${result.masterRowsSaved === 1 ? '' : 's'} saved`);
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
        return existing
            ? this.gateway.updateBucketPrice(tx, existing.smpId, candidate)
            : this.gateway.insertBucketPrice(tx, candidate, scope);
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
    isHeadlineRow(row) {
        return (row.mrp ?? null) === null && (row.salePrice ?? null) === null;
    }
    rowScopeOf(row) {
        return row.priceScope ?? null;
    }
    toCandidate(row, index, companyId, actor, taxRates, masterRows) {
        const prepared = this.prepareRow(row, index, taxRates, masterRows);
        return {
            lineNo: prepared.lineNo,
            companyId,
            itemId: prepared.itemId,
            uomId: prepared.uomId,
            bucketId: prepared.bucketId,
            mrp: prepared.mrp,
            salePrice: prepared.salePrice,
            minPrice: prepared.minPrice,
            roundOff: prepared.roundOff,
            actor,
            levels: prepared.levels.map((level) => ({
                level: level.level,
                price: level.price,
                priceWot: level.priceWot,
                markupPerc: level.markupPerc,
            })),
        };
    }
    prepareRow(row, index, taxRates, masterRows) {
        const tax = taxRates.get(row.itemId);
        const taxPerc = tax?.taxPerc ?? 0;
        const costRate = masterRows.get(this.masterKey(row))?.costRate ?? 0;
        return {
            lineNo: row.lineNo ?? index + 1,
            itemId: row.itemId,
            uomId: row.uomId,
            bucketId: row.bucketId ?? null,
            mrp: row.mrp ?? null,
            salePrice: row.salePrice ?? null,
            minPrice: row.minPrice ?? null,
            roundOff: row.roundOff ?? null,
            taxPerc,
            costRate,
            levels: row.levels.map((level) => (0, selling_price_math_helper_1.recomputeLevel)(level.level, level.price, taxPerc, costRate)),
        };
    }
    validateHeadlineRows(rows, taxRates, masterRows, identities) {
        const problems = [];
        rows.forEach((row, index) => {
            const master = masterRows.get(this.masterKey(row));
            const prepared = this.prepareRow(row, index, taxRates, masterRows);
            const minPrice = row.minPrice ?? master?.minPrice ?? 0;
            for (const level of prepared.levels) {
                if (minPrice > 0 && level.price < minPrice) {
                    problems.push(this.problem(prepared, identities, level.level, 'BELOW_MIN', `${level.price} is below the minimum price ${minPrice}.`));
                    continue;
                }
                if (prepared.costRate > 0 && level.price < prepared.costRate) {
                    problems.push(this.problem(prepared, identities, level.level, 'BELOW_COST', `${level.price} is below the cost ${prepared.costRate}.`));
                }
            }
        });
        return problems;
    }
    problem(prepared, identities, level, verdict, message) {
        const identity = identities.get(prepared.itemId);
        return {
            lineNo: prepared.lineNo,
            itemId: prepared.itemId,
            itemCode: identity?.itemCode ?? null,
            itemName: identity?.itemName ?? '',
            uomId: prepared.uomId,
            bucketId: prepared.bucketId,
            level,
            verdict,
            message: identity ? `${identity.itemName}: ${message}` : message,
        };
    }
    async loadItemIdentities(tx, itemIds) {
        const ids = [...new Set(itemIds)];
        if (!ids.length) {
            return new Map();
        }
        const records = await tx.itemMaster.findMany({
            where: { itemId: { in: ids } },
            select: { itemId: true, itemCode: true, itemNameEn: true },
        });
        return new Map(records.map((record) => [
            record.itemId,
            { itemCode: record.itemCode, itemName: record.itemNameEn },
        ]));
    }
    throwProblems(problems, message) {
        (0, module_service_utils_1.throwStockUnprocessable)(message, problems.map((problem) => ({
            field: `rows.${problem.lineNo}`,
            message: `Line ${problem.lineNo}: ${problem.message}`,
        })));
    }
    async fanOutHeadlineRows(tx, dto, rows, taxRates, masterRows, actor) {
        if (!rows.length) {
            return 0;
        }
        const payloads = rows.map((row, index) => {
            const prepared = this.prepareRow(row, index, taxRates, masterRows);
            const existing = masterRows.get(this.masterKey(row));
            const payload = {
                ...(existing ? { ipm_id: existing.ipmId } : {}),
                ipm_company_id: dto.companyId,
                ipm_branch_id: dto.scope === 'CHAIN' ? null : dto.branchId,
                ipm_item_id: prepared.itemId,
                ipm_uc_unit_id: prepared.uomId,
                ipm_profit_type: HEADLINE_PROFIT_TYPE,
                ipm_updated_by: actor,
                ...(existing ? {} : { ipm_created_by: actor }),
            };
            if (prepared.minPrice !== null) {
                payload.ipm_min_price = prepared.minPrice;
            }
            if (prepared.roundOff !== null) {
                payload.ipm_round_off = prepared.roundOff;
            }
            for (const level of prepared.levels) {
                this.applyLevelColumns(payload, level);
            }
            return payload;
        });
        const saved = await this.itemsPriceMasterService.save(payloads, tx);
        return saved.length;
    }
    applyLevelColumns(payload, level) {
        switch (selling_price_bulk_types_1.LEVEL_COLUMN_SUFFIX[level.level]) {
            case 'a':
                payload.ipm_sales_price_a = level.price;
                payload.ipm_price_a_wot = level.priceWot;
                payload.ipm_price_a_markup_perc = level.markupPerc;
                return;
            case 'b':
                payload.ipm_sales_price_b = level.price;
                payload.ipm_price_b_wot = level.priceWot;
                payload.ipm_price_b_markup_perc = level.markupPerc;
                return;
            case 'c':
                payload.ipm_sales_price_c = level.price;
                payload.ipm_price_c_wot = level.priceWot;
                payload.ipm_price_c_markup_perc = level.markupPerc;
                return;
            case 'd':
                payload.ipm_sales_price_d = level.price;
                payload.ipm_price_d_wot = level.priceWot;
                payload.ipm_price_d_markup_perc = level.markupPerc;
                return;
        }
    }
    async loadMasterPriceRows(tx, dto) {
        const itemIds = [...new Set(dto.rows.map((row) => row.itemId))];
        const uomIds = [...new Set(dto.rows.map((row) => row.uomId))];
        const records = await tx.itemPriceMaster.findMany({
            where: {
                ipmItemId: { in: itemIds },
                ipmUcUnitId: { in: uomIds },
                ipmCompanyId: dto.companyId,
                ipmBranchId: dto.scope === 'CHAIN' ? null : dto.branchId,
                ipmGodownId: null,
                ipmIsDeleted: false,
            },
            select: {
                ipmId: true,
                ipmItemId: true,
                ipmUcUnitId: true,
                ipmCostPrice: true,
                ipmMinPrice: true,
            },
        });
        const map = new Map();
        for (const record of records) {
            map.set(`${record.ipmItemId}|${record.ipmUcUnitId}`, {
                ipmId: record.ipmId,
                costRate: (0, module_service_utils_1.toNumber)(record.ipmCostPrice),
                minPrice: (0, module_service_utils_1.toNumber)(record.ipmMinPrice),
            });
        }
        return map;
    }
    masterKey(row) {
        return `${row.itemId}|${row.uomId}`;
    }
    async resolveItemTaxRates(tx, itemIds, asOf = new Date()) {
        const ids = [...new Set(itemIds)];
        if (!ids.length) {
            return new Map();
        }
        const asOfDate = new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate()));
        const items = await tx.itemMaster.findMany({
            where: { itemId: { in: ids } },
            select: { itemId: true, itemDefaultTaxId: true, itemInclTax: true },
        });
        const history = await tx.itemTaxHistory.findMany({
            where: {
                ithItemId: { in: ids },
                ithEffectiveFrom: { lte: asOfDate },
                OR: [{ ithEffectiveTo: null }, { ithEffectiveTo: { gte: asOfDate } }],
            },
            orderBy: [{ ithItemId: 'asc' }, { ithEffectiveFrom: 'desc' }],
            select: { ithItemId: true, ithTaxId: true },
        });
        const historyTaxId = new Map();
        for (const row of history) {
            if (!historyTaxId.has(row.ithItemId)) {
                historyTaxId.set(row.ithItemId, row.ithTaxId);
            }
        }
        const taxIds = [
            ...new Set([
                ...historyTaxId.values(),
                ...items.map((item) => item.itemDefaultTaxId).filter((id) => !!id),
            ].filter(Boolean)),
        ];
        const taxes = taxIds.length
            ? await tx.itemTaxMaster.findMany({
                where: { taxId: { in: taxIds } },
                select: {
                    taxId: true,
                    taxGstRateTotal: true,
                    taxCessType: true,
                    taxCessPerc: true,
                    taxCessUnit: true,
                },
            })
            : [];
        const taxById = new Map(taxes.map((tax) => [tax.taxId, tax]));
        const result = new Map();
        for (const item of items) {
            const taxId = historyTaxId.get(item.itemId) ?? item.itemDefaultTaxId ?? null;
            const tax = taxId ? taxById.get(taxId) : undefined;
            result.set(item.itemId, {
                itemId: item.itemId,
                taxId,
                taxPerc: tax ? (0, module_service_utils_1.toNumber)(tax.taxGstRateTotal) : 0,
                inclTax: item.itemInclTax,
                hasCess: tax
                    ? tax.taxCessType !== 'NONE' ||
                        (0, module_service_utils_1.toNumber)(tax.taxCessPerc) > 0 ||
                        (0, module_service_utils_1.toNumber)(tax.taxCessUnit) > 0
                    : false,
            });
        }
        return result;
    }
};
exports.SellingPriceBulkService = SellingPriceBulkService;
exports.SellingPriceBulkService = SellingPriceBulkService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_log_service_1.AuditLogService,
        request_context_service_1.RequestContextService,
        app_setting_value_service_1.AppSettingValueService,
        items_price_master_service_1.ItemsPriceMasterService,
        stock_mrp_price_gateway_1.StockMrpPriceGateway])
], SellingPriceBulkService);
//# sourceMappingURL=selling-price-bulk.service.js.map