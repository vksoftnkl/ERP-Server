import { Injectable } from '@nestjs/common';
import { ItemMaster, Prisma, TaxRateMaster } from '@prisma/client';

/** A price row read with the conversion row that owns its unit shape. */
type ItemPriceMasterWithConversion = Prisma.ItemPriceMasterGetPayload<{
  include: { itemUnitConversion: true };
}>;
import { PrismaService } from 'src/database/prisma/prisma.service';
import { ItemPayload } from '../items-master/types/item-api.types';
import { ItemPricePayload } from '../items-price-master/types/item-price-api.types';
import {
  ItemPriceDetailErrorDetail,
  ItemPriceDetailPayload,
  ItemPriceDetailTaxPayload,
} from './types/item-price-detail-api.types';
import { throwInventoryNotFound, toNumber } from 'src/common/utils/module-service.utils';
import { ItemUnitConversionService } from '../item-unit-conversion/item-unit-conversion.service';
@Injectable()
export class ItemPriceDetailsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly itemUnitConversionService: ItemUnitConversionService,
  ) {}
  async getByBarcode(barcode: string): Promise<ItemPriceDetailPayload> {
    const itemRecord = await this.prisma.itemMaster.findFirst({
      where: {
        itemDefaultBarcode: barcode,
        itemIsDeleted: false,
      },
      include: { trackPreset: { select: { sptName: true } } },
    });
    if (!itemRecord) {
      throwInventoryNotFound<ItemPriceDetailErrorDetail>(
        'Item not found',
        'barcode',
        `No active item found with barcode ${barcode}`,
      );
    }
    return this.getByItemId(itemRecord.itemId);
  }
  async getByItemId(itemId: string): Promise<ItemPriceDetailPayload> {
    const itemRecord = await this.prisma.itemMaster.findFirst({
      where: {
        itemId,
        itemIsDeleted: false,
      },
      include: { trackPreset: { select: { sptName: true } } },
    });
    if (!itemRecord) {
      throwInventoryNotFound<ItemPriceDetailErrorDetail>(
        'Item not found',
        'item_id',
        `No active item found with id ${itemId}`,
      );
    }
    const [priceRecords, unitConversions, taxRecord] = await Promise.all([
      this.prisma.itemPriceMaster.findMany({
        where: {
          ipmItemId: itemId,
          ipmIsDeleted: false,
        },
        include: { itemUnitConversion: true },
        orderBy: [{ itemUnitConversion: { iucUnitSlno: 'asc' } }, { ipmId: 'asc' }],
      }),
      this.itemUnitConversionService.findByItemId(itemId),
      // item_default_tax_id points at tax_rate_master since
      // 20260912110000_repoint_items_to_tax_rate_master; item_tax_master is retired.
      itemRecord.itemDefaultTaxId
        ? this.prisma.taxRateMaster.findFirst({
            where: {
              taxId: itemRecord.itemDefaultTaxId,
              taxIsDeleted: false,
            },
          })
        : Promise.resolve(null),
    ]);
    return {
      item: this.toItemPayload(itemRecord),
      item_prices: priceRecords.map((record) => this.toItemPricePayload(record)),
      item_unit_conversions: unitConversions,
      item_tax: taxRecord ? this.toItemTaxPayload(taxRecord) : null,
    };
  }
  private toItemPayload(
    record: ItemMaster & { trackPreset?: { sptName: string } | null },
  ): ItemPayload {
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
      item_track_preset_id: record.itemTrackPresetId,
      item_track_preset_name: record.trackPreset?.sptName ?? null,
      item_sort_order: record.itemSortOrder,
      item_photo: record.itemPhoto ? Buffer.from(record.itemPhoto).toString('base64') : null,
      item_image_url: record.itemImageUrl,
      item_notes: record.itemNotes,
      item_storage_location: record.itemStorageLocation,
      item_packing_item_ids: record.itemPackingItemIds,
      item_incl_tax: record.itemInclTax,
      item_is_active: record.itemIsActive,
      item_is_deleted: record.itemIsDeleted,
      item_created_on: record.itemCreatedOn.toISOString(),
      item_created_by: record.itemCreatedBy,
      item_modified_on: record.itemModifiedOn.toISOString(),
      item_modified_by: record.itemModifiedBy,
    };
  }
  private toItemPricePayload(record: ItemPriceMasterWithConversion): ItemPricePayload {
    return {
      ipm_id: record.ipmId,
      ipm_company_id: record.ipmCompanyId,
      ipm_branch_id: record.ipmBranchId,
      ipm_item_id: record.ipmItemId,
      ipm_uc_unit_id: record.ipmUcUnitId,
      ipm_godown_id: record.ipmGodownId,
      ipm_sl_no: record.ipmSlNo,
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
      ipm_bucket_mrp: record.ipmBucketMrp === null ? null : toNumber(record.ipmBucketMrp),
      ipm_bucket_sp: record.ipmBucketSp === null ? null : toNumber(record.ipmBucketSp),
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
  /**
   * A tax_rate_master row in the old item_tax_master payload's shape — see
   * ItemPriceDetailTaxPayload for what feeds each field. One rate serves sales
   * and purchase alike, so the `_pur_` figures repeat the sales ones, and a rate
   * carries no ledgers, so every `_ledger_id` is null.
   */
  private toItemTaxPayload(record: TaxRateMaster): ItemPriceDetailTaxPayload {
    // The component rates are GENERATED columns, which Prisma reads back as nullable.
    const cgstPerc = toNumber(record.taxCgstPerc ?? 0);
    const sgstPerc = toNumber(record.taxSgstPerc ?? 0);
    const igstPerc = toNumber(record.taxIgstPerc ?? 0);
    const cessPerc = toNumber(record.taxCessPerc);
    const cessUnit = toNumber(record.taxCessPerUnit);
    return {
      tax_id: record.taxId,
      tax_name: record.taxName,
      tax_code: record.taxCode,
      tax_taxability_type: record.taxTaxability,
      tax_is_reverse_charge: record.taxIsReverseCharge,
      tax_cgst_perc: cgstPerc,
      tax_sgst_perc: sgstPerc,
      tax_igst_perc: igstPerc,
      tax_cgst_pur_perc: cgstPerc,
      tax_sgst_pur_perc: sgstPerc,
      tax_igst_pur_perc: igstPerc,
      // NONE | PERCENT | PER_UNIT | BOTH — not the old NONE | PERCENT | UNIT.
      tax_cess_type: record.taxCessBasis,
      tax_cess_perc: cessPerc,
      tax_cess_unit: cessUnit,
      tax_cess_pur_perc: cessPerc,
      tax_cess_pur_unit: cessUnit,
      tax_gst_rate_total: toNumber(record.taxRatePerc),
      tax_sales_ledger_id: null,
      tax_sales_return_ledger_id: null,
      tax_purchase_ledger_id: null,
      tax_purchase_return_ledger_id: null,
      tax_cgst_output_ledger_id: null,
      tax_sgst_output_ledger_id: null,
      tax_igst_output_ledger_id: null,
      tax_cess_output_ledger_id: null,
      tax_cgst_input_ledger_id: null,
      tax_sgst_input_ledger_id: null,
      tax_igst_input_ledger_id: null,
      tax_cess_input_ledger_id: null,
      tax_is_active: record.taxIsActive,
      tax_is_deleted: record.taxIsDeleted,
      tax_sync_date: record.taxSyncDate ? record.taxSyncDate.toISOString() : null,
      tax_created_on: record.taxCreatedOn.toISOString(),
      tax_created_by: record.taxCreatedBy,
      tax_modified_on: record.taxModifiedOn ? record.taxModifiedOn.toISOString() : null,
      tax_modified_by: record.taxModifiedBy,
    };
  }
}
