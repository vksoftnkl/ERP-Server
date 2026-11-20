import { Injectable } from '@nestjs/common';
import { EmployeeDesignation, Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { SaveEmployeeDesignationMasterDto } from './dto/save-employee-designation-master.dto';
import {
  EmployeeDesignationMasterErrorDetail,
  EmployeeDesignationMasterErrorResponse,
  EmployeeDesignationMasterPayload,
} from './types/employee-designation-master-api.types';
import { EmployeeDesignationMasterErrorCode } from './types/employee-designation-master-error-codes';
import {
  DEFAULT_ACTOR,
  SettingsWriteClient,
  buildSettingsErrorResponse,
  hasOwnProperty,
  normalizeNullableString,
  normalizeRequiredText,
  throwOnUniqueConstraintError,
  throwSettingsBadRequest,
  throwSettingsConflict,
  throwSettingsNotFound,
} from 'src/common/utils/module-service.utils';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import { DESIGNATION_CODE_MAX_LENGTH, nextFreeCode, wholeNameCode } from '../shared/code-from-name';
import { DESIGNATION_CODE_SERIES, lockCodeSeries } from '../shared/code-series-lock';
import { isUniqueViolationOf } from '../shared/unique-violation';

const EMPLOYEE_DESIGNATION_MASTER_TABLE_NAME = 'employee designations';
const EMPLOYEE_DESIGNATION_MASTER_AUDIT_SCREEN_NAME = 'Employee Designation Master';

type EmployeeDesignationWriteClient = SettingsWriteClient;

@Injectable()
export class EmployeeDesignationMasterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly requestContextService: RequestContextService,
  ) {}

  async save(
    saveEmployeeDesignationMasterDto: SaveEmployeeDesignationMasterDto,
  ): Promise<EmployeeDesignationMasterPayload> {
    if (saveEmployeeDesignationMasterDto.edId) {
      return this.updateDesignation(saveEmployeeDesignationMasterDto);
    }

    return this.createDesignation(saveEmployeeDesignationMasterDto);
  }

  async getById(edId: string): Promise<EmployeeDesignationMasterPayload> {
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

  async softDelete(edId: string): Promise<{ edId: string; deleted: true }> {
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
            code: EmployeeDesignationMasterErrorCode.IN_USE,
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
          edModifiedOn: modifiedOn,
          edModifiedBy: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
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
        edModifiedOn: modifiedOn,
        edModifiedBy: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
      });

      await this.auditLogService.logEntityChange(
        {
          action: 'cancel',
          tableName: EMPLOYEE_DESIGNATION_MASTER_TABLE_NAME,
          screenName: EMPLOYEE_DESIGNATION_MASTER_AUDIT_SCREEN_NAME,
          screenType: 'master',
          pk: edId,
          displayName: existing.edName,
          originalRecord,
          modifiedRecord,
          userId: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
          notes: 'Employee designation soft deleted',
        },
        tx,
      );

      return {
        edId,
        deleted: true,
      };
    });
  }

  private async createDesignation(
    saveEmployeeDesignationMasterDto: SaveEmployeeDesignationMasterDto,
  ): Promise<EmployeeDesignationMasterPayload> {
    try {
      // `return await`: a write refused inside the transaction must reach the catch below.
      return await this.prisma.$transaction(async (tx) => {
        const edName = this.normalizeRequiredName(saveEmployeeDesignationMasterDto.edName);
        const typedCode = normalizeNullableString(saveEmployeeDesignationMasterDto.edCode);
        const edRemarks = normalizeNullableString(saveEmployeeDesignationMasterDto.edRemarks);

        // HR review step 5: one save at a time reads and takes a designation code.
        await lockCodeSeries(tx, DESIGNATION_CODE_SERIES);
        await this.ensureNameIsUnique(tx, edName);
        await this.ensureCodeIsUnique(tx, typedCode);
        // A designation created with a blank Code gets its whole name as one.
        const edCode = typedCode ?? (await this.nextDesignationCode(tx, edName));

        const now = new Date();
        const data: Prisma.EmployeeDesignationUncheckedCreateInput = {
          edName,
          edCreatedOn: now,
          edCreatedBy: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
        };

        if (edCode !== null) {
          data.edCode = edCode;
        }
        // HR review step 5 (H6): Default Designation is gone. edIsDefault is still
        // accepted from an older client and ignored; the column keeps its default.
        if (hasOwnProperty(saveEmployeeDesignationMasterDto, 'edRemarks')) {
          data.edRemarks = edRemarks;
        }
        if (hasOwnProperty(saveEmployeeDesignationMasterDto, 'edIsActive')) {
          data.edIsActive = saveEmployeeDesignationMasterDto.edIsActive;
        }

        const created = await tx.employeeDesignation.create({ data });
        const payload = this.toPayload(created);

        await this.auditLogService.logEntityChange(
          {
            action: 'New',
            tableName: EMPLOYEE_DESIGNATION_MASTER_TABLE_NAME,
            screenName: EMPLOYEE_DESIGNATION_MASTER_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: payload.edId,
            displayName: payload.edName,
            originalRecord: null,
            modifiedRecord: payload,
            userId: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
            notes: 'Employee designation created',
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

  private async updateDesignation(
    saveEmployeeDesignationMasterDto: SaveEmployeeDesignationMasterDto,
  ): Promise<EmployeeDesignationMasterPayload> {
    const edId = saveEmployeeDesignationMasterDto.edId!;

    try {
      return await this.prisma.$transaction(async (tx) => {
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
        const edCode = normalizeNullableString(saveEmployeeDesignationMasterDto.edCode);
        const edRemarks = normalizeNullableString(saveEmployeeDesignationMasterDto.edRemarks);

        await this.ensureNameIsUnique(tx, edName, edId);
        // An edit never makes a code; a typed one is checked under the series lock.
        if (edCode) {
          await lockCodeSeries(tx, DESIGNATION_CODE_SERIES);
        }
        await this.ensureCodeIsUnique(tx, edCode, edId);

        const data: Prisma.EmployeeDesignationUncheckedUpdateInput = {
          edName,
          edModifiedOn: new Date(),
          edModifiedBy: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
        };

        if (hasOwnProperty(saveEmployeeDesignationMasterDto, 'edCode')) {
          data.edCode = edCode;
        }
        if (hasOwnProperty(saveEmployeeDesignationMasterDto, 'edRemarks')) {
          data.edRemarks = edRemarks;
        }
        if (hasOwnProperty(saveEmployeeDesignationMasterDto, 'edIsActive')) {
          data.edIsActive = saveEmployeeDesignationMasterDto.edIsActive;
        }

        const updated = await tx.employeeDesignation.update({
          where: {
            edId,
          },
          data,
        });
        const payload = this.toPayload(updated);

        await this.auditLogService.logEntityChange(
          {
            action: 'update',
            tableName: EMPLOYEE_DESIGNATION_MASTER_TABLE_NAME,
            screenName: EMPLOYEE_DESIGNATION_MASTER_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: edId,
            displayName: payload.edName,
            originalRecord: this.toPayload(existing),
            modifiedRecord: payload,
            userId: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
            notes: 'Employee designation updated',
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

  private async ensureNameIsUnique(
    tx: EmployeeDesignationWriteClient,
    edName: string,
    excludeEdId?: string,
  ): Promise<void> {
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
      throwSettingsConflict<EmployeeDesignationMasterErrorDetail>(
        'Employee designation name already exists',
        [
          {
            field: 'edName',
            message: 'Duplicate edName is not allowed',
            code: EmployeeDesignationMasterErrorCode.NAME_DUPLICATE,
          },
        ],
      );
    }
  }

  private async ensureCodeIsUnique(
    tx: EmployeeDesignationWriteClient,
    edCode: string | null | undefined,
    excludeEdId?: string,
  ): Promise<void> {
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
      throwSettingsConflict<EmployeeDesignationMasterErrorDetail>(
        'Employee designation code already exists',
        [
          {
            field: 'edCode',
            message: 'Duplicate edCode is not allowed',
            code: EmployeeDesignationMasterErrorCode.CODE_DUPLICATE,
          },
        ],
      );
    }
  }

  /**
   * HR review step 5 (Q1) — the code of a designation created without one: its
   * whole name, upper case, letters and digits only, at most 20 (Driver →
   * DRIVER, Sales Manager → SALESMANAGER; the driver list matches DRIVER), then
   * 2, 3, … until no LIVE designation holds it in any case (ux_ed_code covers
   * live rows only). null when the name gives no code.
   */
  private async nextDesignationCode(
    tx: EmployeeDesignationWriteClient,
    edName: string,
  ): Promise<string | null> {
    return nextFreeCode(wholeNameCode(edName, DESIGNATION_CODE_MAX_LENGTH), async (base) => {
      const rows = await tx.employeeDesignation.findMany({
        where: { edIsDeleted: false, edCode: { startsWith: base, mode: 'insensitive' } },
        select: { edCode: true },
      });
      return rows.map((row) => row.edCode);
    });
  }

  private normalizeRequiredName(value: string): string {
    return normalizeRequiredText<EmployeeDesignationMasterErrorDetail>(
      value,
      'edName',
      undefined,
      EmployeeDesignationMasterErrorCode.NAME_REQUIRED,
    );
  }

  private toPayload(record: EmployeeDesignation): EmployeeDesignationMasterPayload {
    return {
      edId: record.edId,
      edName: record.edName,
      edCode: record.edCode,
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

  private handleWriteError(error: unknown): void {
    // HR review step 5: two saves raced past the code check onto ux_ed_code.
    if (isUniqueViolationOf(error, 'ux_ed_code', 'ed_code')) {
      throwSettingsConflict<EmployeeDesignationMasterErrorDetail>(
        'Employee designation code already exists',
        [
          {
            field: 'edCode',
            message: 'Another designation took this code at the same moment',
            code: EmployeeDesignationMasterErrorCode.CODE_DUPLICATE,
          },
        ],
      );
    }
    throwOnUniqueConstraintError<EmployeeDesignationMasterErrorDetail>(
      error,
      'Employee designation already exists',
      [
        {
          field: 'edName',
          message: 'Duplicate employee designation unique value is not allowed',
          code: EmployeeDesignationMasterErrorCode.DUPLICATE,
        },
      ],
    );
  }

  private throwNotFound(edId: string): never {
    throwSettingsNotFound<EmployeeDesignationMasterErrorDetail>(
      'Employee designation not found',
      'edId',
      `No active employee designation found with id ${edId}`,
      EmployeeDesignationMasterErrorCode.NOT_FOUND,
    );
  }

  private throwBadRequest(message: string, errors: EmployeeDesignationMasterErrorDetail[]): never {
    throwSettingsBadRequest<EmployeeDesignationMasterErrorDetail>(message, errors);
  }

  private buildErrorResponse(
    message: string,
    errors: EmployeeDesignationMasterErrorDetail[] = [],
  ): EmployeeDesignationMasterErrorResponse {
    return buildSettingsErrorResponse<
      EmployeeDesignationMasterErrorDetail,
      EmployeeDesignationMasterErrorResponse
    >(message, errors);
  }
}
