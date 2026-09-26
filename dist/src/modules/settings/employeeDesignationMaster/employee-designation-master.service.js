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
exports.EmployeeDesignationMasterService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const audit_log_service_1 = require("../../audit-log/audit-log.service");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const EMPLOYEE_DESIGNATION_MASTER_TABLE_NAME = 'employee designations';
const EMPLOYEE_DESIGNATION_MASTER_AUDIT_SCREEN_NAME = 'Employee Designation Master';
let EmployeeDesignationMasterService = class EmployeeDesignationMasterService {
    prisma;
    auditLogService;
    requestContextService;
    constructor(prisma, auditLogService, requestContextService) {
        this.prisma = prisma;
        this.auditLogService = auditLogService;
        this.requestContextService = requestContextService;
    }
    async save(saveEmployeeDesignationMasterDto) {
        if (saveEmployeeDesignationMasterDto.edId) {
            return this.updateDesignation(saveEmployeeDesignationMasterDto);
        }
        return this.createDesignation(saveEmployeeDesignationMasterDto);
    }
    async getById(edId) {
        const record = await this.prisma.employeeDesignation.findFirst({
            where: {
                edId,
                edIsDeleted: false,
            },
        });
        if (!record) {
            this.throwNotFound(edId);
        }
        return this.toPayload(record);
    }
    async softDelete(edId) {
        return this.prisma.$transaction(async (tx) => {
            const existing = await tx.employeeDesignation.findFirst({
                where: {
                    edId,
                    edIsDeleted: false,
                },
            });
            if (!existing) {
                this.throwNotFound(edId);
            }
            const activeEmployeesCount = await tx.employeeMaster.count({
                where: {
                    empDesignationId: edId,
                    empIsDeleted: false,
                },
            });
            if (activeEmployeesCount > 0) {
                this.throwBadRequest('Cannot delete employee designation with active employees', [
                    {
                        field: 'edId',
                        message: `Employee designation ${edId} is used by ${activeEmployeesCount} employee(s).`,
                    },
                ]);
            }
            const modifiedOn = new Date();
            const result = await tx.employeeDesignation.updateMany({
                where: {
                    edId,
                    edIsDeleted: false,
                },
                data: {
                    edIsDeleted: true,
                    edIsActive: false,
                    edIsDefault: false,
                    edModifiedOn: modifiedOn,
                    edModifiedBy: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
                },
            });
            if (result.count === 0) {
                this.throwNotFound(edId);
            }
            const originalRecord = this.toPayload(existing);
            const modifiedRecord = this.toPayload({
                ...existing,
                edIsDeleted: true,
                edIsActive: false,
                edIsDefault: false,
                edModifiedOn: modifiedOn,
                edModifiedBy: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
            });
            await this.auditLogService.logEntityChange({
                action: 'cancel',
                tableName: EMPLOYEE_DESIGNATION_MASTER_TABLE_NAME,
                screenName: EMPLOYEE_DESIGNATION_MASTER_AUDIT_SCREEN_NAME,
                screenType: 'master',
                pk: edId,
                displayName: existing.edName,
                originalRecord,
                modifiedRecord,
                userId: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
                notes: 'Employee designation soft deleted',
            }, tx);
            return {
                edId,
                deleted: true,
            };
        });
    }
    async createDesignation(saveEmployeeDesignationMasterDto) {
        try {
            return this.prisma.$transaction(async (tx) => {
                const edName = this.normalizeRequiredName(saveEmployeeDesignationMasterDto.edName);
                const edCode = (0, module_service_utils_1.normalizeNullableString)(saveEmployeeDesignationMasterDto.edCode);
                const edRemarks = (0, module_service_utils_1.normalizeNullableString)(saveEmployeeDesignationMasterDto.edRemarks);
                await this.ensureNameIsUnique(tx, edName);
                await this.ensureCodeIsUnique(tx, edCode);
                if (saveEmployeeDesignationMasterDto.edIsDefault === true) {
                    await this.clearDefaultDesignation(tx);
                }
                const now = new Date();
                const data = {
                    edName,
                    edCreatedOn: now,
                    edCreatedBy: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
                };
                if ((0, module_service_utils_1.hasOwnProperty)(saveEmployeeDesignationMasterDto, 'edCode')) {
                    data.edCode = edCode;
                }
                if ((0, module_service_utils_1.hasOwnProperty)(saveEmployeeDesignationMasterDto, 'edIsDefault')) {
                    data.edIsDefault = saveEmployeeDesignationMasterDto.edIsDefault;
                }
                if ((0, module_service_utils_1.hasOwnProperty)(saveEmployeeDesignationMasterDto, 'edRemarks')) {
                    data.edRemarks = edRemarks;
                }
                if ((0, module_service_utils_1.hasOwnProperty)(saveEmployeeDesignationMasterDto, 'edIsActive')) {
                    data.edIsActive = saveEmployeeDesignationMasterDto.edIsActive;
                }
                const created = await tx.employeeDesignation.create({ data });
                const payload = this.toPayload(created);
                await this.auditLogService.logEntityChange({
                    action: 'New',
                    tableName: EMPLOYEE_DESIGNATION_MASTER_TABLE_NAME,
                    screenName: EMPLOYEE_DESIGNATION_MASTER_AUDIT_SCREEN_NAME,
                    screenType: 'master',
                    pk: payload.edId,
                    displayName: payload.edName,
                    originalRecord: null,
                    modifiedRecord: payload,
                    userId: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
                    notes: 'Employee designation created',
                }, tx);
                return payload;
            });
        }
        catch (error) {
            this.handleWriteError(error);
            throw error;
        }
    }
    async updateDesignation(saveEmployeeDesignationMasterDto) {
        const edId = saveEmployeeDesignationMasterDto.edId;
        try {
            return this.prisma.$transaction(async (tx) => {
                const existing = await tx.employeeDesignation.findFirst({
                    where: {
                        edId,
                        edIsDeleted: false,
                    },
                });
                if (!existing) {
                    this.throwNotFound(edId);
                }
                const edName = this.normalizeRequiredName(saveEmployeeDesignationMasterDto.edName);
                const edCode = (0, module_service_utils_1.normalizeNullableString)(saveEmployeeDesignationMasterDto.edCode);
                const edRemarks = (0, module_service_utils_1.normalizeNullableString)(saveEmployeeDesignationMasterDto.edRemarks);
                await this.ensureNameIsUnique(tx, edName, edId);
                await this.ensureCodeIsUnique(tx, edCode, edId);
                if (saveEmployeeDesignationMasterDto.edIsDefault === true) {
                    await this.clearDefaultDesignation(tx, edId);
                }
                const data = {
                    edName,
                    edModifiedOn: new Date(),
                    edModifiedBy: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
                };
                if ((0, module_service_utils_1.hasOwnProperty)(saveEmployeeDesignationMasterDto, 'edCode')) {
                    data.edCode = edCode;
                }
                if ((0, module_service_utils_1.hasOwnProperty)(saveEmployeeDesignationMasterDto, 'edIsDefault')) {
                    data.edIsDefault = saveEmployeeDesignationMasterDto.edIsDefault;
                }
                if ((0, module_service_utils_1.hasOwnProperty)(saveEmployeeDesignationMasterDto, 'edRemarks')) {
                    data.edRemarks = edRemarks;
                }
                if ((0, module_service_utils_1.hasOwnProperty)(saveEmployeeDesignationMasterDto, 'edIsActive')) {
                    data.edIsActive = saveEmployeeDesignationMasterDto.edIsActive;
                }
                const updated = await tx.employeeDesignation.update({
                    where: {
                        edId,
                    },
                    data,
                });
                const payload = this.toPayload(updated);
                await this.auditLogService.logEntityChange({
                    action: 'update',
                    tableName: EMPLOYEE_DESIGNATION_MASTER_TABLE_NAME,
                    screenName: EMPLOYEE_DESIGNATION_MASTER_AUDIT_SCREEN_NAME,
                    screenType: 'master',
                    pk: edId,
                    displayName: payload.edName,
                    originalRecord: this.toPayload(existing),
                    modifiedRecord: payload,
                    userId: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
                    notes: 'Employee designation updated',
                }, tx);
                return payload;
            });
        }
        catch (error) {
            this.handleWriteError(error);
            throw error;
        }
    }
    async ensureNameIsUnique(tx, edName, excludeEdId) {
        const existing = await tx.employeeDesignation.findFirst({
            where: {
                edIsDeleted: false,
                edName: {
                    equals: edName,
                    mode: 'insensitive',
                },
                ...(excludeEdId
                    ? {
                        edId: {
                            not: excludeEdId,
                        },
                    }
                    : {}),
            },
            select: {
                edId: true,
            },
        });
        if (existing) {
            (0, module_service_utils_1.throwSettingsConflict)('Employee designation name already exists', [
                {
                    field: 'edName',
                    message: 'Duplicate edName is not allowed',
                },
            ]);
        }
    }
    async ensureCodeIsUnique(tx, edCode, excludeEdId) {
        if (!edCode) {
            return;
        }
        const existing = await tx.employeeDesignation.findFirst({
            where: {
                edIsDeleted: false,
                edCode: {
                    equals: edCode,
                    mode: 'insensitive',
                },
                ...(excludeEdId
                    ? {
                        edId: {
                            not: excludeEdId,
                        },
                    }
                    : {}),
            },
            select: {
                edId: true,
            },
        });
        if (existing) {
            (0, module_service_utils_1.throwSettingsConflict)('Employee designation code already exists', [
                {
                    field: 'edCode',
                    message: 'Duplicate edCode is not allowed',
                },
            ]);
        }
    }
    async clearDefaultDesignation(tx, excludeEdId) {
        await tx.employeeDesignation.updateMany({
            where: {
                edIsDeleted: false,
                edIsDefault: true,
                ...(excludeEdId
                    ? {
                        edId: {
                            not: excludeEdId,
                        },
                    }
                    : {}),
            },
            data: {
                edIsDefault: false,
                edModifiedOn: new Date(),
                edModifiedBy: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
            },
        });
    }
    normalizeRequiredName(value) {
        return (0, module_service_utils_1.normalizeRequiredText)(value, 'edName');
    }
    toPayload(record) {
        return {
            edId: record.edId,
            edName: record.edName,
            edCode: record.edCode,
            edIsDefault: record.edIsDefault,
            edRemarks: record.edRemarks,
            edIsActive: record.edIsActive,
            edIsDeleted: record.edIsDeleted,
            edSyncDate: record.edSyncDate ? record.edSyncDate.toISOString() : null,
            edCreatedOn: record.edCreatedOn.toISOString(),
            edCreatedBy: record.edCreatedBy,
            edModifiedOn: record.edModifiedOn.toISOString(),
            edModifiedBy: record.edModifiedBy,
        };
    }
    handleWriteError(error) {
        (0, module_service_utils_1.throwOnUniqueConstraintError)(error, 'Employee designation already exists', [
            {
                field: 'edName',
                message: 'Duplicate employee designation unique value is not allowed',
            },
        ]);
    }
    throwNotFound(edId) {
        (0, module_service_utils_1.throwSettingsNotFound)('Employee designation not found', 'edId', `No active employee designation found with id ${edId}`);
    }
    throwBadRequest(message, errors) {
        (0, module_service_utils_1.throwSettingsBadRequest)(message, errors);
    }
    buildErrorResponse(message, errors = []) {
        return (0, module_service_utils_1.buildSettingsErrorResponse)(message, errors);
    }
};
exports.EmployeeDesignationMasterService = EmployeeDesignationMasterService;
exports.EmployeeDesignationMasterService = EmployeeDesignationMasterService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_log_service_1.AuditLogService,
        request_context_service_1.RequestContextService])
], EmployeeDesignationMasterService);
//# sourceMappingURL=employee-designation-master.service.js.map