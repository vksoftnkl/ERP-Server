import { Injectable } from '@nestjs/common';
import { CityMaster, Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { SaveCityDto } from './dto/save-city.dto';
import {
  CityErrorDetail,
  CityErrorResponse,
  CityPayload,
} from './types/city-api.types';
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
import { RequestContextService } from '../../../common/request-context/request-context.service';
const CITY_TABLE_NAME = 'city master';
const CITY_AUDIT_SCREEN_NAME = 'City Master';
const CITY_OPTIONAL_FIELDS = ['ctmAlias', 'ctmShort', 'ctmOrder', 'ctmIsActive'];
type CityWriteClient = SalesWriteClient;
@Injectable()
export class CityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly requestContextService: RequestContextService,
  ) {}
  async save(saveCityDto: SaveCityDto): Promise<CityPayload> {
    if (saveCityDto.ctmId) {
      return this.updateCity(saveCityDto);
    }
    return this.createCity(saveCityDto);
  }
  async getById(ctmId: string): Promise<CityPayload> {
    const record = await this.prisma.cityMaster.findFirst({
      where: {
        ctmId,
        ctmIsDeleted: false,
      },
    });
    if (!record) {
      throwSalesNotFound<CityErrorDetail, CityErrorResponse>(
        'City not found',
        'ctmId',
        `No active city found with id ${ctmId}`,
      );
    }
    const payload = this.toPayload(record);
    payload.ctmStateName = await this.getStateName(this.prisma, record.ctmStateId);
    return payload;
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
        throwSalesNotFound<CityErrorDetail, CityErrorResponse>(
          'City not found',
          'ctmId',
          `No active city found with id ${ctmId}`,
        );
      }
      const areaCount = await tx.areaMaster.count({
        where: {
          armCityId: ctmId,
          armIsDeleted: false,
        },
      });
      if (areaCount > 0) {
        throwSalesBadRequest<CityErrorDetail, CityErrorResponse>(
          'Cannot delete city with active areas',
          [
            {
              field: 'ctmId',
              message: `City ${ctmId} is used by ${areaCount} area(s).`,
            },
          ],
        );
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
          ctmModifiedBy: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
        },
      });
      if (result.count === 0) {
        throwSalesNotFound<CityErrorDetail, CityErrorResponse>(
          'City not found',
          'ctmId',
          `No active city found with id ${ctmId}`,
        );
      }
      const originalRecord = this.toPayload(existing);
      const modifiedRecord = this.toPayload({
        ...existing,
        ctmIsDeleted: true,
        ctmIsActive: false,
        ctmModifiedOn: modifiedOn,
        ctmModifiedBy: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
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
          userId: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
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
    const normalizedName = normalizeRequiredText<CityErrorDetail, CityErrorResponse>(
      saveCityDto.ctmName,
      'ctmName',
    );
    const now = new Date();
    const createdBy = resolveActor(saveCityDto.ctmCreatedBy, this.requestContextService.getUserId());
    const modifiedBy = resolveActor(saveCityDto.ctmModifiedBy, createdBy);
    const data: Prisma.CityMasterUncheckedCreateInput = {
      ctmName: normalizedName,
      ctmStateId: saveCityDto.ctmStateId,
      ctmCreatedOn: now,
      ctmCreatedBy: createdBy,
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
      throwOnUniqueConstraintError<CityErrorDetail, CityErrorResponse>(
        error,
        'City already exists',
        [
          {
            field: 'ctmName',
            message: 'Duplicate ctmName is not allowed',
          },
        ],
      );
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
          throwSalesNotFound<CityErrorDetail, CityErrorResponse>(
            'City not found',
            'ctmId',
            `No active city found with id ${ctmId}`,
          );
        }

        const normalizedName = normalizeRequiredText<CityErrorDetail, CityErrorResponse>(
          saveCityDto.ctmName,
          'ctmName',
        );
        const nextStateId = hasOwnProperty(saveCityDto, 'ctmStateId')
          ? saveCityDto.ctmStateId
          : existing.ctmStateId;

        await this.ensureStateExists(tx, nextStateId);
        await this.ensureNameIsUnique(tx, normalizedName, nextStateId, ctmId);

        const data: Prisma.CityMasterUncheckedUpdateInput = {
          ctmName: normalizedName,
          ctmStateId: nextStateId,
          ctmModifiedOn: new Date(),
          ctmModifiedBy: resolveActor(saveCityDto.ctmModifiedBy, this.requestContextService.getUserId()),
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
      throwOnUniqueConstraintError<CityErrorDetail, CityErrorResponse>(
        error,
        'City already exists',
        [
          {
            field: 'ctmName',
            message: 'Duplicate ctmName is not allowed',
          },
        ],
      );
      throw error;
    }
  }

  private async getStateName(client: CityWriteClient, stateId: string): Promise<string | null> {
    if (!stateId) {
      return null;
    }
    const state = await client.stateMaster.findFirst({
      where: { stmId: stateId },
      select: { stmName: true },
    });
    return state?.stmName ?? null;
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
      throwSalesBadRequest<CityErrorDetail, CityErrorResponse>('State does not exist', [
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
      throwSalesConflict<CityErrorDetail, CityErrorResponse>(
        'City name already exists for this state',
        [
          {
            field: 'ctmName',
            message: 'Duplicate city name is not allowed for this state',
          },
        ],
      );
    }
  }

  private applyOptionalFields(
    data: Prisma.CityMasterUncheckedCreateInput | Prisma.CityMasterUncheckedUpdateInput,
    saveCityDto: SaveCityDto,
  ): void {
    applyPresentFields(data, saveCityDto, CITY_OPTIONAL_FIELDS);
  }
  private toPayload(record: CityMaster): CityPayload {
    return {
      ctmId: record.ctmId,
      ctmName: record.ctmName,
      ctmAlias: record.ctmAlias,
      ctmShort: record.ctmShort,
      ctmStateId: record.ctmStateId,
      ctmOrder: toNumber(record.ctmOrder),
      ctmIsActive: record.ctmIsActive,
      ctmIsDeleted: record.ctmIsDeleted,
      ctmSyncDate: record.ctmSyncDate ? record.ctmSyncDate.toISOString() : null,
      ctmCreatedOn: record.ctmCreatedOn.toISOString(),
      ctmCreatedBy: record.ctmCreatedBy,
      ctmModifiedOn: record.ctmModifiedOn.toISOString(),
      ctmModifiedBy: record.ctmModifiedBy,
    };
  }
}
