"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ItemPriceDetailsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const item_unit_conversion_service_1 = require("../item-unit-conversion/item-unit-conversion.service");
let ItemPriceDetailsService = class ItemPriceDetailsService {
    prisma;
    itemUnitConversionService;
    constructor(prisma, itemUnitConversionService) {
        this.prisma = prisma;
        this.itemUnitConversionService = itemUnitConversionService;
    }
    async getByBarcode(barcode) {
        const itemRecord = await this.prisma.itemMaster.findFirst({
            where: {
                itemDefaultBarcode: barcode,
                itemIsDeleted: false,
            },
        });
        if (!itemRecord) {
            (0, module_service_utils_1.throwInventoryNotFound)('Item not found', 'barcode', `No active item found with barcode ${barcode}`);
        }
        return this.getByItemId(itemRecord.itemId);
    }
    async getByItemId(itemId) {
        const itemRecord = await this.prisma.itemMaster.findFirst({
            where: {
                itemId,
                itemIsDeleted: false,
            },
        });
        if (!itemRecord) {
            (0, module_service_utils_1.throwInventoryNotFound)('Item not found', 'item_id', `No active item found with id ${itemId}`);
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
            itemRecord.itemDefaultTaxId
                ? this.prisma.itemTaxMaster.findFirst({
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
    toItemPayload(record) {
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
            item_incl_tax: record.itemInclTax,
            item_is_active: record.itemIsActive,
            item_is_deleted: record.itemIsDeleted,
            item_created_on: record.itemCreatedOn.toISOString(),
            item_created_by: record.itemCreatedBy,
            item_modified_on: record.itemModifiedOn.toISOString(),
            item_modified_by: record.itemModifiedBy,
        };
    }
    toItemPricePayload(record) {
        const conversion = record.itemUnitConversion;
        return {
            ipm_id: record.ipmId,
            ipm_company_id: record.ipmCompanyId,
            ipm_branch_id: record.ipmBranchId,
            ipm_item_id: record.ipmItemId,
            ipm_uc_unit_id: record.ipmUcUnitId,
            ipm_godown_id: record.ipmGodownId,
            ipm_sl_no: record.ipmSlNo,
            ipm_cost_price: (0, module_service_utils_1.toNumber)(record.ipmCostPrice),
            ipm_cost_wot: (0, module_service_utils_1.toNumber)(record.ipmCostWot),
            ipm_sales_price_a: (0, module_service_utils_1.toNumber)(record.ipmSalesPriceA),
            ipm_sales_price_b: (0, module_service_utils_1.toNumber)(record.ipmSalesPriceB),
            ipm_sales_price_c: (0, module_service_utils_1.toNumber)(record.ipmSalesPriceC),
            ipm_sales_price_d: (0, module_service_utils_1.toNumber)(record.ipmSalesPriceD),
            ipm_price_a_wot: (0, module_service_utils_1.toNumber)(record.ipmPriceAWot),
            ipm_price_b_wot: (0, module_service_utils_1.toNumber)(record.ipmPriceBWot),
            ipm_price_c_wot: (0, module_service_utils_1.toNumber)(record.ipmPriceCWot),
            ipm_price_d_wot: (0, module_service_utils_1.toNumber)(record.ipmPriceDWot),
            ipm_price_a_markup_perc: (0, module_service_utils_1.toNumber)(record.ipmPriceAMarkupPerc),
            ipm_price_b_markup_perc: (0, module_service_utils_1.toNumber)(record.ipmPriceBMarkupPerc),
            ipm_price_c_markup_perc: (0, module_service_utils_1.toNumber)(record.ipmPriceCMarkupPerc),
            ipm_price_d_markup_perc: (0, module_service_utils_1.toNumber)(record.ipmPriceDMarkupPerc),
            ipm_max_price: (0, module_service_utils_1.toNumber)(record.ipmMaxPrice),
            ipm_min_price: (0, module_service_utils_1.toNumber)(record.ipmMinPrice),
            ipm_disc_perc: (0, module_service_utils_1.toNumber)(record.ipmDiscPerc),
            ipm_disc_qty: (0, module_service_utils_1.toNumber)(record.ipmDiscQty),
            ipm_addl_cess: (0, module_service_utils_1.toNumber)(record.ipmAddlCess),
            ipm_profit_type: record.ipmProfitType,
            ipm_round_off: (0, module_service_utils_1.toNumber)(record.ipmRoundOff),
            ipm_loading_charge: (0, module_service_utils_1.toNumber)(record.ipmLoadingCharge),
            ipm_freight_charge: (0, module_service_utils_1.toNumber)(record.ipmFreightCharge),
            ipm_loyalty_points: (0, module_service_utils_1.toNumber)(record.ipmLoyaltyPoints),
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
    toItemTaxPayload(record) {
        return {
            tax_id: record.taxId,
            tax_name: record.taxName,
            tax_code: record.taxCode,
            tax_taxability_type: record.taxTaxabilityType,
            tax_is_reverse_charge: record.taxIsReverseCharge,
            tax_cgst_perc: (0, module_service_utils_1.toNumber)(record.taxCgstPerc),
            tax_sgst_perc: (0, module_service_utils_1.toNumber)(record.taxSgstPerc),
            tax_igst_perc: (0, module_service_utils_1.toNumber)(record.taxIgstPerc),
            tax_cgst_pur_perc: (0, module_service_utils_1.toNumber)(record.taxCgstPurPerc),
            tax_sgst_pur_perc: (0, module_service_utils_1.toNumber)(record.taxSgstPurPerc),
            tax_igst_pur_perc: (0, module_service_utils_1.toNumber)(record.taxIgstPurPerc),
            tax_cess_type: record.taxCessType,
            tax_cess_perc: (0, module_service_utils_1.toNumber)(record.taxCessPerc),
            tax_cess_unit: (0, module_service_utils_1.toNumber)(record.taxCessUnit),
            tax_cess_pur_perc: (0, module_service_utils_1.toNumber)(record.taxCessPurPerc),
            tax_cess_pur_unit: (0, module_service_utils_1.toNumber)(record.taxCessPurUnit),
            tax_gst_rate_total: (0, module_service_utils_1.toNumber)(record.taxGstRateTotal),
            tax_sales_ledger_id: record.taxSalesLedgerId,
            tax_sales_return_ledger_id: record.taxSalesReturnLedgerId,
            tax_purchase_ledger_id: record.taxPurchaseLedgerId,
            tax_purchase_return_ledger_id: record.taxPurchaseReturnLedgerId,
            tax_cgst_output_ledger_id: record.taxCgstOutputLedgerId,
            tax_sgst_output_ledger_id: record.taxSgstOutputLedgerId,
            tax_igst_output_ledger_id: record.taxIgstOutputLedgerId,
            tax_cess_output_ledger_id: record.taxCessOutputLedgerId,
            tax_cgst_input_ledger_id: record.taxCgstInputLedgerId,
            tax_sgst_input_ledger_id: record.taxSgstInputLedgerId,
            tax_igst_input_ledger_id: record.taxIgstInputLedgerId,
            tax_cess_input_ledger_id: record.taxCessInputLedgerId,
            tax_is_active: record.taxIsActive,
            tax_is_deleted: record.taxIsDeleted,
            tax_sync_date: record.taxSyncDate ? record.taxSyncDate.toISOString() : null,
            tax_created_on: record.taxCreatedOn.toISOString(),
            tax_created_by: record.taxCreatedBy,
            tax_modified_on: record.taxModifiedOn.toISOString(),
            tax_modified_by: record.taxModifiedBy,
        };
    }
};
exports.ItemPriceDetailsService = ItemPriceDetailsService;
exports.ItemPriceDetailsService = ItemPriceDetailsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        item_unit_conversion_service_1.ItemUnitConversionService])
], ItemPriceDetailsService);
//# sourceMappingURL=item-price-details.service.js.map