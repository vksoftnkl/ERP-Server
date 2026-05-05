import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfiguredGridListResult, ConfiguredGridSqlService } from '../../../common/configured-grid-sql/configured-grid-sql.service';
import { EmpMaster, Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { ListEmployeeMasterQueryDto } from './dto/list-employee-master-query.dto';
import { SaveEmployeeMasterDto } from './dto/save-employee-master.dto';
import {
  EmployeeMasterErrorDetail,
  EmployeeMasterErrorResponse,
  EmployeeMasterListItem,
  EmployeeMasterListMeta,
  EmployeeMasterPayload,
} from './types/employee-master-api.types';
import type { GridColumnItem } from '../../../common/configured-grid-sql/types/configured-grid-sql.types';

const DEFAULT_ACTOR = 'system';
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const EMPLOYEE_MASTER_TABLE_NAME = 'emp_master';
const EMPLOYEE_MASTER_AUDIT_SCREEN_NAME = 'Employee Master';
const VALIDATION_FAILED_MESSAGE = 'Validation failed';
const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;

type EmployeeMasterWriteClient = Prisma.TransactionClient | PrismaService;

@Injectable()
export class EmployeeMasterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly configuredGridSqlService: ConfiguredGridSqlService,
  ) {}
  async save(saveEmployeeMasterDto: SaveEmployeeMasterDto): Promise<EmployeeMasterPayload> {
    if (saveEmployeeMasterDto.empId) {
      return this.updateEmployee(saveEmployeeMasterDto);
    }
    return this.createEmployee(saveEmployeeMasterDto);
  }
  async list(
    queryDto: ListEmployeeMasterQueryDto,
  ): Promise<ConfiguredGridListResult<EmployeeMasterListItem, EmployeeMasterListMeta>> {
    const page = queryDto.page ?? DEFAULT_PAGE;
    const limit = queryDto.limit ?? DEFAULT_LIMIT;
    const skip = (page - 1) * limit;
    const hasStructuredFilters =
      queryDto.empCompanyId !== undefined ||
      queryDto.empDepartmentId !== undefined ||
      queryDto.empDesignationId !== undefined ||
      queryDto.empIsActive !== undefined ||
      queryDto.empStatus !== undefined ||
      queryDto.empEmploymentType !== undefined;
    if (!hasStructuredFilters) {
      const configuredList = await this.listFromConfiguredGridSql(queryDto.search, page, limit, skip);
      if (configuredList) {
        return configuredList;
      }
    }
    const where: Prisma.EmpMasterWhereInput = {
      empIsDeleted: false,
    };
    if (queryDto.empCompanyId !== undefined) {
      where.empCompanyId = queryDto.empCompanyId as string;
    }
    if (queryDto.empDepartmentId !== undefined) {
      where.empDepartmentId = queryDto.empDepartmentId;
    }
    if (queryDto.empDesignationId !== undefined) {
      where.empDesignationId = queryDto.empDesignationId;
    }
    if (queryDto.empIsActive !== undefined) {
      where.empIsActive = queryDto.empIsActive;
    }
    if (queryDto.empStatus !== undefined) {
      where.empStatus = {
        equals: queryDto.empStatus,
        mode: 'insensitive',
      };
    }
    if (queryDto.empEmploymentType !== undefined) {
      where.empEmploymentType = {
        equals: queryDto.empEmploymentType,
        mode: 'insensitive',
      };
    }
    if (queryDto.search?.trim()) {
      const search = queryDto.search.trim();
      where.OR = [
        { empCode: { contains: search, mode: 'insensitive' } },
        { empName: { contains: search, mode: 'insensitive' } },
        { empAlias: { contains: search, mode: 'insensitive' } },
        { empMobile1: { contains: search, mode: 'insensitive' } },
        { empMobile2: { contains: search, mode: 'insensitive' } },
        { empEmail: { contains: search, mode: 'insensitive' } },
        { empCity: { contains: search, mode: 'insensitive' } },
        { empDistrict: { contains: search, mode: 'insensitive' } },
        { empState: { contains: search, mode: 'insensitive' } },
        { empStatus: { contains: search, mode: 'insensitive' } },
      ];
    }
    const [total, records, styles] = await Promise.all([
      this.prisma.empMaster.count({ where }),
      this.prisma.empMaster.findMany({
        where,
        orderBy: [{ empName: 'asc' }, { empId: 'asc' }],
        skip,
        take: limit,
      }),
      this.configuredGridSqlService.loadPrimaryGridStyles(EMPLOYEE_MASTER_TABLE_NAME),
    ]);
    return {
      items: records.map((record) => this.toPayload(record)),
      meta: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
      },
      ...(styles !== undefined && { styles }),
    };
  }
  private async listFromConfiguredGridSql(
    search: string | undefined,
    page: number,
    limit: number,
    skip: number,
  ): Promise<ConfiguredGridListResult<EmployeeMasterListItem, EmployeeMasterListMeta> | null> {
    const configuredGrids = await this.configuredGridSqlService.loadCandidates({
      tableName: EMPLOYEE_MASTER_TABLE_NAME,
    });
    const primaryConfiguredGrids = this.configuredGridSqlService.filterPrimaryFromTable(
      configuredGrids,
      EMPLOYEE_MASTER_TABLE_NAME,
    );
    if (primaryConfiguredGrids.length === 0) {
      return null;
    }
    for (const configuredGrid of primaryConfiguredGrids) {
      const rawGridSql = configuredGrid.gridSql?.trim();
      if (!rawGridSql) {
        continue;
      }
      const validation = this.configuredGridSqlService.validateBaseSql({
        sql: rawGridSql,
        tableName: EMPLOYEE_MASTER_TABLE_NAME,
      });
      if (!validation.isValid) {
        continue;
      }
      try {
        const result = await this.configuredGridSqlService.runPagedQuery<EmployeeMasterListItem>({
          baseSql: validation.normalizedSql,
          alias: 'employee_master_grid',
          search,
          limit,
          skip,
          gridId: configuredGrid.gridId,
        });
        return {
          items: result.items,
          meta: {
            page,
            limit,
            total: result.total,
            total_pages: Math.ceil(result.total / limit),
          },
          styles: result.styles,
        };
      } catch {
        continue;
      }
    }
    return null;
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

  async getStyles(): Promise<GridColumnItem[]> {
    const configuredGrids = await this.configuredGridSqlService.loadCandidates({
      tableName: EMPLOYEE_MASTER_TABLE_NAME,
    });
    const primaryConfiguredGrids = this.configuredGridSqlService.filterPrimaryFromTable(
      configuredGrids,
      EMPLOYEE_MASTER_TABLE_NAME,
    );

    for (const configuredGrid of primaryConfiguredGrids) {
      const rawGridSql = configuredGrid.gridSql?.trim();
      if (!rawGridSql) {
        continue;
      }

      const validation = this.configuredGridSqlService.validateBaseSql({
        sql: rawGridSql,
        tableName: EMPLOYEE_MASTER_TABLE_NAME,
      });
      if (!validation.isValid) {
        continue;
      }

      try {
        return await this.configuredGridSqlService.loadGridColumns(configuredGrid.gridId);
      } catch {
        continue;
      }
    }

    return [];
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
          empModifiedBy: DEFAULT_ACTOR,
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
        empModifiedBy: DEFAULT_ACTOR,
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
          userId: DEFAULT_ACTOR,
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
          empCreatedBy: DEFAULT_ACTOR,
          empModifiedOn: now,
          empModifiedBy: DEFAULT_ACTOR,
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
            userId: DEFAULT_ACTOR,
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
          empModifiedBy: DEFAULT_ACTOR,
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
            userId: DEFAULT_ACTOR,
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
    if (this.hasOwnProperty(saveEmployeeMasterDto, 'empBranchId')) {
      data.empBranchId = saveEmployeeMasterDto.empBranchId;
    }
    if (this.hasOwnProperty(saveEmployeeMasterDto, 'empCode')) {
      data.empCode = saveEmployeeMasterDto.empCode;
    }
    if (this.hasOwnProperty(saveEmployeeMasterDto, 'empAlias')) {
      data.empAlias = saveEmployeeMasterDto.empAlias;
    }
    if (this.hasOwnProperty(saveEmployeeMasterDto, 'empMobile1')) {
      data.empMobile1 = saveEmployeeMasterDto.empMobile1;
    }
    if (this.hasOwnProperty(saveEmployeeMasterDto, 'empMobile2')) {
      data.empMobile2 = saveEmployeeMasterDto.empMobile2;
    }
    if (this.hasOwnProperty(saveEmployeeMasterDto, 'empEmail')) {
      data.empEmail = saveEmployeeMasterDto.empEmail;
    }
    if (this.hasOwnProperty(saveEmployeeMasterDto, 'empAddr1')) {
      data.empAddr1 = saveEmployeeMasterDto.empAddr1;
    }
    if (this.hasOwnProperty(saveEmployeeMasterDto, 'empAddr2')) {
      data.empAddr2 = saveEmployeeMasterDto.empAddr2;
    }
    if (this.hasOwnProperty(saveEmployeeMasterDto, 'empAddr3')) {
      data.empAddr3 = saveEmployeeMasterDto.empAddr3;
    }
    if (this.hasOwnProperty(saveEmployeeMasterDto, 'empCity')) {
      data.empCity = saveEmployeeMasterDto.empCity;
    }
    if (this.hasOwnProperty(saveEmployeeMasterDto, 'empDistrict')) {
      data.empDistrict = saveEmployeeMasterDto.empDistrict;
    }
    if (this.hasOwnProperty(saveEmployeeMasterDto, 'empState')) {
      data.empState = saveEmployeeMasterDto.empState;
    }
    if (this.hasOwnProperty(saveEmployeeMasterDto, 'empPincode')) {
      data.empPincode = saveEmployeeMasterDto.empPincode;
    }
    if (this.hasOwnProperty(saveEmployeeMasterDto, 'empGender')) {
      data.empGender = saveEmployeeMasterDto.empGender;
    }
    if (this.hasOwnProperty(saveEmployeeMasterDto, 'empMaritalStatus')) {
      data.empMaritalStatus = saveEmployeeMasterDto.empMaritalStatus;
    }
    if (this.hasOwnProperty(saveEmployeeMasterDto, 'empBloodGroup')) {
      data.empBloodGroup = saveEmployeeMasterDto.empBloodGroup;
    }
    if (this.hasOwnProperty(saveEmployeeMasterDto, 'empDob')) {
      data.empDob = saveEmployeeMasterDto.empDob;
    }
    if (this.hasOwnProperty(saveEmployeeMasterDto, 'empDepartmentId')) {
      data.empDepartmentId = saveEmployeeMasterDto.empDepartmentId;
    }
    if (this.hasOwnProperty(saveEmployeeMasterDto, 'empDesignationId')) {
      data.empDesignationId = saveEmployeeMasterDto.empDesignationId;
    }
    if (this.hasOwnProperty(saveEmployeeMasterDto, 'empEmploymentType')) {
      data.empEmploymentType = saveEmployeeMasterDto.empEmploymentType;
    }
    if (this.hasOwnProperty(saveEmployeeMasterDto, 'empStatus')) {
      data.empStatus = saveEmployeeMasterDto.empStatus;
    }
    if (this.hasOwnProperty(saveEmployeeMasterDto, 'empJoinedOn')) {
      data.empJoinedOn = saveEmployeeMasterDto.empJoinedOn;
    }
    if (this.hasOwnProperty(saveEmployeeMasterDto, 'empProbationEndOn')) {
      data.empProbationEndOn = saveEmployeeMasterDto.empProbationEndOn;
    }
    if (this.hasOwnProperty(saveEmployeeMasterDto, 'empConfirmationOn')) {
      data.empConfirmationOn = saveEmployeeMasterDto.empConfirmationOn;
    }
    if (this.hasOwnProperty(saveEmployeeMasterDto, 'empLeftOn')) {
      data.empLeftOn = saveEmployeeMasterDto.empLeftOn;
    }
    if (this.hasOwnProperty(saveEmployeeMasterDto, 'empShiftId')) {
      data.empShiftId = saveEmployeeMasterDto.empShiftId;
    }
    if (this.hasOwnProperty(saveEmployeeMasterDto, 'empAttConstraintId')) {
      data.empAttConstraintId = saveEmployeeMasterDto.empAttConstraintId;
    }
    if (this.hasOwnProperty(saveEmployeeMasterDto, 'empHolidayGroupId')) {
      data.empHolidayGroupId = saveEmployeeMasterDto.empHolidayGroupId;
    }
    if (this.hasOwnProperty(saveEmployeeMasterDto, 'empOvertimeAllowed')) {
      data.empOvertimeAllowed = saveEmployeeMasterDto.empOvertimeAllowed;
    }
    if (this.hasOwnProperty(saveEmployeeMasterDto, 'empHasCommission')) {
      data.empHasCommission = saveEmployeeMasterDto.empHasCommission;
    }
    if (this.hasOwnProperty(saveEmployeeMasterDto, 'empCommissionType')) {
      data.empCommissionType = saveEmployeeMasterDto.empCommissionType;
    }
    if (this.hasOwnProperty(saveEmployeeMasterDto, 'empCommissionValue')) {
      data.empCommissionValue = saveEmployeeMasterDto.empCommissionValue;
    }
    if (this.hasOwnProperty(saveEmployeeMasterDto, 'empSalaryAmount')) {
      data.empSalaryAmount = saveEmployeeMasterDto.empSalaryAmount;
    }
    if (this.hasOwnProperty(saveEmployeeMasterDto, 'empBataAmount')) {
      data.empBataAmount = saveEmployeeMasterDto.empBataAmount;
    }
    if (this.hasOwnProperty(saveEmployeeMasterDto, 'empKmBataAmount')) {
      data.empKmBataAmount = saveEmployeeMasterDto.empKmBataAmount;
    }
    if (this.hasOwnProperty(saveEmployeeMasterDto, 'empPanNo')) {
      data.empPanNo = saveEmployeeMasterDto.empPanNo;
    }
    if (this.hasOwnProperty(saveEmployeeMasterDto, 'empAadharNo')) {
      data.empAadharNo = saveEmployeeMasterDto.empAadharNo;
    }
    if (this.hasOwnProperty(saveEmployeeMasterDto, 'empPfNo')) {
      data.empPfNo = saveEmployeeMasterDto.empPfNo;
    }
    if (this.hasOwnProperty(saveEmployeeMasterDto, 'empEsiNo')) {
      data.empEsiNo = saveEmployeeMasterDto.empEsiNo;
    }
    if (this.hasOwnProperty(saveEmployeeMasterDto, 'empLoanLedgerId')) {
      data.empLoanLedgerId = saveEmployeeMasterDto.empLoanLedgerId;
    }
    if (this.hasOwnProperty(saveEmployeeMasterDto, 'empPhotoUrl')) {
      data.empPhotoUrl = saveEmployeeMasterDto.empPhotoUrl;
    }
    if (this.hasOwnProperty(saveEmployeeMasterDto, 'empPhoto')) {
      data.empPhoto = this.decodePhoto(saveEmployeeMasterDto.empPhoto);
    }
    if (this.hasOwnProperty(saveEmployeeMasterDto, 'empRemarks')) {
      data.empRemarks = saveEmployeeMasterDto.empRemarks;
    }
    if (this.hasOwnProperty(saveEmployeeMasterDto, 'empIsActive')) {
      data.empIsActive = saveEmployeeMasterDto.empIsActive;
    }
  }

  private normalizeRequiredValue(value: string, field: string): string {
    const trimmed = value.trim();
    if (!trimmed) {
      this.throwBadRequest(VALIDATION_FAILED_MESSAGE, [
        {
          field,
          message: `${field} must not be empty`,
        },
      ]);
    }

    return trimmed;
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
      empCommissionValue: this.toNullableNumber(record.empCommissionValue),
      empSalaryType: record.empSalaryType,
      empSalaryAmount: this.toNumber(record.empSalaryAmount),
      empBataAmount: this.toNumber(record.empBataAmount),
      empKmBataAmount: this.toNumber(record.empKmBataAmount),
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

  private toNullableNumber(value: Prisma.Decimal | number | null): number | null {
    if (value === null) {
      return null;
    }

    if (typeof value === 'number') {
      return value;
    }

    return Number(value.toString());
  }

  private toNumber(value: Prisma.Decimal | number): number {
    if (typeof value === 'number') {
      return value;
    }

    return Number(value.toString());
  }

  private handleWriteError(error: unknown): void {
    if (this.isUniqueConstraintError(error)) {
      throw new ConflictException(
        this.buildErrorResponse('Employee already exists', [
          {
            field: 'empCode',
            message: 'Duplicate employee unique value is not allowed',
          },
        ]),
      );
    }

    if (this.isForeignKeyConstraintError(error)) {
      throw new BadRequestException(
        this.buildErrorResponse('Invalid relation reference', [
          {
            field: 'empCompanyId',
            message: 'Referenced relation does not exist',
          },
        ]),
      );
    }
  }

  private isUniqueConstraintError(error: unknown): boolean {
    if (typeof error !== 'object' || error === null || !('code' in error)) {
      return false;
    }

    return (error as { code?: string }).code === 'P2002';
  }

  private isForeignKeyConstraintError(error: unknown): boolean {
    if (typeof error !== 'object' || error === null || !('code' in error)) {
      return false;
    }

    return (error as { code?: string }).code === 'P2003';
  }

  private throwNotFound(empId: string): never {
    throw new NotFoundException(
      this.buildErrorResponse('Employee not found', [
        {
          field: 'empId',
          message: `No active employee found with id ${empId}`,
        },
      ]),
    );
  }

  private throwBadRequest(message: string, errors: EmployeeMasterErrorDetail[]): never {
    throw new BadRequestException(this.buildErrorResponse(message, errors));
  }

  private buildErrorResponse(
    message: string,
    errors: EmployeeMasterErrorDetail[] = [],
  ): EmployeeMasterErrorResponse {
    return {
      success: false,
      message,
      errors,
    };
  }

  private hasOwnProperty<T extends object>(obj: T, key: PropertyKey): boolean {
    return Object.prototype.hasOwnProperty.call(obj, key);
  }
}
