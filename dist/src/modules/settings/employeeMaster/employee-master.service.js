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
exports.EmployeeMasterService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const audit_log_service_1 = require("../../audit-log/audit-log.service");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const EMPLOYEE_MASTER_TABLE_NAME = 'emp_master';
const EMPLOYEE_MASTER_AUDIT_SCREEN_NAME = 'Employee Master';
const VALIDATION_FAILED_MESSAGE = 'Validation failed';
const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;
const EMPLOYEE_MASTER_OPTIONAL_FIELDS = [
    'empBranchId',
    'empCode',
    'empAlias',
    'empMobile1',
    'empMobile2',
    'empEmail',
    'empAddr1',
    'empAddr2',
    'empAddr3',
    'empCity',
    'empDistrict',
    'empState',
    'empPincode',
    'empGender',
    'empMaritalStatus',
    'empBloodGroup',
    'empDob',
    'empDepartmentId',
    'empDesignationId',
    'empEmploymentType',
    'empStatus',
    'empJoinedOn',
    'empProbationEndOn',
    'empConfirmationOn',
    'empLeftOn',
    'empShiftId',
    'empAttConstraintId',
    'empHolidayGroupId',
    'empOvertimeAllowed',
    'empHasCommission',
    'empCommissionType',
    'empCommissionValue',
    'empSalaryAmount',
    'empBataAmount',
    'empKmBataAmount',
    'empPanNo',
    'empAadharNo',
    'empPfNo',
    'empEsiNo',
    'empLoanLedgerId',
    'empPhotoUrl',
    'empPhoto',
    'empRemarks',
    'empIsActive',
];
let EmployeeMasterService = class EmployeeMasterService {
    prisma;
    auditLogService;
    requestContextService;
    constructor(prisma, auditLogService, requestContextService) {
        this.prisma = prisma;
        this.auditLogService = auditLogService;
        this.requestContextService = requestContextService;
    }
    async save(saveEmployeeMasterDto) {
        if (saveEmployeeMasterDto.empId) {
            return this.updateEmployee(saveEmployeeMasterDto);
        }
        return this.createEmployee(saveEmployeeMasterDto);
    }
    async getById(empId) {
        const record = await this.prisma.employeeMaster.findFirst({
            where: {
                empId,
                empIsDeleted: false,
            },
        });
        if (!record) {
            this.throwNotFound(empId);
        }
        const payload = this.toPayload(record);
        const relatedNames = await this.resolveRelatedNames(this.prisma, record);
        return { ...payload, ...relatedNames };
    }
    async resolveRelatedNames(client, record) {
        const [company, branch, department, designation] = await Promise.all([
            record.empCompanyId
                ? client.company.findFirst({
                    where: { compId: record.empCompanyId },
                    select: { compName: true },
                })
                : null,
            record.empBranchId
                ? client.branchMaster.findFirst({
                    where: { brId: record.empBranchId },
                    select: { brName: true },
                })
                : null,
            record.empDepartmentId
                ? client.employeeDepartment.findFirst({
                    where: { edptId: record.empDepartmentId },
                    select: { edptName: true },
                })
                : null,
            record.empDesignationId
                ? client.employeeDesignation.findFirst({
                    where: { edId: record.empDesignationId },
                    select: { edName: true },
                })
                : null,
        ]);
        return {
            empCompanyName: company?.compName ?? null,
            empBranchName: branch?.brName ?? null,
            empDepartmentName: department?.edptName ?? null,
            empDesignationName: designation?.edName ?? null,
        };
    }
    async softDelete(empId) {
        return this.prisma.$transaction(async (tx) => {
            const existing = await tx.employeeMaster.findFirst({
                where: {
                    empId,
                    empIsDeleted: false,
                },
            });
            if (!existing) {
                this.throwNotFound(empId);
            }
            const modifiedOn = new Date();
            const result = await tx.employeeMaster.updateMany({
                where: {
                    empId,
                    empIsDeleted: false,
                },
                data: {
                    empIsDeleted: true,
                    empIsActive: false,
                    empModifiedOn: modifiedOn,
                    empModifiedBy: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
                },
            });
            if (result.count === 0) {
                this.throwNotFound(empId);
            }
            const originalRecord = this.toPayload(existing);
            const modifiedRecord = this.toPayload({
                ...existing,
                empIsDeleted: true,
                empIsActive: false,
                empModifiedOn: modifiedOn,
                empModifiedBy: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
            });
            await this.auditLogService.logEntityChange({
                action: 'cancel',
                tableName: EMPLOYEE_MASTER_TABLE_NAME,
                screenName: EMPLOYEE_MASTER_AUDIT_SCREEN_NAME,
                screenType: 'master',
                pk: empId,
                displayName: existing.empName,
                originalRecord,
                modifiedRecord,
                userId: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
                notes: 'Employee soft deleted',
            }, tx);
            return {
                empId,
                deleted: true,
            };
        });
    }
    async createEmployee(saveEmployeeMasterDto) {
        try {
            return this.prisma.$transaction(async (tx) => {
                const empName = this.normalizeRequiredValue(saveEmployeeMasterDto.empName, 'empName');
                const empSalaryType = this.normalizeRequiredValue(saveEmployeeMasterDto.empSalaryType, 'empSalaryType');
                await this.ensureCompanyExists(saveEmployeeMasterDto?.empCompanyId, tx);
                await this.ensureDepartmentExists(saveEmployeeMasterDto.empDepartmentId, tx);
                await this.ensureDesignationExists(saveEmployeeMasterDto.empDesignationId, tx);
                const now = new Date();
                const data = {
                    empCompanyId: saveEmployeeMasterDto.empCompanyId,
                    empName,
                    empSalaryType,
                    empCreatedOn: now,
                    empCreatedBy: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
                };
                this.applyOptionalFields(data, saveEmployeeMasterDto);
                const created = await tx.employeeMaster.create({ data });
                const payload = this.toPayload(created);
                await this.auditLogService.logEntityChange({
                    action: 'New',
                    tableName: EMPLOYEE_MASTER_TABLE_NAME,
                    screenName: EMPLOYEE_MASTER_AUDIT_SCREEN_NAME,
                    screenType: 'master',
                    pk: payload.empId,
                    displayName: payload.empName,
                    originalRecord: null,
                    modifiedRecord: payload,
                    userId: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
                    notes: 'Employee created',
                }, tx);
                return payload;
            });
        }
        catch (error) {
            this.handleWriteError(error);
            throw error;
        }
    }
    async updateEmployee(saveEmployeeMasterDto) {
        const empId = saveEmployeeMasterDto.empId;
        try {
            return this.prisma.$transaction(async (tx) => {
                const existing = await tx.employeeMaster.findFirst({
                    where: {
                        empId,
                        empIsDeleted: false,
                    },
                });
                if (!existing) {
                    this.throwNotFound(empId);
                }
                const empName = this.normalizeRequiredValue(saveEmployeeMasterDto.empName, 'empName');
                const empSalaryType = this.normalizeRequiredValue(saveEmployeeMasterDto.empSalaryType, 'empSalaryType');
                await this.ensureCompanyExists(saveEmployeeMasterDto?.empCompanyId, tx);
                await this.ensureDepartmentExists(saveEmployeeMasterDto.empDepartmentId, tx);
                await this.ensureDesignationExists(saveEmployeeMasterDto.empDesignationId, tx);
                const data = {
                    empCompanyId: saveEmployeeMasterDto?.empCompanyId,
                    empName,
                    empSalaryType,
                    empModifiedOn: new Date(),
                    empModifiedBy: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
                };
                this.applyOptionalFields(data, saveEmployeeMasterDto);
                const updated = await tx.employeeMaster.update({
                    where: {
                        empId,
                    },
                    data,
                });
                const payload = this.toPayload(updated);
                await this.auditLogService.logEntityChange({
                    action: 'update',
                    tableName: EMPLOYEE_MASTER_TABLE_NAME,
                    screenName: EMPLOYEE_MASTER_AUDIT_SCREEN_NAME,
                    screenType: 'master',
                    pk: empId,
                    displayName: payload.empName,
                    originalRecord: this.toPayload(existing),
                    modifiedRecord: payload,
                    userId: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
                    notes: 'Employee updated',
                }, tx);
                return payload;
            });
        }
        catch (error) {
            this.handleWriteError(error);
            throw error;
        }
    }
    async ensureCompanyExists(compId, tx) {
        if (compId === undefined || compId === null) {
            return;
        }
        const company = await tx.company.findFirst({
            where: {
                compId,
                compIsDeleted: false,
            },
            select: {
                compId: true,
            },
        });
        if (!company) {
            this.throwBadRequest('Company does not exist', [
                {
                    field: 'empCompanyId',
                    message: `No active company found with id ${compId}`,
                },
            ]);
        }
    }
    async ensureDesignationExists(empDesignationId, tx) {
        if (empDesignationId === undefined || empDesignationId === null) {
            return;
        }
        const designation = await tx.employeeDesignation.findFirst({
            where: {
                edId: empDesignationId,
                edIsDeleted: false,
            },
            select: {
                edId: true,
            },
        });
        if (!designation) {
            this.throwBadRequest('Employee designation does not exist', [
                {
                    field: 'empDesignationId',
                    message: `No active employee designation found with id ${empDesignationId}`,
                },
            ]);
        }
    }
    async ensureDepartmentExists(empDepartmentId, tx) {
        if (empDepartmentId === undefined || empDepartmentId === null) {
            return;
        }
        const department = await tx.employeeDepartment.findFirst({
            where: {
                edptId: empDepartmentId,
                edptIsDeleted: false,
            },
            select: {
                edptId: true,
            },
        });
        if (!department) {
            this.throwBadRequest('Employee department does not exist', [
                {
                    field: 'empDepartmentId',
                    message: `No active employee department found with id ${empDepartmentId}`,
                },
            ]);
        }
    }
    applyOptionalFields(data, saveEmployeeMasterDto) {
        (0, module_service_utils_1.applyPresentFields)(data, saveEmployeeMasterDto, EMPLOYEE_MASTER_OPTIONAL_FIELDS, {
            empPhoto: (value) => this.decodePhoto(value),
        });
    }
    normalizeRequiredValue(value, field) {
        return (0, module_service_utils_1.normalizeRequiredText)(value, field, `${field} must not be empty`);
    }
    decodePhoto(value) {
        if (value === undefined) {
            return undefined;
        }
        if (value === null) {
            return null;
        }
        const trimmed = value.trim();
        if (!trimmed) {
            return null;
        }
        const extracted = this.extractBase64Payload(trimmed);
        const normalized = extracted.replace(/\s+/g, '');
        if (!normalized || normalized.length % 4 !== 0 || !BASE64_PATTERN.test(normalized)) {
            this.throwBadRequest(VALIDATION_FAILED_MESSAGE, [
                {
                    field: 'empPhoto',
                    message: 'empPhoto must be a valid base64 string',
                },
            ]);
        }
        return Uint8Array.from(Buffer.from(normalized, 'base64')).slice();
    }
    extractBase64Payload(value) {
        if (!value.startsWith('data:')) {
            return value;
        }
        const separatorIndex = value.indexOf(',');
        if (separatorIndex === -1) {
            return '';
        }
        return value.slice(separatorIndex + 1).trim();
    }
    toPayload(record) {
        return {
            empId: record.empId,
            empCompanyId: record.empCompanyId,
            empBranchId: record.empBranchId,
            empCode: record.empCode,
            empName: record.empName,
            empAlias: record.empAlias,
            empMobile1: record.empMobile1,
            empMobile2: record.empMobile2,
            empEmail: record.empEmail,
            empAddr1: record.empAddr1,
            empAddr2: record.empAddr2,
            empAddr3: record.empAddr3,
            empCity: record.empCity,
            empDistrict: record.empDistrict,
            empState: record.empState,
            empPincode: record.empPincode,
            empGender: record.empGender,
            empMaritalStatus: record.empMaritalStatus,
            empBloodGroup: record.empBloodGroup,
            empDob: record.empDob ? record.empDob.toISOString() : null,
            empDepartmentId: record.empDepartmentId,
            empDesignationId: record.empDesignationId,
            empEmploymentType: record.empEmploymentType,
            empStatus: record.empStatus,
            empJoinedOn: record.empJoinedOn ? record.empJoinedOn.toISOString() : null,
            empProbationEndOn: record.empProbationEndOn ? record.empProbationEndOn.toISOString() : null,
            empConfirmationOn: record.empConfirmationOn ? record.empConfirmationOn.toISOString() : null,
            empLeftOn: record.empLeftOn ? record.empLeftOn.toISOString() : null,
            empShiftId: record.empShiftId,
            empAttConstraintId: record.empAttConstraintId,
            empHolidayGroupId: record.empHolidayGroupId,
            empOvertimeAllowed: record.empOvertimeAllowed,
            empHasCommission: record.empHasCommission,
            empCommissionType: record.empCommissionType,
            empCommissionValue: (0, module_service_utils_1.toNullableNumber)(record.empCommissionValue),
            empSalaryType: record.empSalaryType,
            empSalaryAmount: (0, module_service_utils_1.toNumber)(record.empSalaryAmount),
            empBataAmount: (0, module_service_utils_1.toNumber)(record.empBataAmount),
            empKmBataAmount: (0, module_service_utils_1.toNumber)(record.empKmBataAmount),
            empPanNo: record.empPanNo,
            empAadharNo: record.empAadharNo,
            empPfNo: record.empPfNo,
            empEsiNo: record.empEsiNo,
            empLoanLedgerId: record.empLoanLedgerId,
            empPhotoUrl: record.empPhotoUrl,
            empPhoto: record.empPhoto ? Buffer.from(record.empPhoto).toString('base64') : null,
            empRemarks: record.empRemarks,
            empIsActive: record.empIsActive,
            empIsDeleted: record.empIsDeleted,
            empSyncDate: record.empSyncDate ? record.empSyncDate.toISOString() : null,
            empCreatedOn: record.empCreatedOn.toISOString(),
            empCreatedBy: record.empCreatedBy,
            empModifiedOn: record.empModifiedOn.toISOString(),
            empModifiedBy: record.empModifiedBy,
        };
    }
    handleWriteError(error) {
        (0, module_service_utils_1.throwOnUniqueConstraintError)(error, 'Employee already exists', [
            {
                field: 'empCode',
                message: 'Duplicate employee unique value is not allowed',
            },
        ]);
        if ((0, module_service_utils_1.isForeignKeyConstraintError)(error)) {
            (0, module_service_utils_1.throwSettingsBadRequest)('Invalid relation reference', [
                {
                    field: 'empCompanyId',
                    message: 'Referenced relation does not exist',
                },
            ]);
        }
    }
    throwNotFound(empId) {
        (0, module_service_utils_1.throwSettingsNotFound)('Employee not found', 'empId', `No active employee found with id ${empId}`);
    }
    throwBadRequest(message, errors) {
        (0, module_service_utils_1.throwSettingsBadRequest)(message, errors);
    }
    buildErrorResponse(message, errors = []) {
        return (0, module_service_utils_1.buildSettingsErrorResponse)(message, errors);
    }
};
exports.EmployeeMasterService = EmployeeMasterService;
exports.EmployeeMasterService = EmployeeMasterService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_log_service_1.AuditLogService,
        request_context_service_1.RequestContextService])
], EmployeeMasterService);
//# sourceMappingURL=employee-master.service.js.map