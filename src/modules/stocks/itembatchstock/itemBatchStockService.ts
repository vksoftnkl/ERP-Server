import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { GetItemBatchStockQueryDto } from './dto/get-item-batch-stock-query.dto';
import {
  ItemBatchStockErrorDetail,
  ItemBatchStockErrorResponse,
  ItemBatchStockPayload,
} from './types/item-batch-stock-api.types';

type ItemBatchStockWithBatchMaster = Prisma.ItemBatchStockGetPayload<{
  include: { batch: true };
}>;

@Injectable()
export class ItemBatchStockService {
  constructor(private readonly prisma: PrismaService) {}

  async getByScope(queryDto: GetItemBatchStockQueryDto): Promise<ItemBatchStockPayload[]> {
    const unitFactorsByUnitId = await this.getItemPriceUnitFactors(
      queryDto.ibs_item_id,
      queryDto.ibs_unit_id,
    );
    const stockUnitIds = Array.from(
      new Set([queryDto.ibs_unit_id, ...unitFactorsByUnitId.keys()]),
    );

    const where: Prisma.ItemBatchStockWhereInput = {
      ibsAccYear: queryDto.ibs_acc_year,
      ibsCompanyId: queryDto.ibs_company_id,
      ibsBranchId: queryDto.ibs_branch_id,
      ibsGodownId: queryDto.ibs_godown_id,
      ibsItemId: queryDto.ibs_item_id,
      ibsUnitId: { in: stockUnitIds },
      ibsIsActive: queryDto.ibs_is_active ?? true,
      ibsIsDeleted: queryDto.ibs_is_deleted ?? false,
    };

    if (queryDto.ibs_batch_id) {
      where.ibsBatchId = queryDto.ibs_batch_id;
    }
    if (queryDto.ibs_stock_bucket) {
      where.ibsStockBucket = queryDto.ibs_stock_bucket;
    }

    const normalizedSearch = queryDto.search?.trim();
    if (normalizedSearch) {
      const contains = { contains: normalizedSearch, mode: 'insensitive' as const };
      where.OR = [
        { ibsBatchNo: contains },
        { ibsSerialNo: contains },
        { batch: { is: { btmBatchNo: contains } } },
        { batch: { is: { btmMfgBatchNo: contains } } },
        { batch: { is: { btmBarcode: contains } } },
      ];
    }

    const records = await this.prisma.itemBatchStock.findMany({
      where,
      include: { batch: true },
      orderBy: [
        { ibsStockBucket: 'asc' },
        { ibsExpiryDate: 'asc' },
        { ibsBatchNo: 'asc' },
        { ibsBatchId: 'asc' },
      ],
    });

    if (records.length === 0) {
      this.throwItemBatchStockNotFound(queryDto);
    }
    if (unitFactorsByUnitId.size === 0) {
      this.throwItemPriceMasterNotFound(queryDto.ibs_item_id, queryDto.ibs_unit_id);
    }

    return records.map((record) =>
      this.toPayload(record, this.getUnitFactorForStockUnit(record, queryDto, unitFactorsByUnitId)),
    );
  }
  private toPayload(
    record: ItemBatchStockWithBatchMaster,
    unitFactor = 1,
  ): ItemBatchStockPayload {
    const closingQty = this.toNumber(record.ibsClosingQty);
    const freeClosingQty = this.toNumber(record.ibsFreeClosingQty);
    const reservedQty = this.toNumber(record.ibsReservedQty);
    const availableQty = this.toNumber(record.ibsAvailableQty);
    const mfgDate = record.ibsMfgDate ?? record.batch.btmMfgDate;
    const expiryDate = record.ibsExpiryDate ?? record.batch.btmExpiryDate;
    return {
      ibs_id: record.ibsId,
      ibs_acc_year: record.ibsAccYear,
      ibs_company_id: record.ibsCompanyId,
      ibs_branch_id: record.ibsBranchId,
      ibs_godown_id: record.ibsGodownId,
      ibs_item_id: record.ibsItemId,
      ibs_unit_id: record.ibsUnitId,
      ibs_batch_id: record.ibsBatchId,
      ibs_batch_no: record.ibsBatchNo ?? record.batch.btmBatchNo ?? null,
      ibs_mfg_batch_no: record.batch.btmMfgBatchNo ?? null,
      ibs_batch_date: this.toIsoStringOrNull(record.batch.btmBatchDate),
      ibs_serial_no: record.ibsSerialNo ?? null,
      ibs_mfg_date: this.toIsoStringOrNull(mfgDate),
      ibs_expiry_date: this.toIsoStringOrNull(expiryDate),
      ibs_mrp: this.toNumber(record.ibsMrp),
      ibs_barcode: record.batch.btmBarcode ?? null,
      ibs_stock_bucket: record.ibsStockBucket,
      ibs_opening_qty: this.toNumber(record.ibsOpeningQty),
      ibs_in_qty: this.toNumber(record.ibsInQty),
      ibs_out_qty: this.toNumber(record.ibsOutQty),
      ibs_closing_qty: closingQty,
      ibs_opening_free_qty: this.toNumber(record.ibsOpeningFreeQty),
      ibs_free_in_qty: this.toNumber(record.ibsFreeInQty),
      ibs_free_out_qty: this.toNumber(record.ibsFreeOutQty),
      ibs_free_closing_qty: freeClosingQty,
      ibs_reserved_qty: reservedQty,
      ibs_available_qty: availableQty,
      book_qty: this.calculateBookQty(closingQty, unitFactor),
      book_base_qty: closingQty,
      book_free_qty: this.calculateBookQty(freeClosingQty, unitFactor),
      book_free_base_qty: freeClosingQty,
      book_reserved_qty: this.calculateBookQty(reservedQty, unitFactor),
      book_reserved_base_qty: reservedQty,
      book_available_qty: this.calculateBookQty(availableQty, unitFactor),
      book_available_base_qty: availableQty,
      ibs_opening_avg_rate: this.toNumber(record.ibsOpeningAvgRate),
      ibs_avg_stock_rate: this.toNumber(record.ibsAvgStockRate),
      ibs_opening_value: this.toNumber(record.ibsOpeningValue),
      ibs_stock_value: this.toNumber(record.ibsStockValue),
      ibs_last_in_date: this.toIsoStringOrNull(record.ibsLastInDate),
      ibs_last_out_date: this.toIsoStringOrNull(record.ibsLastOutDate),
      ibs_is_active: record.ibsIsActive,
      ibs_is_deleted: record.ibsIsDeleted,
      ibs_row_version: record.ibsRowVersion.toString(),
      ibs_created_on: record.ibsCreatedOn.toISOString(),
      ibs_created_by: record.ibsCreatedBy,
      ibs_updated_on: this.toIsoStringOrNull(record.ibsUpdatedOn),
      ibs_updated_by: record.ibsUpdatedBy,
    };
  }
  private async getItemPriceUnitFactors(
    itemId: string,
    unitId: string,
  ): Promise<Map<string, number>> {
    const records = await this.prisma.itemPriceMaster.findMany({
      where: {
        ipmItemId: itemId,
        ipmIsDeleted: false,
        // ipm_unit_id holds an iuc_id, so a caller-supplied unit_id matches
        // through the conversion row rather than the column itself.
        OR: [
          { ipmId: unitId },
          { ipmUcUnitId: unitId },
          { itemUnitConversion: { iucUnitId: unitId } },
        ],
      },
      select: {
        ipmId: true,
        ipmUcUnitId: true,
        itemUnitConversion: { select: { iucUnitId: true, iucUnitFactor: true } },
      },
      orderBy: [{ itemUnitConversion: { iucUnitSlno: 'asc' } }, { ipmId: 'asc' }],
    });

    const factorsByUnitId = new Map<string, number>();
    for (const record of records) {
      const unitFactor = this.toNumber(record.itemUnitConversion.iucUnitFactor);
      if (!factorsByUnitId.has(record.ipmId)) {
        factorsByUnitId.set(record.ipmId, unitFactor);
      }
      if (!factorsByUnitId.has(record.ipmUcUnitId)) {
        factorsByUnitId.set(record.ipmUcUnitId, unitFactor);
      }
      // Batch stock rows are keyed by raw unit_id, so index the factor there too.
      if (!factorsByUnitId.has(record.itemUnitConversion.iucUnitId)) {
        factorsByUnitId.set(record.itemUnitConversion.iucUnitId, unitFactor);
      }
    }
    return factorsByUnitId;
  }
  private getUnitFactorForStockUnit(
    record: ItemBatchStockWithBatchMaster,
    queryDto: GetItemBatchStockQueryDto,
    unitFactorsByUnitId: Map<string, number>,
  ): number {
    const unitFactor =
      unitFactorsByUnitId.get(record.ibsUnitId) ??
      unitFactorsByUnitId.get(queryDto.ibs_unit_id);
    if (unitFactor === undefined) {
      this.throwItemPriceMasterNotFound(record.ibsItemId, record.ibsUnitId);
    }
    return unitFactor;
  }
  private calculateBookQty(baseQty: number, unitFactor: number): number {
    return unitFactor > 0 ? baseQty / unitFactor : 0;
  }
  private toIsoStringOrNull(value: Date | null | undefined): string | null {
    return value ? value.toISOString() : null;
  }
  private toNumber(value: Prisma.Decimal | number): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  private throwItemBatchStockNotFound(queryDto: GetItemBatchStockQueryDto): never {
    const batchMessage = queryDto.ibs_batch_id ? `, batch ${queryDto.ibs_batch_id}` : '';
    throw new NotFoundException(
      this.buildErrorResponse('Item batch stock not found', [
        {
          field: 'scope',
          message:
            `No item batch stock found for acc year ${queryDto.ibs_acc_year}, ` +
            `company ${queryDto.ibs_company_id}, branch ${queryDto.ibs_branch_id}, ` +
            `godown ${queryDto.ibs_godown_id}, item ${queryDto.ibs_item_id}, ` +
            `unit ${queryDto.ibs_unit_id}${batchMessage}`,
        },
      ]),
    );
  }
  private throwItemPriceMasterNotFound(itemId: string, unitId: string): never {
    throw new NotFoundException(
      this.buildErrorResponse('Item price master not found', [
        {
          field: 'ipm_item_id',
          message: `No item price master found for item ${itemId} and unit ${unitId}`,
        },
      ]),
    );
  }
  private buildErrorResponse(
    message: string,
    errors: ItemBatchStockErrorDetail[] = [],
  ): ItemBatchStockErrorResponse {
    return {
      success: false,
      message,
      errors,
    };
  }
}