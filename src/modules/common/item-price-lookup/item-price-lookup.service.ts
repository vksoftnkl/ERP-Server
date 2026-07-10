import { Injectable } from '@nestjs/common';
import { ItemMaster, ItemPriceMaster } from '@prisma/client';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { throwInventoryNotFound, toNumber } from 'src/common/utils/module-service.utils';
import { ItemPayload } from '../items-master/types/item-api.types';
import { ItemPricePayload } from '../items-price-master/types/item-price-api.types';
import { GetItemPriceLookupQueryDto } from './dto/get-item-price-lookup-query.dto';
import {
  ItemPriceLookupErrorDetail,
  ItemPriceLookupPayload,
} from './types/item-price-lookup-api.types';
@Injectable()
export class ItemPriceLookupService {
  constructor(private readonly prisma: PrismaService) {}
  async getByParams(query: GetItemPriceLookupQueryDto): Promise<ItemPriceLookupPayload> {
    const { item_id, unit_id, branch_id, company_id } = query;
    const itemRecord = await this.prisma.itemMaster.findFirst({
      where: {
        itemId: item_id,
        itemCompanyId: company_id,
        itemBranchId: branch_id,
        itemIsDeleted: false,
      },
    });
    if (!itemRecord) {
      throwInventoryNotFound<ItemPriceLookupErrorDetail>(
        'Item not found',
        'item_id',
        `No active item found for id ${item_id} at branch ${branch_id} / company ${company_id}`,
      );
    }
    const priceRecords = await this.prisma.itemPriceMaster.findMany({
      where: {
        ipmItemId: item_id,
        ipmUnitId: unit_id,
        ipmBranchId: branch_id,
        ipmCompanyId: company_id,
        ipmIsDeleted: false,
      },
      orderBy: [{ ipmUnitSlno: 'asc' }, { ipmId: 'asc' }],
    });
    return {
      item: this.toItemPayload(itemRecord),
      item_prices: priceRecords.map((record) => this.toItemPricePayload(record)),
    };
  }
  private toItemPayload(record: ItemMaster): ItemPayload {
    return {
      item_id: record.itemId,
      item_company_id: record.itemCompanyId,
      item_branch_id: record.itemBranchId,
      item_code: record.itemCode,
      item_sku: record.itemSku,
      item_name_en: record.itemNameEn,
      item_name_ta: record.itemNameTa,
      item_alias: record.itemAlias,
      item_stock_type: record.itemStockType,
      item_default_barcode: record.itemDefaultBarcode,
      item_group_id: record.itemGroupId,
      item_category_id: record.itemCategoryId,
      item_brand_id: record.itemBrandId,
      item_section_id: record.itemSectionId,
      item_company_category_id: record.itemCompanyCategoryId,
      item_mfgr_id: record.itemMfgrId,
      item_supplier_id: record.itemSupplierId,
      item_cust_group: record.itemCustGroup,
      item_base_unit_id: record.itemBaseUnitId,
      item_is_service: record.itemIsService,
      item_is_batch_based: record.itemIsBatchBased,
      item_is_expiry_item: record.itemIsExpiryItem,
      item_expiry_days: record.itemExpiryDays,
      item_intimate_before_days: record.itemIntimateBeforeDays,
      item_allow_sales: record.itemAllowSales,
      item_allow_sales_return: record.itemAllowSalesReturn,
      item_allow_purchase: record.itemAllowPurchase,
      item_allow_po: record.itemAllowPo,
      item_allow_so: record.itemAllowSo,
      item_allow_neg_stock: record.itemAllowNegStock,
      item_allow_negative_so: record.itemAllowNegativeSo,
      item_price_list: record.itemPriceList,
      item_weigh_scale: record.itemWeighScale,
      item_retail_item: record.itemRetailItem,
      item_is_kit: record.itemIsKit,
      item_auto_break: record.itemAutoBreak,
      item_auto_make: record.itemAutoMake,
      item_allow_loyalty: record.itemAllowLoyalty,
      item_allow_promo: record.itemAllowPromo,
      item_has_offer: record.itemHasOffer,
      item_damagable_product: record.itemDamagableProduct,
      item_is_demand: record.itemIsDemand,
      item_allow_loading: record.itemAllowLoading,
      item_allow_freight: record.itemAllowFreight,
      item_random_stock: record.itemRandomStock,
      item_barcode_sticker: record.itemBarcodeSticker,
      item_barcode_sticker_id: record.itemBarcodeStickerId,
      item_default_tax_id: record.itemDefaultTaxId,
      item_hsn_code: record.itemHsnCode,
      item_batch_config: record.itemBatchConfig,
      item_sort_order: record.itemSortOrder,
      item_photo: record.itemPhoto ? Buffer.from(record.itemPhoto).toString('base64') : null,
      item_image_url: record.itemImageUrl,
      item_notes: record.itemNotes,
      item_storage_location: record.itemStorageLocation,
      item_packing_item_ids: record.itemPackingItemIds,
      item_is_active: record.itemIsActive,
      item_is_deleted: record.itemIsDeleted,
      item_created_on: record.itemCreatedOn.toISOString(),
      item_created_by: record.itemCreatedBy,
      item_modified_on: record.itemModifiedOn.toISOString(),
      item_modified_by: record.itemModifiedBy,
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
      ipm_to_base_factor: toNumber(record.ipmToBaseFactor),
      ipm_unit_slno: record.ipmUnitSlno,
      ipm_unit_factor: toNumber(record.ipmUnitFactor),
      ipm_is_default_unit: record.ipmIsDefaultUnit,
      ipm_is_big_unit: record.ipmIsBigUnit,
      ipm_is_base_unit: record.ipmIsBaseUnit,
      ipm_cost_price: toNumber(record.ipmCostPrice),
      ipm_cost_wot: toNumber(record.ipmCostWot),
      ipm_sales_price_a: toNumber(record.ipmSalesPriceA),
      ipm_sales_price_b: toNumber(record.ipmSalesPriceB),
      ipm_sales_price_c: toNumber(record.ipmSalesPriceC),
      ipm_sales_price_d: toNumber(record.ipmSalesPriceD),
      ipm_price_a_wot: toNumber(record.ipmPriceAWot),
      ipm_price_b_wot: toNumber(record.ipmPriceBWot),
      ipm_price_c_wot: toNumber(record.ipmPriceCWot),
      ipm_price_d_wot: toNumber(record.ipmPriceDWot),
      ipm_price_a_markup_perc: toNumber(record.ipmPriceAMarkupPerc),
      ipm_price_b_markup_perc: toNumber(record.ipmPriceBMarkupPerc),
      ipm_price_c_markup_perc: toNumber(record.ipmPriceCMarkupPerc),
      ipm_price_d_markup_perc: toNumber(record.ipmPriceDMarkupPerc),
      ipm_max_price: toNumber(record.ipmMaxPrice),
      ipm_min_price: toNumber(record.ipmMinPrice),
      ipm_disc_perc: toNumber(record.ipmDiscPerc),
      ipm_disc_qty: toNumber(record.ipmDiscQty),
      ipm_addl_cess: toNumber(record.ipmAddlCess),
      ipm_profit_type: record.ipmProfitType,
      ipm_round_off: toNumber(record.ipmRoundOff),
      ipm_loading_charge: toNumber(record.ipmLoadingCharge),
      ipm_freight_charge: toNumber(record.ipmFreightCharge),
      ipm_loyalty_points: toNumber(record.ipmLoyaltyPoints),
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
}
