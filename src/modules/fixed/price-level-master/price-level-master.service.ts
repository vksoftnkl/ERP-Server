import { Injectable, NotFoundException } from '@nestjs/common';
import { PriceLevel, Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import { DEFAULT_ACTOR } from '../../../common/utils/module-shared.utils';
import { GetPriceLevelMasterQueryDto } from './dto/get-price-level-master-query.dto';
import { UpdatePriceLevelMasterDto } from './dto/update-price-level-master.dto';
import {
  PriceLevelMasterGetMeta,
  PriceLevelMasterPayload,
} from './types/price-level-master-api.types';
type PriceLevelRecord = Pick<
  PriceLevel,
  | 'priceLvlId'
  | 'priceLvlName'
  | 'priceLvlShort'
  | 'priceLvlIsActive'
  | 'priceLvlIsAdmin'
  | 'priceLvlIsDeleted'
  | 'priceLvlSyncDate'
  | 'priceLvlCreatedOn'
  | 'priceLvlCreatedBy'
  | 'priceLvlModifiedOn'
  | 'priceLvlModifiedBy'
>;
@Injectable()
export class PriceLevelMasterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContextService: RequestContextService,
  ) {}
  async get(
    queryDto: GetPriceLevelMasterQueryDto,
  ): Promise<{ items: PriceLevelMasterPayload[]; meta: PriceLevelMasterGetMeta }> {
   
    const where: Prisma.PriceLevelWhereInput = {};
    if (queryDto.priceLvlId !== undefined) {
      where.priceLvlId = queryDto.priceLvlId;
    }
    const records = await this.prisma.priceLevel.findMany({
      where,
      orderBy: [ { priceLvlId: 'asc' }],
      select: {
        priceLvlId: true,
        priceLvlName: true,
        priceLvlShort: true,
        priceLvlIsActive: true,
        priceLvlIsAdmin: true,
        priceLvlIsDeleted: true,
        priceLvlSyncDate: true,
        priceLvlCreatedOn: true,
        priceLvlCreatedBy: true,
        priceLvlModifiedOn: true,
        priceLvlModifiedBy: true,
      },
    });
    if (queryDto.priceLvlId !== undefined && records.length === 0) {
      throw new NotFoundException(`Price level not found for priceLvlId ${queryDto.priceLvlId}`);
    }
    const items = records.map((record) => this.toPayload(record));
    return {
      items,
      meta: {
        priceLvlId: queryDto.priceLvlId,
        count: items.length,
      },
    };
  }
  async update(
    updateDto: UpdatePriceLevelMasterDto,
  ): Promise<PriceLevelMasterPayload[]> {
    const ids = updateDto.priceLevels.map((item) => item.priceLvlId);
    const existing = await this.prisma.priceLevel.findMany({
      where: { priceLvlId: { in: ids } },
      select: { priceLvlId: true },
    });
    const foundIds = new Set(existing.map((record) => record.priceLvlId));
    const missing = ids.filter((id) => !foundIds.has(id));
    if (missing.length > 0) {
      throw new NotFoundException(`Price level(s) not found for priceLvlId(s): ${missing.join(', ')}`);
    }

    const actor = this.requestContextService.getUserId() ?? DEFAULT_ACTOR;
    const records = await this.prisma.$transaction(
      updateDto.priceLevels.map((item) => {
        const data: Prisma.PriceLevelUpdateInput = {};
        if (item.priceLvlName !== undefined) {
          data.priceLvlName = item.priceLvlName;
        }
        if (item.priceLvlShort !== undefined) {
          data.priceLvlShort = item.priceLvlShort;
        }
        if (item.priceLvlIsActive !== undefined) {
          data.priceLvlIsActive = item.priceLvlIsActive;
        }
        if (item.priceLvlIsAdmin !== undefined) {
          data.priceLvlIsAdmin = item.priceLvlIsAdmin;
        }
        data.priceLvlModifiedOn = new Date();
        data.priceLvlModifiedBy = actor;

        return this.prisma.priceLevel.update({
          where: { priceLvlId: item.priceLvlId },
          data,
          select: {
            priceLvlId: true,
            priceLvlName: true,
            priceLvlShort: true,
            priceLvlIsActive: true,
            priceLvlIsAdmin: true,
            priceLvlIsDeleted: true,
            priceLvlSyncDate: true,
            priceLvlCreatedOn: true,
            priceLvlCreatedBy: true,
            priceLvlModifiedOn: true,
            priceLvlModifiedBy: true,
          },
        });
      }),
    );

    return records.map((record) => this.toPayload(record));
  }

  private toPayload(record: PriceLevelRecord): PriceLevelMasterPayload {
    return {
      priceLvlId: record.priceLvlId,
      priceLvlName: record.priceLvlName,
      priceLvlShort: record.priceLvlShort,
      priceLvlIsActive: record.priceLvlIsActive,
      priceLvlIsAdmin: record.priceLvlIsAdmin,
      priceLvlIsDeleted: record.priceLvlIsDeleted,
      priceLvlSyncDate: record.priceLvlSyncDate?.toISOString() ?? null,
      priceLvlCreatedOn: record.priceLvlCreatedOn.toISOString(),
      priceLvlCreatedBy: record.priceLvlCreatedBy,
      priceLvlModifiedOn: record.priceLvlModifiedOn.toISOString(),
      priceLvlModifiedBy: record.priceLvlModifiedBy,
    };
  }
}