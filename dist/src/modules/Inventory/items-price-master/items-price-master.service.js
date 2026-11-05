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
exports.ItemsPriceMasterService = void 0;
const common_1 = require("@nestjs/common");
const configured_grid_sql_service_1 = require("../../../common/configured-grid-sql/configured-grid-sql.service");
const item_price_error_codes_1 = require("./types/item-price-error-codes");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const audit_log_service_1 = require("../../audit-log/audit-log.service");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const price_bucket_service_1 = require("./price-bucket.service");
const price_master_writer_service_1 = require("../item-price-log/price-master-writer.service");
const price_change_log_types_1 = require("../item-price-log/types/price-change-log.types");
const price_resolver_1 = require("./price-resolver");
const price_period_helper_1 = require("./price-period.helper");
const item_tax_rate_helper_1 = require("../utils/item-tax-rate.helper");
const selling_price_math_helper_1 = require("../../stocks/selling-price-bulk/selling-price-math.helper");
const item_child_helper_1 = require("../utils/item-child.helper");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const module_list_utils_1 = require("../../../common/utils/module-list.utils");
const DEFAULT_AUDIT_ACTOR = 'system';
const ITEM_PRICE_TABLE_NAME = 'item price master';
const ITEM_PRICE_AUDIT_SCREEN_NAME = 'Item Price Master';
const CHECK_MESSAGES = {
    ck_ipm_not_above_mrp: {
        field: 'ipm_max_price',
        code: item_price_error_codes_1.ItemPriceErrorCode.ABOVE_MRP,
        message: 'A price for one MRP cannot be above that MRP. Lower the selling price, or correct the MRP.',
    },
    ck_ipm_bucket_mrp_is_max: {
        field: 'ipm_max_price',
        code: item_price_error_codes_1.ItemPriceErrorCode.MRP_BUCKET_MISMATCH,
        message: "A price row's MRP bucket and its MRP must be the same figure.",
    },
    ck_ipm_bucket_mrp: {
        field: 'ipm_max_price',
        code: item_price_error_codes_1.ItemPriceErrorCode.MRP_BUCKET_NOT_POSITIVE,
        message: 'An MRP bucket must be above zero.',
    },
    ck_ipm_bucket_sp: {
        field: 'ipm_sales_price_a',
        code: item_price_error_codes_1.ItemPriceErrorCode.SP_BUCKET_NOT_POSITIVE,
        message: 'A sale-price bucket must be above zero.',
    },
    ck_ipm_dates: {
        field: 'request',
        code: item_price_error_codes_1.ItemPriceErrorCode.DATES_REVERSED,
        message: 'A price cannot end before it starts.',
    },
    chk_ipm_nonnegative: {
        field: 'request',
        code: item_price_error_codes_1.ItemPriceErrorCode.NEGATIVE_FIGURE,
        message: 'Prices, charges and points cannot be negative.',
    },
};
let ItemsPriceMasterService = class ItemsPriceMasterService {
    prisma;
    auditLogService;
    configuredGridSqlService;
    requestContextService;
    priceBucketService;
    priceWriter;
    constructor(prisma, auditLogService, configuredGridSqlService, requestContextService, priceBucketService, priceWriter) {
        this.prisma = prisma;
        this.auditLogService = auditLogService;
        this.configuredGridSqlService = configuredGridSqlService;
        this.requestContextService = requestContextService;
        this.priceBucketService = priceBucketService;
        this.priceWriter = priceWriter;
    }
    async save(saveItemPriceDto, tx) {
        const saveItems = Array.isArray(saveItemPriceDto) ? saveItemPriceDto : [saveItemPriceDto];
        const saveAll = async (client) => {
            await (0, item_child_helper_1.assertItemsLive)(client, saveItems.map((item) => item.ipm_item_id), { field: 'ipm_item_id', code: item_price_error_codes_1.ItemPriceErrorCode.ITEM_NOT_LIVE });
            const savedItems = [];
            for (const saveItem of saveItems) {
                savedItems.push(await this.saveItemPrice(client, saveItem));
            }
            return savedItems;
        };
        try {
            const results = tx ? await saveAll(tx) : await this.prisma.$transaction(saveAll);
            return Array.isArray(saveItemPriceDto) ? results : results[0];
        }
        catch (error) {
            this.handleWriteError(error);
            throw error;
        }
    }
    async listPrices(queryDto) {
        const { page, limit, skip } = (0, module_list_utils_1.resolvePagination)(queryDto);
        const where = {
            ipmIsDeleted: false,
            ...(queryDto.ipm_item_id !== undefined && { ipmItemId: queryDto.ipm_item_id }),
            ...(queryDto.ipm_company_id !== undefined && { ipmCompanyId: queryDto.ipm_company_id }),
            ...(queryDto.ipm_branch_id !== undefined && { ipmBranchId: queryDto.ipm_branch_id }),
            ...(queryDto.ipm_is_active !== undefined && { ipmIsActive: queryDto.ipm_is_active }),
        };
        return (0, module_list_utils_1.runInventoryListQuery)({ page, limit }, {
            configuredGridFn: () => (0, module_list_utils_1.runConfiguredGridQuery)(this.configuredGridSqlService, {
                tableName: ITEM_PRICE_TABLE_NAME,
                alias: 'item_price_grid',
                search: queryDto.search,
                page,
                limit,
                skip,
            }),
            countFn: () => this.prisma.itemPriceMaster.count({ where }),
            findManyFn: () => this.prisma.itemPriceMaster.findMany({
                where,
                orderBy: [
                    { ipmItemId: 'asc' },
                    { ipmSlNo: 'asc' },
                    { itemUnitConversion: { iucUnitSlno: 'asc' } },
                    { ipmId: 'asc' },
                ],
                skip,
                take: limit,
            }),
            toItemFn: (record) => this.toPayload(record),
        });
    }
    async getById(ipmId) {
        const record = await this.prisma.itemPriceMaster.findFirst({
            where: {
                ipmId,
                ipmIsDeleted: false,
            },
        });
        if (!record) {
            (0, module_service_utils_1.throwInventoryNotFound)('Item price not found', 'ipm_id', `No item price found with id ${ipmId}`, item_price_error_codes_1.ItemPriceErrorCode.NOT_FOUND);
        }
        return this.toPayload(record);
    }
    async findByItemId(itemId, client = this.prisma) {
        const today = await (0, price_period_helper_1.databaseToday)(client);
        const records = await client.itemPriceMaster.findMany({
            where: { ipmItemId: itemId, ipmIsDeleted: false, ...(0, price_period_helper_1.priceRowsInForce)(today) },
            orderBy: [
                { ipmSlNo: 'asc' },
                { itemUnitConversion: { iucUnitSlno: 'asc' } },
                { ipmId: 'asc' },
            ],
        });
        return records.map((record) => this.toPayload(record));
    }
    async findScheduledByItemId(itemId, client = this.prisma) {
        const today = await (0, price_period_helper_1.databaseToday)(client);
        const records = await client.itemPriceMaster.findMany({
            where: { ipmItemId: itemId, ipmIsDeleted: false, ...(0, price_period_helper_1.priceRowsScheduledAfter)(today) },
            orderBy: [
                { itemUnitConversion: { iucUnitSlno: 'asc' } },
                { ipmEffectiveFrom: 'asc' },
                { ipmId: 'asc' },
            ],
        });
        return records.map((record) => ({
            ...this.toPayload(record),
            ipm_effective_from: (0, price_resolver_1.toDay)(record.ipmEffectiveFrom),
            ipm_effective_to: (0, price_resolver_1.toDay)(record.ipmEffectiveTo),
        }));
    }
    async toggleDelete(ipmId, tx) {
        const toggleIds = Array.isArray(ipmId) ? ipmId : [ipmId];
        const toggleAll = async (client) => {
            const toggledItems = [];
            for (const toggleId of toggleIds) {
                toggledItems.push(await this.toggleDeleteItemPrice(client, toggleId));
            }
            return toggledItems;
        };
        try {
            const results = tx ? await toggleAll(tx) : await this.prisma.$transaction(toggleAll);
            return Array.isArray(ipmId) ? results : results[0];
        }
        catch (error) {
            this.handleDeleteError(error);
            throw error;
        }
    }
    async delete(ipmId) {
        const ids = Array.isArray(ipmId) ? ipmId : [ipmId];
        try {
            const results = await this.prisma.$transaction(async (client) => {
                const deleted = [];
                for (const id of ids) {
                    const existing = await client.itemPriceMaster.findFirst({ where: { ipmId: id } });
                    if (!existing) {
                        (0, module_service_utils_1.throwInventoryNotFound)('Item price not found', 'ipm_id', `No item price found with id ${id}`, item_price_error_codes_1.ItemPriceErrorCode.NOT_FOUND);
                    }
                    await (0, item_child_helper_1.assertChildDeletable)(client, { isDeleted: existing.ipmIsDeleted, itemId: existing.ipmItemId }, {
                        label: 'price row',
                        idField: 'ipm_id',
                        alreadyDeletedCode: item_price_error_codes_1.ItemPriceErrorCode.ALREADY_DELETED,
                        itemNotLiveCode: item_price_error_codes_1.ItemPriceErrorCode.ITEM_NOT_LIVE,
                    });
                    deleted.push(await this.toggleDeleteItemPrice(client, id));
                }
                return deleted;
            });
            return Array.isArray(ipmId) ? results : results[0];
        }
        catch (error) {
            this.handleDeleteError(error);
            throw error;
        }
    }
    async saveItemPrice(tx, saveItemPriceDto) {
        if (saveItemPriceDto.ipm_id) {
            return this.updateItemPrice(tx, saveItemPriceDto);
        }
        return this.createItemPrice(tx, saveItemPriceDto);
    }
    async toggleDeleteItemPrice(tx, ipmId) {
        const existing = await tx.itemPriceMaster.findFirst({
            where: {
                ipmId,
            },
        });
        if (!existing) {
            (0, module_service_utils_1.throwInventoryNotFound)('Item price not found', 'ipm_id', `No item price found with id ${ipmId}`, item_price_error_codes_1.ItemPriceErrorCode.NOT_FOUND);
        }
        const nextDeleted = !existing.ipmIsDeleted;
        const updatedOn = new Date();
        const updated = await this.priceWriter.updatePrice(tx, price_change_log_types_1.PRICE_ORIGIN.ITEM_CARD, ipmId, {
            ipmIsDeleted: nextDeleted,
            ipmUpdatedOn: updatedOn,
            ipmUpdatedBy: this.requestUser() ?? existing.ipmUpdatedBy,
        });
        await this.auditLogService.logEntityChange({
            action: nextDeleted ? 'cancel' : 'update',
            tableName: ITEM_PRICE_TABLE_NAME,
            screenName: ITEM_PRICE_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: ipmId,
            displayName: this.buildDisplayName(existing),
            originalRecord: this.toPayload(existing),
            modifiedRecord: this.toPayload(updated),
            userId: this.resolveAuditActor(updated.ipmUpdatedBy),
            notes: nextDeleted ? 'Item price soft deleted' : 'Item price restored',
        }, tx);
        return {
            ipm_id: ipmId,
            deleted: nextDeleted,
        };
    }
    async createItemPrice(tx, saveItemPriceDto) {
        const profitType = saveItemPriceDto.ipm_profit_type?.trim();
        if (!profitType) {
            (0, module_service_utils_1.throwInventoryBadRequest)('Validation failed', [
                {
                    field: 'ipm_profit_type',
                    code: item_price_error_codes_1.ItemPriceErrorCode.PROFIT_TYPE_REQUIRED,
                    message: 'ipm_profit_type is required',
                },
            ]);
        }
        const unitConversion = await this.requireUnitConversion(tx, saveItemPriceDto);
        await this.assertRowScope(tx, saveItemPriceDto, null);
        const now = new Date();
        const createdBy = this.requestUser();
        const updatedBy = createdBy;
        const data = {
            ipmItemId: saveItemPriceDto.ipm_item_id,
            ipmUcUnitId: unitConversion.iucId,
            ipmGodownId: saveItemPriceDto.ipm_godown_id ?? null,
            ipmProfitType: profitType,
            ipmUomRemarks: unitConversion.iucUomRemarks,
            ipmCreatedOn: now,
            ipmCreatedBy: createdBy,
            ipmUpdatedOn: now,
            ipmUpdatedBy: updatedBy,
        };
        this.applyOptionalFields(data, saveItemPriceDto);
        await this.applyBucket(tx, data, saveItemPriceDto, null);
        await this.applyOpenPeriod(tx, data);
        await this.fillLevelFigures(tx, data, saveItemPriceDto, null);
        const created = await this.priceWriter.createPrice(tx, price_change_log_types_1.PRICE_ORIGIN.ITEM_CARD, data);
        const payload = this.toPayload(created);
        await this.auditLogService.logEntityChange({
            action: 'New',
            tableName: ITEM_PRICE_TABLE_NAME,
            screenName: ITEM_PRICE_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: payload.ipm_id,
            displayName: this.buildDisplayName(created),
            originalRecord: null,
            modifiedRecord: payload,
            userId: this.resolveAuditActor(createdBy),
            notes: 'Item price created',
        }, tx);
        return payload;
    }
    async updateItemPrice(tx, saveItemPriceDto) {
        const ipmId = saveItemPriceDto.ipm_id;
        const profitType = saveItemPriceDto.ipm_profit_type?.trim();
        if (!profitType) {
            (0, module_service_utils_1.throwInventoryBadRequest)('Validation failed', [
                {
                    field: 'ipm_profit_type',
                    code: item_price_error_codes_1.ItemPriceErrorCode.PROFIT_TYPE_REQUIRED,
                    message: 'ipm_profit_type cannot be empty',
                },
            ]);
        }
        const existing = await tx.itemPriceMaster.findFirst({
            where: {
                ipmId,
                ipmItemId: saveItemPriceDto.ipm_item_id,
                ipmIsDeleted: false,
            },
        });
        if (!existing) {
            (0, module_service_utils_1.throwInventoryNotFound)('Item price not found', 'ipm_id', `No live price row ${ipmId} on item ${saveItemPriceDto.ipm_item_id}`, item_price_error_codes_1.ItemPriceErrorCode.NOT_FOUND);
        }
        const unitConversion = await this.requireUnitConversion(tx, saveItemPriceDto);
        await this.assertRowScope(tx, saveItemPriceDto, existing);
        const data = {
            ipmUcUnitId: unitConversion.iucId,
            ipmProfitType: profitType,
            ipmUpdatedOn: new Date(),
            ipmUpdatedBy: this.requestUser() ?? existing.ipmUpdatedBy,
        };
        if (saveItemPriceDto.ipm_godown_id !== undefined) {
            data.ipmGodownId = saveItemPriceDto.ipm_godown_id ?? null;
        }
        this.applyOptionalFields(data, saveItemPriceDto);
        await this.applyBucket(tx, data, saveItemPriceDto, existing);
        await this.fillLevelFigures(tx, data, saveItemPriceDto, existing);
        const updated = await this.priceWriter.updatePrice(tx, price_change_log_types_1.PRICE_ORIGIN.ITEM_CARD, ipmId, data);
        const payload = this.toPayload(updated);
        await this.auditLogService.logEntityChange({
            action: 'update',
            tableName: ITEM_PRICE_TABLE_NAME,
            screenName: ITEM_PRICE_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: ipmId,
            displayName: this.buildDisplayName(updated),
            originalRecord: this.toPayload(existing),
            modifiedRecord: payload,
            userId: this.resolveAuditActor(payload.ipm_updated_by),
            notes: 'Item price updated',
        }, tx);
        return payload;
    }
    async applyBucket(tx, data, dto, existing) {
        const pick = (sent, stored) => sent !== undefined ? sent : stored !== undefined ? (0, module_service_utils_1.toNumber)(stored) : 0;
        const scope = {
            companyId: dto.ipm_company_id !== undefined ? dto.ipm_company_id : (existing?.ipmCompanyId ?? null),
            branchId: dto.ipm_branch_id !== undefined ? dto.ipm_branch_id : (existing?.ipmBranchId ?? null),
        };
        const next = {
            ...scope,
            maxPrice: pick(dto.ipm_max_price, existing?.ipmMaxPrice),
            prices: [
                pick(dto.ipm_sales_price_a, existing?.ipmSalesPriceA),
                pick(dto.ipm_sales_price_b, existing?.ipmSalesPriceB),
                pick(dto.ipm_sales_price_c, existing?.ipmSalesPriceC),
                pick(dto.ipm_sales_price_d, existing?.ipmSalesPriceD),
            ],
        };
        if (!existing) {
            const [key] = await this.priceBucketService.deriveBuckets(tx, dto.ipm_item_id, [next]);
            data.ipmBucketMrp = key.mrp;
            data.ipmBucketSp = key.salePrice;
            return;
        }
        const stored = {
            ...scope,
            maxPrice: (0, module_service_utils_1.toNumber)(existing.ipmMaxPrice),
            prices: [
                (0, module_service_utils_1.toNumber)(existing.ipmSalesPriceA),
                (0, module_service_utils_1.toNumber)(existing.ipmSalesPriceB),
                (0, module_service_utils_1.toNumber)(existing.ipmSalesPriceC),
                (0, module_service_utils_1.toNumber)(existing.ipmSalesPriceD),
            ],
        };
        const [key, kept] = await this.priceBucketService.deriveBuckets(tx, dto.ipm_item_id, [
            next,
            stored,
        ]);
        if (!(0, price_resolver_1.sameBucket)(key, kept)) {
            this.refuseBucketChange(existing, next, kept, key);
        }
        data.ipmBucketMrp = key.mrp;
        data.ipmBucketSp = key.salePrice;
    }
    refuseBucketChange(existing, next, from, to) {
        const stored = (0, price_resolver_1.bucketKeyOfRow)(existing);
        const describe = (key) => [
            key.mrp !== null ? `MRP ${key.mrp}` : null,
            key.salePrice !== null ? `sale price ${key.salePrice}` : null,
        ]
            .filter(Boolean)
            .join(', ') || 'no bucket';
        const levels = ['a', 'b', 'c', 'd'];
        const storedPrices = [
            existing.ipmSalesPriceA,
            existing.ipmSalesPriceB,
            existing.ipmSalesPriceC,
            existing.ipmSalesPriceD,
        ].map((price) => (0, module_service_utils_1.toNumber)(price));
        const level = from.mrp !== to.mrp
            ? null
            : levels.find((_, index) => next.prices[index] === to.salePrice && next.prices[index] !== storedPrices[index]);
        (0, module_service_utils_1.throwInventoryBadRequest)('This edit would move the price onto other stock', [
            {
                field: level ? `ipm_sales_price_${level}` : 'ipm_max_price',
                code: item_price_error_codes_1.ItemPriceErrorCode.BUCKET_CHANGED,
                message: `Price row ${existing.ipmId} prices the stock at ${describe(stored)}; this edit would ` +
                    `make it the price of ${describe(to)}. Add a new price row for that stock instead.`,
            },
        ]);
    }
    async applyOpenPeriod(tx, data) {
        const [gap] = await tx.$queryRaw `
      WITH k AS (
        SELECT ipm_effective_from, ipm_effective_to
          FROM inventory.item_price_master
         WHERE ipm_is_deleted = false
           AND ipm_company_id IS NOT DISTINCT FROM ${data.ipmCompanyId ?? null}::uuid
           AND ipm_branch_id  IS NOT DISTINCT FROM ${data.ipmBranchId ?? null}::uuid
           AND ipm_item_id    = ${data.ipmItemId}::uuid
           AND ipm_uc_unit_id = ${data.ipmUcUnitId}::uuid
           AND ipm_key_mrp    = COALESCE(${data.ipmBucketMrp ?? null}::numeric, -1)
           AND ipm_key_sp     = COALESCE(${data.ipmBucketSp ?? null}::numeric, -1)
      )
      SELECT (SELECT MAX(ipm_effective_to) + 1 FROM k WHERE ipm_effective_to < CURRENT_DATE)::text
                 AS "from",
             (SELECT MIN(ipm_effective_from) - 1 FROM k WHERE ipm_effective_from > CURRENT_DATE)::text
                 AS "to"
    `;
        if (gap?.from)
            data.ipmEffectiveFrom = (0, price_period_helper_1.toDateColumn)(gap.from);
        if (gap?.to)
            data.ipmEffectiveTo = (0, price_period_helper_1.toDateColumn)(gap.to);
    }
    async fillLevelFigures(tx, data, dto, existing) {
        const levels = [
            {
                level: 1,
                price: dto.ipm_sales_price_a,
                wot: dto.ipm_price_a_wot,
                markup: dto.ipm_price_a_markup_perc,
            },
            {
                level: 2,
                price: dto.ipm_sales_price_b,
                wot: dto.ipm_price_b_wot,
                markup: dto.ipm_price_b_markup_perc,
            },
            {
                level: 3,
                price: dto.ipm_sales_price_c,
                wot: dto.ipm_price_c_wot,
                markup: dto.ipm_price_c_markup_perc,
            },
            {
                level: 4,
                price: dto.ipm_sales_price_d,
                wot: dto.ipm_price_d_wot,
                markup: dto.ipm_price_d_markup_perc,
            },
        ];
        const missing = levels.filter((l) => l.price !== undefined && (l.wot === undefined || l.markup === undefined));
        if (!missing.length) {
            return;
        }
        const taxPerc = (await (0, item_tax_rate_helper_1.resolveItemTaxRates)(tx, [dto.ipm_item_id])).get(dto.ipm_item_id)?.taxPerc ?? 0;
        const cost = dto.ipm_cost_price !== undefined
            ? dto.ipm_cost_price
            : existing
                ? (0, module_service_utils_1.toNumber)(existing.ipmCostPrice)
                : 0;
        for (const l of missing) {
            const figures = (0, selling_price_math_helper_1.recomputeLevel)(l.level, l.price ?? 0, taxPerc, cost);
            const wot = l.wot === undefined ? figures.priceWot : undefined;
            const markup = l.markup === undefined ? figures.markupPerc : undefined;
            switch (l.level) {
                case 1:
                    if (wot !== undefined)
                        data.ipmPriceAWot = wot;
                    if (markup !== undefined)
                        data.ipmPriceAMarkupPerc = markup;
                    break;
                case 2:
                    if (wot !== undefined)
                        data.ipmPriceBWot = wot;
                    if (markup !== undefined)
                        data.ipmPriceBMarkupPerc = markup;
                    break;
                case 3:
                    if (wot !== undefined)
                        data.ipmPriceCWot = wot;
                    if (markup !== undefined)
                        data.ipmPriceCMarkupPerc = markup;
                    break;
                case 4:
                    if (wot !== undefined)
                        data.ipmPriceDWot = wot;
                    if (markup !== undefined)
                        data.ipmPriceDMarkupPerc = markup;
                    break;
            }
        }
    }
    async requireUnitConversion(tx, saveItemPriceDto) {
        const unitConversion = await tx.itemUnitConversion.findFirst({
            where: {
                iucId: saveItemPriceDto.ipm_uc_unit_id,
                iucItemId: saveItemPriceDto.ipm_item_id,
                iucIsDeleted: false,
            },
            select: { iucId: true, iucUomRemarks: true },
        });
        if (!unitConversion) {
            (0, module_service_utils_1.throwInventoryBadRequest)('Validation failed', [
                {
                    field: 'ipm_uc_unit_id',
                    code: item_price_error_codes_1.ItemPriceErrorCode.UNIT_NOT_FOUND,
                    message: `Unit conversion ${saveItemPriceDto.ipm_uc_unit_id} does not exist for item ${saveItemPriceDto.ipm_item_id}`,
                },
            ]);
        }
        return unitConversion;
    }
    async assertRowScope(tx, dto, existing) {
        const pick = (sent, stored) => sent !== undefined ? sent : (stored ?? null);
        const companyId = pick(dto.ipm_company_id, existing?.ipmCompanyId);
        const branchId = pick(dto.ipm_branch_id, existing?.ipmBranchId);
        const godownId = pick(dto.ipm_godown_id, existing?.ipmGodownId);
        if (existing &&
            companyId === existing.ipmCompanyId &&
            branchId === existing.ipmBranchId &&
            godownId === existing.ipmGodownId) {
            return;
        }
        const refuse = (field, code, message) => (0, module_service_utils_1.throwInventoryBadRequest)('Validation failed', [
            { field, code, message },
        ]);
        const item = await tx.itemMaster.findFirst({
            where: { itemId: dto.ipm_item_id },
            select: { itemCompanyId: true },
        });
        const itemCompanyId = item?.itemCompanyId ?? null;
        if (companyId && itemCompanyId && companyId !== itemCompanyId) {
            refuse('ipm_company_id', item_price_error_codes_1.ItemPriceErrorCode.OTHER_COMPANY, 'The item belongs to another company. Leave ipm_company_id blank or name the item’s company.');
        }
        const scopeCompanyId = companyId ?? itemCompanyId;
        if (branchId) {
            const branch = await tx.branchMaster.findFirst({
                where: { brId: branchId },
                select: { brCompId: true, brName: true },
            });
            if (!branch || (scopeCompanyId && branch.brCompId !== scopeCompanyId)) {
                refuse('ipm_branch_id', item_price_error_codes_1.ItemPriceErrorCode.BRANCH_OTHER_COMPANY, branch
                    ? `${branch.brName} belongs to another company than the price row's`
                    : `No branch found with id ${branchId}`);
            }
        }
        if (godownId) {
            const godown = await tx.godownLocation.findFirst({
                where: { gdlId: godownId },
                select: { gdlBranchId: true },
            });
            const godownCompanyId = godown && !branchId && scopeCompanyId
                ? ((await tx.branchMaster.findFirst({
                    where: { brId: godown.gdlBranchId },
                    select: { brCompId: true },
                }))?.brCompId ?? null)
                : null;
            const outside = !godown ||
                (branchId
                    ? godown.gdlBranchId !== branchId
                    : !!scopeCompanyId && godownCompanyId !== scopeCompanyId);
            if (outside) {
                refuse('ipm_godown_id', item_price_error_codes_1.ItemPriceErrorCode.GODOWN_OUT_OF_SCOPE, godown
                    ? 'The godown belongs to another branch / company than the price row'
                    : `No godown found with id ${godownId}`);
            }
        }
    }
    applyOptionalFields(data, saveItemPriceDto) {
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemPriceDto, 'ipm_company_id')) {
            data.ipmCompanyId = saveItemPriceDto.ipm_company_id;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemPriceDto, 'ipm_branch_id')) {
            data.ipmBranchId = saveItemPriceDto.ipm_branch_id;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemPriceDto, 'ipm_sl_no')) {
            data.ipmSlNo = saveItemPriceDto.ipm_sl_no;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemPriceDto, 'ipm_cost_price')) {
            data.ipmCostPrice = saveItemPriceDto.ipm_cost_price;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemPriceDto, 'ipm_cost_wot')) {
            data.ipmCostWot = saveItemPriceDto.ipm_cost_wot;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemPriceDto, 'ipm_sales_price_a')) {
            data.ipmSalesPriceA = saveItemPriceDto.ipm_sales_price_a;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemPriceDto, 'ipm_sales_price_b')) {
            data.ipmSalesPriceB = saveItemPriceDto.ipm_sales_price_b;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemPriceDto, 'ipm_sales_price_c')) {
            data.ipmSalesPriceC = saveItemPriceDto.ipm_sales_price_c;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemPriceDto, 'ipm_sales_price_d')) {
            data.ipmSalesPriceD = saveItemPriceDto.ipm_sales_price_d;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemPriceDto, 'ipm_price_a_wot')) {
            data.ipmPriceAWot = saveItemPriceDto.ipm_price_a_wot;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemPriceDto, 'ipm_price_b_wot')) {
            data.ipmPriceBWot = saveItemPriceDto.ipm_price_b_wot;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemPriceDto, 'ipm_price_c_wot')) {
            data.ipmPriceCWot = saveItemPriceDto.ipm_price_c_wot;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemPriceDto, 'ipm_price_d_wot')) {
            data.ipmPriceDWot = saveItemPriceDto.ipm_price_d_wot;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemPriceDto, 'ipm_price_a_markup_perc')) {
            data.ipmPriceAMarkupPerc = saveItemPriceDto.ipm_price_a_markup_perc;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemPriceDto, 'ipm_price_b_markup_perc')) {
            data.ipmPriceBMarkupPerc = saveItemPriceDto.ipm_price_b_markup_perc;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemPriceDto, 'ipm_price_c_markup_perc')) {
            data.ipmPriceCMarkupPerc = saveItemPriceDto.ipm_price_c_markup_perc;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemPriceDto, 'ipm_price_d_markup_perc')) {
            data.ipmPriceDMarkupPerc = saveItemPriceDto.ipm_price_d_markup_perc;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemPriceDto, 'ipm_max_price')) {
            data.ipmMaxPrice = saveItemPriceDto.ipm_max_price;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemPriceDto, 'ipm_min_price')) {
            data.ipmMinPrice = saveItemPriceDto.ipm_min_price;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemPriceDto, 'ipm_disc_perc')) {
            data.ipmDiscPerc = saveItemPriceDto.ipm_disc_perc;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemPriceDto, 'ipm_disc_qty')) {
            data.ipmDiscQty = saveItemPriceDto.ipm_disc_qty;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemPriceDto, 'ipm_addl_cess')) {
            data.ipmAddlCess = saveItemPriceDto.ipm_addl_cess;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemPriceDto, 'ipm_round_off')) {
            data.ipmRoundOff = saveItemPriceDto.ipm_round_off;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemPriceDto, 'ipm_loading_charge')) {
            data.ipmLoadingCharge = saveItemPriceDto.ipm_loading_charge;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemPriceDto, 'ipm_freight_charge')) {
            data.ipmFreightCharge = saveItemPriceDto.ipm_freight_charge;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemPriceDto, 'ipm_loyalty_points')) {
            data.ipmLoyaltyPoints = saveItemPriceDto.ipm_loyalty_points;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemPriceDto, 'ipm_uom_remarks')) {
            data.ipmUomRemarks = saveItemPriceDto.ipm_uom_remarks;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemPriceDto, 'ipm_cost_remarks')) {
            data.ipmCostRemarks = saveItemPriceDto.ipm_cost_remarks;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemPriceDto, 'ipm_is_active')) {
            data.ipmIsActive = saveItemPriceDto.ipm_is_active;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemPriceDto, 'ipm_sync_date')) {
            data.ipmSyncDate = this.parseOptionalDate(saveItemPriceDto.ipm_sync_date, 'ipm_sync_date');
        }
    }
    parseOptionalDate(value, fieldName) {
        if (value === undefined) {
            return undefined;
        }
        if (value === null) {
            return null;
        }
        const parsedDate = new Date(value);
        if (Number.isNaN(parsedDate.getTime())) {
            (0, module_service_utils_1.throwInventoryBadRequest)('Validation failed', [
                {
                    field: fieldName,
                    code: item_price_error_codes_1.ItemPriceErrorCode.DATE_INVALID,
                    message: `${fieldName} must be a valid date`,
                },
            ]);
        }
        return parsedDate;
    }
    toPayload(record) {
        return {
            ipm_id: record.ipmId,
            ipm_company_id: record.ipmCompanyId,
            ipm_branch_id: record.ipmBranchId,
            ipm_item_id: record.ipmItemId,
            ipm_uc_unit_id: record.ipmUcUnitId,
            ipm_godown_id: record.ipmGodownId,
            ipm_sl_no: record.ipmSlNo,
            ipm_cost_price: (0, module_service_utils_1.toNumber)(record.ipmCostPrice),
            ipm_cost_wot: (0, module_service_utils_1.toNumber)(record.ipmCostWot),
            ipm_sales_price_a: (0, module_service_utils_1.toNumber)(record.ipmSalesPriceA),
            ipm_sales_price_b: (0, module_service_utils_1.toNumber)(record.ipmSalesPriceB),
            ipm_sales_price_c: (0, module_service_utils_1.toNumber)(record.ipmSalesPriceC),
            ipm_sales_price_d: (0, module_service_utils_1.toNumber)(record.ipmSalesPriceD),
            ipm_price_a_wot: (0, module_service_utils_1.toNumber)(record.ipmPriceAWot),
            ipm_price_b_wot: (0, module_service_utils_1.toNumber)(record.ipmPriceBWot),
            ipm_price_c_wot: (0, module_service_utils_1.toNumber)(record.ipmPriceCWot),
            ipm_price_d_wot: (0, module_service_utils_1.toNumber)(record.ipmPriceDWot),
            ipm_price_a_markup_perc: (0, module_service_utils_1.toNumber)(record.ipmPriceAMarkupPerc),
            ipm_price_b_markup_perc: (0, module_service_utils_1.toNumber)(record.ipmPriceBMarkupPerc),
            ipm_price_c_markup_perc: (0, module_service_utils_1.toNumber)(record.ipmPriceCMarkupPerc),
            ipm_price_d_markup_perc: (0, module_service_utils_1.toNumber)(record.ipmPriceDMarkupPerc),
            ipm_max_price: (0, module_service_utils_1.toNumber)(record.ipmMaxPrice),
            ipm_bucket_mrp: (0, module_service_utils_1.toNullableNumber)(record.ipmBucketMrp),
            ipm_bucket_sp: (0, module_service_utils_1.toNullableNumber)(record.ipmBucketSp),
            ipm_min_price: (0, module_service_utils_1.toNumber)(record.ipmMinPrice),
            ipm_disc_perc: (0, module_service_utils_1.toNumber)(record.ipmDiscPerc),
            ipm_disc_qty: (0, module_service_utils_1.toNumber)(record.ipmDiscQty),
            ipm_addl_cess: (0, module_service_utils_1.toNumber)(record.ipmAddlCess),
            ipm_profit_type: record.ipmProfitType,
            ipm_round_off: (0, module_service_utils_1.toNumber)(record.ipmRoundOff),
            ipm_loading_charge: (0, module_service_utils_1.toNumber)(record.ipmLoadingCharge),
            ipm_freight_charge: (0, module_service_utils_1.toNumber)(record.ipmFreightCharge),
            ipm_loyalty_points: (0, module_service_utils_1.toNumber)(record.ipmLoyaltyPoints),
            ipm_uom_remarks: record.ipmUomRemarks,
            ipm_cost_remarks: record.ipmCostRemarks,
            ipm_is_active: record.ipmIsActive,
            ipm_is_deleted: record.ipmIsDeleted,
            ipm_sync_date: record.ipmSyncDate ? record.ipmSyncDate.toISOString() : null,
            ipm_created_on: record.ipmCreatedOn.toISOString(),
            ipm_created_by: record.ipmCreatedBy,
            ipm_updated_on: record.ipmUpdatedOn ? record.ipmUpdatedOn.toISOString() : null,
            ipm_updated_by: record.ipmUpdatedBy,
        };
    }
    buildDisplayName(record) {
        const branchSegment = record.ipmBranchId ?? 'NO_BRANCH';
        const godownSegment = record.ipmGodownId ?? 'ALL_GODOWNS';
        return `${record.ipmItemId}:${record.ipmUcUnitId}:${branchSegment}:${godownSegment}`;
    }
    requestUser() {
        return this.requestContextService.getUserId()?.trim() || null;
    }
    resolveAuditActor(value, fallback = DEFAULT_AUDIT_ACTOR) {
        const trimmed = value?.trim();
        return trimmed || fallback;
    }
    handleWriteError(error) {
        (0, module_service_utils_1.throwOnUniqueConstraintError)(error, 'Item price already exists', [
            {
                field: 'ipm_item_id',
                code: item_price_error_codes_1.ItemPriceErrorCode.DUPLICATE,
                message: 'Duplicate item price configuration is not allowed',
            },
        ]);
        if ((0, module_service_utils_1.isExclusionConstraintError)(error)) {
            (0, module_service_utils_1.throwInventoryConflict)('Item price already exists', [
                {
                    field: 'ipm_uc_unit_id',
                    code: item_price_error_codes_1.ItemPriceErrorCode.DUPLICATE,
                    message: 'This unit already has a price at this company, branch and MRP. Edit that row instead of adding another.',
                },
            ]);
        }
        const check = (0, module_service_utils_1.violatedCheckOf)(error);
        if (check && CHECK_MESSAGES[check]) {
            (0, module_service_utils_1.throwUnprocessable)('This price cannot be saved', [
                CHECK_MESSAGES[check],
            ]);
        }
        if ((0, module_service_utils_1.isForeignKeyConstraintError)(error)) {
            (0, module_service_utils_1.throwInventoryBadRequest)('Invalid relation reference', [
                {
                    field: 'request',
                    code: item_price_error_codes_1.ItemPriceErrorCode.REFERENCE_NOT_FOUND,
                    message: 'Referenced company, branch, item, unit, base unit, or godown does not exist',
                },
            ]);
        }
    }
    handleDeleteError(error) {
        if ((0, module_service_utils_1.isForeignKeyConstraintError)(error)) {
            (0, module_service_utils_1.throwInventoryBadRequest)('Cannot delete item price', [
                {
                    field: 'ipm_id',
                    code: item_price_error_codes_1.ItemPriceErrorCode.IN_USE,
                    message: 'Item price is referenced by related records',
                },
            ]);
        }
    }
};
exports.ItemsPriceMasterService = ItemsPriceMasterService;
exports.ItemsPriceMasterService = ItemsPriceMasterService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_log_service_1.AuditLogService,
        configured_grid_sql_service_1.ConfiguredGridSqlService,
        request_context_service_1.RequestContextService,
        price_bucket_service_1.PriceBucketService,
        price_master_writer_service_1.PriceMasterWriter])
], ItemsPriceMasterService);
//# sourceMappingURL=items-price-master.service.js.map