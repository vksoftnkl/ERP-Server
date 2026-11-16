import { Prisma } from '@prisma/client';
import { pendingLinesCte } from '../../sales/delivery/core/delivery-pending.sql';

/**
 * Delivery tracking (plan §8.4 item 10, addendum §5.3) — what a PHYSICAL count
 * needs to compare the shelf with PHYSICAL rather than with the books:
 *
 *   Physical = Book (stock_balance on hand) + Billed not delivered (BND)
 *
 * BND of a holding (godown, item, lot, bucket) is the shared §5.1 fragment
 * (delivery-pending.sql.ts): Σ (billed − settled) × factor over the eligible
 * open bill lines of that holding — the customers' goods still on the shelf.
 * A count that sends `shelfQty` stores svi_counted_qty = shelf − BND (re-read
 * at every save, `svi_undelivered_qty` keeps the snapshot), so the posted
 * variance is shelf − Physical (decision 55). Read-only here; the caller's
 * transaction.
 */
type Client = Pick<Prisma.TransactionClient, '$queryRaw'>;
const D0 = new Prisma.Decimal(0);

/** One bill behind a holding's BND (the "this line" card, addendum callout 14). */
export interface UndeliveredBill {
  billId: string;
  billAccYear: string;
  billRefno: string | null;
  custName: string | null;
  /** Pending in the bill line's own unit. */
  qty: number;
  unitName: string | null;
  /** Pending in the holding's base unit. */
  baseQty: number;
}

export interface HoldingUndelivered {
  bndBase: Prisma.Decimal;
  /** Oldest bill first; only when asked for. */
  bills: UndeliveredBill[];
}

/** The key a count line and a BND row share. */
export function undeliveredKey(
  godownId: string,
  itemId: string,
  lotId: string | null | undefined,
  bucket: string | null | undefined,
): string {
  return `${godownId}|${itemId}|${lotId ?? ''}|${bucket ?? 'SALEABLE'}`;
}

/**
 * BND per holding of the given godowns × items at a branch (base unit), with
 * the bills behind each when `withBills`. Holdings with nothing pending are
 * absent (read them as 0).
 */
export async function readHoldingUndelivered(
  client: Client,
  scope: {
    companyId: string;
    branchId: string;
    godownIds: readonly string[];
    itemIds: readonly string[];
    withBills?: boolean;
  },
): Promise<Map<string, HoldingUndelivered>> {
  const out = new Map<string, HoldingUndelivered>();
  if (scope.godownIds.length === 0 || scope.itemIds.length === 0) {
    return out;
  }
  const rows = await client.$queryRaw<
    {
      bill_id: string;
      bill_acc_year: string;
      bill_refno: string | null;
      cust_name: string | null;
      godown_id: string;
      item_id: string;
      lot_id: string | null;
      bucket: string;
      pending_qty: Prisma.Decimal;
      pending_base: Prisma.Decimal;
      unit_name: string | null;
    }[]
  >`
    WITH op AS (${pendingLinesCte(
      scope.companyId,
      scope.branchId,
      Prisma.sql`AND i.sbi_godown_id = ANY(${[...new Set(scope.godownIds)]}::uuid[])
                 AND i.sbi_item_id = ANY(${[...new Set(scope.itemIds)]}::uuid[])`,
    )})
    SELECT op.bill_id, btrim(op.bill_acc_year) AS bill_acc_year, op.bill_refno,
           COALESCE(c.cus_name, op.cust_name) AS cust_name,
           op.godown_id, op.item_id, op.lot_id, op.bucket,
           op.pending_qty, op.pending_base, um.unit_name
      FROM op
      LEFT JOIN sales.customers c ON c.cus_id = op.cust_id
      LEFT JOIN inventory.item_unit_conversion u ON u.iuc_id = op.unit_id
      LEFT JOIN inventory.item_unit_master um ON um.unit_id = u.iuc_unit_id
     ORDER BY op.bill_date, op.bill_refno, op.line_no`;
  for (const r of rows) {
    const key = undeliveredKey(r.godown_id, r.item_id, r.lot_id, r.bucket);
    const h = out.get(key) ?? { bndBase: D0, bills: [] };
    h.bndBase = h.bndBase.plus(r.pending_base ?? D0);
    if (scope.withBills) {
      h.bills.push({
        billId: r.bill_id,
        billAccYear: r.bill_acc_year,
        billRefno: r.bill_refno,
        custName: r.cust_name,
        qty: Number(r.pending_qty),
        unitName: r.unit_name,
        baseQty: Number(r.pending_base),
      });
    }
    out.set(key, h);
  }
  return out;
}

/** The item's selling unit (iuc_is_default_unit), else its base (factor 1) — the card's "(64 Bag)". */
export async function readSellUnits(
  client: Client,
  itemIds: readonly string[],
): Promise<Map<string, { name: string | null; factor: number }>> {
  const out = new Map<string, { name: string | null; factor: number }>();
  if (itemIds.length === 0) {
    return out;
  }
  const rows = await client.$queryRaw<
    { item_id: string; unit_name: string | null; factor: Prisma.Decimal | null }[]
  >`
    SELECT im.item_id,
           COALESCE(su.unit_name, bu.unit_name) AS unit_name,
           COALESCE(dfl.factor, 1) AS factor
      FROM inventory.item_master im
      LEFT JOIN LATERAL (
        SELECT COALESCE(NULLIF(x.iuc_to_base_factor, 0), 1) AS factor, x.iuc_unit_id
          FROM inventory.item_unit_conversion x
         WHERE x.iuc_item_id = im.item_id AND x.iuc_is_default_unit = true AND x.iuc_is_deleted = false
         ORDER BY x.iuc_unit_slno
         LIMIT 1) dfl ON true
      LEFT JOIN LATERAL (
        SELECT x.iuc_unit_id
          FROM inventory.item_unit_conversion x
         WHERE x.iuc_item_id = im.item_id AND x.iuc_is_base_unit = true AND x.iuc_is_deleted = false
         ORDER BY x.iuc_unit_slno
         LIMIT 1) bw ON true
      LEFT JOIN inventory.item_unit_master su ON su.unit_id = dfl.iuc_unit_id
      LEFT JOIN inventory.item_unit_master bu
             ON bu.unit_id = COALESCE(im.item_base_unit_id, bw.iuc_unit_id)
     WHERE im.item_id = ANY(${[...new Set(itemIds)]}::uuid[])`;
  for (const r of rows) {
    out.set(r.item_id, { name: r.unit_name, factor: Number(r.factor ?? 1) });
  }
  return out;
}

/**
 * The shelf maths (decision 68): what a count line with `shelfQty` stores.
 * counted = shelf − undelivered, which MAY be negative (billed before the
 * stock came); the variance svi_diff_qty = counted − book = shelf − Physical.
 */
export function countedFromShelf(
  shelf: Prisma.Decimal,
  undelivered: Prisma.Decimal,
): Prisma.Decimal {
  return shelf.minus(undelivered);
}
