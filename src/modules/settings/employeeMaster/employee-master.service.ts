import { Injectable } from '@nestjs/common';
import { EmpMaster, Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { SaveEmployeeMasterDto } from './dto/save-employee-master.dto';
import {
  EmployeeMasterErrorDetail,
  EmployeeMasterErrorResponse,
  EmployeeMasterPayload,
} from './types/employee-master-api.types';
import {
  DEFAULT_ACTOR,
  SettingsWriteClient,
  applyPresentFields,
  buildSettingsErrorResponse,
  isForeignKeyConstraintError,
  normalizeRequiredText,
  throwOnUniqueConstraintError,
  throwSettingsBadRequest,
  throwSettingsNotFound,
  toNullableNumber,
  toNumber,
} from 'src/common/utils/module-service.utils';
import { RequestContextService } from '../../../common/request-context/request-context.service';

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

type EmployeeMasterWriteClient = SettingsWriteClient;

@Injectable()
export class EmployeeMasterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly requestContextService: RequestContextService,
  ) {}
  async save(saveEmployeeMasterDto: SaveEmployeeMasterDto): Promise<EmployeeMasterPayload> {
    if (saveEmployeeMasterDto.empId) {
      return this.updateEmployee(saveEmployeeMasterDto);
    }
    return this.createEmployee(saveEmployeeMasterDto);
  }
  async getById(empId: string): Promise<EmployeeMasterPayload> {
    const record = await this.prisma.empMaster.findFirst({
      where: {
        empId,
        empIsDeleted: false,
      },
    });
    if (!record) {
      this.throwNotFound(empId);
    }
    return this.toPayload(record);
  }

  async softDelete(empId: string): Promise<{ empId: string; deleted: true }> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.empMaster.findFirst({
        where: {
          empId,
          empIsDeleted: false,
        },
      });
      if (!existing) {
        this.throwNotFound(empId);
      }
      const modifiedOn = new Date();
      const result = await tx.empMaster.updateMany({
        where: {
          empId,
          empIsDeleted: false,
        },
        data: {
          empIsDeleted: true,
          empIsActive: false,
          empModifiedOn: modifiedOn,
          empModifiedBy: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
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
        empModifiedBy: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
      });
      await this.auditLogService.logEntityChange(
        {
          action: 'cancel',
          tableName: EMPLOYEE_MASTER_TABLE_NAME,
          screenName: EMPLOYEE_MASTER_AUDIT_SCREEN_NAME,
          screenType: 'master',
          pk: empId,
          displayName: existing.empName,
          originalRecord,
          modifiedRecord,
          userId: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
          notes: 'Employee soft deleted',
        },
        tx,
      );
      return {
        empId,
        deleted: true,
      };
    });
  }
  private async createEmployee(
    saveEmployeeMasterDto: SaveEmployeeMasterDto,
  ): Promise<EmployeeMasterPayload> {
    try {
      return this.prisma.$transaction(async (tx) => {
        const empName = this.normalizeRequiredValue(saveEmployeeMasterDto.empName, 'empName');
        const empSalaryType = this.normalizeRequiredValue(
          saveEmployeeMasterDto.empSalaryType,
          'empSalaryType',
        );
        await this.ensureCompanyExists(saveEmployeeMasterDto.empCompanyId, tx);
        await this.ensureDepartmentExists(saveEmployeeMasterDto.empDepartmentId, tx);
        await this.ensureDesignationExists(saveEmployeeMasterDto.empDesignationId, tx);
        const now = new Date();
        const data: Prisma.EmpMasterUncheckedCreateInput = {
          empCompanyId: saveEmployeeMasterDto.empCompanyId,
          empName,
          empSalaryType,
          empCreatedOn: now,
          empCreatedBy: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
        };
        this.applyOptionalFields(data, saveEmployeeMasterDto);
        const created = await tx.empMaster.create({ data });
        const payload = this.toPayload(created);
        await this.auditLogService.logEntityChange(
          {
            action: 'New',
            tableName: EMPLOYEE_MASTER_TABLE_NAME,
            screenName: EMPLOYEE_MASTER_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: payload.empId,
            displayName: payload.empName,
            originalRecord: null,
            modifiedRecord: payload,
            userId: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
            notes: 'Employee created',
          },
          tx,
        );
        return payload;
      });
    } catch (error: unknown) {
      this.handleWriteError(error);
      throw error;
    }
  }
  private async updateEmployee(
    saveEmployeeMasterDto: SaveEmployeeMasterDto,
  ): Promise<EmployeeMasterPayload> {
    const empId = saveEmployeeMasterDto.empId!;
    try {
      return this.prisma.$transaction(async (tx) => {
        const existing = await tx.empMaster.findFirst({
          where: {
            empId,
            empIsDeleted: false,
          },
        });
        if (!existing) {
          this.throwNotFound(empId);
        }
        const empName = this.normalizeRequiredValue(saveEmployeeMasterDto.empName, 'empName');
        const empSalaryType = this.normalizeRequiredValue(
          saveEmployeeMasterDto.empSalaryType,
          'empSalaryType',
        );
        await this.ensureCompanyExists(saveEmployeeMasterDto.empCompanyId, tx);
        await this.ensureDepartmentExists(saveEmployeeMasterDto.empDepartmentId, tx);
        await this.ensureDesignationExists(saveEmployeeMasterDto.empDesignationId, tx);
        const data: Prisma.EmpMasterUncheckedUpdateInput = {
          empCompanyId: saveEmployeeMasterDto.empCompanyId,
          empName,
          empSalaryType,
          empModifiedOn: new Date(),
          empModifiedBy: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
        };
        this.applyOptionalFields(data, saveEmployeeMasterDto);
        const updated = await tx.empMaster.update({
          where: {
            empId,
          },
          data,
        });
        const payload = this.toPayload(updated);
        await this.auditLogService.logEntityChange(
          {
            action: 'update',
            tableName: EMPLOYEE_MASTER_TABLE_NAME,
            screenName: EMPLOYEE_MASTER_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: empId,
            displayName: payload.empName,
            originalRecord: this.toPayload(existing),
            modifiedRecord: payload,
            userId: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
            notes: 'Employee updated',
          },
          tx,
        );
        return payload;
      });
    } catch (error: unknown) {
      this.handleWriteError(error);
      throw error;
    }
  }
  private async ensureCompanyExists(compId: string, tx: EmployeeMasterWriteClient): Promise<void> {
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
  private async ensureDesignationExists(
    empDesignationId: string | null | undefined,
    tx: EmployeeMasterWriteClient,
  ): Promise<void> {
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
  private async ensureDepartmentExists(
    empDepartmentId: string | null | undefined,
    tx: EmployeeMasterWriteClient,
  ): Promise<void> {
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

  private applyOptionalFields(
    data: Prisma.EmpMasterUncheckedCreateInput | Prisma.EmpMasterUncheckedUpdateInput,
    saveEmployeeMasterDto: SaveEmployeeMasterDto,
  ): void {
    applyPresentFields(data, saveEmployeeMasterDto, EMPLOYEE_MASTER_OPTIONAL_FIELDS, {
      empPhoto: (value) => this.decodePhoto(value as string | null | undefined),
    });
  }

  private normalizeRequiredValue(value: string, field: string): string {
    return normalizeRequiredText<EmployeeMasterErrorDetail>(
      value,
      field,
      `${field} must not be empty`,
    );
  }

  private decodePhoto(value: string | null | undefined): Prisma.Bytes | null | undefined {
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

  private extractBase64Payload(value: string): string {
    if (!value.startsWith('data:')) {
      return value;
    }

    const separatorIndex = value.indexOf(',');
    if (separatorIndex === -1) {
      return '';
    }

    return value.slice(separatorIndex + 1).trim();
  }

  private toPayload(record: EmpMaster): EmployeeMasterPayload {
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
      empCommissionValue: toNullableNumber(record.empCommissionValue),
      empSalaryType: record.empSalaryType,
      empSalaryAmount: toNumber(record.empSalaryAmount),
      empBataAmount: toNumber(record.empBataAmount),
      empKmBataAmount: toNumber(record.empKmBataAmount),
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

  private handleWriteError(error: unknown): void {
    throwOnUniqueConstraintError<EmployeeMasterErrorDetail>(error, 'Employee already exists', [
      {
        field: 'empCode',
        message: 'Duplicate employee unique value is not allowed',
      },
    ]);

    if (isForeignKeyConstraintError(error)) {
      throwSettingsBadRequest<EmployeeMasterErrorDetail>('Invalid relation reference', [
        {
          field: 'empCompanyId',
          message: 'Referenced relation does not exist',
        },
      ]);
    }
  }

  private throwNotFound(empId: string): never {
    throwSettingsNotFound<EmployeeMasterErrorDetail>(
      'Employee not found',
      'empId',
      `No active employee found with id ${empId}`,
    );
  }

  private throwBadRequest(message: string, errors: EmployeeMasterErrorDetail[]): never {
    throwSettingsBadRequest<EmployeeMasterErrorDetail>(message, errors);
  }

  private buildErrorResponse(
    message: string,
    errors: EmployeeMasterErrorDetail[] = [],
  ): EmployeeMasterErrorResponse {
    return buildSettingsErrorResponse<EmployeeMasterErrorDetail, EmployeeMasterErrorResponse>(
      message,
      errors,
    );
  }
}
