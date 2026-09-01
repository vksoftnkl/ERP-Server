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
exports.GridDetailsService = void 0;
const common_1 = require("@nestjs/common");
const configured_grid_sql_service_1 = require("../../common/configured-grid-sql/configured-grid-sql.service");
const prisma_service_1 = require("../../database/prisma/prisma.service");
const audit_log_service_1 = require("../audit-log/audit-log.service");
const request_context_service_1 = require("../../common/request-context/request-context.service");
const module_service_utils_1 = require("../../common/utils/module-service.utils");
const GRID_DETAIL_TABLE_NAME = 'grid details';
const GRID_COLUMN_TABLE_NAME = 'grid column';
const GRID_DETAIL_AUDIT_SCREEN_NAME = 'Grid Details';
let GridDetailsService = class GridDetailsService {
    prisma;
    configuredGridSqlService;
    auditLogService;
    requestContextService;
    constructor(prisma, configuredGridSqlService, auditLogService, requestContextService) {
        this.prisma = prisma;
        this.configuredGridSqlService = configuredGridSqlService;
        this.auditLogService = auditLogService;
        this.requestContextService = requestContextService;
    }
    async save(saveGridDetailDto) {
        return saveGridDetailDto.grid_id
            ? this.updateGridDetails(saveGridDetailDto)
            : this.createGridDetails(saveGridDetailDto);
    }
    async list(queryDto) {
        const requestedGridId = queryDto.gridId ?? queryDto.grid_id;
        const fixedGridId = requestedGridId ? BigInt(requestedGridId) : undefined;
        const search = queryDto.search?.trim();
        const where = {
            gridIsDeleted: false,
            ...(fixedGridId !== undefined ? { gridId: fixedGridId } : {}),
            ...(search
                ? {
                    OR: [
                        { gridName: { contains: search, mode: 'insensitive' } },
                        { gridDescription: { contains: search, mode: 'insensitive' } },
                    ],
                }
                : {}),
        };
        const records = await this.prisma.gridDetails.findMany({
            where,
            orderBy: [{ gridSortOrder: 'asc' }, { gridName: 'asc' }],
            include: {
                columns: {
                    where: { gridColumnIsDeleted: false },
                    orderBy: [{ gridColumnNumber: 'asc' }, { gridColumnId: 'asc' }],
                },
            },
        });
        return { items: records.map((record) => this.toPayload(record)) };
    }
    async updateColumnWidths(dto) {
        let count = 0;
        await this.prisma.$transaction(async (tx) => {
            for (const item of dto.columns) {
                const serialId = this.parseUuidId('grid_column_id', item.grid_column_id);
                const existing = await tx.gridColumn.findFirst({
                    where: { gridColumnId: serialId, gridColumnIsDeleted: false },
                    select: { gridColumnId: true },
                });
                if (!existing) {
                    (0, module_service_utils_1.throwFixedNotFound)('Grid column not found', 'grid_column_id', `No active grid column found with id ${item.grid_column_id}`);
                }
                await tx.gridColumn.update({
                    where: { gridColumnId: serialId },
                    data: { gridColumnWidth: item.grid_column_width },
                });
                count++;
            }
        });
        return { updated: count };
    }
    async updateFilterSettings(dto) {
        let count = 0;
        await this.prisma.$transaction(async (tx) => {
            for (const item of dto.columns) {
                const serialId = this.parseUuidId('grid_column_id', item.grid_column_id);
                const existing = await tx.gridColumn.findFirst({
                    where: { gridColumnId: serialId, gridColumnIsDeleted: false },
                    select: { gridColumnId: true },
                });
                if (!existing) {
                    (0, module_service_utils_1.throwFixedNotFound)('Grid column not found', 'grid_column_id', `No active grid column found with id ${item.grid_column_id}`);
                }
                await tx.gridColumn.update({
                    where: { gridColumnId: serialId },
                    data: { gridColumnFilter: item.grid_column_filter },
                });
                count++;
            }
        });
        return { updated: count };
    }
    async updateVisibilitySettings(dto) {
        let count = 0;
        await this.prisma.$transaction(async (tx) => {
            for (const item of dto.columns) {
                const serialId = this.parseUuidId('grid_column_id', item.grid_column_id);
                const existing = await tx.gridColumn.findFirst({
                    where: { gridColumnId: serialId, gridColumnIsDeleted: false },
                    select: { gridColumnId: true },
                });
                if (!existing) {
                    (0, module_service_utils_1.throwFixedNotFound)('Grid column not found', 'grid_column_id', `No active grid column found with id ${item.grid_column_id}`);
                }
                await tx.gridColumn.update({
                    where: { gridColumnId: serialId },
                    data: { gridColumnVisibility: item.grid_column_visibility },
                });
                count++;
            }
        });
        return { updated: count };
    }
    async getById(gridId) {
        const parsedGridId = this.parseBigIntId('grid_id', gridId);
        const record = await this.prisma.gridDetails.findFirst({
            where: { gridId: parsedGridId, gridIsDeleted: false },
            include: {
                columns: {
                    where: { gridColumnIsDeleted: false },
                    orderBy: [{ gridColumnNumber: 'asc' }, { gridColumnId: 'asc' }],
                },
            },
        });
        if (!record) {
            (0, module_service_utils_1.throwFixedNotFound)('Grid details not found', 'grid_id', `No active grid details found with id ${gridId}`);
        }
        return this.toPayload(record);
    }
    async softDelete(gridId) {
        const parsedGridId = this.parseBigIntId('grid_id', gridId);
        const actor = this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR;
        return this.prisma.$transaction(async (tx) => {
            const existing = await tx.gridDetails.findFirst({
                where: { gridId: parsedGridId, gridIsDeleted: false },
            });
            if (!existing) {
                (0, module_service_utils_1.throwFixedNotFound)('Grid details not found', 'grid_id', `No active grid details found with id ${gridId}`);
            }
            const result = await tx.gridDetails.updateMany({
                where: { gridId: parsedGridId, gridIsDeleted: false },
                data: { gridIsDeleted: true, gridStatus: false, gridModifiedBy: actor },
            });
            if (result.count === 0) {
                (0, module_service_utils_1.throwFixedNotFound)('Grid details not found', 'grid_id', `No active grid details found with id ${gridId}`);
            }
            await tx.gridColumn.updateMany({
                where: { gridId: parsedGridId, gridColumnIsDeleted: false },
                data: { gridColumnIsDeleted: true, gridColumnModifiedBy: actor },
            });
            await this.auditLogService.logEntityChange({
                action: 'cancel',
                tableName: GRID_DETAIL_TABLE_NAME,
                screenName: GRID_DETAIL_AUDIT_SCREEN_NAME,
                screenType: 'master',
                pk: gridId,
                displayName: existing.gridName ?? `Grid ${gridId}`,
                originalRecord: this.toPayload({ ...existing, columns: [] }),
                modifiedRecord: this.toPayload({ ...existing, gridIsDeleted: true, gridStatus: false, columns: [] }),
                userId: actor,
                notes: 'Grid details soft deleted',
            }, tx);
            return { grid_id: gridId, deleted: true };
        });
    }
    async softDeleteColumn(grid_column_id) {
        const parsedSerialId = this.parseUuidId('grid_column_id', grid_column_id);
        const actor = this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR;
        return this.prisma.$transaction(async (tx) => {
            const existing = await tx.gridColumn.findFirst({
                where: { gridColumnId: parsedSerialId, gridColumnIsDeleted: false },
            });
            if (!existing) {
                (0, module_service_utils_1.throwFixedNotFound)('Grid column not found', 'grid_column_id', `No active grid column found with id ${grid_column_id}`);
            }
            await tx.gridColumn.update({
                where: { gridColumnId: parsedSerialId },
                data: { gridColumnIsDeleted: true, gridColumnModifiedBy: actor },
            });
            await this.auditLogService.logEntityChange({
                action: 'cancel',
                tableName: GRID_COLUMN_TABLE_NAME,
                screenName: GRID_DETAIL_AUDIT_SCREEN_NAME,
                screenType: 'master',
                pk: grid_column_id,
                displayName: existing.gridColumnName ?? `Grid column ${grid_column_id}`,
                originalRecord: this.toColumnPayload(existing),
                modifiedRecord: this.toColumnPayload({ ...existing, gridColumnIsDeleted: true }),
                userId: actor,
                notes: 'Grid column soft deleted',
            }, tx);
            return { grid_column_id: grid_column_id, deleted: true };
        });
    }
    async createGridDetails(saveGridDetailDto) {
        const actor = this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR;
        const data = {
            gridName: saveGridDetailDto.grid_name.trim(),
            gridCreatedBy: actor,
            gridModifiedBy: null,
        };
        await this.applyOptionalGridFields(data, saveGridDetailDto);
        return this.prisma.$transaction(async (tx) => {
            const created = await tx.gridDetails.create({ data });
            if (saveGridDetailDto.grid_columns?.length) {
                await this.saveColumnsInTx(saveGridDetailDto.grid_columns, created.gridId, actor, tx);
            }
            const full = await tx.gridDetails.findFirstOrThrow({
                where: { gridId: created.gridId },
                include: {
                    columns: {
                        where: { gridColumnIsDeleted: false },
                        orderBy: [{ gridColumnNumber: 'asc' }, { gridColumnId: 'asc' }],
                    },
                },
            });
            const payload = this.toPayload(full);
            await this.auditLogService.logEntityChange({
                action: 'New',
                tableName: GRID_DETAIL_TABLE_NAME,
                screenName: GRID_DETAIL_AUDIT_SCREEN_NAME,
                screenType: 'master',
                pk: payload.grid_id,
                displayName: payload.grid_name,
                originalRecord: null,
                modifiedRecord: payload,
                userId: actor,
                notes: 'Grid details created',
            }, tx);
            return payload;
        });
    }
    async updateGridDetails(saveGridDetailDto) {
        const gridId = saveGridDetailDto.grid_id;
        const parsedGridId = this.parseBigIntId('grid_id', gridId);
        const actor = this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR;
        return this.prisma.$transaction(async (tx) => {
            const existing = await tx.gridDetails.findFirst({
                where: { gridId: parsedGridId, gridIsDeleted: false },
            });
            if (!existing) {
                (0, module_service_utils_1.throwFixedNotFound)('Grid details not found', 'grid_id', `No active grid details found with id ${gridId}`);
            }
            const data = {
                gridName: saveGridDetailDto.grid_name.trim(),
                gridModifiedBy: actor,
            };
            await this.applyOptionalGridFields(data, saveGridDetailDto);
            await tx.gridDetails.update({ where: { gridId: parsedGridId }, data });
            if (saveGridDetailDto.grid_columns !== undefined) {
                await this.saveColumnsInTx(saveGridDetailDto.grid_columns, parsedGridId, actor, tx);
                if (saveGridDetailDto.replace_columns === true) {
                    const keptIds = saveGridDetailDto.grid_columns
                        .filter((col) => !!col.grid_column_id)
                        .map((col) => this.parseUuidId('grid_column_id', col.grid_column_id));
                    await tx.gridColumn.updateMany({
                        where: {
                            gridId: parsedGridId,
                            gridColumnIsDeleted: false,
                            ...(keptIds.length > 0 ? { gridColumnId: { notIn: keptIds } } : {}),
                        },
                        data: { gridColumnIsDeleted: true, gridColumnModifiedBy: actor },
                    });
                }
            }
            const full = await tx.gridDetails.findFirstOrThrow({
                where: { gridId: parsedGridId },
                include: {
                    columns: {
                        where: { gridColumnIsDeleted: false },
                        orderBy: [{ gridColumnNumber: 'asc' }, { gridColumnId: 'asc' }],
                    },
                },
            });
            const payload = this.toPayload(full);
            await this.auditLogService.logEntityChange({
                action: 'update',
                tableName: GRID_DETAIL_TABLE_NAME,
                screenName: GRID_DETAIL_AUDIT_SCREEN_NAME,
                screenType: 'master',
                pk: gridId,
                displayName: payload.grid_name,
                originalRecord: this.toPayload({ ...existing, columns: [] }),
                modifiedRecord: payload,
                userId: actor,
                notes: 'Grid details updated',
            }, tx);
            return payload;
        });
    }
    async saveColumnsInTx(columns, gridId, actor, tx) {
        for (const colDto of columns) {
            await this.upsertColumnInTx(colDto, gridId, actor, tx);
        }
    }
    async upsertColumnInTx(colDto, gridId, actor, tx) {
        const normalizedName = colDto.grid_column_name?.trim();
        if (!normalizedName) {
            (0, module_service_utils_1.throwFixedBadRequest)('Validation failed', [{ field: 'grid_column_name', message: 'grid_column_name must not be empty' }]);
        }
        if (colDto.grid_column_id) {
            const parsedId = this.parseUuidId('grid_column_id', colDto.grid_column_id);
            const colData = {
                gridColumnName: normalizedName,
                gridId,
                gridColumnNumber: colDto.grid_column_number,
                gridColumnModifiedBy: actor,
            };
            this.applyOptionalColumnFields(colData, colDto);
            await tx.gridColumn.update({ where: { gridColumnId: parsedId }, data: colData });
        }
        else {
            const colData = {
                gridColumnName: normalizedName,
                gridId,
                gridColumnNumber: colDto.grid_column_number,
                gridColumnCreatedBy: actor,
                gridColumnModifiedBy: null,
            };
            this.applyOptionalColumnFields(colData, colDto);
            await tx.gridColumn.create({ data: colData });
        }
    }
    applyOptionalColumnFields(data, dto) {
        if ((0, module_service_utils_1.hasOwnProperty)(dto, 'grid_column_width'))
            data.gridColumnWidth = dto.grid_column_width;
        if ((0, module_service_utils_1.hasOwnProperty)(dto, 'grid_column_position'))
            data.gridColumnPosition = dto.grid_column_position;
        if ((0, module_service_utils_1.hasOwnProperty)(dto, 'grid_column_alignment'))
            data.gridColumnAlignment = dto.grid_column_alignment;
        if ((0, module_service_utils_1.hasOwnProperty)(dto, 'grid_column_visibility'))
            data.gridColumnVisibility = dto.grid_column_visibility;
        if ((0, module_service_utils_1.hasOwnProperty)(dto, 'grid_column_filter'))
            data.gridColumnFilter = dto.grid_column_filter;
        if ((0, module_service_utils_1.hasOwnProperty)(dto, 'grid_column_condition'))
            data.gridColumnCondition = dto.grid_column_condition;
        if ((0, module_service_utils_1.hasOwnProperty)(dto, 'grid_column_condition_color'))
            data.gridColumnConditionColor = dto.grid_column_condition_color;
        if ((0, module_service_utils_1.hasOwnProperty)(dto, 'grid_column_group'))
            data.gridColumnGroup = dto.grid_column_group;
        if ((0, module_service_utils_1.hasOwnProperty)(dto, 'grid_column_total'))
            data.gridColumnTotal = dto.grid_column_total;
        if ((0, module_service_utils_1.hasOwnProperty)(dto, 'grid_column_data_type'))
            data.gridColumnDataType = dto.grid_column_data_type;
        if ((0, module_service_utils_1.hasOwnProperty)(dto, 'grid_column_color'))
            data.gridColumnColor = dto.grid_column_color;
        if ((0, module_service_utils_1.hasOwnProperty)(dto, 'grid_column_notes'))
            data.gridColumnNotes = dto.grid_column_notes;
        if ((0, module_service_utils_1.hasOwnProperty)(dto, 'grid_column_px'))
            data.gridColumnPx = dto.grid_column_px;
        if ((0, module_service_utils_1.hasOwnProperty)(dto, 'grid_column_sql_field_name'))
            data.gridColumnSqlFieldName = dto.grid_column_sql_field_name;
    }
    async applyOptionalGridFields(data, dto) {
        if ((0, module_service_utils_1.hasOwnProperty)(dto, 'grid_description'))
            data.gridDescription = dto.grid_description;
        if ((0, module_service_utils_1.hasOwnProperty)(dto, 'grid_sort_column'))
            data.gridSortColumn = dto.grid_sort_column;
        if ((0, module_service_utils_1.hasOwnProperty)(dto, 'grid_sort_order'))
            data.gridSortOrder = dto.grid_sort_order;
        if ((0, module_service_utils_1.hasOwnProperty)(dto, 'grid_sql'))
            data.gridSql = await this.normalizeGridSql(dto.grid_sql);
        if ((0, module_service_utils_1.hasOwnProperty)(dto, 'grid_status'))
            data.gridStatus = dto.grid_status;
        if ((0, module_service_utils_1.hasOwnProperty)(dto, 'grid_device_type'))
            data.gridDeviceType = dto.grid_device_type;
    }
    async normalizeGridSql(gridSql) {
        if (gridSql === undefined || gridSql === null)
            return gridSql;
        const normalized = this.configuredGridSqlService.stripSqlComments(gridSql).trim();
        if (!normalized)
            return null;
        const topLevelTableName = this.configuredGridSqlService.extractTopLevelFromTableName(normalized);
        if (!topLevelTableName) {
            (0, module_service_utils_1.throwFixedBadRequest)('Invalid grid_sql configuration', [{ field: 'grid_sql', message: 'grid_sql must be a SELECT query with a top-level FROM table' }]);
        }
        const validation = this.configuredGridSqlService.validateBaseSql({
            sql: normalized,
            tableName: topLevelTableName,
        });
        if (!validation.isValid) {
            (0, module_service_utils_1.throwFixedBadRequest)('Invalid grid_sql configuration', [{ field: 'grid_sql', message: validation.message }]);
        }
        return validation.normalizedSql;
    }
    toPayload(record) {
        return {
            grid_id: record.gridId.toString(),
            grid_name: record.gridName,
            grid_description: record.gridDescription,
            grid_sort_column: record.gridSortColumn,
            grid_sort_order: record.gridSortOrder,
            grid_sql: record.gridSql,
            grid_status: record.gridStatus,
            grid_device_type: record.gridDeviceType,
            grid_is_deleted: record.gridIsDeleted,
            grid_created_on: record.gridCreatedOn.toISOString(),
            grid_created_by: record.gridCreatedBy,
            grid_modified_on: record.gridModifiedOn?.toISOString() ?? null,
            grid_modified_by: record.gridModifiedBy,
            grid_sync_on: record.gridSyncOn?.toISOString() ?? null,
            columns: record.columns.map((col) => this.toColumnPayload(col)),
        };
    }
    toColumnPayload(record) {
        return {
            grid_column_id: record.gridColumnId,
            grid_id: record.gridId.toString(),
            grid_column_number: record.gridColumnNumber,
            grid_column_name: record.gridColumnName,
            grid_column_width: (0, module_service_utils_1.toNullableNumber)(record.gridColumnWidth),
            grid_column_position: (0, module_service_utils_1.toNullableNumber)(record.gridColumnPosition),
            grid_column_alignment: record.gridColumnAlignment,
            grid_column_visibility: record.gridColumnVisibility,
            grid_column_filter: record.gridColumnFilter,
            grid_column_condition: record.gridColumnCondition,
            grid_column_condition_color: record.gridColumnConditionColor,
            grid_column_group: record.gridColumnGroup,
            grid_column_total: record.gridColumnTotal,
            grid_column_data_type: record.gridColumnDataType,
            grid_column_color: record.gridColumnColor,
            grid_column_notes: record.gridColumnNotes,
            grid_column_px: record.gridColumnPx,
            grid_column_sql_field_name: record.gridColumnSqlFieldName,
            grid_column_is_deleted: record.gridColumnIsDeleted,
            grid_column_created_on: record.gridColumnCreatedOn.toISOString(),
            grid_column_created_by: record.gridColumnCreatedBy,
            grid_column_modified_on: record.gridColumnModifiedOn?.toISOString() ?? null,
            grid_column_modified_by: record.gridColumnModifiedBy,
            grid_column_sync_on: record.gridColumnSyncOn?.toISOString() ?? null,
        };
    }
    parseUuidId(field, value) {
        const normalized = value.trim();
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalized)) {
            (0, module_service_utils_1.throwFixedBadRequest)("Validation error", [
                { field, message: `${field} must be a valid UUID` },
            ]);
        }
        return normalized;
    }
    parseBigIntId(field, value) {
        const normalized = value.trim();
        if (!/^\d+$/.test(normalized)) {
            (0, module_service_utils_1.throwFixedBadRequest)('Validation error', [
                { field, message: `${field} must be a numeric id` },
            ]);
        }
        return BigInt(normalized);
    }
};
exports.GridDetailsService = GridDetailsService;
exports.GridDetailsService = GridDetailsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        configured_grid_sql_service_1.ConfiguredGridSqlService,
        audit_log_service_1.AuditLogService,
        request_context_service_1.RequestContextService])
], GridDetailsService);
//# sourceMappingURL=grid-details.service.js.map