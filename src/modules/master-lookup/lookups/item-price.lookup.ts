import {
  MasterErrorDetail,
  throwMasterBadRequest,
  throwMasterNotFound,
  toNullableNumber,
  toNumber,
} from '../../../common/utils/module-service.utils';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import {
  resolveRoleLedgers,
  roleLedgerKey,
} from '../../accountsModule/ledgerRole/ledger-map.helper';
import { ItemPriceLookupQueryDto } from '../dto/item-price-lookup-query.dto';
import { ItemPriceRefreshQueryDto } from '../dto/item-price-refresh-query.dto';
import { DEFAULT_FREIGHT_TYPE, DEFAULT_LOADING_TYPE } from '../master-lookup.constants';
import {
  ItemPriceBucketPayload,
  ItemPriceLookupPayload,
  ItemQtySlabPayload,
  ItemUnitCyclePayload,
} from '../types/master-lookup-api.types';
import { PriceRowWithUnit } from '../types/master-lookup-internal.types';
import { MasterLookupErrorCode } from '../types/master-lookup-error-codes';
import { nextIucIdInCycle, priceForLevel } from '../utils/item-price.utils';
import {
  resolveEffectivePrice,
  sameBucket,
  type BucketKey,
  type PriceCallerScope,
} from '../../Inventory/items-price-master/price-resolver';
import { todayIso } from '../../Inventory/items-price-master/price-bucket.service';
import {
  pricedBuckets,
  rankedQtySlabs,
  resolveSaleLinePrice,
  type QtyPriceSettingReader,
  type SaleLinePriceMiss,
} from '../../Inventory/items-price-master/sale-line-price';
import {
  bucketKeyFor,
  type BucketTrackFlags,
} from '../../stocks/stock-voucher/stock-voucher-posting.helper';
import { resolveLoadingWeight, selectLoadingSlab } from '../utils/loading-charge.utils';
import { branchDefaultGodownId } from '../../../common/utils/sale-line-godown.utils';
import { slabSpecificity } from '../../Inventory/items-qty-price-master/qty-slab.rules';

/**
 * What the lookup asks of the settings resolver (AppSettingValueService) — for
 * `sales.apply_qty_prices`. Absent (a unit test, a bare e2e), the setting's
 * seeded default stands: On. Lives with the shared resolver since review step 6.
 */
export type { QtyPriceSettingReader };

/**
 * The posting roles the payload names a ledger for, keyed by the payload field.
 * The ledgers are no longer columns on the rate: they resolve per role through
 * tax_rate_ledger (the rate's override) then acc_ledger_map (the default).
 */
const TAX_LEDGER_ROLES = {
  sales_ledger_id: 'SALES',
  sgst_output_ledger_id: 'OUTPUT_SGST',
  cgst_output_ledger_id: 'OUTPUT_CGST',
  igst_output_ledger_id: 'OUTPUT_IGST',
  cess_output_ledger_id: 'OUTPUT_CESS',
} as const;

type TaxLedgerResolution = Record<keyof typeof TAX_LEDGER_ROLES, string | null>;

/** The loading-charge block of the payload, resolved as one unit. */
type LoadingChargeResolution = Pick<ItemPriceLookupPayload, 'loading_charge' | 'resolved_weight'>;

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
 *    own godown for both the godown row and the stock scope; a godown-less
 *    rate falls back to the branch's default godown (notes 51).
 *  - stock: scoped to the resolved godown; only when no godown resolves at
 *    all (no rate godown, no branch default) does it sum across godowns.
 *  - customer rate (legacy `CSR.csr_disc_qty`): the customer discount is
 *    subtracted ONLY from the A/B/C/D sales prices (levels 1–4), never from
 *    max/min/cost (levels 5/6/7).
 *  - name (legacy `iregional`): regional=true returns item_name_ta, else the
 *    English name.
 *
 * ONE PRICE TABLE (plan-nestjs-one-price-table.md §3). item_price_master holds
 * the headline row AND the MRP / sale-price buckets. The unit is chosen first
 * (the rule above), then `resolveEffectivePrice` chooses the row within the
 * unit: the exact bucket the line's MRP / sale price / lot names — blanked by
 * the item's stock track policy through `bucketKeyFor`, the rule lot identity
 * uses — before the headline, a branch row before a chain row. Retyping the MRP
 * under sales.allow_mrp_edit therefore RE-PRICES the line: the client re-asks
 * with `mrp`, and this is the only place that rule lives.
 *
 * Schema divergences from the legacy query:
 *  - customer rates / qty-wise rates now hang off the pricing hub
 *    `item_price_master` (ipm_id) instead of (item_id, unit_id) — the
 *    HEADLINE row's id, never a bucket row's: a customer rate is per item and
 *    unit, not per MRP.
 *  - price level is the legacy 1–7 scheme: 1=A, 2=B, 3=C, 4=D, 5=MRP/max,
 *    6=min, 7=cost — any of the seven columns is selectable.
 *  - the item-group price-level scheme discount has no column → `sch_discount`
 *    is always null.
 */
export class ItemPriceLookup {
  constructor(
    private readonly prisma: PrismaService,
    /** Plan 2026-11-05 §4.4 — reads `sales.apply_qty_prices`; absent = On. */
    private readonly settings?: QtyPriceSettingReader,
  ) {}

  /**
   * Plan 2026-11-05 §4.4 (B-01) — the qty-wise price slabs that can price this
   * line, ranked: live and active, of the item and of the unit this answer
   * priced (`iucId`), in force on the document's date (Q6), company / branch /
   * party blank or the line's (no customer → party-blank slabs only), level
   * blank or the line's — and none at all when the line's level is not a
   * selling level 1–4 (Q12). Ranked most specific first (Q3), then by
   * from_qty: the client takes the FIRST whose range holds its qty. Empty when
   * `sales.apply_qty_prices` is off for the company (read only when there is a
   * slab to hide). ADDITIVE (D21): a caller that ignores the key gets today's
   * answer.
   */
  private async resolveQtySlabs(
    query: ItemPriceLookupQueryDto,
    iucId: string,
    docDate: string,
  ): Promise<ItemQtySlabPayload[]> {
    const ranked = await rankedQtySlabs(
      this.prisma,
      {
        itemId: query.item_id,
        iucId,
        companyId: query.company_id ?? null,
        branchId: query.branch_id ?? null,
        partyId: query.customer_id ?? null,
        priceLevel: query.price_level,
        onDate: docDate,
      },
      this.settings,
    );
    const amount = (value: Prisma.Decimal | null) => (value === null ? null : value.toNumber());
    return ranked.map((slab) => ({
      iqp_id: slab.iqpId,
      from_qty: slab.fromQty.toNumber(),
      to_qty: amount(slab.toQty),
      price_mode: slab.priceMode,
      disc_pct: amount(slab.discPct),
      flat_off: amount(slab.flatOff),
      price: amount(slab.price),
      is_tax_incl: slab.isTaxIncl,
      price_level: slab.priceLevel,
      party_id: slab.partyId,
      branch_id: slab.branchId,
      company_id: slab.companyId,
      effective_from: slab.effectiveFrom,
      effective_to: slab.effectiveTo,
      specificity: slabSpecificity(slab),
    }));
  }

  /**
   * "Cycle unit" on an entry screen: step from the conversion the caller
   * currently has selected to the next one the item is configured for, and
   * return that iuc_id. Nothing is priced — the screen decides whether to
   * re-read /item-price for the new unit, and with which scope.
   */
  async refreshItemPriceLookup(query: ItemPriceRefreshQueryDto): Promise<ItemUnitCyclePayload> {
    return {
      item_id: query.item_id,
      iuc_id: await this.resolveNextIucId(query.item_id, query.iuc_id),
    };
  }

  /**
   * The conversion one step along the item's unit list from `iucId`.
   *
   * The order is the item's own unit serial (iuc_unit_slno) — the order the
   * unit list is configured and displayed in, and the one /item-price already
   * ranks its price rows by — so "next" here is the next unit on screen. The
   * conversion PK breaks ties, since slno is not unique per item.
   *
   * NOT to-base factor: that only happens to put the base unit first when the
   * item's other units are larger than base (BOX = 12 PCS). An item whose extra
   * units are fractions of base (0.5 KG, 0.1 KG) sorts factor-ascending in the
   * exact reverse of its list, and the cycle would then skip backwards.
   *
   * item_unit_conversion is keyed by item alone — it carries no company or
   * branch column — so the cycle is not scoped further.
   */
  private async resolveNextIucId(itemId: string, iucId: string): Promise<string> {
    const rows = await this.prisma.itemUnitConversion.findMany({
      where: { iucItemId: itemId, iucIsDeleted: false },
      orderBy: [{ iucUnitSlno: 'asc' }, { iucId: 'asc' }],
      select: { iucId: true, iucUnitId: true },
    });
    return nextIucIdInCycle(rows, iucId);
  }

  /**
   * Resolves the loading charge the voucher line should carry, server-side.
   *
   * The three modes return the same two keys — a screen reads one shape and
   * decides nothing itself. A null charge always means "nothing resolved", never
   * "zero": no slab covering the weight and an unset master value are both null,
   * so a real 0 charge configured on a slab stays 0.
   *
   *  - `manual`     resolves nothing and touches no table.
   *  - `item_basis` reads item_price_master.ipm_loading_charge off the rate row
   *    already selected. The column is NOT NULL DEFAULT 0, so "not configured"
   *    is indistinguishable from a stored 0 — 0 is reported as null.
   *  - `auto` matches a sale_loading_charges weight slab on the selected
   *    conversion's own UOM weight — the lookup takes no weight or qty from the
   *    caller. Both scope columns are required here even though they are
   *    optional on the lookup itself: an unscoped slab match would be a
   *    cross-tenant read. A unit with no UOM weight has nothing to match a
   *    slab on, so it answers exactly what `manual` answers (both keys null)
   *    and the user types the charge in. It used to be a 400
   *    (LOOKUP_LOADING_WEIGHT_MISSING), which failed the whole item pick for a
   *    company on loading `auto` (2026-11-10: 397 of 411 dev units carry no
   *    weight). The payload has no warnings[] to carry a note in.
   */
  private async resolveLoadingCharge(
    query: ItemPriceLookupQueryDto,
    rate: PriceRowWithUnit,
  ): Promise<LoadingChargeResolution> {
    const loadingType = query.loading_type ?? DEFAULT_LOADING_TYPE;
    if (loadingType === 'manual') {
      return {
        loading_charge: null,
        resolved_weight: null,
      };
    }
    if (loadingType === 'item_basis') {
      const charge = toNumber(rate.ipmLoadingCharge);
      return {
        // Weight plays no part here: the item's own charge stands as stored.
        loading_charge: charge > 0 ? charge : null,
        resolved_weight: null,
      };
    }
    const { company_id, branch_id } = query;
    if (!company_id || !branch_id) {
      throwMasterBadRequest<MasterErrorDetail>('Validation failed', [
        {
          field: company_id ? 'branch_id' : 'company_id',
          message: "loading_type 'auto' requires both company_id and branch_id",
          code: MasterLookupErrorCode.LOADING_SCOPE_REQUIRED,
        },
      ]);
    }
    const weight = resolveLoadingWeight(rate.itemUnitConversion.iucUomWeight);
    if (weight === null) {
      // No weight, no slab: resolved as `manual` would, so the pick goes on.
      return {
        loading_charge: null,
        resolved_weight: null,
      };
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
        resolved_weight: resolvedWeight,
      };
    }
    return {
      // Flat per slab: the slab's charge applies whole, unmultiplied by the
      // weight. sale_loading_charges carries no charge-mode column to vary that.
      loading_charge: toNullableNumber(slab.ilcLoadChrg),
      resolved_weight: resolvedWeight,
    };
  }

  /**
   * Resolves the freight charge the voucher line should carry, the same way
   * `resolveLoadingCharge` does for loading: one key, one shape, whichever mode
   * the voucher is in. A null charge always means "nothing resolved", never
   * "zero", so the screen unlocks the field instead of billing 0.
   *
   *  - `manual`     resolves nothing and touches no column.
   *  - `item_basis` reads item_price_master.ipm_freight_charge off the rate row
   *    already selected. The column is NOT NULL DEFAULT 0, so "not configured"
   *    is indistinguishable from a stored 0 — 0 is reported as null.
   *  - `auto`       resolves nothing either, exactly like `manual`: the
   *    distance bands (sale_freight_charges) are matched on distance, which
   *    this lookup is never given, so the client applies the band itself from
   *    GET /master-lookups/freight-charges/charge?distance=. Accepted (not a
   *    400) so a company whose sales.freight_calc_type is `auto` can pick items.
   *
   * item_allow_freight does not gate this; it rides along as `add_freight` for
   * the screen to act on.
   */
  private resolveFreightCharge(
    query: ItemPriceLookupQueryDto,
    rate: PriceRowWithUnit,
  ): number | null {
    if ((query.freight_type ?? DEFAULT_FREIGHT_TYPE) !== 'item_basis') {
      return null;
    }
    const charge = toNumber(rate.ipmFreightCharge);
    return charge > 0 ? charge : null;
  }

  /**
   * Where a line taxed under `taxId` would post, one ledger per role. Nothing
   * mapped is null, not an error — this is a price lookup, and posting raises
   * the gap itself with the line it belongs to.
   */
  private async resolveTaxLedgers(
    taxId: string | null,
    query: ItemPriceLookupQueryDto,
  ): Promise<TaxLedgerResolution> {
    const requests = Object.values(TAX_LEDGER_ROLES).map((role) => ({ role, taxId }));
    const resolved = await resolveRoleLedgers(this.prisma, requests, {
      companyId: query.company_id ?? null,
      branchId: query.branch_id ?? null,
      where: 'item_price_lookup',
    });
    const entries = Object.entries(TAX_LEDGER_ROLES).map(([field, role]) => [
      field,
      resolved.get(roleLedgerKey({ role, taxId }))?.ledgerId ?? null,
    ]);
    return Object.fromEntries(entries) as TaxLedgerResolution;
  }

  /**
   * §3.3 `buckets[]` — every live bucket at this scope that has stock, each
   * with the prices it resolves to. 16q Q24 without the F12 screen.
   *
   * Grouped by the stock's (sbl_mrp, sbl_sale_price), then BLANKED by the
   * policy in force and merged again: a holding opened under an older policy
   * may carry a dimension the item no longer tracks, and two such holdings are
   * one bucket today. SALEABLE only — damaged or quarantined stock is not
   * sold, so its MRP is not a choice the till should offer.
   */
  private async resolveStockBuckets(
    query: ItemPriceLookupQueryDto,
    policy: BucketTrackFlags,
    unitRows: PriceRowWithUnit[],
    docDate: string,
    caller: PriceCallerScope,
  ): Promise<ItemPriceBucketPayload[]> {
    const company = query.company_id ?? null;
    const branch = query.branch_id ?? null;
    const holdings = await this.prisma.$queryRaw<
      { mrp: Prisma.Decimal | null; salePrice: Prisma.Decimal | null; qty: Prisma.Decimal | null }[]
    >`
      SELECT b.sbl_mrp AS "mrp", b.sbl_sale_price AS "salePrice",
             SUM(b.sbl_available_qty) AS "qty"
        FROM stock.stock_balance b
       WHERE b.sbl_item_id = ${query.item_id}::uuid
         AND b.sbl_is_deleted = false
         AND b.sbl_bucket = 'SALEABLE'
         AND (${company}::uuid IS NULL OR b.sbl_company_id = ${company}::uuid)
         AND (${branch}::uuid IS NULL OR b.sbl_branch_id = ${branch}::uuid)
       GROUP BY b.sbl_mrp, b.sbl_sale_price
      HAVING SUM(b.sbl_available_qty) > 0
       ORDER BY b.sbl_mrp DESC NULLS LAST, b.sbl_sale_price DESC NULLS LAST`;
    const merged: Array<{ key: BucketKey; qty: number }> = [];
    for (const holding of holdings) {
      const key = bucketKeyFor(policy, {
        mrp: toNullableNumber(holding.mrp),
        salePrice: toNullableNumber(holding.salePrice),
      });
      const qty = toNumber(holding.qty ?? 0);
      const same = merged.find((entry) => sameBucket(entry.key, key));
      if (same) {
        same.qty += qty;
      } else {
        merged.push({ key, qty });
      }
    }
    // Notes 71 B2 — nothing on hand yet: offer every PRICED bucket instead, at
    // quantity 0, so a screen can still put the item on a bill (and the grid's
    // own rule — Q25 — shows the priced rows of an item with no stock too).
    if (!merged.length) {
      merged.push(...pricedBuckets(unitRows, docDate, caller).map(({ key }) => ({ key, qty: 0 })));
    }
    return merged.map(({ key, qty }) => {
      const answer = resolveEffectivePrice(unitRows, key, docDate, caller);
      const row = answer?.row;
      return {
        mrp: key.mrp,
        sale_price: key.salePrice,
        available_qty: qty,
        price_source: answer?.source ?? null,
        price_scope: answer?.scope ?? null,
        price_row_id: row?.ipmId ?? null,
        sales_price: row ? priceForLevel(row, query.price_level) : 0,
        sales_price_a: row ? toNumber(row.ipmSalesPriceA) : 0,
        sales_price_b: row ? toNumber(row.ipmSalesPriceB) : 0,
        sales_price_c: row ? toNumber(row.ipmSalesPriceC) : 0,
        sales_price_d: row ? toNumber(row.ipmSalesPriceD) : 0,
        max_price: row ? toNumber(row.ipmMaxPrice) : (key.mrp ?? 0),
        min_price: row ? toNumber(row.ipmMinPrice) : 0,
      };
    });
  }

  /** The coded 404 the lookup has always answered for a line the shared resolver could not price. */
  private throwPriceMiss(answer: SaleLinePriceMiss, query: ItemPriceLookupQueryDto): never {
    const { item_id, unit_id } = query;
    switch (answer.reason) {
      case 'ITEM_NOT_FOUND':
        return throwMasterNotFound<MasterErrorDetail>(
          'Item not found',
          'item_id',
          `No active item found for id ${item_id}`,
          MasterLookupErrorCode.ITEM_NOT_FOUND,
        );
      case 'PRICE_NOT_FOUND':
        return throwMasterNotFound<MasterErrorDetail>(
          'Item price not found',
          unit_id ? 'unit_id' : 'item_id',
          unit_id
            ? `No active price row found for item ${item_id} and unit ${unit_id}`
            : `No active price row configured for item ${item_id}`,
          MasterLookupErrorCode.PRICE_NOT_FOUND,
        );
      case 'LOT_NOT_FOUND':
        return throwMasterNotFound<MasterErrorDetail>(
          'Lot not found',
          'lot_id',
          `No lot ${query.lot_id} found for item ${item_id}`,
          MasterLookupErrorCode.LOT_NOT_FOUND,
        );
      case 'BUCKET_PRICE_NOT_FOUND': {
        const { key } = answer;
        const priced = answer.priced.map((k) =>
          k.mrp !== null ? `MRP ${k.mrp}` : `sale price ${k.salePrice}`,
        );
        return throwMasterNotFound<MasterErrorDetail>(
          'Item price not found',
          key.mrp !== null
            ? 'mrp'
            : key.salePrice !== null
              ? 'sale_price'
              : unit_id
                ? 'unit_id'
                : 'item_id',
          `No active price row for item ${item_id} at ${
            key.mrp !== null
              ? `MRP ${key.mrp}`
              : key.salePrice !== null
                ? `sale price ${key.salePrice}`
                : 'this unit'
          }, and no headline row to fall back to` +
            (priced.length ? `. Priced: ${priced.join(', ')}.` : '.'),
          MasterLookupErrorCode.BUCKET_PRICE_NOT_FOUND,
        );
      }
    }
  }

  async getItemPriceLookup(query: ItemPriceLookupQueryDto): Promise<ItemPriceLookupPayload> {
    const { item_id, unit_id, company_id, branch_id, customer_id, acccyear } = query;
    const priceLevel = query.price_level;
    const regional = query.regional ?? false;
    const docDate = query.doc_date?.slice(0, 10) ?? todayIso();
    // 1–3. Item, unit, bucket, row and customer rate: the shared resolver (review step 6,
    //    D12), so the Sale Bill's rate lock prices a line exactly as this answer does.
    //    branch_id is optional: without it the item and its price rows are resolved across
    //    every branch; a NULL branch / company on a row applies to every one. An explicit
    //    unit wins, else the legacy unit-slno rule (retail item → highest slno, else the
    //    base row). The bucket key is the lot's identity when the line holds one, else what
    //    the line carries, blanked by the policy in force on the document's date, so an
    //    untracked item always asks for its headline.
    const answer = await resolveSaleLinePrice(this.prisma, {
      itemId: item_id,
      unitId: unit_id ?? null,
      companyId: company_id ?? null,
      branchId: branch_id ?? null,
      customerId: customer_id ?? null,
      priceLevel,
      docDate,
      mrp: query.mrp ?? null,
      salePrice: query.sale_price ?? null,
      lotId: query.lot_id ?? null,
    });
    if (!answer.ok) {
      this.throwPriceMiss(answer, query);
    }
    const { item: itemRecord, caller, unitRows, policy, resolved, rate } = answer;
    // Legacy `isale_no`: an explicit sale godown overrides the rate's own godown.
    // A rate with no godown falls back to the branch default — the same rule
    // /quotations/get stamps its lines with (notes 51, sale-line-godown.utils).
    const godownId =
      query.godown_id ??
      rate.ipmGodownId ??
      (branch_id ? await branchDefaultGodownId(this.prisma, branch_id) : null);
    // 3. Everything that hangs off the chosen item / rate (legacy lateral joins).
    // The rate's unit now arrives with the row, via its conversion.
    const unit = rate.itemUnitConversion.unit;
    const rateUnitId = rate.itemUnitConversion.iucUnitId;
    const [godown, tax, company, reorder, stockSum, loading] = await Promise.all([
      godownId
        ? this.prisma.godownLocation.findFirst({ where: { gdlId: godownId } })
        : Promise.resolve(null),
      // item_default_tax_id points at tax_rate_master since
      // 20260912110000_repoint_items_to_tax_rate_master; item_tax_master is retired.
      itemRecord.itemDefaultTaxId
        ? this.prisma.taxRateMaster.findFirst({
            where: { taxId: itemRecord.itemDefaultTaxId, taxIsDeleted: false },
          })
        : Promise.resolve(null),
      company_id
        ? this.prisma.company.findFirst({
            where: { compId: company_id },
            // The row holds the logo and signature images (up to ~700 KB each).
            select: { compGstApplicable: true, compNegStkApl: true },
          })
        : Promise.resolve(null),
      // ir_unit_id and ipm_uc_unit_id both hold an iuc_id, so these match directly.
      this.prisma.itemReorder.findFirst({
        where: { irItemId: item_id, irUcUnitId: rate.ipmUcUnitId, irIsDeleted: false },
      }),
      // §1.7 — the ENGINE's balance, not the retired inventory.item_stock_*
      // tables (0 rows, no writer). stock_balance is in the item's BASE unit
      // and is not partitioned by year; the caller's unit and year only
      // decide whether a figure is wanted at all.
      acccyear
        ? this.prisma.$queryRaw<{ qty: Prisma.Decimal | null }[]>`
            SELECT SUM(b.sbl_on_hand_qty) AS qty
              FROM stock.stock_balance b
             WHERE b.sbl_item_id = ${item_id}::uuid
               AND b.sbl_is_deleted = false
               AND (${company_id ?? null}::uuid IS NULL OR b.sbl_company_id = ${company_id ?? null}::uuid)
               AND (${branch_id ?? null}::uuid IS NULL OR b.sbl_branch_id = ${branch_id ?? null}::uuid)
               AND (${godownId ?? null}::uuid IS NULL OR b.sbl_godown_id = ${godownId ?? null}::uuid)`
        : Promise.resolve(null),
      // Reads sale_loading_charges only in `auto` mode; the other two modes
      // resolve from what is already in hand.
      this.resolveLoadingCharge(query, rate),
    ]);
    const taxLedgers = await this.resolveTaxLedgers(tax?.taxId ?? null, query);
    const buckets =
      policy.trackMrp || policy.trackSalePrice
        ? await this.resolveStockBuckets(query, policy, unitRows, docDate, caller)
        : [];
    const qtySlabs = await this.resolveQtySlabs(query, rate.itemUnitConversion.iucId, docDate);
    // 4. Derived values.
    // Without a company there is nothing to switch GST off, so the item's own
    // tax block stands; a supplied company still decides as before.
    const gstApplicable = company_id ? (company?.compGstApplicable ?? false) : true;
    // Legacy: the customer rate discount applies ONLY to the A/B/C/D sales
    // prices (levels 1–4), never to max/min/cost (levels 5/6/7) — the resolver's rule.
    const salesPrice = answer.salesPrice;
    // Legacy `iregional`: regional name falls back to English when unset.
    const itemName = regional
      ? (itemRecord.itemNameTa ?? itemRecord.itemNameEn)
      : itemRecord.itemNameEn;
    const stock = stockSum ? toNullableNumber(stockSum[0]?.qty ?? 0) : null;
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
      // The conversion PK, not the raw unit: it is what the screens hold and
      // what /item-price-refresh cycles over.
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
      cost_price: toNumber(rate.ipmCostPrice),
      cost_wot: toNumber(rate.ipmCostWot),
      min_price: toNumber(rate.ipmMinPrice),
      // ck_ipm_bucket_mrp_is_max: on a BUCKET answer this IS the bucket's MRP.
      max_price: toNumber(rate.ipmMaxPrice),
      price_source: resolved.source,
      price_scope: resolved.scope,
      price_row_id: rate.ipmId,
      buckets,
      qty_slabs: qtySlabs,
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
      decimal_count: unit?.unit_decimal_count ?? 0,
      ...loading,
      // Resolved off the rate row already in hand, so no extra query.
      freight_charge: this.resolveFreightCharge(query, rate),
      loyalty_pv: itemRecord.itemAllowLoyalty ? toNumber(rate.ipmLoyaltyPoints) : 0,
      stock,
      reorder_qty: reorderQty,
      // Straight off the item — the GST toggle zeroes the perc fields below but
      // does not change whether the item's stored prices include tax.
      item_incl_tax: itemRecord.itemInclTax,
      tax_id: tax?.taxId ?? null,
      hsn_code: itemRecord.itemHsnCode ?? null,
      gst_rate: gstApplicable && tax ? toNumber(tax.taxRatePerc) : 0,
      // The rate says which cess figure is in play; the other is not charged.
      cess_perc:
        gstApplicable && tax && ['PERCENT', 'BOTH'].includes(tax.taxCessBasis)
          ? toNumber(tax.taxCessPerc)
          : 0,
      cess_unit:
        gstApplicable && tax && ['PER_UNIT', 'BOTH'].includes(tax.taxCessBasis)
          ? toNumber(tax.taxCessPerUnit)
          : 0,
      sgst_perc: gstApplicable && tax ? toNumber(tax.taxSgstPerc ?? 0) : 0,
      cgst_perc: gstApplicable && tax ? toNumber(tax.taxCgstPerc ?? 0) : 0,
      igst_perc: gstApplicable && tax ? toNumber(tax.taxIgstPerc ?? 0) : 0,
      ...taxLedgers,
    };
  }
}
