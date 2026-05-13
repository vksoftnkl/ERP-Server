import { Injectable, NotFoundException } from '@nestjs/common';
import { ItemStockBalance, Prisma } from '@prisma/client';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { GetItemStockBalanceQueryDto } from './dto/get-item-stock-balance-query.dto';
import {
  ItemStockBalanceErrorDetail,
  ItemStockBalanceErrorResponse,
  ItemStockBalancePayload,
} from './types/item-stock-balance-api.types';
@Injectable()
export class ItemStockBalanceService {
  constructor(private readonly prisma: PrismaService) {}
  async getByScope(
    queryDto: GetItemStockBalanceQueryDto,
  ): Promise<ItemStockBalancePayload[]> {
    const where: Prisma.ItemStockBalanceWhereInput = {
      isbAccYear: queryDto.isb_acc_year,
      isbCompanyId: queryDto.isb_company_id,
      isbBranchId: queryDto.isb_branch_id,
      isbGodownId: queryDto.isb_godown_id,
      isbItemId: queryDto.isb_item_id,
      isbUnitId: queryDto.isb_unit_id,
    };
    if (queryDto.isb_stock_bucket) {
      where.isbStockBucket = queryDto.isb_stock_bucket;
    }
    const records = await this.prisma.itemStockBalance.findMany({
      where,
      orderBy: [{ isbStockBucket: 'asc' }, { isbId: 'asc' }],
    });
    if (records.length === 0) {
      this.throwItemStockBalanceNotFound(queryDto);
    }
    return records.map((record) => this.toPayload(record));
  }
  private toPayload(record: ItemStockBalance): ItemStockBalancePayload {
    return {
      isb_id: record.isbId,
      isb_acc_year: record.isbAccYear,
      isb_company_id: record.isbCompanyId,
      isb_branch_id: record.isbBranchId,
      isb_godown_id: record.isbGodownId,
      isb_item_id: record.isbItemId,
      isb_unit_id: record.isbUnitId,
      isb_tracking_type: record.isbTrackingType,
      isb_stock_bucket: record.isbStockBucket,
      isb_opening_qty: this.toNumber(record.isbOpeningQty),
      isb_in_qty: this.toNumber(record.isbInQty),
      isb_out_qty: this.toNumber(record.isbOutQty),
      isb_closing_qty: this.toNumber(record.isbClosingQty),
      isb_opening_free_qty: this.toNumber(record.isbOpeningFreeQty),
      isb_free_in_qty: this.toNumber(record.isbFreeInQty),
      isb_free_out_qty: this.toNumber(record.isbFreeOutQty),
      isb_free_closing_qty: this.toNumber(record.isbFreeClosingQty),
      isb_reserved_qty: this.toNumber(record.isbReservedQty),
      isb_transit_qty: this.toNumber(record.isbTransitQty),
      isb_available_qty: this.toNumber(record.isbAvailableQty),
      isb_opening_avg_rate: this.toNumber(record.isbOpeningAvgRate),
      isb_avg_stock_rate: this.toNumber(record.isbAvgStockRate),
      isb_opening_value: this.toNumber(record.isbOpeningValue),
      isb_stock_value: this.toNumber(record.isbStockValue),
      isb_opening_avg_rate_wot: this.toNumber(record.isbOpeningAvgRateWot),
      isb_avg_stock_rate_wot: this.toNumber(record.isbAvgStockRateWot),
      isb_opening_value_wot: this.toNumber(record.isbOpeningValueWot),
      isb_stock_value_wot: this.toNumber(record.isbStockValueWot),
      isb_last_in_date: record.isbLastInDate ? record.isbLastInDate.toISOString() : null,
      isb_last_out_date: record.isbLastOutDate ? record.isbLastOutDate.toISOString() : null,
      isb_sync_date: record.isbSyncDate ? record.isbSyncDate.toISOString() : null,
      isb_created_on: record.isbCreatedOn.toISOString(),
      isb_created_by: record.isbCreatedBy,
      isb_updated_on: record.isbUpdatedOn ? record.isbUpdatedOn.toISOString() : null,
      isb_updated_by: record.isbUpdatedBy,
    };
  }
  private toNumber(value: Prisma.Decimal | number): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  private throwItemStockBalanceNotFound(queryDto: GetItemStockBalanceQueryDto): never {
    throw new NotFoundException(
      this.buildErrorResponse('Item stock balance not found', [
        {
          field: 'scope',
          message:
            `No item stock balance found for acc year ${queryDto.isb_acc_year}, ` +
            `company ${queryDto.isb_company_id}, branch ${queryDto.isb_branch_id}, ` +
            `godown ${queryDto.isb_godown_id}, item ${queryDto.isb_item_id}, ` +
            `unit ${queryDto.isb_unit_id}`,
        },
      ]),
    );
  }
  private buildErrorResponse(
    message: string,
    errors: ItemStockBalanceErrorDetail[] = [],
  ): ItemStockBalanceErrorResponse {
    return {
      success: false,
      message,
      errors,
    };
  }
}