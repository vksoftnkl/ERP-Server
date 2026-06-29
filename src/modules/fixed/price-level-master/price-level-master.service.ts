import { Injectable, NotFoundException } from '@nestjs/common';
import { PriceLevel, Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { GetPriceLevelMasterQueryDto } from './dto/get-price-level-master-query.dto';
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
  constructor(private readonly prisma: PrismaService) {}
  async get(
    queryDto: GetPriceLevelMasterQueryDto,
  ): Promise<{ items: PriceLevelMasterPayload[]; meta: PriceLevelMasterGetMeta }> {
    const activeOnly = queryDto.activeOnly ?? true;
    const includeDeleted = queryDto.includeDeleted ?? false;
    const where: Prisma.PriceLevelWhereInput = {};
    if (queryDto.priceLvlId !== undefined) {
      where.priceLvlId = queryDto.priceLvlId;
    }
    if (activeOnly) {
      where.priceLvlIsActive = true;
    }
    if (!includeDeleted) {
      where.priceLvlIsDeleted = false;
    }
    const records = await this.prisma.priceLevel.findMany({
      where,
      orderBy: [{ priceLvlName: 'asc' }, { priceLvlId: 'asc' }],
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
        activeOnly,
        includeDeleted,
        count: items.length,
      },
    };
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