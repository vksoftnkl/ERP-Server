import { Injectable } from '@nestjs/common';
import { ItemGstUnits, Prisma } from '@prisma/client';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { GetItemGstUnitQueryDto } from './dto/get-item-gst-unit-query.dto';
import { ItemGstUnitPayload } from './types/item-gst-unit-api.types';

@Injectable()
export class ItemsGstUnitsMasterService {
  constructor(private readonly prisma: PrismaService) {}

  async list(queryDto: GetItemGstUnitQueryDto): Promise<ItemGstUnitPayload[]> {
    const where: Prisma.ItemGstUnitsWhereInput = {};
    const search = queryDto.search?.trim();
    if (search) {
      where.OR = [
        { itemGstUnitCode: { contains: search, mode: 'insensitive' } },
        { itemGstUnitName: { contains: search, mode: 'insensitive' } },
      ];
    }

    const records = await this.prisma.itemGstUnits.findMany({
      where,
      orderBy: [{ itemGstUnitName: 'asc' }, { itemGstUnitId: 'asc' }],
    });

    return records.map((record) => this.toPayload(record));
  }

  private toPayload(record: ItemGstUnits): ItemGstUnitPayload {
    return {
      item_gst_unit_id: record.itemGstUnitId,
      item_gst_unit_code: record.itemGstUnitCode,
      item_gst_unit_name: record.itemGstUnitName,
      item_gst_unit_created_on: record.itemGstUnitCreatedOn.toISOString(),
      item_gst_unit_created_by: record.itemGstUnitCreatedBy,
      item_gst_unit_modified_on: record.itemGstUnitModifiedOn.toISOString(),
      item_gst_unit_modified_by: record.itemGstUnitModifiedBy,
      item_gst_unit_sync_date: record.itemGstUnitSyncDate
        ? record.itemGstUnitSyncDate.toISOString()
        : null,
    };
  }
}
