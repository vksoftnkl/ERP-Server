import { Injectable } from '@nestjs/common';
import {
  ConfiguredGridListResult,
  ConfiguredGridSqlService,
} from '../../../common/configured-grid-sql/configured-grid-sql.service';
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
import {
  DEFAULT_ACTOR,
  SalesWriteClient,
  applyPresentFields,
  hasOwnProperty,
  normalizeRequiredText,
  resolveActor,
  throwOnUniqueConstraintError,
  throwSalesBadRequest,
  throwSalesConflict,
  throwSalesNotFound,
  toNumber,
} from 'src/common/utils/module-service.utils';
import { resolvePagination, runConfiguredGridQuery, runSalesListQuery } from 'src/common/utils/module-list.utils';
const AREA_TABLE_NAME = 'area master';
const AREA_AUDIT_SCREEN_NAME = 'Area Master';
const AREA_OPTIONAL_FIELDS = [
  'armAlias',
  'armShort',
  'armSort',
  'armDistanceKm',
  'armCollectionDays',
  'armIsActive',
];
type AreaWriteClient = SalesWriteClient;
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
  async list(
    queryDto: ListAreaQueryDto,
  ): Promise<ConfiguredGridListResult<AreaListItem, AreaListMeta>> {
    const { page, limit, skip } = resolvePagination(queryDto);
    const hasStructuredFilters =
      queryDto.armCityId !== undefined || queryDto.armIsActive !== undefined;
    const where: Prisma.AreaMasterWhereInput = { armIsDeleted: false };
    if (queryDto.armCityId !== undefined) where.armCityId = queryDto.armCityId;
    if (queryDto.armIsActive !== undefined) where.armIsActive = queryDto.armIsActive;
    if (queryDto.search?.trim()) {
      const search = queryDto.search.trim();
      where.OR = [
        { armName: { contains: search, mode: 'insensitive' } },
        { armAlias: { contains: search, mode: 'insensitive' } },
        { armShort: { contains: search, mode: 'insensitive' } },
      ];
    }
    return runSalesListQuery({ page, limit }, {
      hasStructuredFilters,
      configuredGridFn: () => runConfiguredGridQuery<AreaListItem>(
        this.configuredGridSqlService,
        { tableName: AREA_TABLE_NAME, alias: 'area_grid', search: queryDto.search, page, limit, skip },
      ),
      countFn: () => this.prisma.areaMaster.count({ where }),
      findManyFn: () => this.prisma.areaMaster.findMany({ where, orderBy: [{ armName: 'asc' }, { armId: 'asc' }], skip, take: limit }),
      toItemFn: (record) => this.toPayload(record),
      loadStylesFn: () => this.configuredGridSqlService.loadPrimaryGridStyles(AREA_TABLE_NAME),
    });
  }
  async getById(armId: string): Promise<AreaPayload> {
    const record = await this.prisma.areaMaster.findFirst({
      where: {
        armId,
        armIsDeleted: false,
      },
    });
    if (!record) {
      throwSalesNotFound<AreaErrorDetail, AreaErrorResponse>(
        'Area not found',
        'armId',
        `No active area found with id ${armId}`,
      );
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
        throwSalesNotFound<AreaErrorDetail, AreaErrorResponse>(
          'Area not found',
          'armId',
          `No active area found with id ${armId}`,
        );
      }
      const customerCount = await tx.customer.count({
        where: {
          cusAreaId: armId,
          cusIsDeleted: false,
        },
      });
      if (customerCount > 0) {
        throwSalesBadRequest<AreaErrorDetail, AreaErrorResponse>(
          'Cannot delete area with active customers',
          [
            {
              field: 'armId',
              message: `Area ${armId} is used by ${customerCount} customer(s).`,
            },
          ],
        );
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
        throwSalesNotFound<AreaErrorDetail, AreaErrorResponse>(
          'Area not found',
          'armId',
          `No active area found with id ${armId}`,
        );
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
    const normalizedName = normalizeRequiredText<AreaErrorDetail, AreaErrorResponse>(
      saveAreaDto.armName,
      'armName',
    );
    const now = new Date();
    const createdBy = resolveActor(saveAreaDto.armCreatedBy);
    const modifiedBy = resolveActor(saveAreaDto.armModifiedBy, createdBy);
    const data: Prisma.AreaMasterUncheckedCreateInput = {
      armName: normalizedName,
      armCityId: saveAreaDto.armCityId,
      armCollectionDays: hasOwnProperty(saveAreaDto, 'armCollectionDays')
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
      throwOnUniqueConstraintError<AreaErrorDetail, AreaErrorResponse>(
        error,
        'Area already exists',
        [
          {
            field: 'armName',
            message: 'Duplicate armName is not allowed',
          },
        ],
      );
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
          throwSalesNotFound<AreaErrorDetail, AreaErrorResponse>(
            'Area not found',
            'armId',
            `No active area found with id ${armId}`,
          );
        }
        const normalizedName = normalizeRequiredText<AreaErrorDetail, AreaErrorResponse>(
          saveAreaDto.armName,
          'armName',
        );
        const nextCityId = hasOwnProperty(saveAreaDto, 'armCityId')
          ? saveAreaDto.armCityId
          : existing.armCityId;
        await this.ensureCityExists(tx, nextCityId);
        await this.ensureNameIsUnique(tx, normalizedName, nextCityId, armId);
        const data: Prisma.AreaMasterUncheckedUpdateInput = {
          armName: normalizedName,
          armCityId: nextCityId,
          armModifiedOn: new Date(),
          armModifiedBy: resolveActor(saveAreaDto.armModifiedBy),
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
      throwOnUniqueConstraintError<AreaErrorDetail, AreaErrorResponse>(
        error,
        'Area already exists',
        [
          {
            field: 'armName',
            message: 'Duplicate armName is not allowed',
          },
        ],
      );
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
      throwSalesBadRequest<AreaErrorDetail, AreaErrorResponse>('City does not exist', [
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
      throwSalesConflict<AreaErrorDetail, AreaErrorResponse>(
        'Area name already exists for this city',
        [
          {
            field: 'armName',
            message: 'Duplicate area name is not allowed for this city',
          },
        ],
      );
    }
  }
  private applyOptionalFields(
    data: Prisma.AreaMasterUncheckedCreateInput | Prisma.AreaMasterUncheckedUpdateInput,
    saveAreaDto: SaveAreaDto,
  ): void {
    applyPresentFields(data, saveAreaDto, AREA_OPTIONAL_FIELDS);
  }
  private toPayload(record: AreaMaster): AreaPayload {
    return {
      armId: record.armId,
      armName: record.armName,
      armAlias: record.armAlias,
      armShort: record.armShort,
      armCityId: record.armCityId,
      armSort: toNumber(record.armSort),
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
}
