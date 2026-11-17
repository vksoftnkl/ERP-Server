import { Injectable } from '@nestjs/common';
import { Prisma, type ItemPriceMaster } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import {
  HEADLINE_KEY,
  bucketKeyOfRow,
  isHeadlineKey,
  livePriceRows,
  resolveEffectivePrice,
  sameBucket,
  type BucketKey,
  type PriceCallerScope,
  type ResolvedPrice,
} from '../../modules/Inventory/items-price-master/price-resolver';
import {
  assertMobileCompany,
  databaseToday,
  findMobileBranch,
  resolveMobileDevice,
} from '../common/mobile-scope';
import { ListMobileItemsQueryDto, MOBILE_ITEM_DEFAULT_PAGE_SIZE } from './dto/mobile-item.dto';
import type {
  MobileItem,
  MobileItemListPayload,
  MobileItemOptions,
  MobileItemUnit,
} from './types/mobile-item-api.types';

type Num = Prisma.Decimal | string | number;

/** Price level 7 (Cost): never sent to a phone. */
export const MOBILE_HIDDEN_PRICE_LEVEL = 7;

interface ItemRow {
  item_id: string;
  item_code: string | null;
  item_name_en: string;
  item_name_ta: string | null;
  item_group_id: string;
  itg_name: string | null;
  item_brand_id: string | null;
  brand_name: string | null;
  item_allow_loading: boolean;
  item_allow_freight: boolean;
  item_allow_promo: boolean;
  item_incl_tax: boolean;
  item_hsn_code: string | null;
  item_default_tax_id: string | null;
  tax_rate_perc: Num | null;
}

interface UnitRow {
  iucId: string;
  iucItemId: string;
  iucUnitId: string;
  iucToBaseFactor: Prisma.Decimal;
  iucIsDefaultUnit: boolean;
  iucIsBaseUnit: boolean;
  iucUomWeight: Prisma.Decimal;
  unit: { unit_name: string } | null;
}

/** Two decimals as text, the mobile money convention; null stays null. */
export function moneyText(value: Num | null | undefined): string | null {
  return value === null || value === undefined ? null : new Prisma.Decimal(value).toFixed(2);
}

/** A quantity for the phone: 3 decimals, as a number. */
export function qty3(value: Prisma.Decimal): number {
  return Number(value.toDecimalPlaces(3).toString());
}

/**
 * The row that prices one unit of an item when no MRP, sale price or lot is
 * named: the order line has none yet. /master-lookups/item-price answers the
 * same two steps (getItemPriceLookup):
 *   1. the resolver's answer for the headline key (bucketKeyFor blanks nothing
 *      that is already null, so every policy asks for the headline). The
 *      resolver ranks a branch row before a chain row, a company row before a
 *      shared one;
 *   2. else its provisionalBucket (notes 71 B2): an item priced ONLY per MRP
 *      takes its dearest bucket, dearest MRP then dearest sale price.
 * `unitRows` = the live rows of this one unit (livePriceRows, filtered by unit).
 */
export function unitPriceAnswer<R extends ItemPriceMaster>(
  unitRows: readonly R[],
  onDate: string,
  caller: PriceCallerScope,
): ResolvedPrice<R> | null {
  const headline = resolveEffectivePrice(unitRows, HEADLINE_KEY, onDate, caller);
  if (headline) {
    return headline;
  }
  const keys: BucketKey[] = [];
  for (const row of unitRows) {
    const key = bucketKeyOfRow(row);
    if (!isHeadlineKey(key) && !keys.some((known) => sameBucket(known, key))) {
      keys.push(key);
    }
  }
  keys.sort((a, b) => (b.mrp ?? -1) - (a.mrp ?? -1) || (b.salePrice ?? -1) - (a.salePrice ?? -1));
  for (const key of keys) {
    const answer = resolveEffectivePrice(unitRows, key, onDate, caller);
    if (answer) {
      return answer;
    }
  }
  return null;
}

/**
 * The phone's reads of the item masters for the order screen. Read-only:
 * nothing here writes, and no cost price leaves the server (salesmen's phones
 * carry no margins).
 */
@Injectable()
export class MobileItemService {
  constructor(private readonly prisma: PrismaService) {}

  async options(): Promise<MobileItemOptions> {
    const [companies, groups, brands, levels] = await Promise.all([
      this.prisma.company.findMany({
        where: { compIsDeleted: false, compIsActive: true },
        select: { compId: true, compName: true, compCity: true },
        orderBy: [{ compName: 'asc' }, { compId: 'asc' }],
      }),
      this.prisma.itemGroupMaster.findMany({
        where: { itgIsDeleted: false, itgIsActive: true },
        select: { itgId: true, itgName: true, itgSort: true },
        orderBy: [{ itgSort: { sort: 'asc', nulls: 'last' } }, { itgName: 'asc' }],
      }),
      this.prisma.itemBrandMaster.findMany({
        where: { brand_is_deleted: false, brand_is_active: true },
        select: { brand_id: true, brand_name: true, brand_sort: true },
        orderBy: [{ brand_sort: { sort: 'asc', nulls: 'last' } }, { brand_name: 'asc' }],
      }),
      this.prisma.itemPriceLevel.findMany({
        where: { iplIsDeleted: false, iplStatus: true, iplId: { not: MOBILE_HIDDEN_PRICE_LEVEL } },
        select: { iplId: true, iplName: true },
        orderBy: { iplId: 'asc' },
      }),
    ]);
    return {
      companies: companies.map((c) => ({ id: c.compId, name: c.compName, place: c.compCity })),
      itemGroups: groups.map((g) => ({ id: g.itgId, name: g.itgName, position: g.itgSort })),
      brands: brands.map((b) => ({ id: b.brand_id, name: b.brand_name, position: b.brand_sort })),
      priceLevels: levels.map((l) => ({ id: l.iplId, name: l.iplName })),
    };
  }

  /**
   * Items orderable for the company, sorted by English name: live, active,
   * item_allow_so, and shared (no company) or the company's own. Branch-owned
   * items (item_branch_id) show only for their branch once one is known, as
   * the lookup scopes them.
   */
  async list(q: ListMobileItemsQueryDto): Promise<MobileItemListPayload> {
    const page = q.page ?? 1;
    const pageSize = q.pageSize ?? MOBILE_ITEM_DEFAULT_PAGE_SIZE;
    const company = await assertMobileCompany(this.prisma, q.companyId);
    const device = q.deviceUid ? await resolveMobileDevice(this.prisma, q.deviceUid) : null;
    const [branchId, today] = await Promise.all([
      findMobileBranch(this.prisma, q.companyId, device?.devBranchId ?? null),
      databaseToday(this.prisma),
    ]);
    const where = Prisma.sql`
       WHERE i.item_is_deleted = false
         AND i.item_is_active = true
         AND i.item_allow_so = true
         AND (i.item_company_id IS NULL OR i.item_company_id = ${q.companyId}::uuid)
         AND (${branchId}::uuid IS NULL OR i.item_branch_id IS NULL OR i.item_branch_id = ${branchId}::uuid)`;
    const [countRows, rows] = await Promise.all([
      this.prisma.$queryRaw<{ n: number }[]>`
        SELECT count(*)::int AS n FROM inventory.item_master i ${where}`,
      this.prisma.$queryRaw<ItemRow[]>`
        SELECT i.item_id, i.item_code, i.item_name_en, i.item_name_ta,
               i.item_group_id, g.itg_name, i.item_brand_id, b.brand_name,
               i.item_allow_loading, i.item_allow_freight, i.item_allow_promo,
               i.item_incl_tax, i.item_hsn_code, i.item_default_tax_id,
               t.tax_rate_perc
          FROM inventory.item_master i
          LEFT JOIN inventory.item_group_master g ON g.itg_id = i.item_group_id
          LEFT JOIN inventory.item_brand_master b ON b.brand_id = i.item_brand_id
          LEFT JOIN inventory.tax_rate_master t
                 ON t.tax_id = i.item_default_tax_id AND t.tax_is_deleted = false
          ${where}
         ORDER BY lower(i.item_name_en), i.item_id
         LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`,
    ]);
    const total = countRows[0]?.n ?? 0;
    const itemIds = rows.map((r) => r.item_id);
    const caller: PriceCallerScope = { companyId: q.companyId, branchId };
    const [units, priceRows, stock] = itemIds.length
      ? await Promise.all([
          this.prisma.itemUnitConversion.findMany({
            where: { iucItemId: { in: itemIds }, iucIsDeleted: false, iucIsActive: true },
            select: {
              iucId: true,
              iucItemId: true,
              iucUnitId: true,
              iucToBaseFactor: true,
              iucIsDefaultUnit: true,
              iucIsBaseUnit: true,
              iucUomWeight: true,
              unit: { select: { unit_name: true } },
            },
            orderBy: [{ iucItemId: 'asc' }, { iucUnitSlno: 'asc' }, { iucId: 'asc' }],
          }),
          // The lookup's own read: every live row of the item at the caller's
          // scope or wider (a NULL company / branch applies to all).
          this.prisma.itemPriceMaster.findMany({
            where: {
              ipmItemId: { in: itemIds },
              ipmIsDeleted: false,
              AND: [
                { OR: [{ ipmCompanyId: q.companyId }, { ipmCompanyId: null }] },
                ...(branchId ? [{ OR: [{ ipmBranchId: branchId }, { ipmBranchId: null }] }] : []),
              ],
            },
            orderBy: [{ ipmId: 'asc' }],
          }),
          // §1.7: the engine's balance (stock.stock_balance), in the BASE unit;
          // inventory.item_stock_balance is retired. SALEABLE only, free to
          // sell (sbl_available_qty = on hand − reserved), every branch and
          // godown of the company.
          this.prisma.$queryRaw<{ item_id: string; qty: Prisma.Decimal | null }[]>`
            SELECT b.sbl_item_id AS item_id, SUM(b.sbl_available_qty) AS qty
              FROM stock.stock_balance b
             WHERE b.sbl_item_id = ANY(${itemIds}::uuid[])
               AND b.sbl_company_id = ${q.companyId}::uuid
               AND b.sbl_is_deleted = false
               AND b.sbl_bucket = 'SALEABLE'
             GROUP BY b.sbl_item_id`,
        ])
      : [[], [], []];
    const unitsByItem = groupBy(units as UnitRow[], (u) => u.iucItemId);
    const pricesByItem = groupBy(priceRows, (p) => p.ipmItemId);
    const stockByItem = new Map(
      stock.map((s) => [s.item_id, new Prisma.Decimal(s.qty ?? 0)] as const),
    );
    const items = rows.map((row) =>
      this.toItem(
        row,
        unitsByItem.get(row.item_id) ?? [],
        livePriceRows(pricesByItem.get(row.item_id) ?? [], today, caller),
        stockByItem.get(row.item_id) ?? new Prisma.Decimal(0),
        company.compGstApplicable,
        today,
        caller,
      ),
    );
    return {
      items,
      total,
      page,
      pageSize,
      hasMore: page * pageSize < total,
      companyId: q.companyId,
      branchId,
      priceDate: today,
    };
  }

  private toItem(
    row: ItemRow,
    units: UnitRow[],
    liveRows: ItemPriceMaster[],
    baseQty: Prisma.Decimal,
    gstApplicable: boolean,
    today: string,
    caller: PriceCallerScope,
  ): MobileItem {
    return {
      itemId: row.item_id,
      itemCode: row.item_code,
      itemNameEn: row.item_name_en,
      itemNameTa: row.item_name_ta,
      itemGroupId: row.item_group_id,
      itemGroupName: row.itg_name,
      itemBrandId: row.item_brand_id,
      itemBrandName: row.brand_name,
      allowLoading: row.item_allow_loading,
      allowFreight: row.item_allow_freight,
      allowPromo: row.item_allow_promo,
      inclTax: row.item_incl_tax,
      hsnCode: row.item_hsn_code,
      taxId: row.item_default_tax_id,
      // As the lookup: a company with GST off charges none.
      taxPerc: new Prisma.Decimal(
        gstApplicable && row.tax_rate_perc !== null ? row.tax_rate_perc : 0,
      ).toFixed(3),
      availableBaseQty: qty3(baseQty),
      units: units.map((unit) =>
        this.toUnit(
          unit,
          liveRows.filter((p) => p.ipmUcUnitId === unit.iucId),
          baseQty,
          today,
          caller,
        ),
      ),
    };
  }

  private toUnit(
    unit: UnitRow,
    unitRows: ItemPriceMaster[],
    baseQty: Prisma.Decimal,
    today: string,
    caller: PriceCallerScope,
  ): MobileItemUnit {
    const answer = unitPriceAnswer(unitRows, today, caller);
    const rate = answer?.row ?? null;
    const factor = unit.iucToBaseFactor;
    return {
      iucId: unit.iucId,
      unitId: unit.iucUnitId,
      unitName: unit.unit?.unit_name ?? null,
      factor: Number(factor.toString()),
      isDefaultUnit: unit.iucIsDefaultUnit,
      isBaseUnit: unit.iucIsBaseUnit,
      weight: Number(unit.iucUomWeight.toString()),
      priced: rate !== null,
      priceA: moneyText(rate?.ipmSalesPriceA),
      priceB: moneyText(rate?.ipmSalesPriceB),
      priceC: moneyText(rate?.ipmSalesPriceC),
      priceD: moneyText(rate?.ipmSalesPriceD),
      mrp: moneyText(rate?.ipmMaxPrice),
      minPrice: moneyText(rate?.ipmMinPrice),
      loadingCharge: moneyText(rate?.ipmLoadingCharge),
      freightCharge: moneyText(rate?.ipmFreightCharge),
      priceSource: answer?.source ?? null,
      priceScope: answer?.scope ?? null,
      availableQty: factor.gt(0) ? qty3(baseQty.div(factor)) : 0,
    };
  }
}

function groupBy<T>(rows: readonly T[], keyOf: (row: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const key = keyOf(row);
    const list = map.get(key);
    if (list) {
      list.push(row);
    } else {
      map.set(key, [row]);
    }
  }
  return map;
}
