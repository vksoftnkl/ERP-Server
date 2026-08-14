"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ItemPriceLookup = void 0;
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const master_lookup_constants_1 = require("../master-lookup.constants");
const item_price_utils_1 = require("../utils/item-price.utils");
const loading_charge_utils_1 = require("../utils/loading-charge.utils");
class ItemPriceLookup {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async refreshItemPriceLookup(query) {
        return {
            item_id: query.item_id,
            iuc_id: await this.resolveNextIucId(query.item_id, query.iuc_id),
        };
    }
    async resolveNextIucId(itemId, iucId) {
        const rows = await this.prisma.itemUnitConversion.findMany({
            where: { iucItemId: itemId, iucIsDeleted: false },
            orderBy: [{ iucUnitSlno: 'asc' }, { iucId: 'asc' }],
            select: { iucId: true, iucUnitId: true },
        });
        return (0, item_price_utils_1.nextIucIdInCycle)(rows, iucId);
    }
    async resolveLoadingCharge(query, rate) {
        const loadingType = query.loading_type ?? master_lookup_constants_1.DEFAULT_LOADING_TYPE;
        if (loadingType === 'manual') {
            return {
                loading_charge: null,
                resolved_weight: null,
            };
        }
        if (loadingType === 'item_basis') {
            const charge = (0, module_service_utils_1.toNumber)(rate.ipmLoadingCharge);
            return {
                loading_charge: charge > 0 ? charge : null,
                resolved_weight: null,
            };
        }
        const { company_id, branch_id } = query;
        if (!company_id || !branch_id) {
            (0, module_service_utils_1.throwMasterBadRequest)('Validation failed', [
                {
                    field: company_id ? 'branch_id' : 'company_id',
                    message: "loading_type 'auto' requires both company_id and branch_id",
                },
            ]);
        }
        const weight = (0, loading_charge_utils_1.resolveLoadingWeight)(rate.itemUnitConversion.iucUomWeight);
        if (weight === null) {
            (0, module_service_utils_1.throwMasterBadRequest)('Validation failed', [
                {
                    field: 'item_id',
                    message: `loading_type 'auto' needs a weight: the item's unit conversion carries no UOM weight to match a slab on`,
                },
            ]);
        }
        const slabs = await this.prisma.saleLoadingCharge.findMany({
            where: {
                ilcIsDeleted: false,
                ilcIsActive: true,
                ilcFromWeight: { lte: weight },
                ilcToWeight: { gt: weight },
                AND: [
                    { OR: [{ ilcCompId: company_id }, { ilcCompId: null }] },
                    { OR: [{ ilcBranchId: branch_id }, { ilcBranchId: null }] },
                ],
            },
            select: { ilcId: true, ilcCompId: true, ilcBranchId: true, ilcLoadChrg: true },
            orderBy: { ilcId: 'asc' },
        });
        const slab = (0, loading_charge_utils_1.selectLoadingSlab)(slabs, company_id, branch_id);
        const resolvedWeight = (0, module_service_utils_1.toNumber)(weight);
        if (!slab) {
            return {
                loading_charge: null,
                resolved_weight: resolvedWeight,
            };
        }
        return {
            loading_charge: (0, module_service_utils_1.toNullableNumber)(slab.ilcLoadChrg),
            resolved_weight: resolvedWeight,
        };
    }
    resolveFreightCharge(query, rate) {
        if ((query.freight_type ?? master_lookup_constants_1.DEFAULT_FREIGHT_TYPE) === 'manual') {
            return null;
        }
        const charge = (0, module_service_utils_1.toNumber)(rate.ipmFreightCharge);
        return charge > 0 ? charge : null;
    }
    async getItemPriceLookup(query) {
        const { item_id, unit_id, company_id, branch_id, customer_id, acccyear } = query;
        const priceLevel = query.price_level;
        const regional = query.regional ?? false;
        const [itemRecord, branchPriceRows] = await Promise.all([
            this.prisma.itemMaster.findFirst({
                where: {
                    itemId: item_id,
                    ...(branch_id ? { OR: [{ itemBranchId: branch_id }, { itemBranchId: null }] } : {}),
                    itemIsDeleted: false,
                },
            }),
            this.prisma.itemPriceMaster.findMany({
                where: {
                    ipmItemId: item_id,
                    ...(branch_id ? { OR: [{ ipmBranchId: branch_id }, { ipmBranchId: null }] } : {}),
                    ipmIsDeleted: false,
                },
                include: { itemUnitConversion: { include: { unit: true } } },
                orderBy: [{ itemUnitConversion: { iucUnitSlno: 'asc' } }, { ipmId: 'asc' }],
            }),
        ]);
        const priceRows = (0, item_price_utils_1.preferBranchPriceRows)(branchPriceRows, branch_id);
        if (!itemRecord) {
            (0, module_service_utils_1.throwMasterNotFound)('Item not found', 'item_id', `No active item found for id ${item_id}`);
        }
        const rate = (0, item_price_utils_1.selectUnitRate)(priceRows, itemRecord.itemRetailItem, unit_id);
        if (!rate) {
            (0, module_service_utils_1.throwMasterNotFound)('Item price not found', unit_id ? 'unit_id' : 'item_id', unit_id
                ? `No active price row found for item ${item_id} and unit ${unit_id}`
                : `No active price row configured for item ${item_id}`);
        }
        const godownId = query.godown_id ?? rate.ipmGodownId;
        const unit = rate.itemUnitConversion.unit;
        const rateUnitId = rate.itemUnitConversion.iucUnitId;
        const [godown, tax, company, custRate, reorder, stockSum, loading] = await Promise.all([
            godownId
                ? this.prisma.godownLocation.findFirst({ where: { gdlId: godownId } })
                : Promise.resolve(null),
            itemRecord.itemDefaultTaxId
                ? this.prisma.itemTaxMaster.findFirst({
                    where: { taxId: itemRecord.itemDefaultTaxId, taxIsDeleted: false },
                })
                : Promise.resolve(null),
            company_id
                ? this.prisma.company.findFirst({ where: { compId: company_id } })
                : Promise.resolve(null),
            customer_id
                ? this.prisma.custItemRate.findFirst({
                    where: {
                        csrUnitRateId: rate.ipmId,
                        csrCustomerId: customer_id,
                        csrIsDeleted: false,
                        csrIsActive: true,
                    },
                })
                : Promise.resolve(null),
            this.prisma.itemReorder.findFirst({
                where: { irItemId: item_id, irUcUnitId: rate.ipmUcUnitId, irIsDeleted: false },
            }),
            acccyear
                ? this.prisma.itemStockBalance.aggregate({
                    _sum: { isbClosingQty: true },
                    where: {
                        isbAccYear: acccyear,
                        isbItemId: item_id,
                        isbUnitId: rateUnitId,
                        ...(company_id ? { isbCompanyId: company_id } : {}),
                        ...(branch_id ? { isbBranchId: branch_id } : {}),
                        ...(godownId ? { isbGodownId: godownId } : {}),
                    },
                })
                : Promise.resolve(null),
            this.resolveLoadingCharge(query, rate),
        ]);
        const gstApplicable = company_id ? (company?.compGstApplicable ?? false) : true;
        const basePrice = (0, item_price_utils_1.priceForLevel)(rate, priceLevel);
        const customerDiscQty = custRate && priceLevel >= 1 && priceLevel <= 4 ? (0, module_service_utils_1.toNumber)(custRate.csrDiscQty) : 0;
        const salesPrice = basePrice - customerDiscQty;
        const itemName = regional
            ? (itemRecord.itemNameTa ?? itemRecord.itemNameEn)
            : itemRecord.itemNameEn;
        const stock = stockSum ? (0, module_service_utils_1.toNullableNumber)(stockSum._sum.isbClosingQty ?? 0) : null;
        const reorderQty = reorder ? (0, module_service_utils_1.toNumber)(reorder.irMinLevel) - (stock ?? 0) : null;
        const allowNegativeStock = itemRecord.itemIsService
            ? true
            : !(godown?.gdlNegativeStock === false &&
                company?.compNegStkApl === false &&
                itemRecord.itemAllowNegStock === false);
        return {
            item_id: itemRecord.itemId,
            item_uc_id: rate.itemUnitConversion.iucId,
            godown_id: godownId ?? null,
            godown_name: godown?.gdlName ?? '',
            item_code: itemRecord.itemCode,
            item_name: itemName,
            item_com_code: itemRecord.itemSku,
            barcode: itemRecord.itemDefaultBarcode,
            allow_promo: itemRecord.itemAllowPromo,
            add_freight: itemRecord.itemAllowFreight,
            item_group_id: itemRecord.itemGroupId,
            item_category_id: itemRecord.itemCategoryId,
            item_brand_id: itemRecord.itemBrandId,
            item_section_id: itemRecord.itemSectionId,
            weigh_scale: itemRecord.itemWeighScale,
            batch_config: itemRecord.itemBatchConfig,
            service_item: itemRecord.itemIsService ? 'Y' : 'N',
            allow_negative_stock: allowNegativeStock,
            price_level: priceLevel,
            sales_price: salesPrice,
            cost_price: (0, module_service_utils_1.toNumber)(rate.ipmCostPrice),
            cost_wot: (0, module_service_utils_1.toNumber)(rate.ipmCostWot),
            min_price: (0, module_service_utils_1.toNumber)(rate.ipmMinPrice),
            max_price: (0, module_service_utils_1.toNumber)(rate.ipmMaxPrice),
            disc_perc: (0, module_service_utils_1.toNumber)(rate.ipmDiscPerc),
            disc_qty: (0, module_service_utils_1.toNumber)(rate.ipmDiscQty),
            sch_discount: null,
            addl_cess: (0, module_service_utils_1.toNumber)(rate.ipmAddlCess),
            unit_name: unit?.unit_name ?? null,
            base_unit_id: rate.itemUnitConversion.iucBaseUnitId,
            base_factor: (0, module_service_utils_1.toNumber)(rate.itemUnitConversion.iucToBaseFactor),
            iuc_uom_weight: (0, module_service_utils_1.toNumber)(rate.itemUnitConversion.iucUomWeight),
            decimal_count: unit?.unit_decimal_count ?? 0,
            ...loading,
            freight_charge: this.resolveFreightCharge(query, rate),
            loyalty_pv: itemRecord.itemAllowLoyalty ? (0, module_service_utils_1.toNumber)(rate.ipmLoyaltyPoints) : 0,
            stock,
            reorder_qty: reorderQty,
            item_incl_tax: itemRecord.itemInclTax,
            gst_rate: gstApplicable && tax ? (0, module_service_utils_1.toNumber)(tax.taxGstRateTotal) : 0,
            cess_perc: gstApplicable && tax ? (0, module_service_utils_1.toNumber)(tax.taxCessPerc) : 0,
            cess_unit: gstApplicable && tax ? (0, module_service_utils_1.toNumber)(tax.taxCessUnit) : 0,
            sgst_perc: gstApplicable && tax ? (0, module_service_utils_1.toNumber)(tax.taxSgstPerc) : 0,
            cgst_perc: gstApplicable && tax ? (0, module_service_utils_1.toNumber)(tax.taxCgstPerc) : 0,
            igst_perc: gstApplicable && tax ? (0, module_service_utils_1.toNumber)(tax.taxIgstPerc) : 0,
            sales_ledger_id: tax?.taxSalesLedgerId ?? null,
            sgst_output_ledger_id: tax?.taxSgstOutputLedgerId ?? null,
            cgst_output_ledger_id: tax?.taxCgstOutputLedgerId ?? null,
            igst_output_ledger_id: tax?.taxIgstOutputLedgerId ?? null,
            cess_output_ledger_id: tax?.taxCessOutputLedgerId ?? null,
        };
    }
}
exports.ItemPriceLookup = ItemPriceLookup;
//# sourceMappingURL=item-price.lookup.js.map