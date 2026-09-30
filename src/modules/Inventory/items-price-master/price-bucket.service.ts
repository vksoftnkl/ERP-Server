import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AppSettingValueService } from 'src/modules/settings/appSettings/app-setting-value.service';
import {
  throwInventoryConflict,
  throwUnprocessable,
  toNumber,
} from 'src/common/utils/module-service.utils';
import type { InventoryErrorDetail } from 'src/common/utils/module-service.utils';
import {
  bucketKeyFor,
  readBucketTrackFlags,
  type BucketTrackFlags,
} from 'src/modules/stocks/stock-voucher/stock-voucher-posting.helper';
import { bucketKeyOfRow, sameBucket, toDay, type BucketKey } from './price-resolver';

/** The setting whose level a sale-price bucket mirrors (slt_sale_price's doctrine). */
export const DEFAULT_PRICE_LEVEL_SETTING_KEY = 'sales.default_price_level';

/** What deriving one row's bucket needs from the row. */
export interface PriceBucketSource {
  companyId: string | null;
  branchId: string | null;
  maxPrice: number;
  /** Sales prices A, B, C, D in that order. */
  prices: readonly [number, number, number, number];
}

/** The client a derivation reads through: the caller's transaction, or the plain service. */
type ReadClient = Pick<Prisma.TransactionClient, '$queryRaw' | 'itemMaster'>;

/** Today in the server's own calendar — what CURRENT_DATE answers on a same-zone database. */
export function todayIso(now: Date = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

/**
 * WHICH BUCKET A PRICE ROW IS, decided on the server (plan §4).
 *
 * The bucket columns of `inventory.item_price_master` are never sent by a
 * client. They are derived from the item's effective stock track policy, with
 * the SAME blanking rule lot identity uses (`bucketKeyFor`), so the item card
 * and the lot can never disagree about whether an MRP is a dimension:
 *
 *   track_mrp        → ipm_bucket_mrp := NULLIF(ipm_max_price, 0)
 *   track_sale_price → ipm_bucket_sp  := the price at sales.default_price_level
 *   otherwise        → both NULL: the headline row
 *
 * The Qt price grid therefore changes nothing: a second MRP is simply a second
 * grid row for the same unit, which the old unique index refused and
 * `ex_ipm_overlap` accepts.
 *
 * The policy is read at the row's scope — its own company / branch, else the
 * item's, because an ITEM-scope policy is filed under the item's company.
 */
@Injectable()
export class PriceBucketService {
  constructor(private readonly appSettingValueService: AppSettingValueService) {}

  /** One key per row, in the order given. All rows belong to `itemId`. */
  async deriveBuckets(
    client: ReadClient,
    itemId: string,
    rows: readonly PriceBucketSource[],
    onDate: string = todayIso(),
  ): Promise<BucketKey[]> {
    if (!rows.length) {
      return [];
    }
    const item = await client.itemMaster.findUnique({
      where: { itemId },
      select: { itemCompanyId: true, itemBranchId: true },
    });
    const scopes = rows.map((row) => ({
      itemId,
      companyId: row.companyId ?? item?.itemCompanyId ?? null,
      branchId: row.branchId ?? item?.itemBranchId ?? null,
    }));
    const flags = await readBucketTrackFlags(client, scopes, onDate);
    const levels = new Map<string, number>();
    const keys: BucketKey[] = [];
    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      const policy: BucketTrackFlags = flags[index];
      let salePrice: number | null = null;
      if (policy.trackSalePrice) {
        const level = await this.defaultPriceLevel(scopes[index], levels);
        salePrice = row.prices[level - 1] ?? null;
      }
      keys.push(bucketKeyFor(policy, { mrp: row.maxPrice, salePrice }));
    }
    return keys;
  }

  /**
   * §4.3 — re-derive every live price row of an item under the policy in force
   * NOW, in the caller's transaction. Call it after anything that can flip the
   * item's tracking signature: its own preset set or cleared, its group
   * changed.
   *
   * Two rows collapsing onto one key (MRP tracking switched OFF with two MRPs
   * priced) are REFUSED with both rows named, never merged: which of the two
   * prices survives is the operator's decision. So is a headline priced above
   * its MRP that would become a bucket (ck_ipm_not_above_mrp).
   *
   * `ex_ipm_overlap` is DEFERRABLE for exactly this: two rows swapping keys in
   * one save would otherwise trip it half way. It is deferred for the updates
   * and set back to IMMEDIATE — checked on the spot — before returning.
   *
   * @returns the number of rows whose bucket changed.
   */
  async rekeyItem(tx: Prisma.TransactionClient, itemId: string): Promise<number> {
    const rows = await tx.itemPriceMaster.findMany({
      where: { ipmItemId: itemId, ipmIsDeleted: false },
      include: { itemUnitConversion: { include: { unit: true } } },
      orderBy: [{ itemUnitConversion: { iucUnitSlno: 'asc' } }, { ipmId: 'asc' }],
    });
    if (!rows.length) {
      return 0;
    }
    const derived = await this.deriveBuckets(tx, itemId, rows.map(toBucketSource));

    const describe = (index: number) => {
      const row = rows[index];
      const unit = row.itemUnitConversion.unit?.unit_name ?? row.ipmUcUnitId;
      const scope = row.ipmBranchId === null ? 'all branches' : 'one branch';
      return `the ${unit} price at MRP ${toNumber(row.ipmMaxPrice)} (${scope}, ${row.ipmId})`;
    };

    // Collisions first, over the WHOLE item, before anything is written.
    for (let a = 0; a < rows.length; a += 1) {
      for (let b = a + 1; b < rows.length; b += 1) {
        if (collide(rows[a], derived[a], rows[b], derived[b])) {
          throwInventoryConflict<InventoryErrorDetail>(
            "These prices would become one under the item's stock tracking",
            [
              {
                field: 'prices',
                message:
                  `${describe(a)} and ${describe(b)} are one price once the item no longer ` +
                  'tracks what tells them apart. Delete one of them, then save again.',
              },
            ],
          );
        }
      }
    }

    const changed = rows
      .map((row, index) => ({ row, key: derived[index], index }))
      .filter(({ row, key }) => !sameBucket(bucketKeyOfRow(row), key));
    for (const { row, key, index } of changed) {
      const mrp = key.mrp;
      if (mrp !== null && toBucketSource(row).prices.some((price) => price > mrp)) {
        throwUnprocessable<InventoryErrorDetail>(
          'A price is above the MRP it would be bucketed under',
          [
            {
              field: 'prices',
              message:
                `${describe(index)} sells above its MRP. A price per MRP cannot exceed that ` +
                'MRP; correct the price, then change the tracking.',
            },
          ],
        );
      }
    }
    if (!changed.length) {
      return 0;
    }

    await tx.$executeRaw`SET CONSTRAINTS inventory.ex_ipm_overlap DEFERRED`;
    const now = new Date();
    for (const { row, key } of changed) {
      await tx.itemPriceMaster.update({
        where: { ipmId: row.ipmId },
        data: { ipmBucketMrp: key.mrp, ipmBucketSp: key.salePrice, ipmUpdatedOn: now },
      });
    }
    await tx.$executeRaw`SET CONSTRAINTS inventory.ex_ipm_overlap IMMEDIATE`;
    return changed.length;
  }

  /**
   * `sales.default_price_level` for a scope, through the settings resolver —
   * never app_setting_value directly. 1–4 (A–D); anything else reads as A,
   * the catalog default.
   */
  private async defaultPriceLevel(
    scope: { companyId: string | null; branchId: string | null },
    cache: Map<string, number>,
  ): Promise<number> {
    const cacheKey = `${scope.companyId ?? ''}|${scope.branchId ?? ''}`;
    const cached = cache.get(cacheKey);
    if (cached !== undefined) {
      return cached;
    }
    const effective = await this.appSettingValueService.resolveEffective({
      companyId: scope.companyId ?? undefined,
      branchId: scope.branchId ?? undefined,
    });
    const raw = effective.find((entry) => entry.asdKey === DEFAULT_PRICE_LEVEL_SETTING_KEY)?.value;
    const parsed = Number.parseInt(raw ?? '', 10);
    const level = parsed >= 1 && parsed <= 4 ? parsed : 1;
    cache.set(cacheKey, level);
    return level;
  }
}

/** What derivation needs, off a stored row. */
export function toBucketSource(row: {
  ipmCompanyId: string | null;
  ipmBranchId: string | null;
  ipmMaxPrice: Prisma.Decimal | number;
  ipmSalesPriceA: Prisma.Decimal | number;
  ipmSalesPriceB: Prisma.Decimal | number;
  ipmSalesPriceC: Prisma.Decimal | number;
  ipmSalesPriceD: Prisma.Decimal | number;
}): PriceBucketSource {
  return {
    companyId: row.ipmCompanyId,
    branchId: row.ipmBranchId,
    maxPrice: toNumber(row.ipmMaxPrice),
    prices: [
      toNumber(row.ipmSalesPriceA),
      toNumber(row.ipmSalesPriceB),
      toNumber(row.ipmSalesPriceC),
      toNumber(row.ipmSalesPriceD),
    ],
  };
}

/** Would these two rows hold one `ex_ipm_overlap` slot under the given keys? */
function collide(
  a: {
    ipmCompanyId: string | null;
    ipmBranchId: string | null;
    ipmUcUnitId: string;
    ipmEffectiveFrom: Date;
    ipmEffectiveTo: Date;
  },
  keyA: BucketKey,
  b: typeof a,
  keyB: BucketKey,
): boolean {
  return (
    a.ipmCompanyId === b.ipmCompanyId &&
    a.ipmBranchId === b.ipmBranchId &&
    a.ipmUcUnitId === b.ipmUcUnitId &&
    sameBucket(keyA, keyB) &&
    toDay(a.ipmEffectiveFrom) <= toDay(b.ipmEffectiveTo) &&
    toDay(b.ipmEffectiveFrom) <= toDay(a.ipmEffectiveTo)
  );
}
