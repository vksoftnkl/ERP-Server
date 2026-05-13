import { Injectable, NotFoundException } from '@nestjs/common';
import { ItemPriceMaster, ItemStockBalance, Prisma } from '@prisma/client';
import { PrismaService } from 'src/database/prisma/prisma.service';
import type { ItemPricePayload } from 'src/modules/Inventory/items-price-master/types/item-price-api.types';
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
    const unitFactorsByUnitId = await this.getItemPriceUnitFactors(
      queryDto.isb_item_id,
      queryDto.isb_unit_id,
    );
    const stockUnitIds = Array.from(
      new Set([queryDto.isb_unit_id, ...unitFactorsByUnitId.keys()]),
    );
    const where: Prisma.ItemStockBalanceWhereInput = {
      isbAccYear: queryDto.isb_acc_year,
      isbCompanyId: queryDto.isb_company_id,
      isbBranchId: queryDto.isb_branch_id,
      isbGodownId: queryDto.isb_godown_id,
      isbItemId: queryDto.isb_item_id,
      isbUnitId: { in: stockUnitIds },
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
    if (unitFactorsByUnitId.size === 0) {
      this.throwItemPriceMasterNotFound(queryDto.isb_item_id, queryDto.isb_unit_id);
    }
    return records.map((record) =>
      this.toPayload(record, this.getUnitFactorForStockUnit(record, queryDto, unitFactorsByUnitId)),
    );
  }
  async getPriceMasterByItemAndUnit(
    itemId: string,
    unitId: string,
  ): Promise<ItemPricePayload[]> {
    const records = await this.prisma.itemPriceMaster.findMany({
      where: {
        ipmItemId: itemId,
        ipmIsDeleted: false,
        OR: [{ ipmId: unitId }, { ipmUnitId: unitId }],
      },
      orderBy: [{ ipmUnitSlno: 'asc' }, { ipmId: 'asc' }],
    });
    if (records.length === 0) {
      this.throwItemPriceMasterNotFound(itemId, unitId);
    }
    return records.map((record) => this.toItemPricePayload(record));
  }
  private toPayload(record: ItemStockBalance, unitFactor = 1): ItemStockBalancePayload {
    const closingQty = this.toNumber(record.isbClosingQty);
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
      isb_closing_qty: closingQty,
      isb_opening_free_qty: this.toNumber(record.isbOpeningFreeQty),
      isb_free_in_qty: this.toNumber(record.isbFreeInQty),
      isb_free_out_qty: this.toNumber(record.isbFreeOutQty),
      isb_free_closing_qty: this.toNumber(record.isbFreeClosingQty),
      isb_reserved_qty: this.toNumber(record.isbReservedQty),
      isb_transit_qty: this.toNumber(record.isbTransitQty),
      isb_available_qty: this.toNumber(record.isbAvailableQty),
      book_qty: this.calculateBookQty(closingQty, unitFactor),
      book_base_qty: closingQty,
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
  private toItemPricePayload(record: ItemPriceMaster): ItemPricePayload {
    return {
      ipm_id: record.ipmId,
      ipm_company_id: record.ipmCompanyId,
      ipm_branch_id: record.ipmBranchId,
      ipm_item_id: record.ipmItemId,
      ipm_unit_id: record.ipmUnitId,
      ipm_godown_id: record.ipmGodownId,
      ipm_base_unit_id: record.ipmBaseUnitId,
      ipm_to_base_factor: this.toNumber(record.ipmToBaseFactor),
      ipm_unit_slno: record.ipmUnitSlno,
      ipm_unit_factor: this.toNumber(record.ipmUnitFactor),
      ipm_is_default_unit: record.ipmIsDefaultUnit,
      ipm_is_big_unit: record.ipmIsBigUnit,
      ipm_is_base_unit: record.ipmIsBaseUnit,
      ipm_cost_price: this.toNumber(record.ipmCostPrice),
      ipm_cost_wot: this.toNumber(record.ipmCostWot),
      ipm_sales_price_a: this.toNumber(record.ipmSalesPriceA),
      ipm_sales_price_b: this.toNumber(record.ipmSalesPriceB),
      ipm_sales_price_c: this.toNumber(record.ipmSalesPriceC),
      ipm_sales_price_d: this.toNumber(record.ipmSalesPriceD),
      ipm_price_a_wot: this.toNumber(record.ipmPriceAWot),
      ipm_price_b_wot: this.toNumber(record.ipmPriceBWot),
      ipm_price_c_wot: this.toNumber(record.ipmPriceCWot),
      ipm_price_d_wot: this.toNumber(record.ipmPriceDWot),
      ipm_price_a_markup_perc: this.toNumber(record.ipmPriceAMarkupPerc),
      ipm_price_b_markup_perc: this.toNumber(record.ipmPriceBMarkupPerc),
      ipm_price_c_markup_perc: this.toNumber(record.ipmPriceCMarkupPerc),
      ipm_price_d_markup_perc: this.toNumber(record.ipmPriceDMarkupPerc),
      ipm_max_price: this.toNumber(record.ipmMaxPrice),
      ipm_min_price: this.toNumber(record.ipmMinPrice),
      ipm_disc_perc: this.toNumber(record.ipmDiscPerc),
      ipm_disc_qty: this.toNumber(record.ipmDiscQty),
      ipm_addl_cess: this.toNumber(record.ipmAddlCess),
      ipm_profit_type: record.ipmProfitType,
      ipm_round_off: this.toNumber(record.ipmRoundOff),
      ipm_loading_charge: this.toNumber(record.ipmLoadingCharge),
      ipm_freight_charge: this.toNumber(record.ipmFreightCharge),
      ipm_loyalty_points: this.toNumber(record.ipmLoyaltyPoints),
      ipm_uom_remarks: record.ipmUomRemarks,
      ipm_cost_remarks: record.ipmCostRemarks,
      ipm_is_active: record.ipmIsActive,
      ipm_is_deleted: record.ipmIsDeleted,
      ipm_sync_date: record.ipmSyncDate ? record.ipmSyncDate.toISOString() : null,
      ipm_created_on: record.ipmCreatedOn.toISOString(),
      ipm_created_by: record.ipmCreatedBy,
      ipm_updated_on: record.ipmUpdatedOn ? record.ipmUpdatedOn.toISOString() : null,
      ipm_updated_by: record.ipmUpdatedBy,
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
        OR: [{ ipmId: unitId }, { ipmUnitId: unitId }],
      },
      select: {
        ipmId: true,
        ipmUnitId: true,
        ipmUnitFactor: true,
      },
      orderBy: [{ ipmUnitSlno: 'asc' }, { ipmId: 'asc' }],
    });
    const factorsByUnitId = new Map<string, number>();
    for (const record of records) {
      const unitFactor = this.toNumber(record.ipmUnitFactor);
      if (!factorsByUnitId.has(record.ipmId)) {
        factorsByUnitId.set(record.ipmId, unitFactor);
      }
      if (!factorsByUnitId.has(record.ipmUnitId)) {
        factorsByUnitId.set(record.ipmUnitId, unitFactor);
      }
    }
    return factorsByUnitId;
  }
  private getUnitFactorForStockUnit(
    record: ItemStockBalance,
    queryDto: GetItemStockBalanceQueryDto,
    unitFactorsByUnitId: Map<string, number>,
  ): number {
    const unitFactor =
      unitFactorsByUnitId.get(record.isbUnitId) ??
      unitFactorsByUnitId.get(queryDto.isb_unit_id);
    if (unitFactor === undefined) {
      this.throwItemPriceMasterNotFound(record.isbItemId, record.isbUnitId);
    }
    return unitFactor;
  }
  private calculateBookQty(closingQty: number, unitFactor: number): number {
    return unitFactor > 0 ? closingQty / unitFactor : 0;
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
    errors: ItemStockBalanceErrorDetail[] = [],
  ): ItemStockBalanceErrorResponse {
    return {
      success: false,
      message,
      errors,
    };
  }
}
