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
exports.EmployeeDepartmentMasterService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const audit_log_service_1 = require("../../audit-log/audit-log.service");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const EMPLOYEE_DEPARTMENT_MASTER_TABLE_NAME = 'employee departments';
const EMPLOYEE_DEPARTMENT_MASTER_AUDIT_SCREEN_NAME = 'Employee Department Master';
let EmployeeDepartmentMasterService = class EmployeeDepartmentMasterService {
    prisma;
    auditLogService;
    requestContextService;
    constructor(prisma, auditLogService, requestContextService) {
        this.prisma = prisma;
        this.auditLogService = auditLogService;
        this.requestContextService = requestContextService;
    }
    async save(saveEmployeeDepartmentMasterDto) {
        if (saveEmployeeDepartmentMasterDto.edptId) {
            return this.updateDepartment(saveEmployeeDepartmentMasterDto);
        }
        return this.createDepartment(saveEmployeeDepartmentMasterDto);
    }
    async getById(edptId) {
        const record = await this.prisma.employeeDepartment.findFirst({
            where: {
                edptId,
                edptIsDeleted: false,
            },
        });
        if (!record) {
            this.throwNotFound(edptId);
        }
        return this.toPayload(record);
    }
    async softDelete(edptId) {
        return this.prisma.$transaction(async (tx) => {
            const existing = await tx.employeeDepartment.findFirst({
                where: {
                    edptId,
                    edptIsDeleted: false,
                },
            });
            if (!existing) {
                this.throwNotFound(edptId);
            }
            const activeEmployeesCount = await tx.employeeMaster.count({
                where: {
                    empDepartmentId: edptId,
                    empIsDeleted: false,
                },
            });
            if (activeEmployeesCount > 0) {
                this.throwBadRequest('Cannot delete employee department with active employees', [
                    {
                        field: 'edptId',
                        message: `Employee department ${edptId} is used by ${activeEmployeesCount} employee(s).`,
                    },
                ]);
            }
            const modifiedOn = new Date();
            const result = await tx.employeeDepartment.updateMany({
                where: {
                    edptId,
                    edptIsDeleted: false,
                },
                data: {
                    edptIsDeleted: true,
                    edptIsActive: false,
                    edptModifiedOn: modifiedOn,
                    edptModifiedBy: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
                },
            });
            if (result.count === 0) {
                this.throwNotFound(edptId);
            }
            const originalRecord = this.toPayload(existing);
            const modifiedRecord = this.toPayload({
                ...existing,
                edptIsDeleted: true,
                edptIsActive: false,
                edptModifiedOn: modifiedOn,
                edptModifiedBy: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
            });
            await this.auditLogService.logEntityChange({
                action: 'cancel',
                tableName: EMPLOYEE_DEPARTMENT_MASTER_TABLE_NAME,
                screenName: EMPLOYEE_DEPARTMENT_MASTER_AUDIT_SCREEN_NAME,
                screenType: 'master',
                pk: edptId,
                displayName: existing.edptName,
                originalRecord,
                modifiedRecord,
                userId: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
                notes: 'Employee department soft deleted',
            }, tx);
            return {
                edptId,
                deleted: true,
            };
        });
    }
    async createDepartment(saveEmployeeDepartmentMasterDto) {
        try {
            return this.prisma.$transaction(async (tx) => {
                const edptName = this.normalizeRequiredName(saveEmployeeDepartmentMasterDto.edptName);
                const edptCode = (0, module_service_utils_1.normalizeNullableString)(saveEmployeeDepartmentMasterDto.edptCode);
                const edptAlias = (0, module_service_utils_1.normalizeNullableString)(saveEmployeeDepartmentMasterDto.edptAlias);
                const edptRemarks = (0, module_service_utils_1.normalizeNullableString)(saveEmployeeDepartmentMasterDto.edptRemarks);
                await this.ensureNameIsUnique(tx, edptName);
                await this.ensureCodeIsUnique(tx, edptCode);
                const now = new Date();
                const data = {
                    edptName,
                    edptCreatedOn: now,
                    edptCreatedBy: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
                };
                if ((0, module_service_utils_1.hasOwnProperty)(saveEmployeeDepartmentMasterDto, 'edptCode')) {
                    data.edptCode = edptCode;
                }
                if ((0, module_service_utils_1.hasOwnProperty)(saveEmployeeDepartmentMasterDto, 'edptAlias')) {
                    data.edptAlias = edptAlias;
                }
                if ((0, module_service_utils_1.hasOwnProperty)(saveEmployeeDepartmentMasterDto, 'edptRemarks')) {
                    data.edptRemarks = edptRemarks;
                }
                if ((0, module_service_utils_1.hasOwnProperty)(saveEmployeeDepartmentMasterDto, 'edptIsActive')) {
                    data.edptIsActive = saveEmployeeDepartmentMasterDto.edptIsActive;
                }
                const created = await tx.employeeDepartment.create({ data });
                const payload = this.toPayload(created);
                await this.auditLogService.logEntityChange({
                    action: 'New',
                    tableName: EMPLOYEE_DEPARTMENT_MASTER_TABLE_NAME,
                    screenName: EMPLOYEE_DEPARTMENT_MASTER_AUDIT_SCREEN_NAME,
                    screenType: 'master',
                    pk: payload.edptId,
                    displayName: payload.edptName,
                    originalRecord: null,
                    modifiedRecord: payload,
                    userId: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
                    notes: 'Employee department created',
                }, tx);
                return payload;
            });
        }
        catch (error) {
            this.handleWriteError(error);
            throw error;
        }
    }
    async updateDepartment(saveEmployeeDepartmentMasterDto) {
        const edptId = saveEmployeeDepartmentMasterDto.edptId;
        try {
            return this.prisma.$transaction(async (tx) => {
                const existing = await tx.employeeDepartment.findFirst({
                    where: {
                        edptId,
                        edptIsDeleted: false,
                    },
                });
                if (!existing) {
                    this.throwNotFound(edptId);
                }
                const edptName = this.normalizeRequiredName(saveEmployeeDepartmentMasterDto.edptName);
                const edptCode = (0, module_service_utils_1.normalizeNullableString)(saveEmployeeDepartmentMasterDto.edptCode);
                const edptAlias = (0, module_service_utils_1.normalizeNullableString)(saveEmployeeDepartmentMasterDto.edptAlias);
                const edptRemarks = (0, module_service_utils_1.normalizeNullableString)(saveEmployeeDepartmentMasterDto.edptRemarks);
                await this.ensureNameIsUnique(tx, edptName, edptId);
                await this.ensureCodeIsUnique(tx, edptCode, edptId);
                const data = {
                    edptName,
                    edptModifiedOn: new Date(),
                    edptModifiedBy: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
                };
                if ((0, module_service_utils_1.hasOwnProperty)(saveEmployeeDepartmentMasterDto, 'edptCode')) {
                    data.edptCode = edptCode;
                }
                if ((0, module_service_utils_1.hasOwnProperty)(saveEmployeeDepartmentMasterDto, 'edptAlias')) {
                    data.edptAlias = edptAlias;
                }
                if ((0, module_service_utils_1.hasOwnProperty)(saveEmployeeDepartmentMasterDto, 'edptRemarks')) {
                    data.edptRemarks = edptRemarks;
                }
                if ((0, module_service_utils_1.hasOwnProperty)(saveEmployeeDepartmentMasterDto, 'edptIsActive')) {
                    data.edptIsActive = saveEmployeeDepartmentMasterDto.edptIsActive;
                }
                const updated = await tx.employeeDepartment.update({
                    where: {
                        edptId,
                    },
                    data,
                });
                const payload = this.toPayload(updated);
                await this.auditLogService.logEntityChange({
                    action: 'update',
                    tableName: EMPLOYEE_DEPARTMENT_MASTER_TABLE_NAME,
                    screenName: EMPLOYEE_DEPARTMENT_MASTER_AUDIT_SCREEN_NAME,
                    screenType: 'master',
                    pk: edptId,
                    displayName: payload.edptName,
                    originalRecord: this.toPayload(existing),
                    modifiedRecord: payload,
                    userId: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
                    notes: 'Employee department updated',
                }, tx);
                return payload;
            });
        }
        catch (error) {
            this.handleWriteError(error);
            throw error;
        }
    }
    async ensureNameIsUnique(tx, edptName, excludeEdptId) {
        const existing = await tx.employeeDepartment.findFirst({
            where: {
                edptIsDeleted: false,
                edptName: {
                    equals: edptName,
                    mode: 'insensitive',
                },
                ...(excludeEdptId
                    ? {
                        edptId: {
                            not: excludeEdptId,
                        },
                    }
                    : {}),
            },
            select: {
                edptId: true,
            },
        });
        if (existing) {
            (0, module_service_utils_1.throwSettingsConflict)('Employee department name already exists', [
                {
                    field: 'edptName',
                    message: 'Duplicate edptName is not allowed',
                },
            ]);
        }
    }
    async ensureCodeIsUnique(tx, edptCode, excludeEdptId) {
        if (!edptCode) {
            return;
        }
        const existing = await tx.employeeDepartment.findFirst({
            where: {
                edptIsDeleted: false,
                edptCode: {
                    equals: edptCode,
                    mode: 'insensitive',
                },
                ...(excludeEdptId
                    ? {
                        edptId: {
                            not: excludeEdptId,
                        },
                    }
                    : {}),
            },
            select: {
                edptId: true,
            },
        });
        if (existing) {
            (0, module_service_utils_1.throwSettingsConflict)('Employee department code already exists', [
                {
                    field: 'edptCode',
                    message: 'Duplicate edptCode is not allowed',
                },
            ]);
        }
    }
    normalizeRequiredName(value) {
        return (0, module_service_utils_1.normalizeRequiredText)(value, 'edptName');
    }
    toPayload(record) {
        return {
            edptId: record.edptId,
            edptName: record.edptName,
            edptCode: record.edptCode,
            edptAlias: record.edptAlias,
            edptRemarks: record.edptRemarks,
            edptIsActive: record.edptIsActive,
            edptIsDeleted: record.edptIsDeleted,
            edptSyncDate: record.edptSyncDate ? record.edptSyncDate.toISOString() : null,
            edptCreatedOn: record.edptCreatedOn.toISOString(),
            edptCreatedBy: record.edptCreatedBy,
            edptModifiedOn: record.edptModifiedOn.toISOString(),
            edptModifiedBy: record.edptModifiedBy,
        };
    }
    handleWriteError(error) {
        (0, module_service_utils_1.throwOnUniqueConstraintError)(error, 'Employee department already exists', [
            {
                field: 'edptName',
                message: 'Duplicate employee department unique value is not allowed',
            },
        ]);
    }
    throwNotFound(edptId) {
        (0, module_service_utils_1.throwSettingsNotFound)('Employee department not found', 'edptId', `No active employee department found with id ${edptId}`);
    }
    throwBadRequest(message, errors) {
        (0, module_service_utils_1.throwSettingsBadRequest)(message, errors);
    }
    buildErrorResponse(message, errors = []) {
        return (0, module_service_utils_1.buildSettingsErrorResponse)(message, errors);
    }
};
exports.EmployeeDepartmentMasterService = EmployeeDepartmentMasterService;
exports.EmployeeDepartmentMasterService = EmployeeDepartmentMasterService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_log_service_1.AuditLogService,
        request_context_service_1.RequestContextService])
], EmployeeDepartmentMasterService);
//# sourceMappingURL=employee-department-master.service.js.map