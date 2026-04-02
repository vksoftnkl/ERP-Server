import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EmployeeDepartment, Prisma } from '@prisma/client';
import { ConfiguredGridListResult, ConfiguredGridSqlService } from '../../../common/configured-grid-sql/configured-grid-sql.service';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { ListEmployeeDepartmentMasterQueryDto } from './dto/list-employee-department-master-query.dto';
import { SaveEmployeeDepartmentMasterDto } from './dto/save-employee-department-master.dto';
import {
  EmployeeDepartmentMasterErrorDetail,
  EmployeeDepartmentMasterErrorResponse,
  EmployeeDepartmentMasterListItem,
  EmployeeDepartmentMasterListMeta,
  EmployeeDepartmentMasterPayload,
} from './types/employee-department-master-api.types';
const DEFAULT_ACTOR = 'system';
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const EMPLOYEE_DEPARTMENT_MASTER_TABLE_NAME = 'employee_departments';
const EMPLOYEE_DEPARTMENT_MASTER_AUDIT_SCREEN_NAME = 'Employee Department Master';
type EmployeeDepartmentWriteClient = Prisma.TransactionClient | PrismaService;
@Injectable()
export class EmployeeDepartmentMasterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly configuredGridSqlService: ConfiguredGridSqlService,
  ) {}
  async save(
    saveEmployeeDepartmentMasterDto: SaveEmployeeDepartmentMasterDto,
  ): Promise<EmployeeDepartmentMasterPayload> {
    if (saveEmployeeDepartmentMasterDto.edptId) {
      return this.updateDepartment(saveEmployeeDepartmentMasterDto);
    }
    return this.createDepartment(saveEmployeeDepartmentMasterDto);
  }
  async list(queryDto: ListEmployeeDepartmentMasterQueryDto): Promise<ConfiguredGridListResult<EmployeeDepartmentMasterListItem, EmployeeDepartmentMasterListMeta>> {
    const page = queryDto.page ?? DEFAULT_PAGE;
    const limit = queryDto.limit ?? DEFAULT_LIMIT;
    const skip = (page - 1) * limit;
    const hasStructuredFilters =
      queryDto.edptIsActive !== undefined ||
      Boolean(queryDto.search?.trim());
    if (!hasStructuredFilters) {
      const configuredList = await this.listFromConfiguredGridSql(page, limit, skip);
      if (configuredList) {
        return configuredList;
      }
    }
    const where: Prisma.EmployeeDepartmentWhereInput = {
      edptIsDeleted: false,
    };
    if (queryDto.edptIsActive !== undefined) {
      where.edptIsActive = queryDto.edptIsActive;
    }
    if (queryDto.search?.trim()) {
      const search = queryDto.search.trim();
      where.OR = [
        { edptName: { contains: search, mode: 'insensitive' } },
        { edptCode: { contains: search, mode: 'insensitive' } },
        { edptAlias: { contains: search, mode: 'insensitive' } },
        { edptRemarks: { contains: search, mode: 'insensitive' } },
      ];
    }
    const [total, records] = await Promise.all([
      this.prisma.employeeDepartment.count({ where }),
      this.prisma.employeeDepartment.findMany({
        where,
        orderBy: [{ edptName: 'asc' }, { edptId: 'asc' }],
        skip,
        take: limit,
      }),
    ]);
    return {
      items: records.map((record) => this.toPayload(record)),
      meta: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
      },
    };
  }
  private async listFromConfiguredGridSql(
    page: number,
    limit: number,
    skip: number,
  ): Promise<ConfiguredGridListResult<EmployeeDepartmentMasterListItem, EmployeeDepartmentMasterListMeta> | null> {
    const configuredGrids = await this.configuredGridSqlService.loadCandidates({
      tableName: EMPLOYEE_DEPARTMENT_MASTER_TABLE_NAME,
    });
    const primaryConfiguredGrids = this.configuredGridSqlService.filterPrimaryFromTable(
      configuredGrids,
      EMPLOYEE_DEPARTMENT_MASTER_TABLE_NAME,
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
        tableName: EMPLOYEE_DEPARTMENT_MASTER_TABLE_NAME,
      });
      if (!validation.isValid) {
        continue;
      }
      try {
        const result =
          await this.configuredGridSqlService.runPagedQuery<EmployeeDepartmentMasterListItem>({
            baseSql: validation.normalizedSql,
            alias: 'employee_department_master_grid',
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
  async getById(edptId: string): Promise<EmployeeDepartmentMasterPayload> {
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
  async softDelete(edptId: string): Promise<{ edptId: string; deleted: true }> {
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
      const activeEmployeesCount = await tx.empMaster.count({
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
          edptModifiedBy: DEFAULT_ACTOR,
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
        edptModifiedBy: DEFAULT_ACTOR,
      });
      await this.auditLogService.logEntityChange(
        {
          action: 'cancel',
          tableName: EMPLOYEE_DEPARTMENT_MASTER_TABLE_NAME,
          screenName: EMPLOYEE_DEPARTMENT_MASTER_AUDIT_SCREEN_NAME,
          screenType: 'master',
          pk: edptId,
          displayName: existing.edptName,
          originalRecord,
          modifiedRecord,
          userId: DEFAULT_ACTOR,
          notes: 'Employee department soft deleted',
        },
        tx,
      );
      return {
        edptId,
        deleted: true,
      };
    });
  }
  private async createDepartment(
    saveEmployeeDepartmentMasterDto: SaveEmployeeDepartmentMasterDto,
  ): Promise<EmployeeDepartmentMasterPayload> {
    try {
      return this.prisma.$transaction(async (tx) => {
        const edptName = this.normalizeRequiredName(saveEmployeeDepartmentMasterDto.edptName);
        const edptCode = this.normalizeNullableString(saveEmployeeDepartmentMasterDto.edptCode);
        const edptAlias = this.normalizeNullableString(saveEmployeeDepartmentMasterDto.edptAlias);
        const edptRemarks = this.normalizeNullableString(
          saveEmployeeDepartmentMasterDto.edptRemarks,
        );
        await this.ensureNameIsUnique(tx, edptName);
        await this.ensureCodeIsUnique(tx, edptCode);
        const now = new Date();
        const data: Prisma.EmployeeDepartmentUncheckedCreateInput = {
          edptName,
          edptCreatedOn: now,
          edptCreatedBy: DEFAULT_ACTOR,
          edptModifiedOn: now,
          edptModifiedBy: DEFAULT_ACTOR,
        };
        if (this.hasOwnProperty(saveEmployeeDepartmentMasterDto, 'edptCode')) {
          data.edptCode = edptCode;
        }
        if (this.hasOwnProperty(saveEmployeeDepartmentMasterDto, 'edptAlias')) {
          data.edptAlias = edptAlias;
        }
        if (this.hasOwnProperty(saveEmployeeDepartmentMasterDto, 'edptRemarks')) {
          data.edptRemarks = edptRemarks;
        }
        if (this.hasOwnProperty(saveEmployeeDepartmentMasterDto, 'edptIsActive')) {
          data.edptIsActive = saveEmployeeDepartmentMasterDto.edptIsActive;
        }
        const created = await tx.employeeDepartment.create({ data });
        const payload = this.toPayload(created);
        await this.auditLogService.logEntityChange(
          {
            action: 'New',
            tableName: EMPLOYEE_DEPARTMENT_MASTER_TABLE_NAME,
            screenName: EMPLOYEE_DEPARTMENT_MASTER_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: payload.edptId,
            displayName: payload.edptName,
            originalRecord: null,
            modifiedRecord: payload,
            userId: DEFAULT_ACTOR,
            notes: 'Employee department created',
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
  private async updateDepartment(
    saveEmployeeDepartmentMasterDto: SaveEmployeeDepartmentMasterDto,
  ): Promise<EmployeeDepartmentMasterPayload> {
    const edptId = saveEmployeeDepartmentMasterDto.edptId!;
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
        const edptCode = this.normalizeNullableString(saveEmployeeDepartmentMasterDto.edptCode);
        const edptAlias = this.normalizeNullableString(saveEmployeeDepartmentMasterDto.edptAlias);
        const edptRemarks = this.normalizeNullableString(
          saveEmployeeDepartmentMasterDto.edptRemarks,
        );

        await this.ensureNameIsUnique(tx, edptName, edptId);
        await this.ensureCodeIsUnique(tx, edptCode, edptId);

        const data: Prisma.EmployeeDepartmentUncheckedUpdateInput = {
          edptName,
          edptModifiedOn: new Date(),
          edptModifiedBy: DEFAULT_ACTOR,
        };

        if (this.hasOwnProperty(saveEmployeeDepartmentMasterDto, 'edptCode')) {
          data.edptCode = edptCode;
        }
        if (this.hasOwnProperty(saveEmployeeDepartmentMasterDto, 'edptAlias')) {
          data.edptAlias = edptAlias;
        }
        if (this.hasOwnProperty(saveEmployeeDepartmentMasterDto, 'edptRemarks')) {
          data.edptRemarks = edptRemarks;
        }
        if (this.hasOwnProperty(saveEmployeeDepartmentMasterDto, 'edptIsActive')) {
          data.edptIsActive = saveEmployeeDepartmentMasterDto.edptIsActive;
        }

        const updated = await tx.employeeDepartment.update({
          where: {
            edptId,
          },
          data,
        });
        const payload = this.toPayload(updated);

        await this.auditLogService.logEntityChange(
          {
            action: 'update',
            tableName: EMPLOYEE_DEPARTMENT_MASTER_TABLE_NAME,
            screenName: EMPLOYEE_DEPARTMENT_MASTER_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: edptId,
            displayName: payload.edptName,
            originalRecord: this.toPayload(existing),
            modifiedRecord: payload,
            userId: DEFAULT_ACTOR,
            notes: 'Employee department updated',
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
    tx: EmployeeDepartmentWriteClient,
    edptName: string,
    excludeEdptId?: string,
  ): Promise<void> {
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
      throw new ConflictException(
        this.buildErrorResponse('Employee department name already exists', [
          {
            field: 'edptName',
            message: 'Duplicate edptName is not allowed',
          },
        ]),
      );
    }
  }

  private async ensureCodeIsUnique(
    tx: EmployeeDepartmentWriteClient,
    edptCode: string | null | undefined,
    excludeEdptId?: string,
  ): Promise<void> {
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
      throw new ConflictException(
        this.buildErrorResponse('Employee department code already exists', [
          {
            field: 'edptCode',
            message: 'Duplicate edptCode is not allowed',
          },
        ]),
      );
    }
  }

  private normalizeRequiredName(value: string): string {
    const trimmed = value.trim();
    if (!trimmed) {
      this.throwBadRequest('Validation failed', [
        {
          field: 'edptName',
          message: 'edptName must not be empty',
        },
      ]);
    }

    return trimmed;
  }

  private normalizeNullableString(value: string | null | undefined): string | null | undefined {
    if (value === undefined) {
      return undefined;
    }

    if (value === null) {
      return null;
    }

    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }

  private toPayload(record: EmployeeDepartment): EmployeeDepartmentMasterPayload {
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

  private handleWriteError(error: unknown): void {
    if (this.isUniqueConstraintError(error)) {
      throw new ConflictException(
        this.buildErrorResponse('Employee department already exists', [
          {
            field: 'edptName',
            message: 'Duplicate employee department unique value is not allowed',
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

  private throwNotFound(edptId: string): never {
    throw new NotFoundException(
      this.buildErrorResponse('Employee department not found', [
        {
          field: 'edptId',
          message: `No active employee department found with id ${edptId}`,
        },
      ]),
    );
  }

  private throwBadRequest(message: string, errors: EmployeeDepartmentMasterErrorDetail[]): never {
    throw new BadRequestException(this.buildErrorResponse(message, errors));
  }

  private buildErrorResponse(
    message: string,
    errors: EmployeeDepartmentMasterErrorDetail[] = [],
  ): EmployeeDepartmentMasterErrorResponse {
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
