import { Injectable } from '@nestjs/common';
import {
  ConfiguredGridListResult,
  ConfiguredGridSqlService,
} from '../../../common/configured-grid-sql/configured-grid-sql.service';
import { EmployeeDesignation, Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { ListEmployeeDesignationMasterQueryDto } from './dto/list-employee-designation-master-query.dto';
import { SaveEmployeeDesignationMasterDto } from './dto/save-employee-designation-master.dto';
import {
  EmployeeDesignationMasterErrorDetail,
  EmployeeDesignationMasterErrorResponse,
  EmployeeDesignationMasterListItem,
  EmployeeDesignationMasterListMeta,
  EmployeeDesignationMasterPayload,
} from './types/employee-designation-master-api.types';
import {
  DEFAULT_ACTOR,
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
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

const EMPLOYEE_DESIGNATION_MASTER_TABLE_NAME = 'employee designations';
const EMPLOYEE_DESIGNATION_MASTER_AUDIT_SCREEN_NAME = 'Employee Designation Master';

type EmployeeDesignationWriteClient = SettingsWriteClient;

@Injectable()
export class EmployeeDesignationMasterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly configuredGridSqlService: ConfiguredGridSqlService,
  ) {}

  async save(
    saveEmployeeDesignationMasterDto: SaveEmployeeDesignationMasterDto,
  ): Promise<EmployeeDesignationMasterPayload> {
    if (saveEmployeeDesignationMasterDto.edId) {
      return this.updateDesignation(saveEmployeeDesignationMasterDto);
    }

    return this.createDesignation(saveEmployeeDesignationMasterDto);
  }

  async list(
    queryDto: ListEmployeeDesignationMasterQueryDto,
  ): Promise<
    ConfiguredGridListResult<EmployeeDesignationMasterListItem, EmployeeDesignationMasterListMeta>
  > {
    const page = queryDto.page ?? DEFAULT_PAGE;
    const limit = queryDto.limit ?? DEFAULT_LIMIT;
    const skip = (page - 1) * limit;

    const hasStructuredFilters =
      queryDto.edIsActive !== undefined || queryDto.edIsDefault !== undefined;

    if (!hasStructuredFilters) {
      const configuredList = await this.listFromConfiguredGridSql(
        queryDto.search,
        page,
        limit,
        skip,
      );
      if (configuredList) {
        return configuredList;
      }
    }

    const where: Prisma.EmployeeDesignationWhereInput = {
      edIsDeleted: false,
    };

    if (queryDto.edIsActive !== undefined) {
      where.edIsActive = queryDto.edIsActive;
    }

    if (queryDto.edIsDefault !== undefined) {
      where.edIsDefault = queryDto.edIsDefault;
    }

    if (queryDto.search?.trim()) {
      const search = queryDto.search.trim();
      where.OR = [
        { edName: { contains: search, mode: 'insensitive' } },
        { edCode: { contains: search, mode: 'insensitive' } },
        { edRemarks: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, records, styles] = await Promise.all([
      this.prisma.employeeDesignation.count({ where }),
      this.prisma.employeeDesignation.findMany({
        where,
        orderBy: [{ edIsDefault: 'desc' }, { edName: 'asc' }, { edId: 'asc' }],
        skip,
        take: limit,
      }),
      this.configuredGridSqlService.loadPrimaryGridStyles(EMPLOYEE_DESIGNATION_MASTER_TABLE_NAME),
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
  ): Promise<ConfiguredGridListResult<
    EmployeeDesignationMasterListItem,
    EmployeeDesignationMasterListMeta
  > | null> {
    const configuredGrids = await this.configuredGridSqlService.loadCandidates({
      tableName: EMPLOYEE_DESIGNATION_MASTER_TABLE_NAME,
    });
    const primaryConfiguredGrids = this.configuredGridSqlService.filterPrimaryFromTable(
      configuredGrids,
      EMPLOYEE_DESIGNATION_MASTER_TABLE_NAME,
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
        tableName: EMPLOYEE_DESIGNATION_MASTER_TABLE_NAME,
      });
      if (!validation.isValid) {
        continue;
      }

      try {
        const result =
          await this.configuredGridSqlService.runPagedQuery<EmployeeDesignationMasterListItem>({
            baseSql: validation.normalizedSql,
            alias: 'employee_designation_master_grid',
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

      const activeEmployeesCount = await tx.empMaster.count({
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
          edModifiedBy: DEFAULT_ACTOR,
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
        edModifiedBy: DEFAULT_ACTOR,
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
          userId: DEFAULT_ACTOR,
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
      return this.prisma.$transaction(async (tx) => {
        const edName = this.normalizeRequiredName(saveEmployeeDesignationMasterDto.edName);
        const edCode = normalizeNullableString(saveEmployeeDesignationMasterDto.edCode);
        const edRemarks = normalizeNullableString(saveEmployeeDesignationMasterDto.edRemarks);

        await this.ensureNameIsUnique(tx, edName);
        await this.ensureCodeIsUnique(tx, edCode);

        if (saveEmployeeDesignationMasterDto.edIsDefault === true) {
          await this.clearDefaultDesignation(tx);
        }

        const now = new Date();
        const data: Prisma.EmployeeDesignationUncheckedCreateInput = {
          edName,
          edCreatedOn: now,
          edCreatedBy: DEFAULT_ACTOR,
          edModifiedOn: now,
          edModifiedBy: DEFAULT_ACTOR,
        };

        if (hasOwnProperty(saveEmployeeDesignationMasterDto, 'edCode')) {
          data.edCode = edCode;
        }
        if (hasOwnProperty(saveEmployeeDesignationMasterDto, 'edIsDefault')) {
          data.edIsDefault = saveEmployeeDesignationMasterDto.edIsDefault;
        }
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
            userId: DEFAULT_ACTOR,
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
        const edCode = normalizeNullableString(saveEmployeeDesignationMasterDto.edCode);
        const edRemarks = normalizeNullableString(saveEmployeeDesignationMasterDto.edRemarks);

        await this.ensureNameIsUnique(tx, edName, edId);
        await this.ensureCodeIsUnique(tx, edCode, edId);

        if (saveEmployeeDesignationMasterDto.edIsDefault === true) {
          await this.clearDefaultDesignation(tx, edId);
        }

        const data: Prisma.EmployeeDesignationUncheckedUpdateInput = {
          edName,
          edModifiedOn: new Date(),
          edModifiedBy: DEFAULT_ACTOR,
        };

        if (hasOwnProperty(saveEmployeeDesignationMasterDto, 'edCode')) {
          data.edCode = edCode;
        }
        if (hasOwnProperty(saveEmployeeDesignationMasterDto, 'edIsDefault')) {
          data.edIsDefault = saveEmployeeDesignationMasterDto.edIsDefault;
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
            userId: DEFAULT_ACTOR,
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
          },
        ],
      );
    }
  }

  private async clearDefaultDesignation(
    tx: EmployeeDesignationWriteClient,
    excludeEdId?: string,
  ): Promise<void> {
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
        edModifiedBy: DEFAULT_ACTOR,
      },
    });
  }

  private normalizeRequiredName(value: string): string {
    return normalizeRequiredText<EmployeeDesignationMasterErrorDetail>(value, 'edName');
  }

  private toPayload(record: EmployeeDesignation): EmployeeDesignationMasterPayload {
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

  private handleWriteError(error: unknown): void {
    throwOnUniqueConstraintError<EmployeeDesignationMasterErrorDetail>(
      error,
      'Employee designation already exists',
      [
        {
          field: 'edName',
          message: 'Duplicate employee designation unique value is not allowed',
        },
      ],
    );
  }

  private throwNotFound(edId: string): never {
    throwSettingsNotFound<EmployeeDesignationMasterErrorDetail>(
      'Employee designation not found',
      'edId',
      `No active employee designation found with id ${edId}`,
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
