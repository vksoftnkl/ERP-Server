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
exports.DropdownDetailsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../database/prisma/prisma.service");
const configured_grid_sql_service_1 = require("../../common/configured-grid-sql/configured-grid-sql.service");
const audit_log_service_1 = require("../audit-log/audit-log.service");
const request_context_service_1 = require("../../common/request-context/request-context.service");
const module_service_utils_1 = require("../../common/utils/module-service.utils");
const DROPDOWN_DETAIL_TABLE_NAME = 'dropdown details';
const DROPDOWN_COLUMN_TABLE_NAME = 'dropdown column';
const DROPDOWN_DETAIL_AUDIT_SCREEN_NAME = 'Dropdown Details';
let DropdownDetailsService = class DropdownDetailsService {
    prisma;
    auditLogService;
    requestContextService;
    configuredGridSqlService;
    constructor(prisma, auditLogService, requestContextService, configuredGridSqlService) {
        this.prisma = prisma;
        this.auditLogService = auditLogService;
        this.requestContextService = requestContextService;
        this.configuredGridSqlService = configuredGridSqlService;
    }
    async save(saveDropdownDetailDto) {
        return saveDropdownDetailDto.dropdown_id
            ? this.updateDropdownDetails(saveDropdownDetailDto)
            : this.createDropdownDetails(saveDropdownDetailDto);
    }
    async list(queryDto) {
        const requestedDropdownId = queryDto.dropdownId ?? queryDto.dropdown_id;
        const parsedDropdownId = requestedDropdownId
            ? this.parseIntId('dropdown_id', requestedDropdownId)
            : undefined;
        const search = queryDto.search?.trim();
        const where = {
            ...(parsedDropdownId !== undefined ? { dropdownId: parsedDropdownId } : {}),
            ...(search
                ? {
                    OR: [
                        { dropdownName: { contains: search, mode: 'insensitive' } },
                        { dropdownDescription: { contains: search, mode: 'insensitive' } },
                    ],
                }
                : {}),
        };
        const records = (await this.prisma.dropdownDetails.findMany({
            where,
            orderBy: [{ dropdownName: 'asc' }, { dropdownId: 'asc' }],
            include: {
                dropdownColumns: {
                    orderBy: [{ dropdownColumnsNo: 'asc' }, { dropdownColumnsId: 'asc' }],
                },
            },
        }));
        return { items: records.map((record) => this.toPayload(record)) };
    }
    async run(queryDto) {
        const dropdownId = this.parseIntId('dropdown_id', queryDto.dropdown_id);
        const page = queryDto.page ?? 1;
        const limit = queryDto.limit ?? 20;
        const skip = (page - 1) * limit;
        const dropdownPrm = this.parseDropdownParam(queryDto.dropdown_param);
        const dropdown = await this.prisma.dropdownDetails.findFirst({
            where: { dropdownId },
            select: { dropdownId: true, dropdownSql: true },
        });
        if (!dropdown) {
            (0, module_service_utils_1.throwFixedNotFound)('Dropdown details not found', 'dropdown_id', `No dropdown details found with id ${queryDto.dropdown_id}`);
        }
        const baseSql = dropdown.dropdownSql?.trim();
        if (!baseSql) {
            (0, module_service_utils_1.throwFixedBadRequest)('Invalid dropdown SQL configuration', [{ field: 'dropdown_sql', message: `Dropdown ${queryDto.dropdown_id} has no configured SQL` }]);
        }
        const tableName = this.configuredGridSqlService.extractTopLevelFromTableName(baseSql) ?? '';
        const validation = this.configuredGridSqlService.validateBaseSql({ sql: baseSql, tableName });
        if (!validation.isValid) {
            (0, module_service_utils_1.throwFixedBadRequest)('Invalid dropdown SQL configuration', [{ field: 'dropdown_sql', message: validation.message }]);
        }
        const finalSql = dropdownPrm
            ? this.configuredGridSqlService.substituteGridPrm(validation.normalizedSql, dropdownPrm)
            : validation.normalizedSql;
        let searchableFieldNames;
        if (queryDto.search?.trim()) {
            const columns = await this.prisma.dropdownColumns.findMany({
                where: { dropdownColumnsDropdownId: dropdownId },
                orderBy: { dropdownColumnsNo: 'asc' },
                select: {
                    dropdownColumnsFilter: true,
                    dropdownColumnsSqlName: true,
                    dropdownColumnsNo: true,
                    dropdownColumnsName: true,
                },
            });
            searchableFieldNames = this.configuredGridSqlService.deriveSearchableFieldNamesFromColumns(columns.map((col) => ({
                filter: col.dropdownColumnsFilter,
                sqlFieldName: col.dropdownColumnsSqlName,
                columnNumber: col.dropdownColumnsNo,
                columnName: col.dropdownColumnsName,
            })), finalSql);
        }
        let result;
        try {
            result = await this.configuredGridSqlService.runPagedQuery({
                baseSql: finalSql,
                alias: 'cdropdown',
                search: queryDto.search,
                limit,
                skip,
                searchableFieldNames,
            });
        }
        catch (error) {
            const rawMessage = this.extractErrorMessage(error);
            (0, module_service_utils_1.throwFixedBadRequest)('Invalid dropdown SQL configuration', [
                {
                    field: 'dropdown_sql',
                    message: rawMessage
                        ? `dropdown_sql could not be executed: ${rawMessage}`
                        : 'dropdown_sql could not be executed',
                },
            ]);
        }
        return {
            items: result.items,
            meta: { page, limit, total: result.total },
        };
    }
    extractErrorMessage(error) {
        if (error instanceof Error)
            return error.message.replace(/\s+/g, ' ').trim();
        if (typeof error === 'object' && error !== null && 'message' in error) {
            const message = error.message;
            if (typeof message === 'string')
                return message.replace(/\s+/g, ' ').trim();
        }
        return null;
    }
    async updateColumnWidths(dto) {
        let count = 0;
        await this.prisma.$transaction(async (tx) => {
            for (const item of dto.columns) {
                const columnId = this.parseUuidId('dropdown_columns_id', item.dropdown_columns_id);
                const existing = await tx.dropdownColumns.findFirst({
                    where: { dropdownColumnsId: columnId },
                    select: { dropdownColumnsId: true },
                });
                if (!existing) {
                    (0, module_service_utils_1.throwFixedNotFound)('Dropdown column not found', 'dropdown_columns_id', `No dropdown column found with id ${item.dropdown_columns_id}`);
                }
                await tx.dropdownColumns.update({
                    where: { dropdownColumnsId: columnId },
                    data: { dropdownColumnsWidth: item.dropdown_columns_width },
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
                const columnId = this.parseUuidId('dropdown_columns_id', item.dropdown_columns_id);
                const existing = await tx.dropdownColumns.findFirst({
                    where: { dropdownColumnsId: columnId },
                    select: { dropdownColumnsId: true },
                });
                if (!existing) {
                    (0, module_service_utils_1.throwFixedNotFound)('Dropdown column not found', 'dropdown_columns_id', `No dropdown column found with id ${item.dropdown_columns_id}`);
                }
                await tx.dropdownColumns.update({
                    where: { dropdownColumnsId: columnId },
                    data: { dropdownColumnsFilter: item.dropdown_columns_filter },
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
                const columnId = this.parseUuidId('dropdown_columns_id', item.dropdown_columns_id);
                const existing = await tx.dropdownColumns.findFirst({
                    where: { dropdownColumnsId: columnId },
                    select: { dropdownColumnsId: true },
                });
                if (!existing) {
                    (0, module_service_utils_1.throwFixedNotFound)('Dropdown column not found', 'dropdown_columns_id', `No dropdown column found with id ${item.dropdown_columns_id}`);
                }
                await tx.dropdownColumns.update({
                    where: { dropdownColumnsId: columnId },
                    data: { dropdownColumnsVisiblity: item.dropdown_columns_visiblity },
                });
                count++;
            }
        });
        return { updated: count };
    }
    async getById(dropdownId) {
        const parsedDropdownId = this.parseIntId('dropdown_id', dropdownId);
        const record = await this.prisma.dropdownDetails.findFirst({
            where: { dropdownId: parsedDropdownId },
            include: {
                dropdownColumns: {
                    orderBy: [{ dropdownColumnsNo: 'asc' }, { dropdownColumnsId: 'asc' }],
                },
            },
        });
        if (!record) {
            (0, module_service_utils_1.throwFixedNotFound)('Dropdown details not found', 'dropdown_id', `No dropdown details found with id ${dropdownId}`);
        }
        return this.toPayload(record);
    }
    async delete(dropdownId) {
        const parsedDropdownId = this.parseIntId('dropdown_id', dropdownId);
        return this.prisma.$transaction(async (tx) => {
            const existing = await tx.dropdownDetails.findFirst({
                where: { dropdownId: parsedDropdownId },
            });
            if (!existing) {
                (0, module_service_utils_1.throwFixedNotFound)('Dropdown details not found', 'dropdown_id', `No dropdown details found with id ${dropdownId}`);
            }
            await tx.dropdownDetails.delete({ where: { dropdownId: parsedDropdownId } });
            const actor = this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR;
            await this.auditLogService.logEntityChange({
                action: 'cancel',
                tableName: DROPDOWN_DETAIL_TABLE_NAME,
                screenName: DROPDOWN_DETAIL_AUDIT_SCREEN_NAME,
                screenType: 'master',
                pk: dropdownId,
                displayName: existing.dropdownName ?? `Dropdown ${dropdownId}`,
                originalRecord: this.toPayload({ ...existing, dropdownColumns: [] }),
                modifiedRecord: this.toPayload({ ...existing, dropdownColumns: [] }),
                userId: actor,
                notes: 'Dropdown details deleted',
            }, tx);
            return { dropdown_id: dropdownId, deleted: true };
        });
    }
    async deleteColumn(dropdown_columns_id) {
        const parsedColumnId = this.parseUuidId('dropdown_columns_id', dropdown_columns_id);
        return this.prisma.$transaction(async (tx) => {
            const existing = await tx.dropdownColumns.findFirst({
                where: { dropdownColumnsId: parsedColumnId },
            });
            if (!existing) {
                (0, module_service_utils_1.throwFixedNotFound)('Dropdown column not found', 'dropdown_columns_id', `No dropdown column found with id ${dropdown_columns_id}`);
            }
            await tx.dropdownColumns.delete({ where: { dropdownColumnsId: parsedColumnId } });
            const actor = this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR;
            await this.auditLogService.logEntityChange({
                action: 'cancel',
                tableName: DROPDOWN_COLUMN_TABLE_NAME,
                screenName: DROPDOWN_DETAIL_AUDIT_SCREEN_NAME,
                screenType: 'master',
                pk: dropdown_columns_id,
                displayName: existing.dropdownColumnsName ?? `Dropdown column ${dropdown_columns_id}`,
                originalRecord: this.toColumnPayload(existing),
                modifiedRecord: this.toColumnPayload(existing),
                userId: actor,
                notes: 'Dropdown column deleted',
            }, tx);
            return { dropdown_columns_id: dropdown_columns_id, deleted: true };
        });
    }
    async createDropdownDetails(saveDropdownDetailDto) {
        const actor = this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR;
        const data = {
            dropdownName: saveDropdownDetailDto.dropdown_name.trim(),
            dropdownSql: saveDropdownDetailDto.dropdown_sql.trim(),
            dropdownCreatedBy: actor,
            dropdownModifiedBy: null,
        };
        this.applyOptionalDropdownFields(data, saveDropdownDetailDto);
        return this.prisma.$transaction(async (tx) => {
            const created = await tx.dropdownDetails.create({ data });
            if (saveDropdownDetailDto.dropdown_columns?.length) {
                await this.saveColumnsInTx(saveDropdownDetailDto.dropdown_columns, created.dropdownId, actor, tx);
            }
            const full = await tx.dropdownDetails.findFirstOrThrow({
                where: { dropdownId: created.dropdownId },
                include: {
                    dropdownColumns: {
                        orderBy: [{ dropdownColumnsNo: 'asc' }, { dropdownColumnsId: 'asc' }],
                    },
                },
            });
            const payload = this.toPayload(full);
            await this.auditLogService.logEntityChange({
                action: 'New',
                tableName: DROPDOWN_DETAIL_TABLE_NAME,
                screenName: DROPDOWN_DETAIL_AUDIT_SCREEN_NAME,
                screenType: 'master',
                pk: payload.dropdown_id,
                displayName: payload.dropdown_name,
                originalRecord: null,
                modifiedRecord: payload,
                userId: actor,
                notes: 'Dropdown details created',
            }, tx);
            return payload;
        });
    }
    async updateDropdownDetails(saveDropdownDetailDto) {
        const dropdownId = saveDropdownDetailDto.dropdown_id;
        const parsedDropdownId = this.parseIntId('dropdown_id', dropdownId);
        const actor = this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR;
        return this.prisma.$transaction(async (tx) => {
            const existing = await tx.dropdownDetails.findFirst({
                where: { dropdownId: parsedDropdownId },
            });
            if (!existing) {
                (0, module_service_utils_1.throwFixedNotFound)('Dropdown details not found', 'dropdown_id', `No dropdown details found with id ${dropdownId}`);
            }
            const data = {
                dropdownName: saveDropdownDetailDto.dropdown_name.trim(),
                dropdownSql: saveDropdownDetailDto.dropdown_sql.trim(),
                dropdownModifiedBy: actor,
            };
            this.applyOptionalDropdownFields(data, saveDropdownDetailDto);
            await tx.dropdownDetails.update({ where: { dropdownId: parsedDropdownId }, data });
            if (saveDropdownDetailDto.dropdown_columns !== undefined) {
                if (saveDropdownDetailDto.replace_columns === true) {
                    const keptIds = saveDropdownDetailDto.dropdown_columns
                        .filter((col) => !!col.dropdown_columns_id)
                        .map((col) => this.parseUuidId('dropdown_columns_id', col.dropdown_columns_id));
                    await tx.dropdownColumns.deleteMany({
                        where: {
                            dropdownColumnsDropdownId: parsedDropdownId,
                            ...(keptIds.length > 0 ? { dropdownColumnsId: { notIn: keptIds } } : {}),
                        },
                    });
                }
                await this.saveColumnsInTx(saveDropdownDetailDto.dropdown_columns, parsedDropdownId, actor, tx);
            }
            const full = await tx.dropdownDetails.findFirstOrThrow({
                where: { dropdownId: parsedDropdownId },
                include: {
                    dropdownColumns: {
                        orderBy: [{ dropdownColumnsNo: 'asc' }, { dropdownColumnsId: 'asc' }],
                    },
                },
            });
            const payload = this.toPayload(full);
            await this.auditLogService.logEntityChange({
                action: 'update',
                tableName: DROPDOWN_DETAIL_TABLE_NAME,
                screenName: DROPDOWN_DETAIL_AUDIT_SCREEN_NAME,
                screenType: 'master',
                pk: dropdownId,
                displayName: payload.dropdown_name,
                originalRecord: this.toPayload({ ...existing, dropdownColumns: [] }),
                modifiedRecord: payload,
                userId: actor,
                notes: 'Dropdown details updated',
            }, tx);
            return payload;
        });
    }
    async saveColumnsInTx(columns, dropdownId, actor, tx) {
        for (const colDto of columns) {
            await this.upsertColumnInTx(colDto, dropdownId, actor, tx);
        }
    }
    async upsertColumnInTx(colDto, dropdownId, actor, tx) {
        const normalizedName = colDto.dropdown_columns_name?.trim();
        if (!normalizedName) {
            (0, module_service_utils_1.throwFixedBadRequest)('Validation failed', [
                {
                    field: 'dropdown_columns_name',
                    message: 'dropdown_columns_name must not be empty',
                },
            ]);
        }
        const normalizedDataType = colDto.dropdown_columns_data_type?.trim();
        if (!normalizedDataType) {
            (0, module_service_utils_1.throwFixedBadRequest)('Validation failed', [{ field: 'dropdown_columns_data_type', message: 'dropdown_columns_data_type must not be empty' }]);
        }
        if (colDto.dropdown_columns_id) {
            const parsedId = this.parseUuidId('dropdown_columns_id', colDto.dropdown_columns_id);
            const colData = {
                dropdownColumnsName: normalizedName,
                dropdownColumnsDropdownId: dropdownId,
                dropdownColumnsNo: colDto.dropdown_columns_no,
                dropdownColumnsDataType: normalizedDataType,
                dropdownColumnsModifiedBy: actor,
            };
            this.applyOptionalColumnFields(colData, colDto);
            await tx.dropdownColumns.update({ where: { dropdownColumnsId: parsedId }, data: colData });
        }
        else {
            const colData = {
                dropdownColumnsName: normalizedName,
                dropdownColumnsDropdownId: dropdownId,
                dropdownColumnsNo: colDto.dropdown_columns_no,
                dropdownColumnsDataType: normalizedDataType,
                dropdownColumnsCreatedBy: actor,
                dropdownColumnsModifiedBy: null,
            };
            this.applyOptionalColumnFields(colData, colDto);
            await tx.dropdownColumns.create({ data: colData });
        }
    }
    applyOptionalColumnFields(data, dto) {
        if ((0, module_service_utils_1.hasOwnProperty)(dto, 'dropdown_columns_alias'))
            data.dropdownColumnsAlias = dto.dropdown_columns_alias;
        if ((0, module_service_utils_1.hasOwnProperty)(dto, 'dropdown_columns_width'))
            data.dropdownColumnsWidth = dto.dropdown_columns_width;
        if ((0, module_service_utils_1.hasOwnProperty)(dto, 'dropdown_columns_visiblity'))
            data.dropdownColumnsVisiblity = dto.dropdown_columns_visiblity;
        if ((0, module_service_utils_1.hasOwnProperty)(dto, 'dropdown_columns_allignment'))
            data.dropdownColumnsAllignment = dto.dropdown_columns_allignment;
        if ((0, module_service_utils_1.hasOwnProperty)(dto, 'dropdown_columns_filter'))
            data.dropdownColumnsFilter = dto.dropdown_columns_filter;
        if ((0, module_service_utils_1.hasOwnProperty)(dto, 'dropdown_columns_sql_name'))
            data.dropdownColumnsSqlName = dto.dropdown_columns_sql_name;
    }
    applyOptionalDropdownFields(data, dto) {
        if ((0, module_service_utils_1.hasOwnProperty)(dto, 'dropdown_description'))
            data.dropdownDescription = dto.dropdown_description;
        if ((0, module_service_utils_1.hasOwnProperty)(dto, 'dropdown_sort_order'))
            data.dropdownSortOrder = dto.dropdown_sort_order;
        if ((0, module_service_utils_1.hasOwnProperty)(dto, 'dropdown_sort_column'))
            data.dropdownSortColumn = dto.dropdown_sort_column;
        if ((0, module_service_utils_1.hasOwnProperty)(dto, 'dropdown_completion'))
            data.dropdownCompletion = dto.dropdown_completion;
        if ((0, module_service_utils_1.hasOwnProperty)(dto, 'dropdown_sql_regional'))
            data.dropdownSqlRegional = dto.dropdown_sql_regional;
        if ((0, module_service_utils_1.hasOwnProperty)(dto, 'dropdown_max_visible_items'))
            data.dropdownMaxVisibleItems = dto.dropdown_max_visible_items;
        if ((0, module_service_utils_1.hasOwnProperty)(dto, 'dropdown_show_header'))
            data.dropdownShowHeader = dto.dropdown_show_header;
        if ((0, module_service_utils_1.hasOwnProperty)(dto, 'dropdown_width'))
            data.dropdownWidth = dto.dropdown_width;
        if ((0, module_service_utils_1.hasOwnProperty)(dto, 'dropdown_device_type'))
            data.dropdownDeviceType = dto.dropdown_device_type;
    }
    toPayload(record) {
        return {
            dropdown_id: String(record.dropdownId),
            dropdown_name: record.dropdownName,
            dropdown_description: record.dropdownDescription,
            dropdown_sql: record.dropdownSql,
            dropdown_sort_order: record.dropdownSortOrder,
            dropdown_sort_column: record.dropdownSortColumn,
            dropdown_completion: record.dropdownCompletion,
            dropdown_sql_regional: record.dropdownSqlRegional,
            dropdown_max_visible_items: record.dropdownMaxVisibleItems,
            dropdown_show_header: record.dropdownShowHeader,
            dropdown_width: record.dropdownWidth,
            dropdown_device_type: record.dropdownDeviceType,
            dropdown_created_on: record.dropdownCreatedOn.toISOString(),
            dropdown_created_by: record.dropdownCreatedBy,
            dropdown_modified_on: record.dropdownModifiedOn?.toISOString() ?? null,
            dropdown_modified_by: record.dropdownModifiedBy,
            dropdown_sync_on: record.dropdownSyncOn?.toISOString() ?? null,
            columns: record.dropdownColumns.map((col) => this.toColumnPayload(col)),
        };
    }
    toColumnPayload(record) {
        return {
            dropdown_columns_id: record.dropdownColumnsId,
            dropdown_columns_dropdown_id: String(record.dropdownColumnsDropdownId),
            dropdown_columns_no: record.dropdownColumnsNo,
            dropdown_columns_data_type: record.dropdownColumnsDataType,
            dropdown_columns_name: record.dropdownColumnsName,
            dropdown_columns_alias: record.dropdownColumnsAlias,
            dropdown_columns_width: (0, module_service_utils_1.toNullableNumber)(record.dropdownColumnsWidth),
            dropdown_columns_visiblity: record.dropdownColumnsVisiblity,
            dropdown_columns_allignment: record.dropdownColumnsAllignment,
            dropdown_columns_filter: record.dropdownColumnsFilter,
            dropdown_columns_sql_name: record.dropdownColumnsSqlName,
            dropdown_columns_created_on: record.dropdownColumnsCreatedOn.toISOString(),
            dropdown_columns_created_by: record.dropdownColumnsCreatedBy,
            dropdown_columns_modified_on: record.dropdownColumnsModifiedOn?.toISOString() ?? null,
            dropdown_columns_modified_by: record.dropdownColumnsModifiedBy,
            dropdown_columns_sync_on: record.dropdownColumnsSyncOn?.toISOString() ?? null,
        };
    }
    parseDropdownParam(raw) {
        if (raw === undefined) {
            return undefined;
        }
        let parsed;
        try {
            parsed = JSON.parse(raw);
        }
        catch {
            (0, module_service_utils_1.throwFixedBadRequest)('Validation error', [{ field: 'dropdown_param', message: 'dropdown_param must be valid JSON' }]);
        }
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
            (0, module_service_utils_1.throwFixedBadRequest)('Validation error', [{ field: 'dropdown_param', message: 'dropdown_param must be a JSON object' }]);
        }
        const prm = parsed;
        for (const [key, val] of Object.entries(prm)) {
            if (!/^[a-z_][a-z0-9_]*$/i.test(key)) {
                (0, module_service_utils_1.throwFixedBadRequest)('Validation error', [{ field: 'dropdown_param', message: `Invalid parameter name in dropdown_param: "${key}"` }]);
            }
            if (val !== null &&
                val !== undefined &&
                typeof val !== 'boolean' &&
                typeof val !== 'number' &&
                typeof val !== 'string') {
                (0, module_service_utils_1.throwFixedBadRequest)('Validation error', [{ field: 'dropdown_param', message: `Unsupported value type for dropdown_param.${key}: ${typeof val}` }]);
            }
            if (typeof val === 'number' && !Number.isFinite(val)) {
                (0, module_service_utils_1.throwFixedBadRequest)('Validation error', [{ field: 'dropdown_param', message: `Non-finite number for dropdown_param.${key}` }]);
            }
        }
        return prm;
    }
    parseUuidId(field, value) {
        const normalized = value.trim();
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalized)) {
            (0, module_service_utils_1.throwFixedBadRequest)('Validation error', [{ field, message: `${field} must be a valid UUID` }]);
        }
        return normalized;
    }
    parseIntId(field, value) {
        const normalized = value.trim();
        if (!/^\d+$/.test(normalized)) {
            (0, module_service_utils_1.throwFixedBadRequest)('Validation error', [{ field, message: `${field} must be a numeric id` }]);
        }
        const parsed = Number(normalized);
        if (!Number.isSafeInteger(parsed) || parsed <= 0) {
            (0, module_service_utils_1.throwFixedBadRequest)('Validation error', [{ field, message: `${field} must be a positive numeric id` }]);
        }
        return parsed;
    }
};
exports.DropdownDetailsService = DropdownDetailsService;
exports.DropdownDetailsService = DropdownDetailsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_log_service_1.AuditLogService,
        request_context_service_1.RequestContextService,
        configured_grid_sql_service_1.ConfiguredGridSqlService])
], DropdownDetailsService);
//# sourceMappingURL=dropdown-details.service.js.map