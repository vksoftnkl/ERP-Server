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
exports.CostPriceBulkService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const audit_log_service_1 = require("../../audit-log/audit-log.service");
const app_setting_value_service_1 = require("../../settings/appSettings/app-setting-value.service");
const rights_1 = require("../../../common/posting/rights");
const price_master_writer_service_1 = require("../../Inventory/item-price-log/price-master-writer.service");
const price_change_log_types_1 = require("../../Inventory/item-price-log/types/price-change-log.types");
const item_tax_rate_helper_1 = require("../../Inventory/utils/item-tax-rate.helper");
const below_cost_policy_helper_1 = require("../selling-price-bulk/below-cost-policy.helper");
const selling_price_bulk_types_1 = require("../selling-price-bulk/types/selling-price-bulk.types");
const cost_price_bulk_gateway_1 = require("./cost-price-bulk.gateway");
const cost_price_bulk_rules_1 = require("./cost-price-bulk.rules");
const cost_price_bulk_types_1 = require("./types/cost-price-bulk.types");
const ITEM_PRICE_TABLE_NAME = 'item price master';
const ITEM_PRICE_AUDIT_SCREEN_NAME = 'Item Price Master';
const AUDIT_SCREEN_NAME = 'Cost Price – Bulk Change';
const TX = { timeout: 120_000, maxWait: 10_000 };
const READ_TX = { timeout: 60_000, maxWait: 10_000 };
const num = (value) => (value ? value.toNumber() : 0);
const ZERO = new client_1.Prisma.Decimal(0);
function dayDate(day) {
    return new Date(`${day}T00:00:00.000Z`);
}
let CostPriceBulkService = class CostPriceBulkService {
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
    async list(query) {
        const rights = await this.assertRight('view', 'open Cost Price – Bulk Change');
        const policy = await this.belowCostPolicy(query.companyId, query.branchId);
        const limit = query.limit ?? cost_price_bulk_types_1.DEFAULT_COST_BULK_PAGE;
        const page = query.page ?? 1;
        const offset = (page - 1) * limit;
        const filter = {
            companyId: query.companyId,
            branchId: query.branchId,
            groupId: query.groupId,
            itemCategoryId: query.itemCategoryId,
            brandId: query.brandId,
            sectionId: query.sectionId,
            supplierId: query.supplierId,
            profitType: query.profitType,
            priceListOnly: query.priceListOnly,
            itemId: query.itemId,
        };
        return this.prisma.$transaction(async (tx) => {
            await tx.$executeRaw `SET LOCAL plan_cache_mode = force_custom_plan`;
            const today = await this.gateway.today(tx);
            if (query.itemId) {
                await this.assertItemMayLoad(tx, query.companyId, query.branchId, query.itemId);
            }
            const grid = await this.gateway.listGrid(tx, filter, { limit, offset });
            const left = page === 1
                ? await this.gateway.listLeftOut(tx, filter, cost_price_bulk_types_1.MAX_LEFT_OUT)
                : {
                    rows: [],
                    total: 0,
                    counts: { NOT_PLAIN_STOCK: 0, OLD_BATCH_TICK: 0, NO_PRICE_ROW: 0, INACTIVE: 0 },
                };
            if (query.itemId && grid.total === 0 && left.counts.NO_PRICE_ROW > 0) {
                const unit = left.rows.find((row) => row.reason === 'NO_PRICE_ROW');
                this.refuseItem(cost_price_bulk_types_1.COST_BULK.NO_PRICE_ROW, 'NO_PRICE_ROW', `${[unit?.itemCode, unit?.itemName].filter(Boolean).join(' ')} has no price in force today at this branch. Set its prices on the item card first.`, (0, cost_price_bulk_rules_1.trackedAsOf)(unit?.presetName));
            }
            const taxes = await (0, item_tax_rate_helper_1.resolveItemTaxRates)(tx, grid.rows.map((row) => row.itemId), dayDate(today));
            const levels = await this.gateway.levels(tx);
            return {
                items: grid.rows.map((row, index) => this.toRow(row, offset + index + 1, taxes.get(row.itemId), levels)),
                total: grid.total,
                totalItems: grid.totalItems,
                page,
                limit,
                leftOut: left.rows.map((row) => {
                    const trackedAs = (0, cost_price_bulk_rules_1.trackedAsOf)(row.presetName);
                    return {
                        itemId: row.itemId,
                        itemCode: row.itemCode,
                        itemName: row.itemName,
                        unitName: row.unitName,
                        uomId: row.uomId,
                        trackedAs,
                        reasonCode: row.reason,
                        reason: (0, cost_price_bulk_rules_1.leftOutReasonText)(row.reason, trackedAs),
                    };
                }),
                leftOutTotal: left.total,
                leftOutCounts: left.counts,
                today,
                belowCostPolicy: policy,
                rights,
            };
        }, READ_TX);
    }
    async assertItemMayLoad(tx, companyId, branchId, itemId) {
        const item = await this.gateway.findItem(tx, companyId, branchId, itemId);
        if (!item) {
            (0, module_service_utils_1.throwStockNotFound)('Item not found', 'itemId', `No live item ${itemId} at this company and branch.`, cost_price_bulk_types_1.COST_BULK_ITEM_NOT_FOUND);
        }
        const reason = (0, cost_price_bulk_rules_1.leftOutReasonOf)({
            isActive: item.isActive,
            isBatchBased: item.isBatchBased,
            presetTracks: item.presetTracks,
        });
        if (!reason) {
            return;
        }
        const trackedAs = (0, cost_price_bulk_rules_1.trackedAsOf)(item.presetName);
        const name = [item.itemCode, item.itemName].filter(Boolean).join(' ');
        const message = reason === 'INACTIVE'
            ? `${name} is inactive.`
            : reason === 'OLD_BATCH_TICK'
                ? `${name} has the old "batch" tick on, so it is treated as batch. Cost Price – Bulk Change changes Plain stock items only. Change this item on Change Selling Price (menu 30).`
                : `${name} is tracked as ${trackedAs}. Cost Price – Bulk Change changes Plain stock items only. Change this item on Change Selling Price (menu 30).`;
        this.refuseItem(cost_price_bulk_types_1.LEFT_OUT_CODE[reason], reason, message, trackedAs);
    }
    refuseItem(code, reasonCode, message, trackedAs) {
        (0, module_service_utils_1.throwStockUnprocessable)(message, [{ field: 'itemId', code, message, reasonCode, trackedAs }]);
    }
    async validate(dto) {
        const rights = await this.assertRight('edit', 'change costs in Cost Price – Bulk Change');
        this.assertShape(dto);
        const ctx = await this.contextOf(dto);
        const plans = await this.prisma.$transaction((tx) => this.evaluate(tx, dto, ctx, false), READ_TX);
        const overrides = dto.overrides ?? [];
        const refusals = plans.flatMap((plan) => plan.refusals);
        const warnings = plans.flatMap((plan) => plan.warnings);
        return {
            ok: (0, cost_price_bulk_rules_1.blockingNotes)(plans, overrides).length === 0,
            refusals,
            warnings,
            rights,
            counts: (0, cost_price_bulk_rules_1.countsOf)(plans),
            belowCostPolicy: ctx.belowCostPolicy,
        };
    }
    async save(dto) {
        const rights = await this.assertRight('edit', 'change costs in Cost Price – Bulk Change');
        this.assertShape(dto);
        const ctx = await this.contextOf(dto);
        const overrides = dto.overrides ?? [];
        return this.prisma.$transaction(async (tx) => {
            const plans = await this.evaluate(tx, dto, ctx, true);
            const blocking = (0, cost_price_bulk_rules_1.blockingNotes)(plans, overrides);
            const refusals = plans.flatMap((plan) => plan.refusals);
            const warnings = plans.flatMap((plan) => plan.warnings);
            if (blocking.length) {
                throw new common_1.HttpException({
                    success: false,
                    message: refusals.length
                        ? 'These prices cannot be saved'
                        : 'Tick the warnings to save these prices',
                    errors: blocking.map((n) => ({
                        field: n.field,
                        code: n.code,
                        message: n.message,
                        line: n.line,
                        level: n.level,
                    })),
                    refusals,
                    warnings,
                }, common_1.HttpStatus.UNPROCESSABLE_ENTITY);
            }
            const written = plans.filter((plan) => plan.changed && plan.write !== null);
            const inPlace = written.filter((plan) => !plan.companyCopy);
            const copies = written.filter((plan) => plan.companyCopy);
            const { before, after } = await this.writer.rewritePriceRows(tx, price_change_log_types_1.PRICE_ORIGIN.BULK_COST_CHANGE, inPlace.map((plan) => ({ ...plan.write, reason: (0, cost_price_bulk_rules_1.tickedReason)(plan) })), ctx.actor);
            const copied = await this.writer.insertCompanyPriceRows(tx, price_change_log_types_1.PRICE_ORIGIN.BULK_COST_CHANGE, dto.companyId, copies.map((plan) => ({ ...plan.write, reason: (0, cost_price_bulk_rules_1.tickedReason)(plan) })), ctx.actor);
            const stored = ctx.stored;
            for (const plan of written) {
                const row = stored.get(plan.ipmId);
                const ticked = plan.warnings.filter((w) => (0, cost_price_bulk_rules_1.isOverridden)(w, overrides));
                const copy = plan.companyCopy ? copied.get(plan.ipmId) : undefined;
                await this.auditLogService.logEntityChange({
                    action: copy ? 'New' : 'update',
                    tableName: ITEM_PRICE_TABLE_NAME,
                    screenName: ITEM_PRICE_AUDIT_SCREEN_NAME,
                    screenType: 'master',
                    pk: copy ? copy.ipmId : plan.ipmId,
                    entityId: row.itemId,
                    displayName: `${[row.itemCode, row.itemName].filter(Boolean).join(' ')} · ${row.unitName ?? ''}`.trim(),
                    originalRecord: copy ? null : (before.get(plan.ipmId) ?? null),
                    modifiedRecord: copy ? copy.after : (after.get(plan.ipmId) ?? null),
                    userId: ctx.actor,
                    branchId: dto.branchId,
                    notes: `${AUDIT_SCREEN_NAME} (menu ${cost_price_bulk_types_1.COST_BULK_MENU_ID}), ${row.isChain ? 'all branches' : 'this branch'}` +
                        (copy ? ` — this company's own row, copied from the shared row ${plan.ipmId}` : '') +
                        ` — cost ${(0, cost_price_bulk_rules_1.money)(row.costPrice)} → ${(0, cost_price_bulk_rules_1.money)(plan.write.costPrice)}` +
                        (ticked.length
                            ? ` — warnings ticked: ${ticked.map((w) => `${w.code} (${w.message})`).join('; ')}`
                            : ''),
                }, tx);
            }
            const itemIds = [...new Set([...stored.values()].map((row) => row.itemId))];
            const readBack = await this.gateway.listGrid(tx, { companyId: dto.companyId, branchId: dto.branchId, itemIds }, { limit: 100_000, offset: 0 });
            const today = await this.gateway.today(tx);
            const taxes = await (0, item_tax_rate_helper_1.resolveItemTaxRates)(tx, itemIds, dayDate(today));
            const levels = await this.gateway.levels(tx);
            const byId = new Map(readBack.rows.map((row) => [row.ipmId, row]));
            const writtenIds = new Set(written.map((plan) => plan.ipmId));
            const rows = [];
            for (const input of dto.rows) {
                const copy = copied.get(input.ipmId);
                const record = byId.get(copy ? copy.ipmId : input.ipmId);
                if (record) {
                    rows.push({
                        ...this.toRow(record, input.lineNo, taxes.get(record.itemId), levels),
                        written: writtenIds.has(input.ipmId),
                        sourceIpmId: input.ipmId,
                        companyCopy: copy !== undefined,
                    });
                }
            }
            const counts = (0, cost_price_bulk_rules_1.countsOf)(plans);
            return {
                saved: written.length,
                unchanged: counts.unchanged,
                rows,
                warnings,
                refusals: [],
                rights,
                counts,
                belowCostPolicy: ctx.belowCostPolicy,
            };
        }, TX);
    }
    buildSaveMessage(result) {
        const parts = [`${result.saved} price row${result.saved === 1 ? '' : 's'} saved`];
        if (result.unchanged) {
            parts.push(`${result.unchanged} unchanged`);
        }
        const slabItems = new Set(result.rows.filter((row) => row.hasQtySlabs).map((row) => row.itemId));
        if (slabItems.size) {
            parts.push(`${slabItems.size} item${slabItems.size === 1 ? ' has' : 's have'} qty-wise prices, left as they are`);
        }
        return `${parts.join(' · ')}.`;
    }
    assertShape(dto) {
        if (dto.rows.length > cost_price_bulk_types_1.MAX_COST_BULK_ROWS) {
            (0, module_service_utils_1.throwStockUnprocessable)(`One save takes up to ${cost_price_bulk_types_1.MAX_COST_BULK_ROWS} rows; this one has ${dto.rows.length}.`, [
                {
                    field: 'rows',
                    code: cost_price_bulk_types_1.COST_BULK.TOO_MANY_ROWS,
                    message: `One save takes up to ${cost_price_bulk_types_1.MAX_COST_BULK_ROWS} rows (${dto.rows.length} sent). Save in parts of ${cost_price_bulk_types_1.MAX_COST_BULK_ROWS}.`,
                },
            ]);
        }
        const seen = new Set();
        for (const row of dto.rows) {
            if (seen.has(row.lineNo)) {
                (0, module_service_utils_1.throwStockBadRequest)('Validation failed', [
                    {
                        field: 'rows',
                        code: 'VALIDATION_ARRAY_UNIQUE',
                        message: `Line ${row.lineNo} is sent twice; every row needs its own lineNo.`,
                    },
                ]);
            }
            seen.add(row.lineNo);
        }
    }
    async contextOf(dto) {
        return {
            isHq: (0, selling_price_bulk_types_1.isHqUserType)(this.requestContext.getUserType()),
            belowCostPolicy: await this.belowCostPolicy(dto.companyId, dto.branchId),
            actor: (0, module_service_utils_1.resolveActor)(undefined, this.requestContext.getUserId()),
            stored: new Map(),
        };
    }
    async evaluate(tx, dto, ctx, lock) {
        const stored = await this.gateway.readRowsForSave(tx, dto.companyId, dto.branchId, dto.rows.map((row) => row.ipmId), lock);
        ctx.stored = stored;
        const today = await this.gateway.today(tx);
        const taxes = await (0, item_tax_rate_helper_1.resolveItemTaxRates)(tx, [...new Set([...stored.values()].map((row) => row.itemId))], dayDate(today));
        const levels = await this.gateway.levels(tx);
        const levelNames = levels.map((level) => level.name);
        const levelActive = levels.map((level) => level.active);
        return dto.rows.map((row, index) => {
            const record = stored.get(row.ipmId) ?? null;
            return (0, cost_price_bulk_rules_1.planRow)({
                index,
                lineNo: row.lineNo,
                ipmId: row.ipmId,
                rowToken: row.rowToken,
                costPrice: (0, cost_price_bulk_rules_1.dec)(row.costPrice),
                mrp: row.mrp === undefined || row.mrp === null ? null : (0, cost_price_bulk_rules_1.dec)(row.mrp),
                minPrice: row.minPrice === undefined || row.minPrice === null ? null : (0, cost_price_bulk_rules_1.dec)(row.minPrice),
                profitType: row.profitType ?? null,
                levels: row.levels?.map((level) => ({ level: level.level, price: (0, cost_price_bulk_rules_1.dec)(level.price) })),
            }, record ? toStored(record) : null, {
                taxPerc: (0, cost_price_bulk_rules_1.dec)(record ? (taxes.get(record.itemId)?.taxPerc ?? 0) : 0),
                isHq: ctx.isHq,
                belowCostPolicy: ctx.belowCostPolicy,
                levelNames,
                levelActive,
                actor: ctx.actor,
            });
        });
    }
    async assertRight(right, action) {
        const rights = await (0, rights_1.assertMenuRight)(this.prisma, {
            userId: this.requestContext.getUserId(),
            menuId: cost_price_bulk_types_1.COST_BULK_MENU_ID,
            right,
            codePrefix: cost_price_bulk_types_1.COST_BULK_RIGHT_PREFIX,
            action,
        });
        return { view: rights.view, edit: rights.edit, override: rights.edit };
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
    toRow(record, lineNo, tax, levels) {
        const link = (0, cost_price_bulk_rules_1.unitLink)({
            parentToBase: record.parentToBase,
            toBase: record.toBase,
            unitFactor: record.unitFactor,
        });
        const level = (n, price, wot, markup) => ({
            level: n,
            price: num(price),
            priceWot: num(wot),
            markupPerc: num(markup),
            active: levels[n - 1]?.active ?? false,
        });
        return {
            lineNo,
            ipmId: record.ipmId,
            itemId: record.itemId,
            itemCode: record.itemCode,
            itemName: record.itemName,
            barcode: record.barcode,
            uomId: record.uomId,
            unitName: record.unitName,
            unitSlno: record.unitSlno,
            parentUomId: record.parentUomId,
            parentUnitName: record.parentUnitName,
            unitsPerParent: link.unitsPerParent ? link.unitsPerParent.toNumber() : null,
            toBaseFactor: record.toBase.toNumber(),
            unitFactor: record.unitFactor.toNumber(),
            factorsAgree: link.factorsAgree,
            priceScope: record.priceBranchId ? 'BRANCH' : 'CHAIN',
            companyShared: record.companyShared,
            profitType: record.profitType ?? 'By User',
            roundOff: num(record.roundOff),
            taxPerc: tax?.taxPerc ?? 0,
            costPrice: num(record.costPrice),
            costWot: num(record.costWot),
            mrp: num(record.maxPrice),
            minPrice: num(record.minPrice),
            levels: [
                level(1, record.priceA, record.wotA, record.markupA),
                level(2, record.priceB, record.wotB, record.markupB),
                level(3, record.priceC, record.wotC, record.markupC),
                level(4, record.priceD, record.wotD, record.markupD),
            ],
            scheduledFrom: record.scheduledFrom,
            hasQtySlabs: record.hasQtySlabs,
            updatedOn: record.updatedOn,
            rowToken: record.rowToken ?? '',
        };
    }
};
exports.CostPriceBulkService = CostPriceBulkService;
exports.CostPriceBulkService = CostPriceBulkService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_log_service_1.AuditLogService,
        request_context_service_1.RequestContextService,
        app_setting_value_service_1.AppSettingValueService,
        cost_price_bulk_gateway_1.CostPriceBulkGateway,
        price_master_writer_service_1.PriceMasterWriter])
], CostPriceBulkService);
function toStored(record) {
    return {
        ipmId: record.ipmId,
        itemId: record.itemId,
        itemCode: record.itemCode,
        itemName: record.itemName,
        unitName: record.unitName,
        usable: record.usable,
        current: record.current,
        eligibility: {
            isActive: record.itemIsActive,
            isBatchBased: record.itemIsBatchBased,
            presetTracks: record.presetTracks,
        },
        isChain: record.isChain,
        companyShared: record.companyShared,
        rowToken: record.rowToken,
        costPrice: record.costPrice ?? ZERO,
        maxPrice: record.maxPrice ?? ZERO,
        minPrice: record.minPrice ?? ZERO,
        profitType: record.profitType,
        prices: [
            record.priceA ?? ZERO,
            record.priceB ?? ZERO,
            record.priceC ?? ZERO,
            record.priceD ?? ZERO,
        ],
    };
}
//# sourceMappingURL=cost-price-bulk.service.js.map