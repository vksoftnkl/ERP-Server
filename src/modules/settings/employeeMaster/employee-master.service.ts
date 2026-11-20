import { Injectable } from '@nestjs/common';
import { EmployeeMaster, Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { SaveEmployeeMasterDto } from './dto/save-employee-master.dto';
import {
  EmployeeLedgerBackfillReport,
  EmployeeMasterErrorDetail,
  EmployeeMasterErrorResponse,
  EmployeeMasterPayload,
} from './types/employee-master-api.types';
import { StaffAdvanceLedgerService } from './staff-advance-ledger.service';
import { EmployeeMasterErrorCode } from './types/employee-master-error-codes';
import {
  EMPLOYEE_STATUSES,
  EMPLOYEE_STATUS_WORKING,
  canonicalListValue,
} from './types/employee-master-values';
import {
  DEFAULT_ACTOR,
  SettingsWriteClient,
  applyPresentFields,
  buildSettingsErrorResponse,
  isForeignKeyConstraintError,
  normalizeNullableString,
  normalizeRequiredText,
  throwOnUniqueConstraintError,
  throwSettingsBadRequest,
  throwSettingsConflict,
  throwSettingsNotFound,
  toNumber,
} from 'src/common/utils/module-service.utils';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import { EMPLOYEE_CODE_RULE, initialsCode, nextFreeCode } from '../shared/code-from-name';
import { EMPLOYEE_CODE_SERIES, lockCodeSeries } from '../shared/code-series-lock';
import { isUniqueViolationOf } from '../shared/unique-violation';
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
  // HR review step 5 (migration 20261120100000).
  'empUanNo',
  'empBankName',
  'empBankAccountNo',
  'empBankIfsc',
  'empEmergencyContactName',
  'empEmergencyContactPhone',
  // empLoanLedgerId is not copied as given: StaffAdvanceLedgerService.settle decides it.
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
    private readonly staffAdvanceLedgers: StaffAdvanceLedgerService,
  ) {}
  async save(saveEmployeeMasterDto: SaveEmployeeMasterDto): Promise<EmployeeMasterPayload> {
    if (saveEmployeeMasterDto.empId) {
      return this.updateEmployee(saveEmployeeMasterDto);
    }
    return this.createEmployee(saveEmployeeMasterDto);
  }
  async getById(empId: string): Promise<EmployeeMasterPayload> {
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
  private async resolveRelatedNames(
    client: EmployeeMasterWriteClient,
    record: Pick<
      EmployeeMaster,
      'empCompanyId' | 'empBranchId' | 'empDepartmentId' | 'empDesignationId' | 'empLoanLedgerId'
    >,
  ): Promise<{
    empCompanyName: string | null;
    empBranchName: string | null;
    empDepartmentName: string | null;
    empDesignationName: string | null;
    empLoanLedgerName: string | null;
  }> {
    const [company, branch, department, designation, loanLedger] = await Promise.all([
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
      record.empLoanLedgerId
        ? client.accLedgerMaster.findFirst({
            where: { ledId: record.empLoanLedgerId },
            select: { ledName: true },
          })
        : null,
    ]);
    return {
      empCompanyName: company?.compName ?? null,
      empBranchName: branch?.brName ?? null,
      empDepartmentName: department?.edptName ?? null,
      empDesignationName: designation?.edName ?? null,
      empLoanLedgerName: loanLedger?.ledName ?? null,
    };
  }
  async softDelete(empId: string): Promise<{ empId: string; deleted: true }> {
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
      // Notes 95 §A.4 — refused while the staff advance ledger holds money; on a zero balance
      // the ledger is deleted with the employee.
      const ledger = await this.staffAdvanceLedgers.liveLedgerOf(tx, existing);
      if (ledger) {
        await this.staffAdvanceLedgers.ensureSettled(tx, existing, ledger);
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
          empModifiedBy: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
        },
      });
      if (result.count === 0) {
        this.throwNotFound(empId);
      }
      const ledgerRetired = ledger
        ? await this.staffAdvanceLedgers.retire(
            tx,
            ledger,
            this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
            modifiedOn,
          )
        : false;
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
          notes: ledgerRetired
            ? `Employee soft deleted with staff advance ledger "${ledger!.ledName}"`
            : 'Employee soft deleted',
        },
        tx,
      );
      return {
        empId,
        deleted: true,
      };
    });
  }
  // Notes 95 §A.7 — the one-off backfill: every live employee with no staff advance ledger gets
  // one through the same settle() a save runs. One transaction per employee, so a name clash on
  // one is reported and the rest still land. Idempotent: a second run walks nobody.
  async backfillStaffAdvanceLedgers(): Promise<EmployeeLedgerBackfillReport> {
    const pending = await this.prisma.employeeMaster.findMany({
      where: { empIsDeleted: false, empLoanLedgerId: null },
      select: { empId: true, empName: true },
      orderBy: { empCreatedOn: 'asc' },
    });
    const report: EmployeeLedgerBackfillReport = {
      walked: pending.length,
      created: [],
      failed: [],
    };
    for (const { empId, empName } of pending) {
      try {
        report.created.push(await this.provisionStaffAdvanceLedger(empId));
      } catch (error: unknown) {
        const response = (error as { response?: { errors?: Array<{ message?: string }> } })
          .response;
        report.failed.push({
          empId,
          empName,
          message:
            response?.errors?.[0]?.message ??
            (error instanceof Error ? error.message : String(error)),
        });
      }
    }
    return report;
  }
  private async provisionStaffAdvanceLedger(
    empId: string,
  ): Promise<EmployeeLedgerBackfillReport['created'][number]> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.employeeMaster.findFirst({
        where: { empId, empIsDeleted: false },
      });
      if (!existing) {
        this.throwNotFound(empId);
      }
      const actor = this.requestContextService.getUserId() ?? DEFAULT_ACTOR;
      const settled = await this.staffAdvanceLedgers.settle(tx, existing, null, null);
      const updated = await tx.employeeMaster.update({
        where: { empId },
        data: { empModifiedOn: new Date(), empModifiedBy: actor },
      });
      const ledger = await tx.accLedgerMaster.findUniqueOrThrow({
        where: { ledId: settled.empLoanLedgerId! },
        select: { ledId: true, ledName: true },
      });
      await this.auditLogService.logEntityChange(
        {
          action: 'update',
          tableName: EMPLOYEE_MASTER_TABLE_NAME,
          screenName: EMPLOYEE_MASTER_AUDIT_SCREEN_NAME,
          screenType: 'master',
          pk: empId,
          displayName: existing.empName,
          originalRecord: this.toPayload(existing),
          modifiedRecord: this.toPayload(updated),
          userId: actor,
          notes: `Staff advance ledger "${ledger.ledName}" created (backfill, notes 95)`,
        },
        tx,
      );
      return { empId, empName: existing.empName, ledId: ledger.ledId, ledName: ledger.ledName };
    });
  }
  private async createEmployee(
    saveEmployeeMasterDto: SaveEmployeeMasterDto,
  ): Promise<EmployeeMasterPayload> {
    try {
      // `return await`: a write refused inside the transaction must reach the catch below.
      return await this.prisma.$transaction(async (tx) => {
        const empName = this.normalizeRequiredValue(
          saveEmployeeMasterDto.empName,
          'empName',
          EmployeeMasterErrorCode.NAME_REQUIRED,
        );
        const empSalaryType = this.normalizeRequiredValue(
          saveEmployeeMasterDto.empSalaryType,
          'empSalaryType',
          EmployeeMasterErrorCode.SALARY_TYPE_REQUIRED,
        );
        // User 20/11: a new employee saved with no company is the logged-in company's
        // (Company may be hidden on the screen; the driver list filters by company).
        const empCompanyId =
          saveEmployeeMasterDto.empCompanyId ?? this.requestContextService.getCompanyId() ?? null;
        await this.ensureCompanyExists(empCompanyId, tx);
        await this.ensureDepartmentExists(saveEmployeeMasterDto.empDepartmentId, tx);
        await this.ensureDesignationExists(saveEmployeeMasterDto.empDesignationId, tx);
        // HR review step 5: one save at a time reads and takes an employee code; a
        // blank one is made from the name (Suresh Krishna → SKU, a second RAM → RAM2).
        await lockCodeSeries(tx, EMPLOYEE_CODE_SERIES);
        const typedCode = normalizeNullableString(saveEmployeeMasterDto.empCode) ?? null;
        await this.ensureCodeIsUnique(tx, typedCode);
        const empCode = typedCode ?? (await this.nextEmployeeCode(tx, empName));
        const now = new Date();
        const data: Prisma.EmployeeMasterUncheckedCreateInput = {
          empCompanyId,
          empName,
          empSalaryType,
          empCreatedOn: now,
          empCreatedBy: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
        };
        this.applyOptionalFields(data, saveEmployeeMasterDto);
        data.empCode = empCode;
        // H5: a new employee is Working unless sent as Resigned.
        data.empStatus = this.statusOf(saveEmployeeMasterDto.empStatus);
        const created = await this.staffAdvanceLedgers.settle(
          tx,
          await tx.employeeMaster.create({ data }),
          null,
          saveEmployeeMasterDto.empLoanLedgerId,
        );
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
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.employeeMaster.findFirst({
          where: {
            empId,
            empIsDeleted: false,
          },
        });
        if (!existing) {
          this.throwNotFound(empId);
        }
        const empName = this.normalizeRequiredValue(
          saveEmployeeMasterDto.empName,
          'empName',
          EmployeeMasterErrorCode.NAME_REQUIRED,
        );
        const empSalaryType = this.normalizeRequiredValue(
          saveEmployeeMasterDto.empSalaryType,
          'empSalaryType',
          EmployeeMasterErrorCode.SALARY_TYPE_REQUIRED,
        );
        await this.ensureCompanyExists(saveEmployeeMasterDto?.empCompanyId, tx);
        await this.ensureDepartmentExists(saveEmployeeMasterDto.empDepartmentId, tx);
        await this.ensureDesignationExists(saveEmployeeMasterDto.empDesignationId, tx);
        // HR review step 5: an edit never makes a code; a typed one is checked under
        // the series lock, against every live employee but this one.
        const typedCode = normalizeNullableString(saveEmployeeMasterDto.empCode);
        if (typedCode) {
          await lockCodeSeries(tx, EMPLOYEE_CODE_SERIES);
          await this.ensureCodeIsUnique(tx, typedCode, empId);
        }
        const data: Prisma.EmployeeMasterUncheckedUpdateInput = {
          empCompanyId: saveEmployeeMasterDto?.empCompanyId,
          empName,
          empSalaryType,
          empModifiedOn: new Date(),
          empModifiedBy: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
        };
        this.applyOptionalFields(data, saveEmployeeMasterDto);
        if (typedCode !== undefined) {
          data.empCode = typedCode;
        }
        // H5: a status sent blank reads Working; one left out stays as it is.
        if (saveEmployeeMasterDto.empStatus !== undefined) {
          data.empStatus = this.statusOf(saveEmployeeMasterDto.empStatus);
        }
        const updated = await this.staffAdvanceLedgers.settle(
          tx,
          await tx.employeeMaster.update({
            where: {
              empId,
            },
            data,
          }),
          existing,
          saveEmployeeMasterDto.empLoanLedgerId,
        );
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
  /**
   * HR review step 5 (H5) — the stored status: Working / Resigned in that
   * spelling, blank (or not sent) = Working. The house ValidationPipe has
   * already refused any other value (VALIDATION_IS_IN).
   */
  private statusOf(value: string | null | undefined): string {
    const status = canonicalListValue(value ?? null, EMPLOYEE_STATUSES, EMPLOYEE_STATUS_WORKING);
    return typeof status === 'string' ? status : EMPLOYEE_STATUS_WORKING;
  }
  /**
   * HR review step 5 (point 2) — an Employee Code is unique among LIVE
   * employees in any case (ux_emp_code: a deleted employee frees its code).
   * Blank is allowed, any number of times.
   */
  private async ensureCodeIsUnique(
    tx: EmployeeMasterWriteClient,
    empCode: string | null,
    excludeEmpId?: string,
  ): Promise<void> {
    if (!empCode) {
      return;
    }
    const clash = await tx.employeeMaster.findFirst({
      where: {
        empIsDeleted: false,
        empCode: { equals: empCode, mode: 'insensitive' },
        ...(excludeEmpId ? { empId: { not: excludeEmpId } } : {}),
      },
      select: { empId: true },
    });
    if (clash) {
      throwSettingsConflict<EmployeeMasterErrorDetail>('Employee code already exists', [
        {
          field: 'empCode',
          message: 'Duplicate empCode is not allowed',
          code: EmployeeMasterErrorCode.CODE_DUPLICATE,
        },
      ]);
    }
  }
  /**
   * HR review step 5 (point 1, Q2) — the code of an employee created without
   * one: the initials of the name, 3 to 6, padded from the first word
   * (Suresh Krishna → SKU, RAMESH → RAM), then 2, 3, … until no LIVE employee
   * holds it in any case. null when the name gives no code.
   */
  private async nextEmployeeCode(
    tx: EmployeeMasterWriteClient,
    empName: string,
  ): Promise<string | null> {
    return nextFreeCode(initialsCode(empName, EMPLOYEE_CODE_RULE), async (base) => {
      const rows = await tx.employeeMaster.findMany({
        where: { empIsDeleted: false, empCode: { startsWith: base, mode: 'insensitive' } },
        select: { empCode: true },
      });
      return rows.map((row) => row.empCode);
    });
  }
  private async ensureCompanyExists(
    compId: string | null | undefined,
    tx: EmployeeMasterWriteClient,
  ): Promise<void> {
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
          code: EmployeeMasterErrorCode.COMPANY_NOT_FOUND,
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
          code: EmployeeMasterErrorCode.DESIGNATION_NOT_FOUND,
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
          code: EmployeeMasterErrorCode.DEPARTMENT_NOT_FOUND,
        },
      ]);
    }
  }
  private applyOptionalFields(
    data: Prisma.EmployeeMasterUncheckedCreateInput | Prisma.EmployeeMasterUncheckedUpdateInput,
    saveEmployeeMasterDto: SaveEmployeeMasterDto,
  ): void {
    applyPresentFields(data, saveEmployeeMasterDto, EMPLOYEE_MASTER_OPTIONAL_FIELDS, {
      empPhoto: (value) => this.decodePhoto(value as string | null | undefined),
      // Money-decimal rule: the DTO keeps the figure as text, so no float in between.
      empCommissionValue: (value) =>
        value === null || value === '' ? null : new Prisma.Decimal(value as string),
    });
    // User 20/11: Has Commission sent unticked clears the stored Commission Type and
    // Value, whatever else was sent. Left out of an edit, all three stay as they are.
    if (saveEmployeeMasterDto.empHasCommission === false) {
      data.empCommissionType = null;
      data.empCommissionValue = null;
    }
  }
  private normalizeRequiredValue(value: string, field: string, code: EmployeeMasterErrorCode): string {
    return normalizeRequiredText<EmployeeMasterErrorDetail>(
      value,
      field,
      `${field} must not be empty`,
      code,
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
          code: EmployeeMasterErrorCode.PHOTO_INVALID,
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
  private toPayload(record: EmployeeMaster): EmployeeMasterPayload {
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
      empCommissionValue: record.empCommissionValue ? record.empCommissionValue.toFixed(3) : null,
      empSalaryType: record.empSalaryType,
      empSalaryAmount: toNumber(record.empSalaryAmount),
      empBataAmount: toNumber(record.empBataAmount),
      empKmBataAmount: toNumber(record.empKmBataAmount),
      empPanNo: record.empPanNo,
      empAadharNo: record.empAadharNo,
      empPfNo: record.empPfNo,
      empEsiNo: record.empEsiNo,
      empUanNo: record.empUanNo,
      empBankName: record.empBankName,
      empBankAccountNo: record.empBankAccountNo,
      empBankIfsc: record.empBankIfsc,
      empEmergencyContactName: record.empEmergencyContactName,
      empEmergencyContactPhone: record.empEmergencyContactPhone,
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
    // HR review step 5: two saves raced past the code check onto ux_emp_code.
    if (isUniqueViolationOf(error, 'ux_emp_code', 'emp_code')) {
      throwSettingsConflict<EmployeeMasterErrorDetail>('Employee code already exists', [
        {
          field: 'empCode',
          message: 'Another employee took this code at the same moment',
          code: EmployeeMasterErrorCode.CODE_DUPLICATE,
        },
      ]);
    }
    throwOnUniqueConstraintError<EmployeeMasterErrorDetail>(error, 'Employee already exists', [
      {
        field: 'empCode',
        message: 'Duplicate employee unique value is not allowed',
        code: EmployeeMasterErrorCode.DUPLICATE,
      },
    ]);
    if (isForeignKeyConstraintError(error)) {
      throwSettingsBadRequest<EmployeeMasterErrorDetail>('Invalid relation reference', [
        {
          field: 'empCompanyId',
          message: 'Referenced relation does not exist',
          code: EmployeeMasterErrorCode.RELATION_NOT_FOUND,
        },
      ]);
    }
  }
  private throwNotFound(empId: string): never {
    throwSettingsNotFound<EmployeeMasterErrorDetail>(
      'Employee not found',
      'empId',
      `No active employee found with id ${empId}`,
      EmployeeMasterErrorCode.NOT_FOUND,
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
