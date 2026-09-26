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
exports.ItemUnitConversionService = void 0;
const common_1 = require("@nestjs/common");
const configured_grid_sql_service_1 = require("../../../common/configured-grid-sql/configured-grid-sql.service");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const audit_log_service_1 = require("../../audit-log/audit-log.service");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const module_list_utils_1 = require("../../../common/utils/module-list.utils");
const DEFAULT_AUDIT_ACTOR = 'system';
const ITEM_UNIT_CONVERSION_TABLE_NAME = 'item_unit_conversion';
const ITEM_UNIT_CONVERSION_AUDIT_SCREEN_NAME = 'Item Unit Conversion Master';
let ItemUnitConversionService = class ItemUnitConversionService {
    prisma;
    auditLogService;
    configuredGridSqlService;
    constructor(prisma, auditLogService, configuredGridSqlService) {
        this.prisma = prisma;
        this.auditLogService = auditLogService;
        this.configuredGridSqlService = configuredGridSqlService;
    }
    async save(saveItemUnitConversionDto, tx) {
        const saveItems = Array.isArray(saveItemUnitConversionDto)
            ? saveItemUnitConversionDto
            : [saveItemUnitConversionDto];
        const saveAll = async (client) => {
            const baseUnitNormalizedSaveItems = await this.normalizeItemUnitConversionBaseUnits(client, saveItems);
            for (const saveItem of baseUnitNormalizedSaveItems) {
                this.validateItemUnitConversion(saveItem);
            }
            const normalizedSaveItems = await this.normalizeItemUnitConversionFactors(client, baseUnitNormalizedSaveItems);
            const savedItems = [];
            for (const saveItem of normalizedSaveItems) {
                savedItems.push(await this.saveItemUnitConversion(client, saveItem));
            }
            return savedItems;
        };
        try {
            const results = tx ? await saveAll(tx) : await this.prisma.$transaction(saveAll);
            return Array.isArray(saveItemUnitConversionDto) ? results : results[0];
        }
        catch (error) {
            this.handleWriteError(error);
            throw error;
        }
    }
    async list(queryDto) {
        const { page, limit, skip } = (0, module_list_utils_1.resolvePagination)(queryDto);
        const where = {
            iucIsDeleted: false,
            ...(queryDto.iuc_item_id !== undefined && { iucItemId: queryDto.iuc_item_id }),
            ...(queryDto.iuc_is_active !== undefined && { iucIsActive: queryDto.iuc_is_active }),
        };
        return (0, module_list_utils_1.runInventoryListQuery)({ page, limit }, {
            configuredGridFn: () => (0, module_list_utils_1.runConfiguredGridQuery)(this.configuredGridSqlService, {
                tableName: ITEM_UNIT_CONVERSION_TABLE_NAME,
                alias: 'item_unit_conversion_grid',
                search: queryDto.search,
                page,
                limit,
                skip,
            }),
            countFn: () => this.prisma.itemUnitConversion.count({ where }),
            findManyFn: () => this.prisma.itemUnitConversion.findMany({
                where,
                orderBy: [{ iucItemId: 'asc' }, { iucUnitSlno: 'asc' }, { iucId: 'asc' }],
                skip,
                take: limit,
            }),
            toItemFn: (record) => this.toPayload(record),
        });
    }
    async getById(iucId) {
        const record = await this.prisma.itemUnitConversion.findFirst({
            where: {
                iucId,
                iucIsDeleted: false,
            },
        });
        if (!record) {
            (0, module_service_utils_1.throwInventoryNotFound)('Item unit conversion not found', 'iuc_id', `No item unit conversion found with id ${iucId}`);
        }
        return this.toPayload(record);
    }
    async findByItemId(itemId, client = this.prisma) {
        const records = await client.itemUnitConversion.findMany({
            where: { iucItemId: itemId, iucIsDeleted: false },
            orderBy: [{ iucUnitSlno: 'asc' }, { iucId: 'asc' }],
        });
        return records.map((record) => this.toPayload(record));
    }
    async findIdsByItemId(itemId, isDeleted) {
        const records = await this.prisma.itemUnitConversion.findMany({
            where: { iucItemId: itemId, iucIsDeleted: isDeleted },
            select: { iucId: true },
        });
        return records.map((record) => record.iucId);
    }
    async toggleDelete(iucId, tx) {
        const toggleIds = Array.isArray(iucId) ? iucId : [iucId];
        const toggleAll = async (client) => {
            const toggledItems = [];
            for (const toggleId of toggleIds) {
                toggledItems.push(await this.toggleDeleteItemUnitConversion(client, toggleId));
            }
            return toggledItems;
        };
        try {
            const results = tx ? await toggleAll(tx) : await this.prisma.$transaction(toggleAll);
            return Array.isArray(iucId) ? results : results[0];
        }
        catch (error) {
            this.handleDeleteError(error);
            throw error;
        }
    }
    async saveItemUnitConversion(tx, saveItemUnitConversionDto) {
        if (saveItemUnitConversionDto.iuc_id) {
            return this.updateItemUnitConversion(tx, saveItemUnitConversionDto);
        }
        return this.createItemUnitConversion(tx, saveItemUnitConversionDto);
    }
    async createItemUnitConversion(tx, saveItemUnitConversionDto) {
        this.validateItemUnitConversion(saveItemUnitConversionDto);
        const now = new Date();
        const createdBy = this.resolveRecordActor(saveItemUnitConversionDto.iuc_created_by);
        const updatedBy = this.resolveRecordActor(saveItemUnitConversionDto.iuc_updated_by) ?? createdBy;
        const baseUnitId = saveItemUnitConversionDto.iuc_base_unit_id ?? saveItemUnitConversionDto.iuc_unit_id;
        const data = {
            iucItemId: saveItemUnitConversionDto.iuc_item_id,
            iucUnitId: saveItemUnitConversionDto.iuc_unit_id,
            iucBaseUnitId: baseUnitId,
            iucCreatedOn: now,
            iucCreatedBy: createdBy,
            iucUpdatedOn: now,
            iucUpdatedBy: updatedBy,
        };
        this.applyOptionalFields(data, saveItemUnitConversionDto);
        this.assertItemUnitConversionConstraints({
            unitId: saveItemUnitConversionDto.iuc_unit_id,
            baseUnitId,
            toBaseFactor: saveItemUnitConversionDto.iuc_to_base_factor ?? 1,
            uomWeight: saveItemUnitConversionDto.iuc_uom_weight ?? 0,
            isBaseUnit: saveItemUnitConversionDto.iuc_is_base_unit ?? false,
        });
        const created = await tx.itemUnitConversion.create({ data });
        const payload = this.toPayload(created);
        await this.auditLogService.logEntityChange({
            action: 'New',
            tableName: ITEM_UNIT_CONVERSION_TABLE_NAME,
            screenName: ITEM_UNIT_CONVERSION_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: payload.iuc_id,
            displayName: this.buildDisplayName(created),
            originalRecord: null,
            modifiedRecord: payload,
            userId: this.resolveAuditActor(createdBy),
            notes: 'Item unit conversion created',
        }, tx);
        return payload;
    }
    async updateItemUnitConversion(tx, saveItemUnitConversionDto) {
        this.validateItemUnitConversion(saveItemUnitConversionDto);
        const iucId = saveItemUnitConversionDto.iuc_id;
        const existing = await tx.itemUnitConversion.findFirst({
            where: {
                iucId,
                iucIsDeleted: false,
            },
        });
        if (!existing) {
            (0, module_service_utils_1.throwInventoryNotFound)('Item unit conversion not found', 'iuc_id', `No item unit conversion found with id ${iucId}`);
        }
        const baseUnitId = saveItemUnitConversionDto.iuc_base_unit_id ?? existing.iucBaseUnitId;
        const data = {
            iucItemId: saveItemUnitConversionDto.iuc_item_id,
            iucUnitId: saveItemUnitConversionDto.iuc_unit_id,
            iucBaseUnitId: baseUnitId,
            iucUpdatedOn: new Date(),
        };
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemUnitConversionDto, 'iuc_updated_by')) {
            data.iucUpdatedBy = this.resolveRecordActor(saveItemUnitConversionDto.iuc_updated_by);
        }
        this.applyOptionalFields(data, saveItemUnitConversionDto);
        this.assertItemUnitConversionConstraints({
            unitId: saveItemUnitConversionDto.iuc_unit_id ?? existing.iucUnitId,
            baseUnitId,
            toBaseFactor: saveItemUnitConversionDto.iuc_to_base_factor ?? (0, module_service_utils_1.toNumber)(existing.iucToBaseFactor),
            uomWeight: saveItemUnitConversionDto.iuc_uom_weight ?? (0, module_service_utils_1.toNumber)(existing.iucUomWeight),
            isBaseUnit: saveItemUnitConversionDto.iuc_is_base_unit ?? existing.iucIsBaseUnit,
        });
        const updated = await tx.itemUnitConversion.update({
            where: {
                iucId,
            },
            data,
        });
        const payload = this.toPayload(updated);
        await this.auditLogService.logEntityChange({
            action: 'update',
            tableName: ITEM_UNIT_CONVERSION_TABLE_NAME,
            screenName: ITEM_UNIT_CONVERSION_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: iucId,
            displayName: this.buildDisplayName(updated),
            originalRecord: this.toPayload(existing),
            modifiedRecord: payload,
            userId: this.resolveAuditActor(payload.iuc_updated_by),
            notes: 'Item unit conversion updated',
        }, tx);
        return payload;
    }
    async toggleDeleteItemUnitConversion(tx, iucId) {
        const existing = await tx.itemUnitConversion.findFirst({
            where: {
                iucId,
            },
        });
        if (!existing) {
            (0, module_service_utils_1.throwInventoryNotFound)('Item unit conversion not found', 'iuc_id', `No item unit conversion found with id ${iucId}`);
        }
        const nextDeleted = !existing.iucIsDeleted;
        const updatedOn = new Date();
        const updated = await tx.itemUnitConversion.update({
            where: {
                iucId,
            },
            data: {
                iucIsDeleted: nextDeleted,
                iucUpdatedOn: updatedOn,
            },
        });
        await this.auditLogService.logEntityChange({
            action: nextDeleted ? 'cancel' : 'update',
            tableName: ITEM_UNIT_CONVERSION_TABLE_NAME,
            screenName: ITEM_UNIT_CONVERSION_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: iucId,
            displayName: this.buildDisplayName(existing),
            originalRecord: this.toPayload(existing),
            modifiedRecord: this.toPayload(updated),
            userId: this.resolveAuditActor(updated.iucUpdatedBy),
            notes: nextDeleted ? 'Item unit conversion soft deleted' : 'Item unit conversion restored',
        }, tx);
        return {
            iuc_id: iucId,
            deleted: nextDeleted,
        };
    }
    validateItemUnitConversion(saveItemUnitConversionDto) {
        const factor = saveItemUnitConversionDto.iuc_to_base_factor;
        const unitFactor = saveItemUnitConversionDto.iuc_unit_factor ?? saveItemUnitConversionDto.iul_unit_factor;
        const resolvedBaseUnitId = saveItemUnitConversionDto.iuc_base_unit_id ?? saveItemUnitConversionDto.iuc_unit_id;
        if (factor !== undefined && factor <= 0) {
            (0, module_service_utils_1.throwInventoryBadRequest)('Validation failed', [
                {
                    field: 'iuc_to_base_factor',
                    message: 'iuc_to_base_factor must be greater than 0',
                },
            ]);
        }
        if (unitFactor !== undefined && unitFactor <= 0) {
            (0, module_service_utils_1.throwInventoryBadRequest)('Validation failed', [
                {
                    field: 'iuc_unit_factor',
                    message: 'iuc_unit_factor must be greater than 0',
                },
            ]);
        }
        const uomWeight = saveItemUnitConversionDto.iuc_uom_weight;
        if (uomWeight !== undefined && uomWeight < 0) {
            (0, module_service_utils_1.throwInventoryBadRequest)('Validation failed', [
                {
                    field: 'iuc_uom_weight',
                    message: 'iuc_uom_weight cannot be negative',
                },
            ]);
        }
        if (saveItemUnitConversionDto.iuc_is_base_unit !== true) {
            return;
        }
        if (saveItemUnitConversionDto.iuc_unit_id !== resolvedBaseUnitId) {
            (0, module_service_utils_1.throwInventoryBadRequest)('Validation failed', [
                {
                    field: 'iuc_unit_id',
                    message: 'Base unit conversion row must use the selected base unit as iuc_unit_id',
                },
            ]);
        }
    }
    assertItemUnitConversionConstraints(row) {
        const errors = [];
        if (!(row.toBaseFactor > 0)) {
            errors.push({
                field: 'iuc_to_base_factor',
                message: 'iuc_to_base_factor must be greater than 0',
            });
        }
        else if (row.isBaseUnit && row.toBaseFactor !== 1) {
            errors.push({
                field: 'iuc_to_base_factor',
                message: 'Base unit conversion row must use iuc_to_base_factor = 1',
            });
        }
        if (row.uomWeight < 0) {
            errors.push({
                field: 'iuc_uom_weight',
                message: 'iuc_uom_weight cannot be negative',
            });
        }
        if (row.isBaseUnit && row.unitId !== row.baseUnitId) {
            errors.push({
                field: 'iuc_unit_id',
                message: 'Base unit conversion row must use the selected base unit as iuc_unit_id',
            });
        }
        if (errors.length > 0) {
            (0, module_service_utils_1.throwInventoryBadRequest)('Validation failed', errors);
        }
    }
    async normalizeItemUnitConversionBaseUnits(tx, saveItems) {
        const inferredBaseUnitIds = new Map();
        for (const saveItem of saveItems) {
            if (saveItem.iuc_base_unit_id) {
                inferredBaseUnitIds.set(saveItem.iuc_item_id, saveItem.iuc_base_unit_id);
                continue;
            }
            if (saveItem.iuc_is_base_unit === true) {
                inferredBaseUnitIds.set(saveItem.iuc_item_id, saveItem.iuc_unit_id);
            }
        }
        for (const saveItem of saveItems) {
            if (saveItem.iuc_base_unit_id || inferredBaseUnitIds.has(saveItem.iuc_item_id)) {
                continue;
            }
            const persistedBaseUnitId = await this.resolvePersistedItemUnitConversionBaseUnitId(tx, saveItem.iuc_id, saveItem.iuc_item_id);
            inferredBaseUnitIds.set(saveItem.iuc_item_id, persistedBaseUnitId ?? saveItem.iuc_unit_id);
        }
        return saveItems.map((saveItem) => saveItem.iuc_base_unit_id
            ? saveItem
            : {
                ...saveItem,
                iuc_base_unit_id: inferredBaseUnitIds.get(saveItem.iuc_item_id) ?? saveItem.iuc_unit_id,
            });
    }
    async normalizeItemUnitConversionFactors(tx, saveItems) {
        if (saveItems.length === 0) {
            return saveItems;
        }
        const normalizedItems = [...saveItems];
        const saveItemsByItemId = new Map();
        saveItems.forEach((saveItem, index) => {
            const existingEntries = saveItemsByItemId.get(saveItem.iuc_item_id) ?? [];
            existingEntries.push({ index, item: saveItem });
            saveItemsByItemId.set(saveItem.iuc_item_id, existingEntries);
        });
        for (const [itemId, indexedSaveItems] of saveItemsByItemId.entries()) {
            const persistedRows = await tx.itemUnitConversion.findMany({
                where: {
                    iucItemId: itemId,
                    iucIsDeleted: false,
                },
                orderBy: [{ iucUnitSlno: 'asc' }, { iucId: 'asc' }],
            });
            const effectiveRows = persistedRows.map((row) => ({
                iucId: row.iucId,
                unitId: row.iucUnitId,
                baseUnitId: row.iucBaseUnitId,
                unitSlno: row.iucUnitSlno,
                toBaseFactor: this.toPositiveFactor(row.iucToBaseFactor),
                unitFactor: this.toPositiveFactor(row.iucUnitFactor),
                isBaseUnit: row.iucIsBaseUnit,
            }));
            for (const { index, item } of indexedSaveItems) {
                const nextRow = {
                    saveIndex: index,
                    iucId: item.iuc_id,
                    unitId: item.iuc_unit_id,
                    baseUnitId: item.iuc_base_unit_id ?? item.iuc_unit_id,
                    unitSlno: item.iuc_unit_slno ?? 0,
                    toBaseFactor: this.toPositiveFactor(item.iuc_to_base_factor),
                    unitFactor: this.toPositiveFactor(item.iuc_unit_factor ?? item.iul_unit_factor),
                    isBaseUnit: item.iuc_is_base_unit === true ||
                        (item.iuc_base_unit_id ?? item.iuc_unit_id) === item.iuc_unit_id,
                };
                const existingIndex = effectiveRows.findIndex((row) => item.iuc_id ? row.iucId === item.iuc_id : row.unitId === item.iuc_unit_id);
                if (existingIndex >= 0) {
                    effectiveRows[existingIndex] = {
                        ...effectiveRows[existingIndex],
                        ...nextRow,
                    };
                }
                else {
                    effectiveRows.push(nextRow);
                }
            }
            if (effectiveRows.length === 0) {
                continue;
            }
            effectiveRows.sort((left, right) => {
                if (left.unitSlno !== right.unitSlno) {
                    return left.unitSlno - right.unitSlno;
                }
                return left.unitId.localeCompare(right.unitId);
            });
            const resolvedBaseUnitId = indexedSaveItems.find(({ item }) => item.iuc_is_base_unit === true)?.item.iuc_unit_id ??
                effectiveRows.find((row) => row.isBaseUnit)?.unitId ??
                effectiveRows[0].baseUnitId ??
                effectiveRows[0].unitId;
            for (const row of effectiveRows) {
                row.baseUnitId = resolvedBaseUnitId;
                row.isBaseUnit = row.unitId === resolvedBaseUnitId;
            }
            const cumulativeByUnitId = new Map();
            for (let i = 0; i < effectiveRows.length; i++) {
                const row = effectiveRows[i];
                if (i === 0) {
                    row.unitFactor = 1;
                    row.toBaseFactor = row.toBaseFactor ?? 1;
                    cumulativeByUnitId.set(row.unitId, 1);
                    continue;
                }
                const previousRow = effectiveRows[i - 1];
                const resolvedUnitFactor = this.resolveChainUnitFactor(previousRow, row);
                row.unitFactor = resolvedUnitFactor;
                const previousCumulative = cumulativeByUnitId.get(previousRow.unitId);
                const currentCumulative = this.roundFactor(previousCumulative * resolvedUnitFactor);
                cumulativeByUnitId.set(row.unitId, currentCumulative);
            }
            const baseCumulative = cumulativeByUnitId.get(resolvedBaseUnitId);
            for (const row of effectiveRows) {
                const rowCumulative = cumulativeByUnitId.get(row.unitId);
                row.toBaseFactor = baseCumulative
                    ? this.roundFactor(rowCumulative / baseCumulative)
                    : (row.toBaseFactor ?? rowCumulative);
            }
            for (const row of effectiveRows) {
                if (row.saveIndex === undefined) {
                    continue;
                }
                const saveItem = normalizedItems[row.saveIndex];
                normalizedItems[row.saveIndex] = {
                    ...saveItem,
                    iuc_base_unit_id: resolvedBaseUnitId,
                    iuc_unit_slno: row.unitSlno,
                    iuc_to_base_factor: row.toBaseFactor,
                    iuc_unit_factor: row.unitFactor,
                    iul_unit_factor: row.unitFactor,
                    iuc_is_base_unit: row.isBaseUnit,
                };
            }
        }
        return normalizedItems;
    }
    resolveChainUnitFactor(previousRow, currentRow) {
        const explicitUnitFactor = this.toPositiveFactor(currentRow.unitFactor);
        if (explicitUnitFactor !== undefined) {
            return this.roundFactor(explicitUnitFactor);
        }
        const previousToBaseFactor = this.toPositiveFactor(previousRow.toBaseFactor);
        const currentToBaseFactor = this.toPositiveFactor(currentRow.toBaseFactor);
        if (previousToBaseFactor !== undefined && currentToBaseFactor !== undefined) {
            return this.roundFactor(currentToBaseFactor / previousToBaseFactor);
        }
        (0, module_service_utils_1.throwInventoryBadRequest)('Validation failed', [
            {
                field: 'iuc_unit_factor',
                message: `Missing iuc_unit_factor for unit row ${currentRow.unitId}`,
            },
        ]);
    }
    roundFactor(value, scale = 9) {
        return Number(value.toFixed(scale));
    }
    toPositiveFactor(value) {
        if (value === undefined || value === null) {
            return undefined;
        }
        const parsed = Number(value);
        if (!Number.isFinite(parsed) || parsed <= 0) {
            return undefined;
        }
        return parsed;
    }
    async resolvePersistedItemUnitConversionBaseUnitId(tx, iucId, itemId) {
        if (iucId) {
            const existingRecord = await tx.itemUnitConversion.findFirst({
                where: {
                    iucId,
                    iucIsDeleted: false,
                },
            });
            if (existingRecord?.iucBaseUnitId) {
                return existingRecord.iucBaseUnitId;
            }
        }
        const baseRow = await tx.itemUnitConversion.findFirst({
            where: {
                iucItemId: itemId,
                iucIsBaseUnit: true,
                iucIsDeleted: false,
            },
        });
        if (baseRow?.iucBaseUnitId) {
            return baseRow.iucBaseUnitId;
        }
        const existingRow = await tx.itemUnitConversion.findFirst({
            where: {
                iucItemId: itemId,
                iucIsDeleted: false,
            },
        });
        if (existingRow?.iucBaseUnitId) {
            return existingRow.iucBaseUnitId;
        }
        const item = await tx.itemMaster.findFirst({
            where: {
                itemId,
                itemIsDeleted: false,
            },
            select: {
                itemBaseUnitId: true,
            },
        });
        return item?.itemBaseUnitId ?? undefined;
    }
    applyOptionalFields(data, saveItemUnitConversionDto) {
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemUnitConversionDto, 'iuc_to_base_factor')) {
            data.iucToBaseFactor = saveItemUnitConversionDto.iuc_to_base_factor;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemUnitConversionDto, 'iuc_unit_slno')) {
            data.iucUnitSlno = saveItemUnitConversionDto.iuc_unit_slno;
        }
        const hasUnitFactor = (0, module_service_utils_1.hasOwnProperty)(saveItemUnitConversionDto, 'iuc_unit_factor') ||
            (0, module_service_utils_1.hasOwnProperty)(saveItemUnitConversionDto, 'iul_unit_factor');
        const unitFactor = saveItemUnitConversionDto.iuc_unit_factor ?? saveItemUnitConversionDto.iul_unit_factor;
        if (hasUnitFactor && unitFactor !== undefined) {
            data.iucUnitFactor = unitFactor;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemUnitConversionDto, 'iuc_is_default_unit')) {
            data.iucIsDefaultUnit = saveItemUnitConversionDto.iuc_is_default_unit;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemUnitConversionDto, 'iuc_is_base_unit')) {
            data.iucIsBaseUnit = saveItemUnitConversionDto.iuc_is_base_unit;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemUnitConversionDto, 'iuc_is_big_unit')) {
            data.iucIsBigUnit = saveItemUnitConversionDto.iuc_is_big_unit;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemUnitConversionDto, 'iuc_uom_weight')) {
            data.iucUomWeight = saveItemUnitConversionDto.iuc_uom_weight;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemUnitConversionDto, 'iuc_uom_remarks')) {
            data.iucUomRemarks = saveItemUnitConversionDto.iuc_uom_remarks;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemUnitConversionDto, 'iuc_is_active')) {
            data.iucIsActive = saveItemUnitConversionDto.iuc_is_active;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemUnitConversionDto, 'iuc_sync_date')) {
            data.iucSyncDate = this.parseOptionalDate(saveItemUnitConversionDto.iuc_sync_date, 'iuc_sync_date');
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
                    message: `${fieldName} must be a valid date`,
                },
            ]);
        }
        return parsedDate;
    }
    toPayload(record) {
        return {
            iuc_id: record.iucId,
            iuc_item_id: record.iucItemId,
            iuc_unit_id: record.iucUnitId,
            iuc_base_unit_id: record.iucBaseUnitId,
            iuc_to_base_factor: (0, module_service_utils_1.toNumber)(record.iucToBaseFactor),
            iuc_unit_slno: record.iucUnitSlno,
            iuc_unit_factor: (0, module_service_utils_1.toNumber)(record.iucUnitFactor),
            iuc_is_default_unit: record.iucIsDefaultUnit,
            iuc_is_base_unit: record.iucIsBaseUnit,
            iuc_is_big_unit: record.iucIsBigUnit,
            iuc_uom_weight: (0, module_service_utils_1.toNumber)(record.iucUomWeight),
            iuc_uom_remarks: record.iucUomRemarks,
            iuc_is_active: record.iucIsActive,
            iuc_is_deleted: record.iucIsDeleted,
            iuc_sync_date: record.iucSyncDate ? record.iucSyncDate.toISOString() : null,
            iuc_created_on: record.iucCreatedOn.toISOString(),
            iuc_created_by: record.iucCreatedBy,
            iuc_updated_on: record.iucUpdatedOn ? record.iucUpdatedOn.toISOString() : null,
            iuc_updated_by: record.iucUpdatedBy,
        };
    }
    buildDisplayName(record) {
        return `${record.iucItemId}:${record.iucUnitId}:${record.iucBaseUnitId}`;
    }
    resolveRecordActor(value) {
        const trimmed = value?.trim();
        return trimmed || null;
    }
    resolveAuditActor(value, fallback = DEFAULT_AUDIT_ACTOR) {
        const trimmed = value?.trim();
        return trimmed || fallback;
    }
    handleWriteError(error) {
        (0, module_service_utils_1.throwOnUniqueConstraintError)(error, 'Item unit conversion already exists', [
            {
                field: 'iuc_unit_id',
                message: 'Duplicate item unit conversion, default-unit, or base-unit configuration is not allowed',
            },
        ]);
        if ((0, module_service_utils_1.isForeignKeyConstraintError)(error)) {
            (0, module_service_utils_1.throwInventoryBadRequest)('Invalid relation reference', [
                {
                    field: 'request',
                    message: 'Referenced item, unit, or base unit does not exist',
                },
            ]);
        }
    }
    handleDeleteError(error) {
        if ((0, module_service_utils_1.isForeignKeyConstraintError)(error)) {
            (0, module_service_utils_1.throwInventoryBadRequest)('Cannot delete item unit conversion', [{ field: 'iuc_id', message: 'Item unit conversion is referenced by related records' }]);
        }
    }
};
exports.ItemUnitConversionService = ItemUnitConversionService;
exports.ItemUnitConversionService = ItemUnitConversionService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_log_service_1.AuditLogService,
        configured_grid_sql_service_1.ConfiguredGridSqlService])
], ItemUnitConversionService);
//# sourceMappingURL=item-unit-conversion.service.js.map