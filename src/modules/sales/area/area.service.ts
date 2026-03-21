import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfiguredGridListResult, ConfiguredGridSqlService } from '../../../common/configured-grid-sql/configured-grid-sql.service';
import { AreaMaster, Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { ListAreaQueryDto } from './dto/list-area-query.dto';
import { SaveAreaDto } from './dto/save-area.dto';
import {
  AreaErrorDetail,
  AreaErrorResponse,
  AreaListItem,
  AreaListMeta,
  AreaPayload,
} from './types/area-api.types';

const DEFAULT_ACTOR = 'system';
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const AREA_TABLE_NAME = 'area_master';
const AREA_AUDIT_SCREEN_NAME = 'Area Master';

type AreaWriteClient = Prisma.TransactionClient | PrismaService;

@Injectable()
export class AreaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly configuredGridSqlService: ConfiguredGridSqlService,
  ) {}

  async save(saveAreaDto: SaveAreaDto): Promise<AreaPayload> {
    if (saveAreaDto.armId) {
      return this.updateArea(saveAreaDto);
    }

    return this.createArea(saveAreaDto);
  }

  async list(queryDto: ListAreaQueryDto): Promise<ConfiguredGridListResult<AreaListItem, AreaListMeta>> {
    const page = queryDto.page ?? DEFAULT_PAGE;
    const limit = queryDto.limit ?? DEFAULT_LIMIT;
    const skip = (page - 1) * limit;
    const hasStructuredFilters =
      queryDto.armCityId !== undefined ||
      queryDto.armIsActive !== undefined ||
      Boolean(queryDto.search?.trim());

    if (!hasStructuredFilters) {
      const configuredList = await this.listFromConfiguredGridSql(page, limit, skip);
      if (configuredList) {
        return configuredList;
      }
    }

    const where: Prisma.AreaMasterWhereInput = {
      armIsDeleted: false,
    };

    if (queryDto.armCityId !== undefined) {
      where.armCityId = queryDto.armCityId;
    }

    if (queryDto.armIsActive !== undefined) {
      where.armIsActive = queryDto.armIsActive;
    }

    if (queryDto.search?.trim()) {
      const search = queryDto.search.trim();
      where.OR = [
        { armName: { contains: search, mode: 'insensitive' } },
        { armAlias: { contains: search, mode: 'insensitive' } },
        { armShort: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, records] = await Promise.all([
      this.prisma.areaMaster.count({ where }),
      this.prisma.areaMaster.findMany({
        where,
        orderBy: [{ armName: 'asc' }, { armId: 'asc' }],
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
  ): Promise<ConfiguredGridListResult<AreaListItem, AreaListMeta> | null> {
    const configuredGrids = await this.configuredGridSqlService.loadCandidates({
      tableName: AREA_TABLE_NAME,
    });
    const primaryConfiguredGrids = this.configuredGridSqlService.filterPrimaryFromTable(
      configuredGrids,
      AREA_TABLE_NAME,
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
        tableName: AREA_TABLE_NAME,
      });
      if (!validation.isValid) {
        continue;
      }

      try {
        const result = await this.configuredGridSqlService.runPagedQuery<AreaListItem>({
          baseSql: validation.normalizedSql,
          alias: 'area_grid',
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

  async getById(armId: string): Promise<AreaPayload> {
    const record = await this.prisma.areaMaster.findFirst({
      where: {
        armId,
        armIsDeleted: false,
      },
    });

    if (!record) {
      this.throwNotFound(armId);
    }

    return this.toPayload(record);
  }

  async softDelete(armId: string): Promise<{ armId: string; deleted: true }> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.areaMaster.findFirst({
        where: {
          armId,
          armIsDeleted: false,
        },
      });

      if (!existing) {
        this.throwNotFound(armId);
      }

      const customerCount = await tx.customer.count({
        where: {
          cusAreaId: armId,
          cusIsDeleted: false,
        },
      });
      if (customerCount > 0) {
        this.throwBadRequest('Cannot delete area with active customers', [
          {
            field: 'armId',
            message: `Area ${armId} is used by ${customerCount} customer(s).`,
          },
        ]);
      }

      const modifiedOn = new Date();
      const result = await tx.areaMaster.updateMany({
        where: {
          armId,
          armIsDeleted: false,
        },
        data: {
          armIsDeleted: true,
          armIsActive: false,
          armModifiedOn: modifiedOn,
          armModifiedBy: DEFAULT_ACTOR,
        },
      });

      if (result.count === 0) {
        this.throwNotFound(armId);
      }

      const originalRecord = this.toPayload(existing);
      const modifiedRecord = this.toPayload({
        ...existing,
        armIsDeleted: true,
        armIsActive: false,
        armModifiedOn: modifiedOn,
        armModifiedBy: DEFAULT_ACTOR,
      });

      await this.auditLogService.logEntityChange(
        {
          action: 'cancel',
          tableName: AREA_TABLE_NAME,
          screenName: AREA_AUDIT_SCREEN_NAME,
          screenType: 'master',
          pk: armId,
          displayName: existing.armName,
          originalRecord,
          modifiedRecord,
          userId: DEFAULT_ACTOR,
          notes: 'Area soft deleted',
        },
        tx,
      );

      return {
        armId,
        deleted: true,
      };
    });
  }

  private async createArea(saveAreaDto: SaveAreaDto): Promise<AreaPayload> {
    const normalizedName = this.normalizeRequiredName(saveAreaDto.armName);
    const now = new Date();
    const createdBy = this.resolveActor(saveAreaDto.armCreatedBy);
    const modifiedBy = this.resolveActor(saveAreaDto.armModifiedBy, createdBy);
    const data: Prisma.AreaMasterUncheckedCreateInput = {
      armName: normalizedName,
      armCityId: saveAreaDto.armCityId,
      armCollectionDays: this.hasOwnProperty(saveAreaDto, 'armCollectionDays')
        ? (saveAreaDto.armCollectionDays ?? [])
        : [],
      armCreatedOn: now,
      armCreatedBy: createdBy,
      armModifiedOn: now,
      armModifiedBy: modifiedBy,
    };
    this.applyOptionalFields(data, saveAreaDto);

    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.ensureCityExists(tx, data.armCityId);
        await this.ensureNameIsUnique(tx, normalizedName, data.armCityId);

        const created = await tx.areaMaster.create({ data });
        const payload = this.toPayload(created);

        await this.auditLogService.logEntityChange(
          {
            action: 'New',
            tableName: AREA_TABLE_NAME,
            screenName: AREA_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: payload.armId,
            displayName: payload.armName,
            originalRecord: null,
            modifiedRecord: payload,
            userId: createdBy,
            notes: 'Area created',
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

  private async updateArea(saveAreaDto: SaveAreaDto): Promise<AreaPayload> {
    const armId = saveAreaDto.armId!;

    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.areaMaster.findFirst({
          where: {
            armId,
            armIsDeleted: false,
          },
        });

        if (!existing) {
          this.throwNotFound(armId);
        }

        const normalizedName = this.normalizeRequiredName(saveAreaDto.armName);
        const nextCityId = this.hasOwnProperty(saveAreaDto, 'armCityId')
          ? saveAreaDto.armCityId
          : existing.armCityId;

        await this.ensureCityExists(tx, nextCityId);
        await this.ensureNameIsUnique(tx, normalizedName, nextCityId, armId);

        const data: Prisma.AreaMasterUncheckedUpdateInput = {
          armName: normalizedName,
          armCityId: nextCityId,
          armModifiedOn: new Date(),
          armModifiedBy: this.resolveActor(saveAreaDto.armModifiedBy),
        };
        this.applyOptionalFields(data, saveAreaDto);

        const updated = await tx.areaMaster.update({
          where: {
            armId,
          },
          data,
        });
        const payload = this.toPayload(updated);

        await this.auditLogService.logEntityChange(
          {
            action: 'update',
            tableName: AREA_TABLE_NAME,
            screenName: AREA_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: armId,
            displayName: payload.armName,
            originalRecord: this.toPayload(existing),
            modifiedRecord: payload,
            userId: payload.armModifiedBy,
            notes: 'Area updated',
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

  private async ensureCityExists(tx: AreaWriteClient, cityId: string): Promise<void> {
    const city = await tx.cityMaster.findFirst({
      where: {
        ctmId: cityId,
        ctmIsDeleted: false,
      },
      select: {
        ctmId: true,
      },
    });

    if (!city) {
      this.throwBadRequest('City does not exist', [
        {
          field: 'armCityId',
          message: `No active city found with id ${cityId}`,
        },
      ]);
    }
  }

  private async ensureNameIsUnique(
    tx: AreaWriteClient,
    areaName: string,
    cityId: string,
    excludeId?: string,
  ): Promise<void> {
    const existing = await tx.areaMaster.findFirst({
      where: {
        armIsDeleted: false,
        armCityId: cityId,
        armName: {
          equals: areaName,
          mode: 'insensitive',
        },
        ...(excludeId
          ? {
              armId: {
                not: excludeId,
              },
            }
          : {}),
      },
      select: {
        armId: true,
      },
    });

    if (existing) {
      throw new ConflictException(
        this.buildErrorResponse('Area name already exists for this city', [
          {
            field: 'armName',
            message: 'Duplicate area name is not allowed for this city',
          },
        ]),
      );
    }
  }

  private applyOptionalFields(
    data: Prisma.AreaMasterUncheckedCreateInput | Prisma.AreaMasterUncheckedUpdateInput,
    saveAreaDto: SaveAreaDto,
  ): void {
    if (this.hasOwnProperty(saveAreaDto, 'armAlias')) {
      data.armAlias = saveAreaDto.armAlias;
    }

    if (this.hasOwnProperty(saveAreaDto, 'armShort')) {
      data.armShort = saveAreaDto.armShort;
    }

    if (this.hasOwnProperty(saveAreaDto, 'armSort')) {
      data.armSort = saveAreaDto.armSort;
    }

    if (this.hasOwnProperty(saveAreaDto, 'armDistanceKm')) {
      data.armDistanceKm = saveAreaDto.armDistanceKm;
    }

    if (this.hasOwnProperty(saveAreaDto, 'armCollectionDays')) {
      data.armCollectionDays = saveAreaDto.armCollectionDays;
    }

    if (this.hasOwnProperty(saveAreaDto, 'armIsActive')) {
      data.armIsActive = saveAreaDto.armIsActive;
    }
  }

  private normalizeRequiredName(name: string): string {
    const trimmed = name.trim();
    if (!trimmed) {
      this.throwBadRequest('Validation failed', [
        {
          field: 'armName',
          message: 'armName must not be empty',
        },
      ]);
    }

    return trimmed;
  }

  private toPayload(record: AreaMaster): AreaPayload {
    return {
      armId: record.armId,
      armName: record.armName,
      armAlias: record.armAlias,
      armShort: record.armShort,
      armCityId: record.armCityId,
      armSort: this.toNumber(record.armSort),
      armDistanceKm: record.armDistanceKm,
      armCollectionDays: record.armCollectionDays,
      armIsActive: record.armIsActive,
      armIsDeleted: record.armIsDeleted,
      armSyncDate: record.armSyncDate ? record.armSyncDate.toISOString() : null,
      armCreatedOn: record.armCreatedOn.toISOString(),
      armCreatedBy: record.armCreatedBy,
      armModifiedOn: record.armModifiedOn.toISOString(),
      armModifiedBy: record.armModifiedBy,
    };
  }

  private toNumber(value: Prisma.Decimal | number): number {
    if (typeof value === 'number') {
      return value;
    }

    return Number(value.toString());
  }

  private resolveActor(value: string | null | undefined, fallback = DEFAULT_ACTOR): string {
    if (!value) {
      return fallback;
    }

    const trimmed = value.trim();
    return trimmed || fallback;
  }

  private handleWriteError(error: unknown): void {
    if (this.isUniqueConstraintError(error)) {
      throw new ConflictException(
        this.buildErrorResponse('Area already exists', [
          {
            field: 'armName',
            message: 'Duplicate armName is not allowed',
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

  private throwNotFound(armId: string): never {
    throw new NotFoundException(
      this.buildErrorResponse('Area not found', [
        {
          field: 'armId',
          message: `No active area found with id ${armId}`,
        },
      ]),
    );
  }

  private throwBadRequest(message: string, errors: AreaErrorDetail[]): never {
    throw new BadRequestException(this.buildErrorResponse(message, errors));
  }

  private buildErrorResponse(message: string, errors: AreaErrorDetail[] = []): AreaErrorResponse {
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
