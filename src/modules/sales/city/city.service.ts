import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfiguredGridListResult, ConfiguredGridSqlService } from '../../../common/configured-grid-sql/configured-grid-sql.service';
import { CityMaster, Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { ListCityQueryDto } from './dto/list-city-query.dto';
import { SaveCityDto } from './dto/save-city.dto';
import {
  CityErrorDetail,
  CityErrorResponse,
  CityListItem,
  CityListMeta,
  CityPayload,
} from './types/city-api.types';

const DEFAULT_ACTOR = 'system';
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const CITY_TABLE_NAME = 'city master';
const CITY_AUDIT_SCREEN_NAME = 'City Master';

type CityWriteClient = Prisma.TransactionClient | PrismaService;

@Injectable()
export class CityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly configuredGridSqlService: ConfiguredGridSqlService,
  ) {}

  async save(saveCityDto: SaveCityDto): Promise<CityPayload> {
    if (saveCityDto.ctmId) {
      return this.updateCity(saveCityDto);
    }

    return this.createCity(saveCityDto);
  }

  async list(queryDto: ListCityQueryDto): Promise<ConfiguredGridListResult<CityListItem, CityListMeta>> {
    const page = queryDto.page ?? DEFAULT_PAGE;
    const limit = queryDto.limit ?? DEFAULT_LIMIT;
    const skip = (page - 1) * limit;
    const hasStructuredFilters =
      queryDto.ctmStateId !== undefined ||
      queryDto.ctmIsActive !== undefined;

    if (!hasStructuredFilters) {
      const configuredList = await this.listFromConfiguredGridSql(queryDto.search, page, limit, skip);
      if (configuredList) {
        return configuredList;
      }
    }

    const where: Prisma.CityMasterWhereInput = {
      ctmIsDeleted: false,
    };

    if (queryDto.ctmStateId !== undefined) {
      where.ctmStateId = queryDto.ctmStateId;
    }

    if (queryDto.ctmIsActive !== undefined) {
      where.ctmIsActive = queryDto.ctmIsActive;
    }

    if (queryDto.search?.trim()) {
      const search = queryDto.search.trim();
      where.OR = [
        { ctmName: { contains: search, mode: 'insensitive' } },
        { ctmAlias: { contains: search, mode: 'insensitive' } },
        { ctmShort: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, records, styles] = await Promise.all([
      this.prisma.cityMaster.count({ where }),
      this.prisma.cityMaster.findMany({
        where,
        orderBy: [{ ctmName: 'asc' }, { ctmId: 'asc' }],
        skip,
        take: limit,
      }),
      this.configuredGridSqlService.loadPrimaryGridStyles(CITY_TABLE_NAME),
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
  ): Promise<ConfiguredGridListResult<CityListItem, CityListMeta> | null> {
    const configuredGrids = await this.configuredGridSqlService.loadCandidates({
      tableName: CITY_TABLE_NAME,
    });
    const primaryConfiguredGrids = this.configuredGridSqlService.filterPrimaryFromTable(
      configuredGrids,
      CITY_TABLE_NAME,
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
        tableName: CITY_TABLE_NAME,
      });
      if (!validation.isValid) {
        continue;
      }

      try {
        const result = await this.configuredGridSqlService.runPagedQuery<CityListItem>({
          baseSql: validation.normalizedSql,
          alias: 'city_grid',
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

  async getById(ctmId: string): Promise<CityPayload> {
    const record = await this.prisma.cityMaster.findFirst({
      where: {
        ctmId,
        ctmIsDeleted: false,
      },
    });

    if (!record) {
      this.throwNotFound(ctmId);
    }

    return this.toPayload(record);
  }

  async softDelete(ctmId: string): Promise<{ ctmId: string; deleted: true }> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.cityMaster.findFirst({
        where: {
          ctmId,
          ctmIsDeleted: false,
        },
      });

      if (!existing) {
        this.throwNotFound(ctmId);
      }

      const areaCount = await tx.areaMaster.count({
        where: {
          armCityId: ctmId,
          armIsDeleted: false,
        },
      });

      if (areaCount > 0) {
        this.throwBadRequest('Cannot delete city with active areas', [
          {
            field: 'ctmId',
            message: `City ${ctmId} is used by ${areaCount} area(s).`,
          },
        ]);
      }

      const modifiedOn = new Date();
      const result = await tx.cityMaster.updateMany({
        where: {
          ctmId,
          ctmIsDeleted: false,
        },
        data: {
          ctmIsDeleted: true,
          ctmIsActive: false,
          ctmModifiedOn: modifiedOn,
          ctmModifiedBy: DEFAULT_ACTOR,
        },
      });

      if (result.count === 0) {
        this.throwNotFound(ctmId);
      }

      const originalRecord = this.toPayload(existing);
      const modifiedRecord = this.toPayload({
        ...existing,
        ctmIsDeleted: true,
        ctmIsActive: false,
        ctmModifiedOn: modifiedOn,
        ctmModifiedBy: DEFAULT_ACTOR,
      });

      await this.auditLogService.logEntityChange(
        {
          action: 'cancel',
          tableName: CITY_TABLE_NAME,
          screenName: CITY_AUDIT_SCREEN_NAME,
          screenType: 'master',
          pk: ctmId,
          displayName: existing.ctmName,
          originalRecord,
          modifiedRecord,
          userId: DEFAULT_ACTOR,
          notes: 'City soft deleted',
        },
        tx,
      );

      return {
        ctmId,
        deleted: true,
      };
    });
  }

  private async createCity(saveCityDto: SaveCityDto): Promise<CityPayload> {
    const normalizedName = this.normalizeRequiredName(saveCityDto.ctmName);
    const now = new Date();
    const createdBy = this.resolveActor(saveCityDto.ctmCreatedBy);
    const modifiedBy = this.resolveActor(saveCityDto.ctmModifiedBy, createdBy);
    const data: Prisma.CityMasterUncheckedCreateInput = {
      ctmName: normalizedName,
      ctmStateId: saveCityDto.ctmStateId,
      ctmCreatedOn: now,
      ctmCreatedBy: createdBy,
      ctmModifiedOn: now,
      ctmModifiedBy: modifiedBy,
    };
    this.applyOptionalFields(data, saveCityDto);

    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.ensureStateExists(tx, data.ctmStateId);
        await this.ensureNameIsUnique(tx, normalizedName, data.ctmStateId);

        const created = await tx.cityMaster.create({ data });
        const payload = this.toPayload(created);

        await this.auditLogService.logEntityChange(
          {
            action: 'New',
            tableName: CITY_TABLE_NAME,
            screenName: CITY_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: payload.ctmId,
            displayName: payload.ctmName,
            originalRecord: null,
            modifiedRecord: payload,
            userId: createdBy,
            notes: 'City created',
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

  private async updateCity(saveCityDto: SaveCityDto): Promise<CityPayload> {
    const ctmId = saveCityDto.ctmId!;

    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.cityMaster.findFirst({
          where: {
            ctmId,
            ctmIsDeleted: false,
          },
        });

        if (!existing) {
          this.throwNotFound(ctmId);
        }

        const normalizedName = this.normalizeRequiredName(saveCityDto.ctmName);
        const nextStateId = this.hasOwnProperty(saveCityDto, 'ctmStateId')
          ? saveCityDto.ctmStateId
          : existing.ctmStateId;

        await this.ensureStateExists(tx, nextStateId);
        await this.ensureNameIsUnique(tx, normalizedName, nextStateId, ctmId);

        const data: Prisma.CityMasterUncheckedUpdateInput = {
          ctmName: normalizedName,
          ctmStateId: nextStateId,
          ctmModifiedOn: new Date(),
          ctmModifiedBy: this.resolveActor(saveCityDto.ctmModifiedBy),
        };
        this.applyOptionalFields(data, saveCityDto);

        const updated = await tx.cityMaster.update({
          where: {
            ctmId,
          },
          data,
        });
        const payload = this.toPayload(updated);

        await this.auditLogService.logEntityChange(
          {
            action: 'update',
            tableName: CITY_TABLE_NAME,
            screenName: CITY_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: ctmId,
            displayName: payload.ctmName,
            originalRecord: this.toPayload(existing),
            modifiedRecord: payload,
            userId: payload.ctmModifiedBy,
            notes: 'City updated',
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

  private async ensureStateExists(tx: CityWriteClient, stateId: string): Promise<void> {
    const state = await tx.stateMaster.findFirst({
      where: {
        stmId: stateId,
        stmIsDeleted: false,
      },
      select: {
        stmId: true,
      },
    });

    if (!state) {
      this.throwBadRequest('State does not exist', [
        {
          field: 'ctmStateId',
          message: `No active state found with id ${stateId}`,
        },
      ]);
    }
  }

  private async ensureNameIsUnique(
    tx: CityWriteClient,
    cityName: string,
    stateId: string,
    excludeId?: string,
  ): Promise<void> {
    const existing = await tx.cityMaster.findFirst({
      where: {
        ctmIsDeleted: false,
        ctmStateId: stateId,
        ctmName: {
          equals: cityName,
          mode: 'insensitive',
        },
        ...(excludeId
          ? {
              ctmId: {
                not: excludeId,
              },
            }
          : {}),
      },
      select: {
        ctmId: true,
      },
    });

    if (existing) {
      throw new ConflictException(
        this.buildErrorResponse('City name already exists for this state', [
          {
            field: 'ctmName',
            message: 'Duplicate city name is not allowed for this state',
          },
        ]),
      );
    }
  }

  private applyOptionalFields(
    data: Prisma.CityMasterUncheckedCreateInput | Prisma.CityMasterUncheckedUpdateInput,
    saveCityDto: SaveCityDto,
  ): void {
    if (this.hasOwnProperty(saveCityDto, 'ctmAlias')) {
      data.ctmAlias = saveCityDto.ctmAlias;
    }

    if (this.hasOwnProperty(saveCityDto, 'ctmShort')) {
      data.ctmShort = saveCityDto.ctmShort;
    }

    if (this.hasOwnProperty(saveCityDto, 'ctmOrder')) {
      data.ctmOrder = saveCityDto.ctmOrder;
    }

    if (this.hasOwnProperty(saveCityDto, 'ctmIsActive')) {
      data.ctmIsActive = saveCityDto.ctmIsActive;
    }
  }

  private normalizeRequiredName(name: string): string {
    const trimmed = name.trim();
    if (!trimmed) {
      this.throwBadRequest('Validation failed', [
        {
          field: 'ctmName',
          message: 'ctmName must not be empty',
        },
      ]);
    }

    return trimmed;
  }

  private toPayload(record: CityMaster): CityPayload {
    return {
      ctmId: record.ctmId,
      ctmName: record.ctmName,
      ctmAlias: record.ctmAlias,
      ctmShort: record.ctmShort,
      ctmStateId: record.ctmStateId,
      ctmOrder: this.toNumber(record.ctmOrder),
      ctmIsActive: record.ctmIsActive,
      ctmIsDeleted: record.ctmIsDeleted,
      ctmSyncDate: record.ctmSyncDate ? record.ctmSyncDate.toISOString() : null,
      ctmCreatedOn: record.ctmCreatedOn.toISOString(),
      ctmCreatedBy: record.ctmCreatedBy,
      ctmModifiedOn: record.ctmModifiedOn.toISOString(),
      ctmModifiedBy: record.ctmModifiedBy,
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
        this.buildErrorResponse('City already exists', [
          {
            field: 'ctmName',
            message: 'Duplicate ctmName is not allowed',
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

  private throwNotFound(ctmId: string): never {
    throw new NotFoundException(
      this.buildErrorResponse('City not found', [
        {
          field: 'ctmId',
          message: `No active city found with id ${ctmId}`,
        },
      ]),
    );
  }

  private throwBadRequest(message: string, errors: CityErrorDetail[]): never {
    throw new BadRequestException(this.buildErrorResponse(message, errors));
  }

  private buildErrorResponse(message: string, errors: CityErrorDetail[] = []): CityErrorResponse {
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
