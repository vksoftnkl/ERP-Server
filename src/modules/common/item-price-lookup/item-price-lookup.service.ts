import { Injectable } from '@nestjs/common';
import { ItemMaster, ItemPriceMaster, ItemQtywiseRate } from '@prisma/client';
import { PrismaService } from 'src/database/prisma/prisma.service';
import {
  throwInventoryNotFound,
  toNullableNumber,
  toNumber,
} from 'src/common/utils/module-service.utils';
import { GetItemPriceLookupQueryDto } from './dto/get-item-price-lookup-query.dto';
import {
  ItemPriceLookupErrorDetail,
  ItemPriceLookupPayload,
  ItemPriceLookupQtyWiseRate,
} from './types/item-price-lookup-api.types';

@Injectable()
export class ItemPriceLookupService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Port of the legacy PL/pgSQL `getItemForSale` cursor onto the current UUID
   * schema. It resolves one item + one unit rate into a single flat row: the
   * effective price for the requested price level, the tax block, stock,
   * reorder level, negative-stock rule and the quantity-wise rate list.
   *
   * Schema divergences from the legacy query:
   *  - customer rates / qty-wise rates now hang off the pricing hub
   *    `item_price_master` (ipm_id) instead of (item_id, unit_id).
   *  - price level is A–D here (legacy 1–4); max/min/cost levels (5–7) are not
   *    selectable, only surfaced inside `json_qws`.
   *  - the item-group price-level scheme discount has no column → `sch_discount`
   *    is always null.
   */
  async getByParams(query: GetItemPriceLookupQueryDto): Promise<ItemPriceLookupPayload> {
    const { item_id, unit_id, company_id, branch_id, customer_id, acccyear } = query;
    const priceLevel = (query.price_level ?? 'A').toUpperCase();

    // 1. Item + candidate unit-rate rows (legacy: item_master ⋈ item_unit_rates).
    const [itemRecord, priceRows] = await Promise.all([
      this.prisma.itemMaster.findFirst({
        where: {
          itemId: item_id,
          itemCompanyId: company_id,
          itemBranchId: branch_id,
          itemIsDeleted: false,
        },
      }),
      this.prisma.itemPriceMaster.findMany({
        where: {
          ipmItemId: item_id,
          ipmCompanyId: company_id,
          ipmBranchId: branch_id,
          ipmIsDeleted: false,
        },
        orderBy: [{ ipmUnitSlno: 'asc' }],
      }),
    ]);
    if (!itemRecord) {
      throwInventoryNotFound<ItemPriceLookupErrorDetail>(
        'Item not found',
        'item_id',
        `No active item found for id ${item_id}`,
      );
    }

    // 2. Pick the unit rate (legacy unit_slno CASE: explicit unit, else max
    //    slno for retail items / slno 0 otherwise).
    const rate = this.selectUnitRate(priceRows, itemRecord, unit_id);
    if (!rate) {
      throwInventoryNotFound<ItemPriceLookupErrorDetail>(
        'Item price not found',
        unit_id ? 'unit_id' : 'item_id',
        unit_id
          ? `No active price row found for item ${item_id} and unit ${unit_id}`
          : `No active price row configured for item ${item_id}`,
      );
    }

    // 3. Everything that hangs off the chosen item / rate (legacy lateral joins).
    const [godown, unit, tax, company, custRate, qtyRates, reorder, stockSum] = await Promise.all([
      this.prisma.godownLocation.findFirst({ where: { gdlId: rate.ipmGodownId } }),
      this.prisma.unit.findFirst({ where: { unit_id: rate.ipmUnitId } }),
      itemRecord.itemDefaultTaxId
        ? this.prisma.itemTaxMaster.findFirst({
            where: { taxId: itemRecord.itemDefaultTaxId, taxIsDeleted: false },
          })
        : Promise.resolve(null),
      this.prisma.company.findFirst({ where: { compId: company_id } }),
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
      this.prisma.itemQtywiseRate.findMany({
        where: { iqrUnitRateId: rate.ipmId, iqrIsDeleted: false, iqrIsActive: true },
      }),
      this.prisma.itemReorder.findFirst({
        where: { irItemId: item_id, irUnitId: rate.ipmUnitId, irIsDeleted: false },
      }),
      acccyear
        ? this.prisma.itemStockBalance.aggregate({
            _sum: { isbClosingQty: true },
            where: {
              isbAccYear: acccyear,
              isbItemId: item_id,
              isbUnitId: rate.ipmUnitId,
              isbCompanyId: company_id,
              isbBranchId: branch_id,
              isbGodownId: rate.ipmGodownId,
            },
          })
        : Promise.resolve(null),
    ]);

    // 4. Derived values.
    const gstApplicable = company?.compGstApplicable ?? false;
    const basePrice = this.priceForLevel(rate, priceLevel);
    const customerDiscQty = custRate ? toNumber(custRate.csrDiscQty) : 0;
    const salesPrice = basePrice - customerDiscQty;

    const stock = stockSum ? toNullableNumber(stockSum._sum.isbClosingQty ?? 0) : null;
    const reorderQty = reorder ? toNumber(reorder.irMinLevel) - (stock ?? 0) : null;

    // Legacy allow_negative_stock: service items always allow; otherwise it is
    // blocked only when godown, company and item all disallow it.
    const allowNegativeStock = itemRecord.itemIsService
      ? true
      : !(
          godown?.gdlNegativeStock === false &&
          company?.compNegStkApl === false &&
          itemRecord.itemAllowNegStock === false
        );

    return {
      item_id: itemRecord.itemId,
      unit_id: rate.ipmUnitId,
      unit_rate_id: rate.ipmId,
      godown_id: rate.ipmGodownId,
      godown_name: godown?.gdlName ?? '',

      item_code: itemRecord.itemCode,
      item_name: itemRecord.itemNameEn,
      item_com_code: itemRecord.itemSku,
      barcode: itemRecord.itemDefaultBarcode,

      allow_promo: itemRecord.itemAllowPromo,
      add_freight: itemRecord.itemAllowFreight,
      item_group_id: itemRecord.itemGroupId,
      item_category_id: itemRecord.itemCategoryId,
      weigh_scale: itemRecord.itemWeighScale,
      batch_config: itemRecord.itemBatchConfig,
      service_item: itemRecord.itemIsService ? 'Y' : 'N',
      allow_negative_stock: allowNegativeStock,

      price_level: priceLevel,
      sales_price: salesPrice,
      cost_price: toNumber(rate.ipmCostPrice),
      cost_wot: toNumber(rate.ipmCostWot),
      min_price: toNumber(rate.ipmMinPrice),
      max_price: toNumber(rate.ipmMaxPrice),
      disc_perc: toNumber(rate.ipmDiscPerc),
      disc_qty: toNumber(rate.ipmDiscQty),
      sch_discount: null,
      addl_cess: toNumber(rate.ipmAddlCess),

      unit_desc: unit?.unit_description ?? null,
      unit_weight: toNullableNumber(unit?.unit_weight ?? null) ?? 0,
      unit_loading: itemRecord.itemAllowLoading
        ? (toNullableNumber(unit?.unit_loading ?? null) ?? 0)
        : 0,
      decimal_count: unit?.unit_decimal_count ?? 0,

      loyalty_pv: itemRecord.itemAllowLoyalty ? toNumber(rate.ipmLoyaltyPoints) : 0,

      stock,
      reorder_qty: reorderQty,

      gst_rate: gstApplicable && tax ? toNumber(tax.taxGstRateTotal) : 0,
      cess_perc: gstApplicable && tax ? toNumber(tax.taxCessPerc) : 0,
      cess_unit: gstApplicable && tax ? toNumber(tax.taxCessUnit) : 0,
      sgst_perc: gstApplicable && tax ? toNumber(tax.taxSgstPerc) : 0,
      cgst_perc: gstApplicable && tax ? toNumber(tax.taxCgstPerc) : 0,
      igst_perc: gstApplicable && tax ? toNumber(tax.taxIgstPerc) : 0,
      sales_ledger_id: tax?.taxSalesLedgerId ?? null,
      sgst_output_ledger_id: tax?.taxSgstOutputLedgerId ?? null,
      cgst_output_ledger_id: tax?.taxCgstOutputLedgerId ?? null,
      igst_output_ledger_id: tax?.taxIgstOutputLedgerId ?? null,
      cess_output_ledger_id: tax?.taxCessOutputLedgerId ?? null,

      json_qws: this.buildQtyWiseRates(rate, qtyRates),
    };
  }

  /**
   * Legacy unit_slno selection: an explicit unit wins; otherwise retail items
   * take the highest slno row and non-retail items take slno 0. Falls back to
   * the default unit / first row so a data quirk still returns a rate.
   */
  private selectUnitRate(
    priceRows: ItemPriceMaster[],
    item: ItemMaster,
    unitId?: string,
  ): ItemPriceMaster | null {
    if (priceRows.length === 0) return null;
    if (unitId) {
      return priceRows.find((row) => row.ipmUnitId === unitId) ?? null;
    }
    if (item.itemRetailItem) {
      return priceRows.reduce((best, row) => (row.ipmUnitSlno > best.ipmUnitSlno ? row : best));
    }
    return (
      priceRows.find((row) => row.ipmUnitSlno === 0) ??
      priceRows.find((row) => row.ipmIsDefaultUnit) ??
      priceRows[0]
    );
  }

  /** Legacy price-level CASE (A–D → sales_price_a..d). */
  private priceForLevel(rate: ItemPriceMaster, priceLevel: string): number {
    switch (priceLevel) {
      case 'B':
        return toNumber(rate.ipmSalesPriceB);
      case 'C':
        return toNumber(rate.ipmSalesPriceC);
      case 'D':
        return toNumber(rate.ipmSalesPriceD);
      case 'A':
      default:
        return toNumber(rate.ipmSalesPriceA);
    }
  }

  /**
   * Legacy `json_qws`: the base unit-rate's seven price levels (1..7 →
   * a/b/c/d/max/min/cost) unioned with the configured quantity slabs, ordered
   * by price level then start qty.
   */
  private buildQtyWiseRates(
    rate: ItemPriceMaster,
    qtyRates: ItemQtywiseRate[],
  ): ItemPriceLookupQtyWiseRate[] {
    const baseLevels: ItemPriceLookupQtyWiseRate[] = [
      { price_level: 1, start_qty: 0, sales_price: toNumber(rate.ipmSalesPriceA), disc_perc: 0, disc_qty: 0 },
      { price_level: 2, start_qty: 0, sales_price: toNumber(rate.ipmSalesPriceB), disc_perc: 0, disc_qty: 0 },
      { price_level: 3, start_qty: 0, sales_price: toNumber(rate.ipmSalesPriceC), disc_perc: 0, disc_qty: 0 },
      { price_level: 4, start_qty: 0, sales_price: toNumber(rate.ipmSalesPriceD), disc_perc: 0, disc_qty: 0 },
      { price_level: 5, start_qty: 0, sales_price: toNumber(rate.ipmMaxPrice), disc_perc: 0, disc_qty: 0 },
      { price_level: 6, start_qty: 0, sales_price: toNumber(rate.ipmMinPrice), disc_perc: 0, disc_qty: 0 },
      { price_level: 7, start_qty: 0, sales_price: toNumber(rate.ipmCostPrice), disc_perc: 0, disc_qty: 0 },
    ];
    const slabs: ItemPriceLookupQtyWiseRate[] = qtyRates.map((slab) => ({
      price_level: slab.iqrPriceLevel,
      start_qty: toNumber(slab.iqrStartQty),
      sales_price: toNumber(slab.iqrSalesPrice),
      disc_perc: toNumber(slab.iqrDiscPerc),
      disc_qty: toNumber(slab.iqrDiscQty),
    }));
    return [...slabs, ...baseLevels].sort(
      (a, b) => a.price_level - b.price_level || a.start_qty - b.start_qty,
    );
  }
}
