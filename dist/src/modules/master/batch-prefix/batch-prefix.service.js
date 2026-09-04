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
exports.BatchPrefixService = void 0;
const common_1 = require("@nestjs/common");
const configured_grid_sql_service_1 = require("../../../common/configured-grid-sql/configured-grid-sql.service");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const audit_log_service_1 = require("../../audit-log/audit-log.service");
const module_list_utils_1 = require("../../../common/utils/module-list.utils");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const BATCH_PREFIX_TABLE_NAME = 'batch prefix';
const BATCH_PREFIX_AUDIT_SCREEN_NAME = 'Batch Prefix';
let BatchPrefixService = class BatchPrefixService {
    prisma;
    auditLogService;
    configuredGridSqlService;
    requestContextService;
    constructor(prisma, auditLogService, configuredGridSqlService, requestContextService) {
        this.prisma = prisma;
        this.auditLogService = auditLogService;
        this.configuredGridSqlService = configuredGridSqlService;
        this.requestContextService = requestContextService;
    }
    async save(saveBatchPrefixDto) {
        if (saveBatchPrefixDto.id) {
            return this.updateBatchPrefix(saveBatchPrefixDto);
        }
        return this.createBatchPrefix(saveBatchPrefixDto);
    }
    async list(queryDto) {
        const { page, limit, skip } = (0, module_list_utils_1.resolvePagination)(queryDto);
        const where = {};
        if (queryDto.search?.trim()) {
            const search = queryDto.search.trim();
            where.OR = [
                { prefixUsed: { contains: search, mode: 'insensitive' } },
                { createdBy: { contains: search, mode: 'insensitive' } },
                { modifiedBy: { contains: search, mode: 'insensitive' } },
            ];
        }
        return (0, module_list_utils_1.runMasterListQuery)({ page, limit }, {
            configuredGridFn: () => (0, module_list_utils_1.runConfiguredGridQuery)(this.configuredGridSqlService, { tableName: BATCH_PREFIX_TABLE_NAME, alias: 'batch_prefix_grid', search: queryDto.search, page, limit, skip }),
            countFn: () => this.prisma.batchPrefix.count({ where }),
            findManyFn: () => this.prisma.batchPrefix.findMany({
                where,
                orderBy: [{ prefixUsed: 'asc' }, { id: 'asc' }],
                skip,
                take: limit,
            }),
            toItemFn: (record) => this.toPayload(record),
            loadStylesFn: () => this.configuredGridSqlService.loadPrimaryGridStyles(BATCH_PREFIX_TABLE_NAME),
        });
    }
    async getById(id) {
        const record = await this.prisma.batchPrefix.findUnique({ where: { id } });
        if (!record) {
            this.throwNotFound(id);
        }
        return this.toPayload(record);
    }
    async delete(id) {
        try {
            return await this.prisma.$transaction(async (tx) => {
                const existing = await tx.batchPrefix.findUnique({ where: { id } });
                if (!existing) {
                    this.throwNotFound(id);
                }
                await tx.batchPrefix.delete({ where: { id } });
                await this.auditLogService.logEntityChange({
                    action: 'cancel',
                    tableName: BATCH_PREFIX_TABLE_NAME,
                    screenName: BATCH_PREFIX_AUDIT_SCREEN_NAME,
                    screenType: 'master',
                    pk: id,
                    displayName: this.buildDisplayName(existing),
                    originalRecord: this.toPayload(existing),
                    modifiedRecord: null,
                    userId: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
                    notes: 'Batch prefix deleted',
                }, tx);
                return { id, deleted: true };
            });
        }
        catch (error) {
            this.handleDeleteError(error, id);
            throw error;
        }
    }
    async createBatchPrefix(saveBatchPrefixDto) {
        try {
            return await this.prisma.$transaction(async (tx) => {
                const prefixUsed = this.normalizeRequiredPrefix(saveBatchPrefixDto.prefixUsed);
                const syncDate = this.parseNullableDate(saveBatchPrefixDto.syncDate, 'syncDate');
                await this.ensurePrefixIsUnique(tx, prefixUsed);
                const now = new Date();
                const data = {
                    prefixUsed,
                    syncDate: syncDate ?? null,
                    createdBy: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
                    createdOn: now,
                };
                const created = await tx.batchPrefix.create({ data });
                const payload = this.toPayload(created);
                await this.auditLogService.logEntityChange({
                    action: 'New',
                    tableName: BATCH_PREFIX_TABLE_NAME,
                    screenName: BATCH_PREFIX_AUDIT_SCREEN_NAME,
                    screenType: 'master',
                    pk: payload.id,
                    displayName: this.buildDisplayName(created),
                    originalRecord: null,
                    modifiedRecord: payload,
                    userId: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
                    notes: 'Batch prefix created',
                }, tx);
                return payload;
            });
        }
        catch (error) {
            this.handleWriteError(error);
            throw error;
        }
    }
    async updateBatchPrefix(saveBatchPrefixDto) {
        const id = saveBatchPrefixDto.id;
        try {
            return await this.prisma.$transaction(async (tx) => {
                const existing = await tx.batchPrefix.findUnique({ where: { id } });
                if (!existing) {
                    this.throwNotFound(id);
                }
                const prefixUsed = this.normalizeRequiredPrefix(saveBatchPrefixDto.prefixUsed);
                await this.ensurePrefixIsUnique(tx, prefixUsed, id);
                const data = {
                    prefixUsed,
                    modifiedBy: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
                    modifiedOn: new Date(),
                };
                if ((0, module_service_utils_1.hasOwnProperty)(saveBatchPrefixDto, 'syncDate')) {
                    const syncDate = this.parseNullableDate(saveBatchPrefixDto.syncDate, 'syncDate');
                    data.syncDate = syncDate ?? null;
                }
                const updated = await tx.batchPrefix.update({ where: { id }, data });
                const payload = this.toPayload(updated);
                await this.auditLogService.logEntityChange({
                    action: 'update',
                    tableName: BATCH_PREFIX_TABLE_NAME,
                    screenName: BATCH_PREFIX_AUDIT_SCREEN_NAME,
                    screenType: 'master',
                    pk: id,
                    displayName: this.buildDisplayName(updated),
                    originalRecord: this.toPayload(existing),
                    modifiedRecord: payload,
                    userId: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
                    notes: 'Batch prefix updated',
                }, tx);
                return payload;
            });
        }
        catch (error) {
            this.handleWriteError(error);
            throw error;
        }
    }
    async ensurePrefixIsUnique(tx, prefixUsed, excludeId) {
        const existing = await tx.batchPrefix.findFirst({
            where: {
                prefixUsed: { equals: prefixUsed, mode: 'insensitive' },
                ...(excludeId ? { id: { not: excludeId } } : {}),
            },
            select: { id: true },
        });
        if (existing) {
            (0, module_service_utils_1.throwMasterConflict)('Batch prefix already exists', [
                { field: 'prefixUsed', message: 'Duplicate prefixUsed is not allowed' },
            ]);
        }
    }
    normalizeRequiredPrefix(value) {
        const trimmed = value.trim();
        if (!trimmed) {
            (0, module_service_utils_1.throwMasterBadRequest)('Validation failed', [
                { field: 'prefixUsed', message: 'prefixUsed must not be empty' },
            ]);
        }
        return trimmed;
    }
    parseNullableDate(value, field) {
        if (value === undefined)
            return undefined;
        if (value === null)
            return null;
        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) {
            (0, module_service_utils_1.throwMasterBadRequest)('Validation failed', [
                { field, message: `${field} must be a valid ISO-8601 date-time` },
            ]);
        }
        return parsed;
    }
    toPayload(record) {
        return {
            id: record.id,
            prefixUsed: record.prefixUsed,
            syncDate: record.syncDate ? record.syncDate.toISOString() : null,
            createdBy: record.createdBy,
            createdOn: record.createdOn ? record.createdOn.toISOString() : null,
            modifiedBy: record.modifiedBy,
            modifiedOn: record.modifiedOn ? record.modifiedOn.toISOString() : null,
        };
    }
    buildDisplayName(record) {
        return record.prefixUsed?.trim() || record.id;
    }
    handleWriteError(error) {
        (0, module_service_utils_1.throwOnUniqueConstraintError)(error, 'Batch prefix already exists', [
            { field: 'prefixUsed', message: 'Duplicate prefixUsed is not allowed' },
        ]);
    }
    handleDeleteError(error, id) {
        if ((0, module_service_utils_1.isPrismaErrorCode)(error, 'P2025')) {
            this.throwNotFound(id);
        }
    }
    throwNotFound(id) {
        (0, module_service_utils_1.throwMasterNotFound)('Batch prefix not found', 'id', `No batch prefix found with id ${id}`);
    }
};
exports.BatchPrefixService = BatchPrefixService;
exports.BatchPrefixService = BatchPrefixService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_log_service_1.AuditLogService,
        configured_grid_sql_service_1.ConfiguredGridSqlService,
        request_context_service_1.RequestContextService])
], BatchPrefixService);
//# sourceMappingURL=batch-prefix.service.js.map