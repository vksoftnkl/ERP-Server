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
exports.ItemsQtyPriceMasterService = exports.QTY_PRICE_RIGHT_PREFIX = exports.QTY_PRICE_MENU_ID = void 0;
const master_tree_helper_1 = require("../utils/master-tree.helper");
const common_1 = require("@nestjs/common");
const configured_grid_sql_service_1 = require("../../../common/configured-grid-sql/configured-grid-sql.service");
const item_qty_price_error_codes_1 = require("./types/item-qty-price-error-codes");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const audit_log_service_1 = require("../../audit-log/audit-log.service");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const rights_1 = require("../../../common/posting/rights");
const selling_price_bulk_types_1 = require("../../stocks/selling-price-bulk/types/selling-price-bulk.types");
const qty_slab_rules_1 = require("./qty-slab.rules");
const module_list_utils_1 = require("../../../common/utils/module-list.utils");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const price_master_writer_service_1 = require("../item-price-log/price-master-writer.service");
const price_change_log_types_1 = require("../item-price-log/types/price-change-log.types");
exports.QTY_PRICE_MENU_ID = 244;
exports.QTY_PRICE_RIGHT_PREFIX = 'ITEM_QTY_PRICE';
const ITEM_QTY_PRICE_TABLE_NAME = 'item qty price';
const ITEM_QTY_PRICE_AUDIT_SCREEN_NAME = 'Item Qty Price Master';
const ITEM_QTY_PRICE_INCLUDE = {
    item: { select: { itemNameEn: true } },
    itemUnitConversion: { select: { unit: { select: { unit_name: true } } } },
    company: { select: { compName: true } },
    branch: { select: { brName: true } },
    priceLevel: { select: { iplName: true } },
    party: { select: { cusName: true } },
};
let ItemsQtyPriceMasterService = class ItemsQtyPriceMasterService {
    prisma;
    auditLogService;
    configuredGridSqlService;
    requestContextService;
    priceWriter;
    constructor(prisma, auditLogService, configuredGridSqlService, requestContextService, priceWriter) {
        this.prisma = prisma;
        this.auditLogService = auditLogService;
        this.configuredGridSqlService = configuredGridSqlService;
        this.requestContextService = requestContextService;
        this.priceWriter = priceWriter;
    }
    async save(saveItemQtyPriceDto, tx, opts) {
        const saveItems = Array.isArray(saveItemQtyPriceDto)
            ? saveItemQtyPriceDto
            : [saveItemQtyPriceDto];
        const prefix = opts?.fieldPrefix;
        const saveAll = async (client) => {
            const savedItems = [];
            for (const [index, saveItem] of saveItems.entries()) {
                try {
                    savedItems.push(await this.saveItemQtyPrice(client, saveItem));
                }
                catch (error) {
                    throw prefix === undefined ? error : this.atRow(error, `${prefix}${index}.`);
                }
            }
            try {
                await this.assertNoOverlaps(client, savedItems.map((saved) => saved.iqp_id), Array.isArray(saveItemQtyPriceDto) ? 'indexed' : 'single', 'iqp_from_qty');
            }
            catch (error) {
                throw prefix === undefined ? error : this.atRow(error, prefix, true);
            }
            return savedItems;
        };
        try {
            const results = tx ? await saveAll(tx) : await this.prisma.$transaction(saveAll);
            return Array.isArray(saveItemQtyPriceDto) ? results : results[0];
        }
        catch (error) {
            this.handleWriteError(error);
            throw error;
        }
    }
    atRow(error, at, indexed = false) {
        let refusal = error;
        if (!(refusal instanceof common_1.HttpException)) {
            try {
                this.handleWriteError(refusal);
            }
            catch (worded) {
                refusal = worded;
            }
        }
        if (!(refusal instanceof common_1.HttpException)) {
            return refusal;
        }
        const body = refusal.getResponse();
        if (typeof body === 'object' && body !== null && Array.isArray(body.errors)) {
            const coded = body;
            coded.errors = coded.errors.map((detail) => {
                const field = typeof detail.field === 'string' && detail.field ? detail.field : 'request';
                return { ...detail, field: indexed && !/^\d+\./.test(field) ? field : `${at}${field}` };
            });
        }
        return refusal;
    }
    async list(queryDto) {
        const { page, limit, skip } = (0, module_list_utils_1.resolvePagination)(queryDto);
        const where = {
            iqpIsDeleted: false,
            ...(queryDto.iqp_item_id !== undefined && { iqpItemId: queryDto.iqp_item_id }),
            ...(queryDto.iqp_item_unit_id !== undefined && { iqpItemUnitId: queryDto.iqp_item_unit_id }),
            ...(queryDto.iqp_company_id !== undefined && { iqpCompanyId: queryDto.iqp_company_id }),
            ...(queryDto.iqp_branch_id !== undefined && { iqpBranchId: queryDto.iqp_branch_id }),
            ...(queryDto.iqp_party_id !== undefined && { iqpPartyId: queryDto.iqp_party_id }),
            ...(queryDto.iqp_price_level !== undefined && { iqpPriceLevel: queryDto.iqp_price_level }),
            ...(queryDto.iqp_is_active !== undefined && { iqpIsActive: queryDto.iqp_is_active }),
        };
        return (0, module_list_utils_1.runInventoryListQuery)({ page, limit }, {
            configuredGridFn: () => (0, module_list_utils_1.runConfiguredGridQuery)(this.configuredGridSqlService, {
                tableName: ITEM_QTY_PRICE_TABLE_NAME,
                alias: 'item_qty_price_grid',
                search: queryDto.search,
                page,
                limit,
                skip,
            }),
            countFn: () => this.prisma.itemQtyPrice.count({ where }),
            findManyFn: () => this.prisma.itemQtyPrice.findMany({
                where,
                include: ITEM_QTY_PRICE_INCLUDE,
                orderBy: [
                    { iqpItemId: 'asc' },
                    { iqpItemUnitId: 'asc' },
                    { iqpFromQty: 'asc' },
                    { iqpId: 'asc' },
                ],
                skip,
                take: limit,
            }),
            toItemFn: (record) => this.toPayload(record),
        });
    }
    async getById(iqpId) {
        const record = await this.prisma.itemQtyPrice.findFirst({
            where: { iqpId, iqpIsDeleted: false },
            include: ITEM_QTY_PRICE_INCLUDE,
        });
        if (!record) {
            this.throwNotFound(iqpId);
        }
        return this.toPayload(record);
    }
    async softDelete(iqpId, tx) {
        return this.setDeleted(iqpId, true, tx);
    }
    async restore(iqpId, tx) {
        return this.setDeleted(iqpId, false, tx);
    }
    async setDeleted(iqpId, wantDeleted, tx) {
        const ids = Array.isArray(iqpId) ? iqpId : [iqpId];
        const applyAll = async (client) => {
            const results = [];
            for (const id of ids) {
                results.push(await this.setDeletedItemQtyPrice(client, id, wantDeleted));
            }
            if (!wantDeleted) {
                await this.assertNoOverlaps(client, ids, Array.isArray(iqpId) ? 'indexed' : 'single', 'iqp_id');
            }
            return results;
        };
        try {
            const results = tx ? await applyAll(tx) : await this.prisma.$transaction(applyAll);
            return Array.isArray(iqpId) ? results : results[0];
        }
        catch (error) {
            this.handleWriteError(error);
            throw error;
        }
    }
    async assertRight(right, action) {
        return (0, rights_1.assertMenuRight)(this.prisma, {
            userId: this.requestContextService.getUserId(),
            menuId: exports.QTY_PRICE_MENU_ID,
            right,
            codePrefix: exports.QTY_PRICE_RIGHT_PREFIX,
            action,
        });
    }
    async assertSaveRights(rows) {
        if (rows.some((row) => !row.iqp_id)) {
            await this.assertRight('create', 'add qty-wise prices');
        }
        if (rows.some((row) => row.iqp_id)) {
            await this.assertRight('edit', 'change qty-wise prices');
        }
    }
    async assertSaveRightsOfBody(body) {
        const rows = Array.isArray(body) ? body : [];
        if (rows.length) {
            const named = (row) => {
                const id = typeof row === 'object' && row !== null ? row.iqp_id : undefined;
                return id !== undefined && id !== null && id !== '';
            };
            return this.assertSaveRights(rows.map((row) => ({ iqp_id: named(row) ? 'named' : undefined })));
        }
        const userId = this.requestContextService.getUserId();
        const rights = userId ? await (0, rights_1.loadRights)(this.prisma, userId, exports.QTY_PRICE_MENU_ID) : rights_1.NO_RIGHTS;
        if (!rights.create && !rights.edit) {
            await this.assertRight('create', 'add qty-wise prices');
        }
    }
    ownBranchId() {
        return this.requestContextService.getBranchId()?.toLowerCase() ?? null;
    }
    throwOtherBranch(fields, own) {
        const message = own
            ? 'A slab for another branch can only be changed by head office. Pick your own branch for the slab.'
            : 'This login is not at a branch counter, so only head office can change qty-wise prices.';
        (0, module_service_utils_1.throwInventoryForbidden)('A slab of another branch needs head office', [
            ...fields.map((field) => ({ field, code: item_qty_price_error_codes_1.ItemQtyPriceErrorCode.OTHER_BRANCH, message })),
        ]);
    }
    async assertOwnBranchSlabs(client, rows, fieldPrefix = '', stored) {
        if (!rows.length || (0, selling_price_bulk_types_1.isHqUserType)(this.requestContextService.getUserType())) {
            return;
        }
        const known = stored ??
            (await this.readStoredSlabs(client, rows.filter((row) => row.iqp_id).map((row) => row.iqp_id)));
        const own = this.ownBranchId();
        const owned = (branchId) => own !== null && branchId?.toLowerCase() === own;
        const wrong = rows
            .map((row, index) => {
            const before = row.iqp_id ? known.get(row.iqp_id.toLowerCase()) : undefined;
            const after = row.iqp_branch_id !== undefined ? row.iqp_branch_id : (before?.branchId ?? null);
            return {
                index,
                ok: (!before || owned(before.branchId)) && (after === null || owned(after)),
            };
        })
            .filter(({ ok }) => !ok);
        if (wrong.length) {
            this.throwOtherBranch(wrong.map(({ index }) => `${fieldPrefix}${index}.iqp_branch_id`), own);
        }
    }
    async assertOwnBranchSlabIds(client, ids, fieldOf, stored) {
        if (!ids.length || (0, selling_price_bulk_types_1.isHqUserType)(this.requestContextService.getUserType())) {
            return;
        }
        const known = stored ?? (await this.readStoredSlabs(client, ids));
        const own = this.ownBranchId();
        const wrong = ids
            .map((id, index) => ({ index, slab: known.get(id.toLowerCase()) }))
            .filter(({ slab }) => slab && (own === null || slab.branchId?.toLowerCase() !== own));
        if (wrong.length) {
            this.throwOtherBranch(wrong.map(({ index }) => fieldOf(index)), own);
        }
    }
    async assertOwnBranchSlabsOf(rows) {
        return this.assertOwnBranchSlabs(this.prisma, rows);
    }
    async assertOwnBranchSlabIdsOf(ids) {
        const list = typeof ids === 'string' ? [ids] : ids;
        return this.assertOwnBranchSlabIds(this.prisma, list, (index) => typeof ids === 'string' ? 'iqp_id' : `${index}.iqp_id`);
    }
    async readStoredSlabs(client, ids) {
        const unique = [...new Set(ids.filter(Boolean))];
        if (!unique.length) {
            return new Map();
        }
        const rows = await client.itemQtyPrice.findMany({
            where: { iqpId: { in: unique } },
            select: {
                iqpId: true,
                iqpItemId: true,
                iqpBranchId: true,
                iqpPriceLevel: true,
                iqpIsDeleted: true,
            },
        });
        return new Map(rows.map((row) => [
            row.iqpId.toLowerCase(),
            {
                iqpId: row.iqpId,
                itemId: row.iqpItemId,
                branchId: row.iqpBranchId,
                priceLevel: row.iqpPriceLevel,
                isDeleted: row.iqpIsDeleted,
            },
        ]));
    }
    async assertSellingLevels(client, rows, fieldPrefix = '', stored) {
        if (!rows.length) {
            return;
        }
        const known = stored ??
            (await this.readStoredSlabs(client, rows
                .filter((row) => row.iqp_id && row.iqp_price_level === undefined)
                .map((row) => row.iqp_id)));
        const active = await this.activeSellingLevels(client);
        const wrong = rows
            .map((row, index) => ({
            index,
            level: row.iqp_price_level !== undefined
                ? row.iqp_price_level
                : row.iqp_id
                    ? (known.get(row.iqp_id.toLowerCase())?.priceLevel ?? null)
                    : null,
        }))
            .filter(({ level }) => !(0, qty_slab_rules_1.isSellingSlabLevel)(level, active));
        if (!wrong.length) {
            return;
        }
        (0, module_service_utils_1.throwUnprocessable)('A slab names a price level that is not for sale', [
            ...wrong.map(({ index, level }) => ({
                field: `${fieldPrefix}${index}.iqp_price_level`,
                code: item_qty_price_error_codes_1.ItemQtyPriceErrorCode.LEVEL_NOT_SELLING,
                message: `Price level ${level} is not an active selling level. Pick an active level 1–4 ` +
                    `(${active.length ? active.join(', ') : 'none is active'}), or leave it blank for all levels.`,
            })),
        ]);
    }
    async assertChainSlabsAllowed(client, rows, fieldPrefix = '', stored) {
        if (!rows.length || (0, selling_price_bulk_types_1.isHqUserType)(this.requestContextService.getUserType())) {
            return;
        }
        const known = stored ??
            (await this.readStoredSlabs(client, rows
                .filter((row) => row.iqp_id && row.iqp_branch_id === undefined)
                .map((row) => row.iqp_id)));
        const chain = rows
            .map((row, index) => ({
            index,
            branchId: row.iqp_branch_id !== undefined
                ? row.iqp_branch_id
                : row.iqp_id
                    ? (known.get(row.iqp_id.toLowerCase())?.branchId ?? null)
                    : null,
        }))
            .filter(({ branchId }) => branchId === null);
        if (!chain.length) {
            return;
        }
        (0, module_service_utils_1.throwInventoryForbidden)('A slab for all branches needs head office', [
            ...chain.map(({ index }) => ({
                field: `${fieldPrefix}${index}.iqp_branch_id`,
                code: item_qty_price_error_codes_1.ItemQtyPriceErrorCode.CHAIN_HQ_ONLY,
                message: 'A slab for all branches can only be saved by head office. Pick this branch for the slab.',
            })),
        ]);
    }
    async assertSellingLevelsOf(rows) {
        return this.assertSellingLevels(this.prisma, rows);
    }
    async assertChainSlabsAllowedOf(rows) {
        return this.assertChainSlabsAllowed(this.prisma, rows);
    }
    async activeSellingLevels(client) {
        const rows = await client.$queryRaw `
      SELECT price_lvl_id::int AS id
        FROM fixed.price_levels
       WHERE price_lvl_id BETWEEN 1 AND 4
         AND price_lvl_is_active IS TRUE
         AND "price_lvl_isDeleted" IS NOT TRUE
       ORDER BY 1`;
        return rows.map((row) => Number(row.id));
    }
    async listForItem(itemId, client = this.prisma) {
        const rows = await client.itemQtyPrice.findMany({
            where: { iqpItemId: itemId, iqpIsDeleted: false },
            include: ITEM_QTY_PRICE_INCLUDE,
            orderBy: [{ iqpItemUnitId: 'asc' }, { iqpFromQty: 'asc' }, { iqpId: 'asc' }],
        });
        return rows.map((row) => this.toPayload(row));
    }
    async saveItemQtyPrice(tx, saveItemQtyPriceDto) {
        if (saveItemQtyPriceDto.iqp_id) {
            return this.updateItemQtyPrice(tx, saveItemQtyPriceDto);
        }
        return this.createItemQtyPrice(tx, saveItemQtyPriceDto);
    }
    async setDeletedItemQtyPrice(tx, iqpId, wantDeleted) {
        const existing = await tx.itemQtyPrice.findFirst({
            where: { iqpId },
            include: ITEM_QTY_PRICE_INCLUDE,
        });
        if (!existing) {
            this.throwNotFound(iqpId);
        }
        (0, master_tree_helper_1.assertDeleteState)(existing.iqpIsDeleted, wantDeleted, {
            label: 'qty price slab',
            idField: 'iqp_id',
            restoreRoute: '/item-qty-prices/restore',
            alreadyDeletedCode: item_qty_price_error_codes_1.ItemQtyPriceErrorCode.ALREADY_DELETED,
            notDeletedCode: item_qty_price_error_codes_1.ItemQtyPriceErrorCode.NOT_DELETED,
        });
        const wasDeleted = existing.iqpIsDeleted;
        const nextDeleted = wantDeleted;
        const modifiedOn = new Date();
        const modifiedBy = this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR;
        const moved = await this.priceWriter.setQtyPriceDeleted(tx, price_change_log_types_1.PRICE_ORIGIN.QTY_PRICE, iqpId, wasDeleted, { iqpIsDeleted: nextDeleted, iqpModifiedOn: modifiedOn, iqpModifiedBy: modifiedBy });
        if (moved === 0) {
            this.throwNotFound(iqpId);
        }
        const originalRecord = this.toPayload(existing);
        const modifiedRecord = this.toPayload({
            ...existing,
            iqpIsDeleted: nextDeleted,
            iqpModifiedOn: modifiedOn,
            iqpModifiedBy: modifiedBy,
        });
        await this.auditLogService.logEntityChange({
            action: nextDeleted ? 'cancel' : 'update',
            tableName: ITEM_QTY_PRICE_TABLE_NAME,
            screenName: ITEM_QTY_PRICE_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: iqpId,
            displayName: this.buildDisplayName(existing),
            originalRecord,
            modifiedRecord,
            userId: modifiedBy,
            notes: nextDeleted ? 'Item qty price soft deleted' : 'Item qty price restored',
        }, tx);
        return { iqp_id: iqpId, deleted: nextDeleted };
    }
    async createItemQtyPrice(tx, saveItemQtyPriceDto) {
        const effectiveFrom = this.parseRequiredDate(saveItemQtyPriceDto.iqp_effective_from, 'iqp_effective_from');
        const effectiveTo = this.parseOptionalDate(saveItemQtyPriceDto.iqp_effective_to, 'iqp_effective_to') ?? null;
        this.validateDateRange(effectiveFrom, effectiveTo);
        this.validateQtyRange(saveItemQtyPriceDto.iqp_from_qty ?? 0, saveItemQtyPriceDto.iqp_to_qty ?? null);
        this.validatePriceValue(saveItemQtyPriceDto, null);
        await this.assertUnitOfItem(tx, saveItemQtyPriceDto.iqp_item_id, saveItemQtyPriceDto.iqp_item_unit_id);
        const now = new Date();
        const createdBy = (0, module_service_utils_1.resolveActor)(saveItemQtyPriceDto.iqp_created_by, this.requestContextService.getUserId());
        const data = {
            iqpItemId: saveItemQtyPriceDto.iqp_item_id,
            iqpItemUnitId: saveItemQtyPriceDto.iqp_item_unit_id,
            iqpEffectiveFrom: effectiveFrom,
            iqpCreatedOn: now,
            iqpCreatedBy: createdBy,
        };
        this.applyOptionalFields(data, saveItemQtyPriceDto);
        const created = await this.priceWriter.createQtyPrice(tx, price_change_log_types_1.PRICE_ORIGIN.QTY_PRICE, data, ITEM_QTY_PRICE_INCLUDE);
        const payload = this.toPayload(created);
        await this.auditLogService.logEntityChange({
            action: 'New',
            tableName: ITEM_QTY_PRICE_TABLE_NAME,
            screenName: ITEM_QTY_PRICE_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: payload.iqp_id,
            displayName: this.buildDisplayName(created),
            originalRecord: null,
            modifiedRecord: payload,
            userId: createdBy,
            notes: 'Item qty price created',
        }, tx);
        return payload;
    }
    async updateItemQtyPrice(tx, saveItemQtyPriceDto) {
        const iqpId = saveItemQtyPriceDto.iqp_id;
        const existing = await tx.itemQtyPrice.findFirst({
            where: { iqpId, iqpIsDeleted: false },
            include: ITEM_QTY_PRICE_INCLUDE,
        });
        if (!existing) {
            this.throwNotFound(iqpId);
        }
        const nextEffectiveFrom = this.parseRequiredDate(saveItemQtyPriceDto.iqp_effective_from, 'iqp_effective_from');
        const nextEffectiveTo = saveItemQtyPriceDto.iqp_effective_to !== undefined
            ? (this.parseOptionalDate(saveItemQtyPriceDto.iqp_effective_to, 'iqp_effective_to') ?? null)
            : existing.iqpEffectiveTo;
        this.validateDateRange(nextEffectiveFrom, nextEffectiveTo);
        const nextFromQty = saveItemQtyPriceDto.iqp_from_qty !== undefined
            ? saveItemQtyPriceDto.iqp_from_qty
            : (0, module_service_utils_1.toNumber)(existing.iqpFromQty);
        const nextToQty = saveItemQtyPriceDto.iqp_to_qty !== undefined
            ? saveItemQtyPriceDto.iqp_to_qty
            : (0, module_service_utils_1.toNullableNumber)(existing.iqpToQty);
        this.validateQtyRange(nextFromQty, nextToQty);
        this.validatePriceValue(saveItemQtyPriceDto, existing);
        await this.assertUnitOfItem(tx, saveItemQtyPriceDto.iqp_item_id, saveItemQtyPriceDto.iqp_item_unit_id);
        const data = {
            iqpItemId: saveItemQtyPriceDto.iqp_item_id,
            iqpItemUnitId: saveItemQtyPriceDto.iqp_item_unit_id,
            iqpEffectiveFrom: nextEffectiveFrom,
            iqpModifiedOn: new Date(),
            iqpModifiedBy: (0, module_service_utils_1.resolveActor)(saveItemQtyPriceDto.iqp_modified_by, this.requestContextService.getUserId()),
        };
        this.applyOptionalFields(data, saveItemQtyPriceDto);
        const updated = await this.priceWriter.updateQtyPrice(tx, price_change_log_types_1.PRICE_ORIGIN.QTY_PRICE, iqpId, data, ITEM_QTY_PRICE_INCLUDE);
        const payload = this.toPayload(updated);
        await this.auditLogService.logEntityChange({
            action: 'update',
            tableName: ITEM_QTY_PRICE_TABLE_NAME,
            screenName: ITEM_QTY_PRICE_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: iqpId,
            displayName: this.buildDisplayName(updated),
            originalRecord: this.toPayload(existing),
            modifiedRecord: payload,
            userId: payload.iqp_modified_by ?? this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
            notes: 'Item qty price updated',
        }, tx);
        return payload;
    }
    applyOptionalFields(data, saveItemQtyPriceDto) {
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemQtyPriceDto, 'iqp_company_id'))
            data.iqpCompanyId = saveItemQtyPriceDto.iqp_company_id;
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemQtyPriceDto, 'iqp_branch_id'))
            data.iqpBranchId = saveItemQtyPriceDto.iqp_branch_id;
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemQtyPriceDto, 'iqp_party_id'))
            data.iqpPartyId = saveItemQtyPriceDto.iqp_party_id;
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemQtyPriceDto, 'iqp_price_level'))
            data.iqpPriceLevel = saveItemQtyPriceDto.iqp_price_level;
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemQtyPriceDto, 'iqp_from_qty'))
            data.iqpFromQty = saveItemQtyPriceDto.iqp_from_qty;
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemQtyPriceDto, 'iqp_to_qty'))
            data.iqpToQty = saveItemQtyPriceDto.iqp_to_qty;
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemQtyPriceDto, 'iqp_price_mode'))
            data.iqpPriceMode = saveItemQtyPriceDto.iqp_price_mode;
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemQtyPriceDto, 'iqp_disc_pct'))
            data.iqpDiscPct = saveItemQtyPriceDto.iqp_disc_pct;
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemQtyPriceDto, 'iqp_flat_off'))
            data.iqpFlatOff = saveItemQtyPriceDto.iqp_flat_off;
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemQtyPriceDto, 'iqp_price'))
            data.iqpPrice = saveItemQtyPriceDto.iqp_price;
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemQtyPriceDto, 'iqp_is_tax_incl'))
            data.iqpIsTaxIncl = saveItemQtyPriceDto.iqp_is_tax_incl;
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemQtyPriceDto, 'iqp_effective_to'))
            data.iqpEffectiveTo = this.parseOptionalDate(saveItemQtyPriceDto.iqp_effective_to, 'iqp_effective_to');
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemQtyPriceDto, 'iqp_is_active'))
            data.iqpIsActive = saveItemQtyPriceDto.iqp_is_active;
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemQtyPriceDto, 'iqp_sync_date'))
            data.iqpSyncDate = this.parseOptionalDate(saveItemQtyPriceDto.iqp_sync_date, 'iqp_sync_date');
    }
    validatePriceValue(saveItemQtyPriceDto, existing) {
        const mode = saveItemQtyPriceDto.iqp_price_mode ?? existing?.iqpPriceMode ?? 'P';
        const [field, sent, stored] = mode === 'F'
            ? ['iqp_price', saveItemQtyPriceDto.iqp_price, existing?.iqpPrice]
            : mode === 'R'
                ? ['iqp_flat_off', saveItemQtyPriceDto.iqp_flat_off, existing?.iqpFlatOff]
                : ['iqp_disc_pct', saveItemQtyPriceDto.iqp_disc_pct, existing?.iqpDiscPct];
        const value = sent !== undefined ? sent : (0, module_service_utils_1.toNullableNumber)(stored ?? null);
        if (value === null || value === undefined) {
            (0, module_service_utils_1.throwInventoryBadRequest)('Validation failed', [
                {
                    field,
                    code: item_qty_price_error_codes_1.ItemQtyPriceErrorCode.VALUE_REQUIRED,
                    message: `Price mode ${mode} needs ${field}.`,
                },
            ]);
        }
    }
    async assertUnitOfItem(tx, itemId, itemUnitId) {
        const unit = await tx.itemUnitConversion.findFirst({
            where: { iucId: itemUnitId, iucItemId: itemId, iucIsDeleted: false },
            select: { iucId: true },
        });
        if (!unit) {
            (0, module_service_utils_1.throwInventoryBadRequest)('Validation failed', [
                {
                    field: 'iqp_item_unit_id',
                    code: item_qty_price_error_codes_1.ItemQtyPriceErrorCode.UNIT_NOT_OF_ITEM,
                    message: `${itemUnitId} is not a live unit of item ${itemId}.`,
                },
            ]);
        }
    }
    async assertNoOverlaps(tx, iqpIds, shape, column) {
        if (!iqpIds.length) {
            return;
        }
        await tx.$queryRaw `
      SELECT count(pg_advisory_xact_lock(hashtext('inventory.item_qty_price'), hashtext(k)))::int AS locked
        FROM (SELECT DISTINCT iqp_item_id::text AS k
                FROM inventory.item_qty_price
               WHERE iqp_id = ANY(${iqpIds}::uuid[])
               ORDER BY 1) AS items
    `;
        const [clash] = await tx.$queryRaw `
      SELECT r.iqp_id::text,
             o.iqp_id::text                AS other_id,
             o.iqp_from_qty::text          AS other_from,
             o.iqp_to_qty::text            AS other_to,
             o.iqp_effective_from::text    AS other_effective_from,
             o.iqp_effective_to::text      AS other_effective_to
        FROM inventory.item_qty_price r
        JOIN inventory.item_qty_price o
          ON o.iqp_id <> r.iqp_id
         AND o.iqp_is_deleted = false
         AND o.iqp_item_id = r.iqp_item_id
         AND o.iqp_item_unit_id = r.iqp_item_unit_id
         AND o.iqp_company_id IS NOT DISTINCT FROM r.iqp_company_id
         AND o.iqp_branch_id IS NOT DISTINCT FROM r.iqp_branch_id
         AND o.iqp_party_id IS NOT DISTINCT FROM r.iqp_party_id
         AND o.iqp_price_level IS NOT DISTINCT FROM r.iqp_price_level
         AND o.iqp_from_qty < COALESCE(r.iqp_to_qty, 'Infinity'::numeric)
         AND r.iqp_from_qty < COALESCE(o.iqp_to_qty, 'Infinity'::numeric)
         AND o.iqp_effective_from <= COALESCE(r.iqp_effective_to, 'infinity'::date)
         AND r.iqp_effective_from <= COALESCE(o.iqp_effective_to, 'infinity'::date)
       WHERE r.iqp_id = ANY(${iqpIds}::uuid[])
         AND r.iqp_is_deleted = false
       ORDER BY array_position(${iqpIds}::uuid[], r.iqp_id), o.iqp_from_qty, o.iqp_id
       LIMIT 1
    `;
        if (!clash) {
            return;
        }
        const index = iqpIds.indexOf(clash.iqp_id);
        const range = `${clash.other_from}–${clash.other_to ?? 'above'}`;
        const dates = `${clash.other_effective_from} to ${clash.other_effective_to ?? 'open'}`;
        (0, module_service_utils_1.throwInventoryConflict)('Qty price slabs overlap', [
            {
                field: shape === 'indexed' ? `${index}.${column}` : column,
                code: item_qty_price_error_codes_1.ItemQtyPriceErrorCode.OVERLAP,
                message: `The qty range overlaps slab ${clash.other_id} (${range}, ${dates}) for the same ` +
                    'item, unit and scope. Close one range where the other starts, or end one date first.',
            },
        ]);
    }
    validateDateRange(effectiveFrom, effectiveTo) {
        if (!effectiveTo) {
            return;
        }
        if (effectiveFrom.getTime() > effectiveTo.getTime()) {
            (0, module_service_utils_1.throwInventoryBadRequest)('Validation failed', [
                {
                    field: 'iqp_effective_to',
                    code: item_qty_price_error_codes_1.ItemQtyPriceErrorCode.DATE_RANGE_INVALID,
                    message: 'iqp_effective_to must be greater than or equal to iqp_effective_from',
                },
            ]);
        }
    }
    validateQtyRange(fromQty, toQty) {
        if (toQty === null) {
            return;
        }
        if (fromQty >= toQty) {
            (0, module_service_utils_1.throwInventoryBadRequest)('Validation failed', [
                {
                    field: 'iqp_to_qty',
                    code: item_qty_price_error_codes_1.ItemQtyPriceErrorCode.QTY_RANGE_INVALID,
                    message: 'iqp_to_qty must be greater than iqp_from_qty',
                },
            ]);
        }
    }
    parseRequiredDate(value, fieldName) {
        const parsedDate = new Date(value);
        if (Number.isNaN(parsedDate.getTime())) {
            (0, module_service_utils_1.throwInventoryBadRequest)('Validation failed', [
                {
                    field: fieldName,
                    code: item_qty_price_error_codes_1.ItemQtyPriceErrorCode.DATE_INVALID,
                    message: `${fieldName} must be a valid date`,
                },
            ]);
        }
        return parsedDate;
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
                    code: item_qty_price_error_codes_1.ItemQtyPriceErrorCode.DATE_INVALID,
                    message: `${fieldName} must be a valid date`,
                },
            ]);
        }
        return parsedDate;
    }
    toPayload(record) {
        return {
            iqp_id: record.iqpId,
            iqp_company_id: record.iqpCompanyId,
            iqp_branch_id: record.iqpBranchId,
            iqp_party_id: record.iqpPartyId,
            iqp_price_level: record.iqpPriceLevel,
            iqp_item_id: record.iqpItemId,
            iqp_item_unit_id: record.iqpItemUnitId,
            iqp_from_qty: (0, module_service_utils_1.toNumber)(record.iqpFromQty),
            iqp_to_qty: (0, module_service_utils_1.toNullableNumber)(record.iqpToQty),
            iqp_price_mode: record.iqpPriceMode,
            iqp_disc_pct: (0, module_service_utils_1.toNullableNumber)(record.iqpDiscPct),
            iqp_flat_off: (0, module_service_utils_1.toNullableNumber)(record.iqpFlatOff),
            iqp_price: (0, module_service_utils_1.toNullableNumber)(record.iqpPrice),
            iqp_is_tax_incl: record.iqpIsTaxIncl,
            iqp_effective_from: record.iqpEffectiveFrom?.toISOString(),
            iqp_effective_to: record.iqpEffectiveTo ? record.iqpEffectiveTo.toISOString() : null,
            iqp_is_active: record.iqpIsActive,
            iqp_is_deleted: record.iqpIsDeleted,
            iqp_sync_date: record.iqpSyncDate ? record.iqpSyncDate.toISOString() : null,
            iqp_created_on: record.iqpCreatedOn.toISOString(),
            iqp_created_by: record.iqpCreatedBy,
            iqp_modified_on: record.iqpModifiedOn.toISOString(),
            iqp_modified_by: record.iqpModifiedBy,
            iqp_item_name: record.item?.itemNameEn ?? null,
            iqp_unit_name: record.itemUnitConversion?.unit?.unit_name ?? null,
            iqp_company_name: record.company?.compName ?? null,
            iqp_branch_name: record.branch?.brName ?? null,
            iqp_price_level_name: record.priceLevel?.iplName ?? null,
            iqp_party_name: record.party?.cusName ?? null,
        };
    }
    buildDisplayName(record) {
        const levelSegment = record.iqpPriceLevel ?? 'ALL';
        const upperSegment = record.iqpToQty !== null ? (0, module_service_utils_1.toNumber)(record.iqpToQty) : 'ABOVE';
        return `${record.iqpItemId}:${record.iqpItemUnitId}:L${levelSegment}:[${(0, module_service_utils_1.toNumber)(record.iqpFromQty)}-${upperSegment})`;
    }
    handleWriteError(error) {
        (0, module_service_utils_1.throwOnUniqueConstraintError)(error, 'Item qty price already exists', [
            {
                field: 'iqp_item_id',
                code: item_qty_price_error_codes_1.ItemQtyPriceErrorCode.DUPLICATE,
                message: 'Duplicate qty price slab is not allowed',
            },
        ]);
        if ((0, module_service_utils_1.isForeignKeyConstraintError)(error)) {
            (0, module_service_utils_1.throwInventoryBadRequest)('Invalid relation reference', [
                {
                    field: 'iqp_item_id',
                    code: item_qty_price_error_codes_1.ItemQtyPriceErrorCode.REFERENCE_NOT_FOUND,
                    message: 'Referenced item, unit, company, branch, or party does not exist',
                },
            ]);
        }
    }
    throwNotFound(iqpId) {
        (0, module_service_utils_1.throwInventoryNotFound)('Item qty price not found', 'iqp_id', `No item qty price found with id ${iqpId}`, item_qty_price_error_codes_1.ItemQtyPriceErrorCode.NOT_FOUND);
    }
};
exports.ItemsQtyPriceMasterService = ItemsQtyPriceMasterService;
exports.ItemsQtyPriceMasterService = ItemsQtyPriceMasterService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_log_service_1.AuditLogService,
        configured_grid_sql_service_1.ConfiguredGridSqlService,
        request_context_service_1.RequestContextService,
        price_master_writer_service_1.PriceMasterWriter])
], ItemsQtyPriceMasterService);
//# sourceMappingURL=items-qty-price-master.service.js.map