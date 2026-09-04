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
exports.ItemsCustRatesMasterService = void 0;
const common_1 = require("@nestjs/common");
const configured_grid_sql_service_1 = require("../../common/configured-grid-sql/configured-grid-sql.service");
const prisma_service_1 = require("../../database/prisma/prisma.service");
const audit_log_service_1 = require("../audit-log/audit-log.service");
const module_list_utils_1 = require("../../common/utils/module-list.utils");
const module_service_utils_1 = require("../../common/utils/module-service.utils");
const request_context_service_1 = require("../../common/request-context/request-context.service");
const ITEM_CUST_RATE_TABLE_NAME = 'cust item rates';
const ITEM_CUST_RATE_AUDIT_SCREEN_NAME = 'Item Customer Rate Master';
let ItemsCustRatesMasterService = class ItemsCustRatesMasterService {
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
    async save(saveItemCustRateDto) {
        if (saveItemCustRateDto.csr_id) {
            return this.updateItemCustRate(saveItemCustRateDto);
        }
        return this.createItemCustRate(saveItemCustRateDto);
    }
    async list(queryDto) {
        const { page, limit, skip } = (0, module_list_utils_1.resolvePagination)(queryDto);
        const result = await (0, module_list_utils_1.runConfiguredGridQuery)(this.configuredGridSqlService, { tableName: ITEM_CUST_RATE_TABLE_NAME, alias: 'item_cust_rate_grid', search: queryDto.search, page, limit, skip });
        if (!result) {
            (0, module_service_utils_1.throwMasterBadRequest)('No configured grid found for item customer rate list', []);
        }
        return result;
    }
    async getById(csrId) {
        const record = await this.prisma.custItemRate.findFirst({
            where: { csrId, csrIsDeleted: false },
        });
        if (!record) {
            this.throwNotFound(csrId);
        }
        return this.toPayload(record);
    }
    async softDelete(csrId) {
        return this.prisma.$transaction(async (tx) => {
            const existing = await tx.custItemRate.findFirst({
                where: { csrId, csrIsDeleted: false },
            });
            if (!existing) {
                this.throwNotFound(csrId);
            }
            const modifiedOn = new Date();
            const modifiedBy = this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR;
            const result = await tx.custItemRate.updateMany({
                where: { csrId, csrIsDeleted: false },
                data: { csrIsDeleted: true, csrModifiedOn: modifiedOn, csrModifiedBy: modifiedBy },
            });
            if (result.count === 0) {
                this.throwNotFound(csrId);
            }
            const originalRecord = this.toPayload(existing);
            const modifiedRecord = this.toPayload({
                ...existing,
                csrIsDeleted: true,
                csrModifiedOn: modifiedOn,
                csrModifiedBy: modifiedBy,
            });
            await this.auditLogService.logEntityChange({
                action: 'cancel',
                tableName: ITEM_CUST_RATE_TABLE_NAME,
                screenName: ITEM_CUST_RATE_AUDIT_SCREEN_NAME,
                screenType: 'master',
                pk: csrId,
                displayName: this.buildDisplayName(existing),
                originalRecord,
                modifiedRecord,
                userId: modifiedBy,
                notes: 'Item customer rate soft deleted',
            }, tx);
            return { csr_id: csrId, deleted: true };
        });
    }
    async createItemCustRate(saveItemCustRateDto) {
        this.validateDateRange(this.parseOptionalDate(saveItemCustRateDto.csr_valid_from, 'csr_valid_from') ?? null, this.parseOptionalDate(saveItemCustRateDto.csr_valid_to, 'csr_valid_to') ?? null);
        const now = new Date();
        const createdBy = (0, module_service_utils_1.resolveActor)(saveItemCustRateDto.csr_created_by, this.requestContextService.getUserId());
        const modifiedBy = (0, module_service_utils_1.resolveActor)(saveItemCustRateDto.csr_modified_by, createdBy);
        const data = {
            csrCustomerId: saveItemCustRateDto.csr_customer_id,
            csrUnitRateId: saveItemCustRateDto.csr_unit_rate_id,
            csrCreatedOn: now,
            csrCreatedBy: createdBy,
        };
        this.applyOptionalFields(data, saveItemCustRateDto);
        try {
            return await this.prisma.$transaction(async (tx) => {
                const created = await tx.custItemRate.create({ data });
                const payload = this.toPayload(created);
                await this.auditLogService.logEntityChange({
                    action: 'New',
                    tableName: ITEM_CUST_RATE_TABLE_NAME,
                    screenName: ITEM_CUST_RATE_AUDIT_SCREEN_NAME,
                    screenType: 'master',
                    pk: payload.csr_id,
                    displayName: this.buildDisplayName(created),
                    originalRecord: null,
                    modifiedRecord: payload,
                    userId: createdBy,
                    notes: 'Item customer rate created',
                }, tx);
                return payload;
            });
        }
        catch (error) {
            this.handleWriteError(error);
            throw error;
        }
    }
    async updateItemCustRate(saveItemCustRateDto) {
        const csrId = saveItemCustRateDto.csr_id;
        try {
            return await this.prisma.$transaction(async (tx) => {
                const existing = await tx.custItemRate.findFirst({
                    where: { csrId, csrIsDeleted: false },
                });
                if (!existing) {
                    this.throwNotFound(csrId);
                }
                const nextValidFrom = (0, module_service_utils_1.hasOwnProperty)(saveItemCustRateDto, 'csr_valid_from')
                    ? (this.parseOptionalDate(saveItemCustRateDto.csr_valid_from, 'csr_valid_from') ?? null)
                    : existing.csrValidFrom;
                const nextValidTo = (0, module_service_utils_1.hasOwnProperty)(saveItemCustRateDto, 'csr_valid_to')
                    ? (this.parseOptionalDate(saveItemCustRateDto.csr_valid_to, 'csr_valid_to') ?? null)
                    : existing.csrValidTo;
                this.validateDateRange(nextValidFrom, nextValidTo);
                const data = {
                    csrCustomerId: saveItemCustRateDto.csr_customer_id,
                    csrUnitRateId: saveItemCustRateDto.csr_unit_rate_id,
                    csrModifiedOn: new Date(),
                    csrModifiedBy: (0, module_service_utils_1.resolveActor)(saveItemCustRateDto.csr_modified_by, this.requestContextService.getUserId()),
                };
                this.applyOptionalFields(data, saveItemCustRateDto);
                const updated = await tx.custItemRate.update({ where: { csrId }, data });
                const payload = this.toPayload(updated);
                await this.auditLogService.logEntityChange({
                    action: 'update',
                    tableName: ITEM_CUST_RATE_TABLE_NAME,
                    screenName: ITEM_CUST_RATE_AUDIT_SCREEN_NAME,
                    screenType: 'master',
                    pk: csrId,
                    displayName: this.buildDisplayName(updated),
                    originalRecord: this.toPayload(existing),
                    modifiedRecord: payload,
                    userId: payload.csr_modified_by ?? this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
                    notes: 'Item customer rate updated',
                }, tx);
                return payload;
            });
        }
        catch (error) {
            this.handleWriteError(error);
            throw error;
        }
    }
    buildListWhere(queryDto) {
        const where = { csrIsDeleted: false };
        if (queryDto.csr_branch_id !== undefined)
            where.csrBranchId = queryDto.csr_branch_id;
        if (queryDto.csr_customer_id !== undefined)
            where.csrCustomerId = queryDto.csr_customer_id;
        if (queryDto.csr_unit_rate_id !== undefined)
            where.csrUnitRateId = queryDto.csr_unit_rate_id;
        if (queryDto.csr_rate_type !== undefined)
            where.csrRateType = queryDto.csr_rate_type;
        if (queryDto.csr_price_level !== undefined)
            where.csrPriceLevel = queryDto.csr_price_level;
        if (queryDto.csr_is_active !== undefined)
            where.csrIsActive = queryDto.csr_is_active;
        if (queryDto.search?.trim()) {
            const search = queryDto.search.trim();
            where.OR = [
                { csrRateType: { contains: search, mode: 'insensitive' } },
                { csrPriceLevel: { contains: search, mode: 'insensitive' } },
                { csrRemarks: { contains: search, mode: 'insensitive' } },
            ];
        }
        return where;
    }
    applyOptionalFields(data, saveItemCustRateDto) {
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemCustRateDto, 'csr_branch_id'))
            data.csrBranchId = saveItemCustRateDto.csr_branch_id;
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemCustRateDto, 'csr_rate_type'))
            data.csrRateType = saveItemCustRateDto.csr_rate_type;
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemCustRateDto, 'csr_item_rate'))
            data.csrItemRate = saveItemCustRateDto.csr_item_rate;
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemCustRateDto, 'csr_disc_perc'))
            data.csrDiscPerc = saveItemCustRateDto.csr_disc_perc;
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemCustRateDto, 'csr_disc_qty'))
            data.csrDiscQty = saveItemCustRateDto.csr_disc_qty;
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemCustRateDto, 'csr_price_level'))
            data.csrPriceLevel = saveItemCustRateDto.csr_price_level;
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemCustRateDto, 'csr_valid_from')) {
            data.csrValidFrom = this.parseOptionalDate(saveItemCustRateDto.csr_valid_from, 'csr_valid_from');
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemCustRateDto, 'csr_valid_to')) {
            data.csrValidTo = this.parseOptionalDate(saveItemCustRateDto.csr_valid_to, 'csr_valid_to');
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemCustRateDto, 'csr_priority'))
            data.csrPriority = saveItemCustRateDto.csr_priority;
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemCustRateDto, 'csr_is_active'))
            data.csrIsActive = saveItemCustRateDto.csr_is_active;
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemCustRateDto, 'csr_uploaded_at')) {
            data.csrUploadedAt = this.parseOptionalDate(saveItemCustRateDto.csr_uploaded_at, 'csr_uploaded_at');
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemCustRateDto, 'csr_uploaded_by'))
            data.csrUploadedBy = saveItemCustRateDto.csr_uploaded_by;
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemCustRateDto, 'csr_remarks'))
            data.csrRemarks = saveItemCustRateDto.csr_remarks;
    }
    validateDateRange(validFrom, validTo) {
        if (!validFrom || !validTo)
            return;
        if (validFrom.getTime() > validTo.getTime()) {
            (0, module_service_utils_1.throwMasterBadRequest)('Validation failed', [
                { field: 'csr_valid_to', message: 'csr_valid_to must be greater than or equal to csr_valid_from' },
            ]);
        }
    }
    parseOptionalDate(value, fieldName) {
        if (value === undefined)
            return undefined;
        if (value === null)
            return null;
        const parsedDate = new Date(value);
        if (Number.isNaN(parsedDate.getTime())) {
            (0, module_service_utils_1.throwMasterBadRequest)('Validation failed', [
                { field: fieldName, message: `${fieldName} must be a valid date` },
            ]);
        }
        return parsedDate;
    }
    toPayload(record) {
        return {
            csr_id: record.csrId,
            csr_branch_id: record.csrBranchId,
            csr_customer_id: record.csrCustomerId,
            csr_unit_rate_id: record.csrUnitRateId,
            csr_rate_type: record.csrRateType,
            csr_item_rate: (0, module_service_utils_1.toNumber)(record.csrItemRate),
            csr_disc_perc: (0, module_service_utils_1.toNumber)(record.csrDiscPerc),
            csr_disc_qty: (0, module_service_utils_1.toNumber)(record.csrDiscQty),
            csr_price_level: record.csrPriceLevel,
            csr_valid_from: record.csrValidFrom ? record.csrValidFrom.toISOString() : null,
            csr_valid_to: record.csrValidTo ? record.csrValidTo.toISOString() : null,
            csr_priority: record.csrPriority,
            csr_is_active: record.csrIsActive,
            csr_is_deleted: record.csrIsDeleted,
            csr_created_on: record.csrCreatedOn.toISOString(),
            csr_created_by: record.csrCreatedBy,
            csr_modified_on: record.csrModifiedOn.toISOString(),
            csr_modified_by: record.csrModifiedBy,
            csr_uploaded_at: record.csrUploadedAt ? record.csrUploadedAt.toISOString() : null,
            csr_uploaded_by: record.csrUploadedBy,
            csr_remarks: record.csrRemarks,
        };
    }
    buildDisplayName(record) {
        return `${record.csrCustomerId}:${record.csrUnitRateId}`;
    }
    handleWriteError(error) {
        (0, module_service_utils_1.throwOnUniqueConstraintError)(error, 'Item customer rate already exists', [
            { field: 'csr_id', message: 'Duplicate item customer rate is not allowed' },
        ]);
        if ((0, module_service_utils_1.isForeignKeyConstraintError)(error)) {
            (0, module_service_utils_1.throwMasterBadRequest)('Invalid relation reference', [
                { field: 'csr_customer_id', message: 'Referenced relation does not exist' },
            ]);
        }
    }
    throwNotFound(csrId) {
        (0, module_service_utils_1.throwMasterNotFound)('Item customer rate not found', 'csr_id', `No active item customer rate found with id ${csrId}`);
    }
};
exports.ItemsCustRatesMasterService = ItemsCustRatesMasterService;
exports.ItemsCustRatesMasterService = ItemsCustRatesMasterService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_log_service_1.AuditLogService,
        configured_grid_sql_service_1.ConfiguredGridSqlService,
        request_context_service_1.RequestContextService])
], ItemsCustRatesMasterService);
//# sourceMappingURL=items-cust-rates-master.service.js.map