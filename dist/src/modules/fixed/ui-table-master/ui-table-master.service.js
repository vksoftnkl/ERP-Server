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
exports.UiTableMasterService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const audit_log_service_1 = require("../../audit-log/audit-log.service");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const UI_TABLE_MASTER_TABLE_NAME = 'ui tables';
const UI_TABLE_COLUMN_TABLE_NAME = 'ui table columns';
const UI_TABLE_MASTER_AUDIT_SCREEN_NAME = 'UI Table Master';
const UI_TABLE_MASTER_OPTIONAL_FIELDS = ['uiTblEditable', 'uiTblIsActive', 'uiTblDeviceType'];
const UI_TABLE_VISIBILITY_SETTING_FIELDS = [
    'uiTblClmColumnWidth',
    'uiTblClmColumnVisibility',
    'uiTblClmColumnFocus',
    'uiTblClmColumnPosition',
    'uiTblClmColumnNecessity',
    'uiTblClmNextColumn',
    'uiTblClmPreviousColumn',
    'uiTblClmPx',
];
const UI_TABLE_COLUMN_OPTIONAL_FIELDS = [
    'uiTblClmColumnWidth',
    'uiTblClmColumnVisibility',
    'uiTblClmColumnFocus',
    'uiTblClmColumnPosition',
    'uiTblClmColumnNecessity',
    'uiTblClmNextColumn',
    'uiTblClmPreviousColumn',
    'uiTblClmPx',
    'uiTblClmIsActive',
];
let UiTableMasterService = class UiTableMasterService {
    prisma;
    auditLogService;
    requestContextService;
    constructor(prisma, auditLogService, requestContextService) {
        this.prisma = prisma;
        this.auditLogService = auditLogService;
        this.requestContextService = requestContextService;
    }
    async save(saveUiTableMasterDto) {
        return saveUiTableMasterDto.uiTblId
            ? this.updateUiTable(saveUiTableMasterDto)
            : this.createUiTable(saveUiTableMasterDto);
    }
    async list(queryDto) {
        const requestedTableId = queryDto.uiTableId ?? queryDto.uiTblId;
        const fixedTableId = requestedTableId ? BigInt(requestedTableId) : undefined;
        const search = queryDto.search?.trim();
        const tableWhere = {
            uiTblIsDeleted: false,
            ...(fixedTableId !== undefined ? { uiTblId: fixedTableId } : {}),
            ...(search ? { uiTblName: { contains: search, mode: 'insensitive' } } : {}),
        };
        const columnWhere = {
            uiTblClmIsDeleted: false,
        };
        const records = await this.prisma.uitable.findMany({
            where: tableWhere,
            orderBy: { uiTblId: 'asc' },
            include: {
                uiTableColumns: {
                    where: columnWhere,
                    orderBy: [{ uiTblClmNo: 'asc' }, { uiTblClmId: 'asc' }],
                },
            },
        });
        return { items: records.map((record) => this.toPayload(record)) };
    }
    async getById(uiTblId) {
        const parsedUiTableId = this.parseBigIntId('uiTblId', uiTblId);
        const record = await this.prisma.uitable.findFirst({
            where: { uiTblId: parsedUiTableId, uiTblIsDeleted: false },
            include: {
                uiTableColumns: {
                    where: { uiTblClmIsDeleted: false },
                    orderBy: [{ uiTblClmNo: 'asc' }, { uiTblClmId: 'asc' }],
                },
            },
        });
        if (!record) {
            (0, module_service_utils_1.throwFixedNotFound)('UI table not found', 'uiTblId', `No active UI table found with id ${uiTblId}`);
        }
        return this.toPayload(record);
    }
    async updateColumnWidths(dto) {
        const actor = (0, module_service_utils_1.resolveActor)(null, this.requestContextService.getUserId());
        let count = 0;
        await this.prisma.$transaction(async (tx) => {
            for (const item of dto.columns) {
                const columnId = BigInt(item.uiTblClmId);
                const existing = await tx.uitableColumns.findFirst({
                    where: { uiTblClmId: columnId, uiTblClmIsDeleted: false },
                    select: { uiTblClmId: true },
                });
                if (!existing) {
                    (0, module_service_utils_1.throwFixedNotFound)('UI table column not found', 'uiTblClmId', `No active UI table column found with id ${item.uiTblClmId}`);
                }
                const data = {
                    uiTblClmColumnWidth: item.uiTblClmColumnWidth,
                    uiTblClmModifiedOn: new Date(),
                    uiTblClmModifiedBy: actor,
                };
                if ((0, module_service_utils_1.hasOwnProperty)(item, 'uiTblClmPx')) {
                    data.uiTblClmPx = item.uiTblClmPx;
                }
                await tx.uitableColumns.update({ where: { uiTblClmId: columnId }, data });
                count++;
            }
        });
        return { updated: count };
    }
    async updateVisibilitySettings(dto) {
        const actor = (0, module_service_utils_1.resolveActor)(null, this.requestContextService.getUserId());
        let count = 0;
        await this.prisma.$transaction(async (tx) => {
            for (const item of dto.columns) {
                const columnId = BigInt(item.uiTblClmId);
                const existing = await tx.uitableColumns.findFirst({
                    where: { uiTblClmId: columnId, uiTblClmIsDeleted: false },
                    select: { uiTblClmId: true },
                });
                if (!existing) {
                    (0, module_service_utils_1.throwFixedNotFound)('UI table column not found', 'uiTblClmId', `No active UI table column found with id ${item.uiTblClmId}`);
                }
                const data = {
                    uiTblClmModifiedOn: new Date(),
                    uiTblClmModifiedBy: actor,
                };
                for (const field of UI_TABLE_VISIBILITY_SETTING_FIELDS) {
                    const value = item[field];
                    if (value !== undefined) {
                        data[field] = value;
                    }
                }
                await tx.uitableColumns.update({ where: { uiTblClmId: columnId }, data });
                count++;
            }
        });
        return { updated: count };
    }
    async softDelete(uiTblId) {
        const parsedUiTableId = this.parseBigIntId('uiTblId', uiTblId);
        return this.prisma.$transaction(async (tx) => {
            const existing = await tx.uitable.findFirst({
                where: { uiTblId: parsedUiTableId, uiTblIsDeleted: false },
            });
            if (!existing) {
                (0, module_service_utils_1.throwFixedNotFound)('UI table not found', 'uiTblId', `No active UI table found with id ${uiTblId}`);
            }
            const modifiedOn = new Date();
            const actor = this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR;
            const result = await tx.uitable.updateMany({
                where: { uiTblId: parsedUiTableId, uiTblIsDeleted: false },
                data: {
                    uiTblIsDeleted: true,
                    uiTblIsActive: false,
                    uiTblModifiedOn: modifiedOn,
                    uiTblModifiedBy: actor,
                },
            });
            if (result.count === 0) {
                (0, module_service_utils_1.throwFixedNotFound)('UI table not found', 'uiTblId', `No active UI table found with id ${uiTblId}`);
            }
            const originalRecord = this.toPayload({ ...existing, uiTableColumns: [] });
            const modifiedRecord = this.toPayload({
                ...existing,
                uiTblIsDeleted: true,
                uiTblIsActive: false,
                uiTblModifiedOn: modifiedOn,
                uiTblModifiedBy: actor,
                uiTableColumns: [],
            });
            await this.auditLogService.logEntityChange({
                action: 'cancel',
                tableName: UI_TABLE_MASTER_TABLE_NAME,
                screenName: UI_TABLE_MASTER_AUDIT_SCREEN_NAME,
                screenType: 'master',
                pk: uiTblId,
                displayName: this.resolveDisplayName(existing.uiTblName, uiTblId),
                originalRecord,
                modifiedRecord,
                userId: actor,
                notes: 'UI table soft deleted',
            }, tx);
            return { uiTblId, deleted: true };
        });
    }
    async softDeleteColumn(uiTblClmId) {
        const parsedColumnId = this.parseBigIntId('uiTblClmId', uiTblClmId);
        return this.prisma.$transaction(async (tx) => {
            const existing = await tx.uitableColumns.findFirst({
                where: { uiTblClmId: parsedColumnId, uiTblClmIsDeleted: false },
            });
            if (!existing) {
                (0, module_service_utils_1.throwFixedNotFound)('UI table column not found', 'uiTblClmId', `No active UI table column found with id ${uiTblClmId}`);
            }
            const modifiedOn = new Date();
            const actor = this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR;
            await tx.uitableColumns.update({
                where: { uiTblClmId: parsedColumnId },
                data: {
                    uiTblClmIsDeleted: true,
                    uiTblClmIsActive: false,
                    uiTblClmModifiedOn: modifiedOn,
                    uiTblClmModifiedBy: actor,
                },
            });
            await this.auditLogService.logEntityChange({
                action: 'cancel',
                tableName: UI_TABLE_COLUMN_TABLE_NAME,
                screenName: UI_TABLE_MASTER_AUDIT_SCREEN_NAME,
                screenType: 'master',
                pk: uiTblClmId,
                displayName: existing.uiTblClmName?.trim() || `UI table column ${uiTblClmId}`,
                originalRecord: this.toColumnPayload(existing),
                modifiedRecord: this.toColumnPayload({
                    ...existing,
                    uiTblClmIsDeleted: true,
                    uiTblClmIsActive: false,
                    uiTblClmModifiedOn: modifiedOn,
                    uiTblClmModifiedBy: actor,
                }),
                userId: actor,
                notes: 'UI table column soft deleted',
            }, tx);
            return { uiTblClmId, deleted: true };
        });
    }
    async createUiTable(saveUiTableMasterDto) {
        const normalizedName = this.normalizeRequiredName(saveUiTableMasterDto.uiTblName);
        const now = new Date();
        const createdBy = (0, module_service_utils_1.resolveActor)(null, this.requestContextService.getUserId());
        const data = {
            uiTblName: normalizedName,
            uiTblCreatedOn: now,
            uiTblCreatedBy: createdBy,
        };
        (0, module_service_utils_1.applyPresentFields)(data, saveUiTableMasterDto, UI_TABLE_MASTER_OPTIONAL_FIELDS);
        try {
            return await this.prisma.$transaction(async (tx) => {
                await this.ensureNameIsUnique(tx, normalizedName);
                const created = await tx.uitable.create({ data });
                if (saveUiTableMasterDto.uiTblColumns?.length) {
                    await this.saveColumnsInTx(saveUiTableMasterDto.uiTblColumns, created.uiTblId, createdBy, tx);
                }
                const full = await tx.uitable.findFirstOrThrow({
                    where: { uiTblId: created.uiTblId },
                    include: {
                        uiTableColumns: {
                            where: { uiTblClmIsDeleted: false },
                            orderBy: [{ uiTblClmNo: 'asc' }, { uiTblClmId: 'asc' }],
                        },
                    },
                });
                const payload = this.toPayload(full);
                await this.auditLogService.logEntityChange({
                    action: 'New',
                    tableName: UI_TABLE_MASTER_TABLE_NAME,
                    screenName: UI_TABLE_MASTER_AUDIT_SCREEN_NAME,
                    screenType: 'master',
                    pk: payload.uiTblId,
                    displayName: this.resolveDisplayName(payload.uiTblName, payload.uiTblId),
                    originalRecord: null,
                    modifiedRecord: payload,
                    userId: createdBy,
                    notes: 'UI table created',
                }, tx);
                return payload;
            });
        }
        catch (error) {
            (0, module_service_utils_1.throwOnUniqueConstraintError)(error, 'UI table already exists', [{ field: 'uiTblName', message: 'Duplicate uiTblName is not allowed' }]);
            throw error;
        }
    }
    async updateUiTable(saveUiTableMasterDto) {
        const uiTblId = saveUiTableMasterDto.uiTblId;
        const parsedUiTableId = this.parseBigIntId('uiTblId', uiTblId);
        try {
            return await this.prisma.$transaction(async (tx) => {
                const existing = await tx.uitable.findFirst({
                    where: { uiTblId: parsedUiTableId, uiTblIsDeleted: false },
                });
                if (!existing) {
                    (0, module_service_utils_1.throwFixedNotFound)('UI table not found', 'uiTblId', `No active UI table found with id ${uiTblId}`);
                }
                const actor = (0, module_service_utils_1.resolveActor)(null, this.requestContextService.getUserId());
                const data = {
                    uiTblModifiedOn: new Date(),
                    uiTblModifiedBy: actor,
                };
                if (saveUiTableMasterDto.uiTblName?.trim()) {
                    const normalizedName = this.normalizeRequiredName(saveUiTableMasterDto.uiTblName);
                    await this.ensureNameIsUnique(tx, normalizedName, parsedUiTableId);
                    data.uiTblName = normalizedName;
                }
                (0, module_service_utils_1.applyPresentFields)(data, saveUiTableMasterDto, UI_TABLE_MASTER_OPTIONAL_FIELDS);
                await tx.uitable.update({ where: { uiTblId: parsedUiTableId }, data });
                if (saveUiTableMasterDto.uiTblColumns !== undefined) {
                    const keptIds = await this.saveColumnsInTx(saveUiTableMasterDto.uiTblColumns, parsedUiTableId, actor, tx);
                    if (saveUiTableMasterDto.replaceColumns === true) {
                        await tx.uitableColumns.updateMany({
                            where: {
                                uiTblClmTableId: parsedUiTableId,
                                uiTblClmIsDeleted: false,
                                ...(keptIds.length > 0 ? { uiTblClmId: { notIn: keptIds } } : {}),
                            },
                            data: {
                                uiTblClmIsDeleted: true,
                                uiTblClmIsActive: false,
                                uiTblClmModifiedOn: new Date(),
                                uiTblClmModifiedBy: actor,
                            },
                        });
                    }
                }
                const full = await tx.uitable.findFirstOrThrow({
                    where: { uiTblId: parsedUiTableId },
                    include: {
                        uiTableColumns: {
                            where: { uiTblClmIsDeleted: false },
                            orderBy: [{ uiTblClmNo: 'asc' }, { uiTblClmId: 'asc' }],
                        },
                    },
                });
                const payload = this.toPayload(full);
                await this.auditLogService.logEntityChange({
                    action: 'update',
                    tableName: UI_TABLE_MASTER_TABLE_NAME,
                    screenName: UI_TABLE_MASTER_AUDIT_SCREEN_NAME,
                    screenType: 'master',
                    pk: uiTblId,
                    displayName: this.resolveDisplayName(payload.uiTblName, payload.uiTblId),
                    originalRecord: this.toPayload({ ...existing, uiTableColumns: [] }),
                    modifiedRecord: payload,
                    userId: actor,
                    notes: 'UI table updated',
                }, tx);
                return payload;
            });
        }
        catch (error) {
            (0, module_service_utils_1.throwOnUniqueConstraintError)(error, 'UI table already exists', [{ field: 'uiTblName', message: 'Duplicate uiTblName is not allowed' }]);
            throw error;
        }
    }
    async saveColumnsInTx(columns, tableId, actor, tx) {
        const savedIds = [];
        for (const colDto of columns) {
            savedIds.push(await this.upsertColumnInTx(colDto, tableId, actor, tx));
        }
        return savedIds;
    }
    async upsertColumnInTx(colDto, tableId, actor, tx) {
        const normalizedName = colDto.uiTblClmName?.trim();
        if (!normalizedName) {
            (0, module_service_utils_1.throwFixedBadRequest)('Validation failed', [{ field: 'uiTblClmName', message: 'uiTblClmName must not be empty' }]);
        }
        const now = new Date();
        if (colDto.uiTblClmId) {
            const parsedId = BigInt(colDto.uiTblClmId);
            const colData = {
                uiTblClmName: normalizedName,
                uiTblClmTableId: tableId,
                uiTblClmModifiedOn: now,
                uiTblClmModifiedBy: actor,
            };
            if (colDto.uiTblClmNo !== undefined && colDto.uiTblClmNo !== null) {
                colData.uiTblClmNo = BigInt(colDto.uiTblClmNo);
            }
            (0, module_service_utils_1.applyPresentFields)(colData, colDto, UI_TABLE_COLUMN_OPTIONAL_FIELDS);
            await tx.uitableColumns.update({ where: { uiTblClmId: parsedId }, data: colData });
            return parsedId;
        }
        else {
            const colData = {
                uiTblClmName: normalizedName,
                uiTblClmTableId: tableId,
                uiTblClmCreatedOn: now,
                uiTblClmCreatedBy: actor,
            };
            if (colDto.uiTblClmNo !== undefined && colDto.uiTblClmNo !== null) {
                colData.uiTblClmNo = BigInt(colDto.uiTblClmNo);
            }
            (0, module_service_utils_1.applyPresentFields)(colData, colDto, UI_TABLE_COLUMN_OPTIONAL_FIELDS);
            const created = await tx.uitableColumns.create({ data: colData });
            return created.uiTblClmId;
        }
    }
    async ensureNameIsUnique(tx, uiTblName, excludeId) {
        const existing = await tx.uitable.findFirst({
            where: {
                uiTblIsDeleted: false,
                uiTblName: { equals: uiTblName, mode: 'insensitive' },
                ...(excludeId ? { uiTblId: { not: excludeId } } : {}),
            },
            select: { uiTblId: true },
        });
        if (existing) {
            (0, module_service_utils_1.throwFixedConflict)('UI table name already exists', [{ field: 'uiTblName', message: 'Duplicate uiTblName is not allowed' }]);
        }
    }
    normalizeRequiredName(name) {
        const trimmed = name.trim();
        if (!trimmed) {
            (0, module_service_utils_1.throwFixedBadRequest)('Validation failed', [{ field: 'uiTblName', message: 'uiTblName must not be empty' }]);
        }
        return trimmed;
    }
    toPayload(record) {
        return {
            uiTblId: record.uiTblId.toString(),
            uiTblName: record.uiTblName,
            uiTblEditable: record.uiTblEditable,
            uiTblIsActive: record.uiTblIsActive,
            uiTblIsDeleted: record.uiTblIsDeleted,
            uiTblDeviceType: record['uiTblDeviceType'] ?? null,
            uiTblSyncDate: record.uiTblSyncDate ? record.uiTblSyncDate.toISOString() : null,
            uiTblSyncOn: record.uiTblSyncOn ? record.uiTblSyncOn.toISOString() : null,
            uiTblCreatedOn: record.uiTblCreatedOn.toISOString(),
            uiTblCreatedBy: record.uiTblCreatedBy,
            uiTblModifiedOn: record.uiTblModifiedOn.toISOString(),
            uiTblModifiedBy: record.uiTblModifiedBy,
            columns: record.uiTableColumns.map((col) => this.toColumnPayload(col)),
        };
    }
    toColumnPayload(record) {
        return {
            uiTblClmId: record.uiTblClmId.toString(),
            uiTblClmNo: record.uiTblClmNo?.toString() ?? '',
            uiTblClmName: record.uiTblClmName,
            uiTblClmTableId: record.uiTblClmTableId?.toString() ?? null,
            uiTblClmColumnWidth: record.uiTblClmColumnWidth === null ? null : Number(record.uiTblClmColumnWidth),
            uiTblClmColumnVisibility: record.uiTblClmColumnVisibility,
            uiTblClmColumnFocus: record.uiTblClmColumnFocus,
            uiTblClmColumnPosition: record.uiTblClmColumnPosition,
            uiTblClmColumnNecessity: record.uiTblClmColumnNecessity,
            uiTblClmNextColumn: record.uiTblClmNextColumn,
            uiTblClmPreviousColumn: record.uiTblClmPreviousColumn,
            uiTblClmPx: record.uiTblClmPx,
            uiTblClmIsActive: record.uiTblClmIsActive,
            uiTblClmIsDeleted: record.uiTblClmIsDeleted,
            uiTblClmSyncDate: record.uiTblClmSyncDate ? record.uiTblClmSyncDate.toISOString() : null,
            uiTblClmCreatedOn: record.uiTblClmCreatedOn.toISOString(),
            uiTblClmCreatedBy: record.uiTblClmCreatedBy,
            uiTblClmModifiedOn: record.uiTblClmModifiedOn.toISOString(),
            uiTblClmModifiedBy: record.uiTblClmModifiedBy,
        };
    }
    resolveDisplayName(uiTblName, uiTblId) {
        return uiTblName?.trim() || `UI Table ${uiTblId}`;
    }
    parseBigIntId(field, value) {
        const normalized = value.trim();
        if (!/^\d+$/.test(normalized)) {
            (0, module_service_utils_1.throwFixedBadRequest)('Validation failed', [{ field, message: `${field} must be a numeric id` }]);
        }
        return BigInt(normalized);
    }
};
exports.UiTableMasterService = UiTableMasterService;
exports.UiTableMasterService = UiTableMasterService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_log_service_1.AuditLogService,
        request_context_service_1.RequestContextService])
], UiTableMasterService);
//# sourceMappingURL=ui-table-master.service.js.map