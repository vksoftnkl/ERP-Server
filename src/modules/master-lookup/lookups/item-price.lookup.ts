import {
  MasterErrorDetail,
  throwMasterBadRequest,
  throwMasterNotFound,
  toNullableNumber,
  toNumber,
} from '../../../common/utils/module-service.utils';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { ItemPriceLookupQueryDto } from '../dto/item-price-lookup-query.dto';
import { ItemPriceRefreshQueryDto } from '../dto/item-price-refresh-query.dto';
import { DEFAULT_LOADING_QTY, DEFAULT_LOADING_TYPE } from '../master-lookup.constants';
import { ItemPriceLookupPayload } from '../types/master-lookup-api.types';
import { PriceRowWithUnit } from '../types/master-lookup-internal.types';
import {
  nextUnitIdInCycle,
  preferBranchPriceRows,
  priceForLevel,
  selectUnitRate,
} from '../utils/item-price.utils';
import { resolveLoadingWeight, selectLoadingSlab } from '../utils/loading-charge.utils';

/** The loading-charge block of the payload, resolved as one unit. */
type LoadingChargeResolution = Pick<
  ItemPriceLookupPayload,
  | 'loading_charge'
  | 'loading_charge_source'
  | 'loading_charge_editable'
  | 'loading_slab_id'
  | 'resolved_weight'
>;

/**
 * Port of the legacy PL/pgSQL `getItemForSale` cursor onto the current UUID
 * schema. It resolves one item + one unit rate into a single flat row: the
 * effective price for the requested price level, the tax block, stock,
 * reorder level, negative-stock rule and the quantity-wise rate list.
 *
 * Legacy workflow faithfully reproduced here:
 *  - unit-rate pick (legacy `ivoucher_no` / `unit_slno`): an explicit unit_id
 *    wins; otherwise the unit-slno rule applies — a retail item takes the
 *    highest slno row, a non-retail item takes the base row (slno 0).
 *  - godown (legacy `isale_no`): an explicit godown_id overrides the rate's
 *    own godown for both the godown row and the stock scope.
 *  - stock: scoped to the resolved godown; a godown-less price row sums
 *    across all godowns since there is nothing to scope it to.
 *  - customer rate (legacy `CSR.csr_disc_qty`): the customer discount is
 *    subtracted ONLY from the A/B/C/D sales prices (levels 1–4), never from
 *    max/min/cost (levels 5/6/7).
 *  - name (legacy `iregional`): regional=true returns item_name_ta, else the
 *    English name.
 *
 * Schema divergences from the legacy query:
 *  - customer rates / qty-wise rates now hang off the pricing hub
 *    `item_price_master` (ipm_id) instead of (item_id, unit_id).
 *  - price level is the legacy 1–7 scheme: 1=A, 2=B, 3=C, 4=D, 5=MRP/max,
 *    6=min, 7=cost — any of the seven columns is selectable.
 *  - the item-group price-level scheme discount has no column → `sch_discount`
 *    is always null.
 */
/**
 * Price level the unit-cycling refresh reads at. It does not take a level of
 * its own, so it uses A — the same default the plain lookup documents.
 */
const REFRESH_PRICE_LEVEL = 1;

export class ItemPriceLookup {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * "Cycle unit" on an entry screen: step from the unit the caller currently has
   * selected to the next one the item is configured for, then return the plain
   * item-price lookup for it. The payload is the lookup's own — every price,
   * tax and unit field therefore belongs to the resolved unit, not the
   * requested one.
   *
   * The refresh takes only the item and the unit, so the lookup runs unscoped:
   * no company (GST applies), no branch (rates resolve across all of them), no
   * customer rate, no godown override and no accounting year (stock is null),
   * at price level A.
   */
  async refreshItemPriceLookup(query: ItemPriceRefreshQueryDto): Promise<ItemPriceLookupPayload> {
    const unit_id = await this.resolveNextUnitId(query.item_id, query.unit_id);
    return this.getItemPriceLookup({
      item_id: query.item_id,
      unit_id,
      price_level: REFRESH_PRICE_LEVEL,
    });
  }

  /**
   * The unit one step along the item's conversion list from `unitId`.
   *
   * The order has to be stable or the cycle would visit units differently on
   * each call: to-base factor ascending puts the base unit first and the packs
   * above it, with the conversion PK breaking ties.
   *
   * item_unit_conversion is keyed by item alone — it carries no company or
   * branch column — so the cycle is not scoped further; the caller's company /
   * branch still scope the price row the lookup then resolves.
   */
  private async resolveNextUnitId(itemId: string, unitId: string): Promise<string> {
    const rows = await this.prisma.itemUnitConversion.findMany({
      where: { iucItemId: itemId, iucIsDeleted: false },
      orderBy: [{ iucToBaseFactor: 'asc' }, { iucId: 'asc' }],
      select: { iucId: true, iucUnitId: true },
    });
    return nextUnitIdInCycle(rows, unitId);
  }

  /**
   * Resolves the loading charge the voucher line should carry, server-side.
   *
   * The three modes return the same five keys — a screen reads one shape and
   * decides nothing itself; `loading_charge_editable` alone tells it whether to
   * unlock the field. A null charge always means "nothing resolved", never
   * "zero": `AUTO_NO_SLAB` (no slab covers the weight) and an unset master
   * value are both null, so a real 0 charge configured on a slab stays 0.
   *
   *  - `manual`     resolves nothing and touches no table.
   *  - `item_basis` reads item_price_master.ipm_loading_charge off the rate row
   *    already selected. The column is NOT NULL DEFAULT 0, so "not configured"
   *    is indistinguishable from a stored 0 — 0 is reported as null.
   *  - `auto` matches a sale_loading_charges weight slab. Both scope columns
   *    are required here even though they are optional on the lookup itself:
   *    an unscoped slab match would be a cross-tenant read.
   */
  private async resolveLoadingCharge(
    query: ItemPriceLookupQueryDto,
    rate: PriceRowWithUnit,
  ): Promise<LoadingChargeResolution> {
    const loadingType = query.loading_type ?? DEFAULT_LOADING_TYPE;
    if (loadingType === 'manual') {
      return {
        loading_charge: null,
        loading_charge_source: 'MANUAL',
        loading_charge_editable: true,
        loading_slab_id: null,
        resolved_weight: null,
      };
    }
    if (loadingType === 'item_basis') {
      const charge = toNumber(rate.ipmLoadingCharge);
      return {
        // Weight plays no part here: the item's own charge stands as stored.
        loading_charge: charge > 0 ? charge : null,
        loading_charge_source: 'ITEM_PRICE_MASTER',
        loading_charge_editable: false,
        loading_slab_id: null,
        resolved_weight: null,
      };
    }
    const { company_id, branch_id } = query;
    if (!company_id || !branch_id) {
      throwMasterBadRequest<MasterErrorDetail>('Validation failed', [
        {
          field: company_id ? 'branch_id' : 'company_id',
          message: "loading_type 'auto' requires both company_id and branch_id",
        },
      ]);
    }
    const weight = resolveLoadingWeight(
      query.weight,
      query.qty ?? DEFAULT_LOADING_QTY,
      rate.itemUnitConversion.iucUomWeight,
    );
    if (weight === null) {
      throwMasterBadRequest<MasterErrorDetail>('Validation failed', [
        {
          field: 'weight',
          message: `loading_type 'auto' needs a weight: none was supplied and the item's unit conversion carries no UOM weight to derive one from`,
        },
      ]);
    }
    // Half-open slab match (from <= weight < to), so a weight sitting exactly on
    // a boundary belongs to one slab only — the one it opens, not the one it
    // closes. Both scope legs allow NULL: a NULL branch prices every branch of
    // the company and a NULL company is a global default, neither of which can
    // be another tenant's row. selectLoadingSlab then ranks the matches.
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
    const slab = selectLoadingSlab(slabs, company_id, branch_id);
    const resolvedWeight = toNumber(weight);
    if (!slab) {
      // No slab covers this weight — the charge is unknown, not zero, so the
      // screen unlocks the field rather than billing 0.
      return {
        loading_charge: null,
        loading_charge_source: 'AUTO_NO_SLAB',
        loading_charge_editable: true,
        loading_slab_id: null,
        resolved_weight: resolvedWeight,
      };
    }
    return {
      // Flat per slab: the slab's charge applies whole, unmultiplied by weight
      // or qty. sale_loading_charges carries no charge-mode column to vary that.
      loading_charge: toNullableNumber(slab.ilcLoadChrg),
      loading_charge_source: 'LOADING_CHARGE_MASTER',
      loading_charge_editable: false,
      loading_slab_id: slab.ilcId,
      resolved_weight: resolvedWeight,
    };
  }

  async getItemPriceLookup(query: ItemPriceLookupQueryDto): Promise<ItemPriceLookupPayload> {
    const { item_id, unit_id, company_id, branch_id, customer_id, acccyear } = query;
    const priceLevel = query.price_level;
    const regional = query.regional ?? false;
    // 1. Item + candidate unit-rate rows (legacy: item_master ⋈ item_unit_rates).
    //    branch_id is optional: without it the item and its price rows are
    //    resolved across every branch. A NULL branch on a row means "applies to
    //    every branch", so a branch-scoped lookup takes those rows as well.
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
    // Both a branch row and a branch-less one can price the same unit; the
    // branch-specific rate is the more specific of the two, so it wins.
    const priceRows = preferBranchPriceRows(branchPriceRows, branch_id);
    if (!itemRecord) {
      throwMasterNotFound<MasterErrorDetail>(
        'Item not found',
        'item_id',
        `No active item found for id ${item_id}`,
      );
    }
    // 2. Pick the unit rate: an explicit unit wins, otherwise the legacy
    //    unit-slno rule (retail item → highest slno, else base row, slno 0).
    const rate = selectUnitRate(priceRows, itemRecord.itemRetailItem, unit_id);
    if (!rate) {
      throwMasterNotFound<MasterErrorDetail>(
        'Item price not found',
        unit_id ? 'unit_id' : 'item_id',
        unit_id
          ? `No active price row found for item ${item_id} and unit ${unit_id}`
          : `No active price row configured for item ${item_id}`,
      );
    }
    // Legacy `isale_no`: an explicit sale godown overrides the rate's own godown.
    const godownId = query.godown_id ?? rate.ipmGodownId;
    // 3. Everything that hangs off the chosen item / rate (legacy lateral joins).
    // The rate's unit now arrives with the row, via its conversion.
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
      // ir_unit_id and ipm_uc_unit_id both hold an iuc_id, so these match directly.
      this.prisma.itemReorder.findFirst({
        where: { irItemId: item_id, irUcUnitId: rate.ipmUcUnitId, irIsDeleted: false },
      }),
      acccyear
        ? this.prisma.itemStockBalance.aggregate({
            _sum: { isbClosingQty: true },
            where: {
              isbAccYear: acccyear,
              isbItemId: item_id,
              // isb_unit_id holds a raw unit_id, so the conversion's unit.
              isbUnitId: rateUnitId,
              // A missing company / branch widens the sum to all of them.
              ...(company_id ? { isbCompanyId: company_id } : {}),
              ...(branch_id ? { isbBranchId: branch_id } : {}),
              // A godown-less price row is not godown-scoped, so its stock
              // sums across all godowns.
              ...(godownId ? { isbGodownId: godownId } : {}),
            },
          })
        : Promise.resolve(null),
      // Reads sale_loading_charges only in `auto` mode; the other two modes
      // resolve from what is already in hand.
      this.resolveLoadingCharge(query, rate),
    ]);
    // 4. Derived values.
    // Without a company there is nothing to switch GST off, so the item's own
    // tax block stands; a supplied company still decides as before.
    const gstApplicable = company_id ? (company?.compGstApplicable ?? false) : true;
    const basePrice = priceForLevel(rate, priceLevel);
    // Legacy: the customer rate discount applies ONLY to the A/B/C/D sales
    // prices (levels 1–4), never to max/min/cost (levels 5/6/7).
    const customerDiscQty =
      custRate && priceLevel >= 1 && priceLevel <= 4 ? toNumber(custRate.csrDiscQty) : 0;
    const salesPrice = basePrice - customerDiscQty;
    // Legacy `iregional`: regional name falls back to English when unset.
    const itemName = regional
      ? (itemRecord.itemNameTa ?? itemRecord.itemNameEn)
      : itemRecord.itemNameEn;
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
      unit_id: rateUnitId,
      unit_rate_id: rate.ipmId,
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
      cost_price: toNumber(rate.ipmCostPrice),
      cost_wot: toNumber(rate.ipmCostWot),
      min_price: toNumber(rate.ipmMinPrice),
      max_price: toNumber(rate.ipmMaxPrice),
      disc_perc: toNumber(rate.ipmDiscPerc),
      disc_qty: toNumber(rate.ipmDiscQty),
      sch_discount: null,
      addl_cess: toNumber(rate.ipmAddlCess),
      unit_name: unit?.unit_name ?? null,
      // The conversion row the rate hangs off is the item + selected unit pair,
      // so its to-base factor is the one that converts this unit's qty to base.
      base_unit_id: rate.itemUnitConversion.iucBaseUnitId,
      base_factor: toNumber(rate.itemUnitConversion.iucToBaseFactor),
      // Weight is the item's own per-unit UOM weight from the conversion row,
      // not the unit master's generic weight.
      iuc_uom_weight: toNumber(rate.itemUnitConversion.iucUomWeight),
      unit_loading: itemRecord.itemAllowLoading
        ? (toNullableNumber(unit?.unit_loading ?? null) ?? 0)
        : 0,
      decimal_count: unit?.unit_decimal_count ?? 0,
      ...loading,
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
    };
  }
}
