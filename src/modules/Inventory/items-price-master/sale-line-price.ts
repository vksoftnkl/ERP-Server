import { CustItemRate, ItemMaster, Prisma } from '@prisma/client';
import { toNullableNumber, toNumber } from '../../../common/utils/module-service.utils';
import type { PriceRowWithUnit } from '../../master-lookup/types/master-lookup-internal.types';
import { priceForLevel, selectUnitRate } from '../../master-lookup/utils/item-price.utils';
import {
  bucketKeyFor,
  readBucketTrackFlags,
  type BucketTrackFlags,
} from '../../stocks/stock-voucher/stock-voucher-posting.helper';
import {
  isApplyQtyPricesOn,
  qtySlabOf,
  slabsFor,
  type QtySlab,
} from '../items-qty-price-master/qty-slab.rules';
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
} from './price-resolver';

/**
 * ONE answer to "what does this item sell for on this line" (review step 6, D12): the unit,
 * the bucket, the price row, the level's price and the customer rate — the steps
 * `/master-lookups/item-price` has always taken, extracted here so the Sale Bill's rate lock
 * judges a line by exactly the price the screen was given. Two readers:
 *   - ItemPriceLookup (the screen's lookup), which builds its payload around the answer;
 *   - the Sale Bill rate / discount lock (sales/bill/bill-rate-discount-lock.ts).
 * Change it here and both move together.
 *
 * It reads; it never throws a coded error. A line it cannot price comes back as a
 * `SaleLinePriceMiss` naming why, and each reader decides what that means (the lookup: the
 * 404 it always answered; the lock: "no normal rate — the cashier types it").
 */

/** What the two readers need of a Prisma client (PrismaService or a transaction). */
export type SaleLinePriceClient = Pick<
  Prisma.TransactionClient,
  'itemMaster' | 'itemPriceMaster' | 'stockLot' | 'custItemRate' | 'itemQtyPrice' | '$queryRaw'
>;

/** One line to price — the lookup's query, resolved to plain values. */
export interface SaleLinePriceQuery {
  itemId: string;
  /** A unit_id or an iuc_id (selectUnitRate matches either); absent = the unit-slno rule. */
  unitId?: string | null;
  companyId?: string | null;
  branchId?: string | null;
  /** The customer (= ledger id); the customer rate is read only when given. */
  customerId?: string | null;
  /** 1–7: A, B, C, D, MRP, min, cost. */
  priceLevel: number;
  /** `YYYY-MM-DD` — the document's date. */
  docDate: string;
  /** The line's own bucket values; ignored when `lotId` is given (the lot's ARE the key). */
  mrp?: number | null;
  salePrice?: number | null;
  lotId?: string | null;
}

export type SaleLinePriceMiss =
  | { ok: false; reason: 'ITEM_NOT_FOUND' }
  | { ok: false; reason: 'PRICE_NOT_FOUND' }
  | { ok: false; reason: 'LOT_NOT_FOUND' }
  | {
      ok: false;
      reason: 'BUCKET_PRICE_NOT_FOUND';
      /** The bucket the line asked for (policy-blanked). */
      key: BucketKey;
      /** Every bucket this unit does price, dearest first. */
      priced: BucketKey[];
    };

export interface SaleLinePrice {
  ok: true;
  item: ItemMaster;
  caller: PriceCallerScope;
  /** The chosen unit's live rows (every bucket). */
  unitRows: PriceRowWithUnit[];
  policy: BucketTrackFlags;
  key: BucketKey;
  resolved: ResolvedPrice<PriceRowWithUnit>;
  /** `resolved.row` — the row that prices the line. */
  rate: PriceRowWithUnit;
  /** The customer's rate row (always the HEADLINE row's: per item and unit, not per MRP). */
  custRate: CustItemRate | null;
  /** The level's price on the row. */
  basePrice: number;
  /** Legacy CSR.csr_disc_qty: only off the A/B/C/D prices (levels 1–4), never 5/6/7. */
  customerDiscQty: number;
  /** basePrice − customerDiscQty: what the lookup answers as `sales_price`. */
  salesPrice: number;
}

export type SaleLinePriceAnswer = SaleLinePrice | SaleLinePriceMiss;

/**
 * Price one line (the lookup's steps 1–3 and its customer rate):
 *  1. the item (branch-scoped when a branch is given) and its price rows in scope;
 *  2. the unit: an explicit unit wins, else the unit-slno rule (retail → highest slno);
 *  3. the bucket key: the lot's identity when the line holds one, else what the line carries,
 *     blanked by the item's stock-track policy on the document's date;
 *  4. the row: the exact bucket, else the headline; a headline-only ask on an item priced
 *     only per MRP takes the dearest bucket (notes 71 B2, provisional);
 *  5. the level's price, less the customer's per-unit discount on levels 1–4.
 */
export async function resolveSaleLinePrice(
  client: SaleLinePriceClient,
  query: SaleLinePriceQuery,
): Promise<SaleLinePriceAnswer> {
  const companyId = query.companyId ?? null;
  const branchId = query.branchId ?? null;
  const docDate = query.docDate.slice(0, 10);
  const [item, priceRows] = await Promise.all([
    client.itemMaster.findFirst({
      where: {
        itemId: query.itemId,
        ...(branchId ? { OR: [{ itemBranchId: branchId }, { itemBranchId: null }] } : {}),
        itemIsDeleted: false,
      },
    }),
    client.itemPriceMaster.findMany({
      where: {
        ipmItemId: query.itemId,
        AND: [
          ...(branchId ? [{ OR: [{ ipmBranchId: branchId }, { ipmBranchId: null }] }] : []),
          ...(companyId ? [{ OR: [{ ipmCompanyId: companyId }, { ipmCompanyId: null }] }] : []),
        ],
        ipmIsDeleted: false,
      },
      include: { itemUnitConversion: { include: { unit: true } } },
      orderBy: [{ itemUnitConversion: { iucUnitSlno: 'asc' } }, { ipmId: 'asc' }],
    }),
  ]);
  if (!item) {
    return { ok: false, reason: 'ITEM_NOT_FOUND' };
  }
  const caller: PriceCallerScope = { companyId, branchId };
  const liveRows = livePriceRows(priceRows, docDate, caller);
  const unitPick = selectUnitRate(liveRows, item.itemRetailItem, query.unitId ?? undefined);
  if (!unitPick) {
    return { ok: false, reason: 'PRICE_NOT_FOUND' };
  }
  const unitRows = liveRows.filter((row) => row.ipmUcUnitId === unitPick.ipmUcUnitId);
  const [policy] = await readBucketTrackFlags(
    client,
    [
      {
        itemId: query.itemId,
        companyId: companyId ?? item.itemCompanyId,
        branchId: branchId ?? item.itemBranchId,
      },
    ],
    docDate,
  );
  const values = await lineBucketValues(client, query);
  if (!values) {
    return { ok: false, reason: 'LOT_NOT_FOUND' };
  }
  const key = bucketKeyFor(policy, values);
  const resolved =
    resolveEffectivePrice(unitRows, key, docDate, caller) ??
    provisionalBucket(unitRows, key, docDate, caller);
  if (!resolved) {
    return {
      ok: false,
      reason: 'BUCKET_PRICE_NOT_FOUND',
      key,
      priced: pricedBuckets(unitRows, docDate, caller).map(({ key: k }) => k),
    };
  }
  const rate = resolved.row;
  // Customer rates are per item and unit, not per MRP: always the headline's.
  const headline = resolveEffectivePrice(unitRows, HEADLINE_KEY, docDate, caller);
  const custRate =
    query.customerId && headline
      ? await client.custItemRate.findFirst({
          where: {
            csrUnitRateId: headline.row.ipmId,
            csrCustomerId: query.customerId,
            csrIsDeleted: false,
            csrIsActive: true,
          },
        })
      : null;
  const basePrice = priceForLevel(rate, query.priceLevel);
  const customerDiscQty =
    custRate && query.priceLevel >= 1 && query.priceLevel <= 4 ? toNumber(custRate.csrDiscQty) : 0;
  return {
    ok: true,
    item,
    caller,
    unitRows,
    policy,
    key,
    resolved,
    rate,
    custRate,
    basePrice,
    customerDiscQty,
    salesPrice: basePrice - customerDiscQty,
  };
}

/**
 * The line's own bucket values, unblanked: a held lot's MRP / sale price when `lotId` is
 * given (they ARE the key), else what the line typed. Null = the lot is not the item's.
 */
async function lineBucketValues(
  client: SaleLinePriceClient,
  query: SaleLinePriceQuery,
): Promise<{ mrp: number | null; salePrice: number | null } | null> {
  if (!query.lotId) {
    return { mrp: query.mrp ?? null, salePrice: query.salePrice ?? null };
  }
  const lot = await client.stockLot.findFirst({
    where: { sltId: query.lotId, sltItemId: query.itemId },
    select: { sltMrp: true, sltSalePrice: true },
  });
  if (!lot) {
    return null;
  }
  return { mrp: toNullableNumber(lot.sltMrp), salePrice: toNullableNumber(lot.sltSalePrice) };
}

/**
 * The live bucket rows of one unit this caller can see, one per bucket — the row the
 * resolver would answer for that bucket — dearest MRP first, then dearest sale price.
 */
export function pricedBuckets(
  unitRows: PriceRowWithUnit[],
  docDate: string,
  caller: PriceCallerScope,
): Array<{ key: BucketKey; row: PriceRowWithUnit; answer: ResolvedPrice<PriceRowWithUnit> }> {
  const keys: BucketKey[] = [];
  for (const row of livePriceRows(unitRows, docDate, caller)) {
    const key = bucketKeyOfRow(row);
    if (!isHeadlineKey(key) && !keys.some((known) => sameBucket(known, key))) {
      keys.push(key);
    }
  }
  return keys
    .map((key) => {
      const answer = resolveEffectivePrice(unitRows, key, docDate, caller)!;
      return { key, row: answer.row, answer };
    })
    .sort(
      (a, b) =>
        (b.key.mrp ?? -1) - (a.key.mrp ?? -1) || (b.key.salePrice ?? -1) - (a.key.salePrice ?? -1),
    );
}

/**
 * Notes 71 B2 — a line with no MRP yet, on an item priced ONLY per MRP (every row a bucket,
 * no headline): the dearest bucket at the most specific scope, PROVISIONAL. Only for a
 * headline ask; a line that named an MRP no row prices gets nothing.
 */
export function provisionalBucket(
  unitRows: PriceRowWithUnit[],
  key: BucketKey,
  docDate: string,
  caller: PriceCallerScope,
): ResolvedPrice<PriceRowWithUnit> | null {
  if (!isHeadlineKey(key)) {
    return null;
  }
  return pricedBuckets(unitRows, docDate, caller)[0]?.answer ?? null;
}

/**
 * What a reader of `sales.apply_qty_prices` needs of the settings resolver
 * (AppSettingValueService.resolveEffective). Absent, the setting's seeded default stands: On.
 */
export interface QtyPriceSettingReader {
  resolveEffective(scope: {
    companyId?: string;
    branchId?: string;
  }): Promise<ReadonlyArray<{ asdKey: string; value: string | null }>>;
}

/** Who and when a line's qty slabs are wanted for. */
export interface QtySlabQuery {
  itemId: string;
  /** The conversion the line was priced in (the slab's own unit, Q4 / Q11). */
  iucId: string;
  companyId?: string | null;
  branchId?: string | null;
  /** The customer (ledger id); none = party-blank slabs only. */
  partyId?: string | null;
  priceLevel: number;
  /** `YYYY-MM-DD`. */
  onDate: string;
}

/**
 * Plan 2026-11-05 §4.4 (B-01) — the qty-wise price slabs that can price this line, ranked
 * most specific first, then by from_qty (the client takes the FIRST whose range holds its
 * qty: `pickSlab`). None when the level is not a selling level 1–4 (Q12), and none when
 * `sales.apply_qty_prices` is off (read only when there is a slab to hide).
 */
export async function rankedQtySlabs(
  client: SaleLinePriceClient,
  query: QtySlabQuery,
  settings?: QtyPriceSettingReader,
): Promise<QtySlab[]> {
  if (query.priceLevel < 1 || query.priceLevel > 4) {
    return [];
  }
  const rows = await client.itemQtyPrice.findMany({
    where: {
      iqpItemId: query.itemId,
      iqpItemUnitId: query.iucId,
      iqpIsDeleted: false,
      iqpIsActive: true,
    },
    orderBy: [{ iqpFromQty: 'asc' }, { iqpId: 'asc' }],
  });
  const ranked = slabsFor(rows.map(qtySlabOf), {
    companyId: query.companyId ?? null,
    branchId: query.branchId ?? null,
    partyId: query.partyId ?? null,
    priceLevel: query.priceLevel,
    onDate: query.onDate,
  });
  if (!ranked.length) {
    return [];
  }
  if (settings) {
    const effective = await settings.resolveEffective({
      companyId: query.companyId ?? undefined,
      branchId: query.branchId ?? undefined,
    });
    if (!isApplyQtyPricesOn(effective)) {
      return [];
    }
  }
  return ranked;
}
