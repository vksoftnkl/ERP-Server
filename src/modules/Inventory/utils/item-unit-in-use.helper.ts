import { Prisma } from '@prisma/client';
import type { InventoryWriteClient } from 'src/common/utils/module-service.utils';

/**
 * Item master review 2026-11-20, Q2 / point 11 (user: "all recommended") — is an
 * item unit conversion row USED?
 *
 * Re-picking the unit of a row keeps its iuc_id, so every row that points at it
 * would silently read the new unit: a bill that sold 1 BOX would read 1 CASE. A
 * row counts as used when a TRANSACTION line or a stock row holds its iuc_id:
 *
 *  - stock: the ledger (`sml_uom_id`, every posted movement of every module) and
 *    the stock voucher lines (`svi_uom_id`, drafts of opening / physical /
 *    adjustment / transfer included);
 *  - sales: bill, order, quotation, return, delivery challan, challan return,
 *    delivery note and loyalty gift redemption lines;
 *  - purchase: order, GRN, invoice, shortage receipt and return lines;
 *  - accounts: the GST item detail of a voucher (`vtx_unit_id`).
 *
 * Only live lines count (`*_is_deleted = false`): a cancelled document is still
 * live and still shows its unit; a deleted draft shows nothing.
 *
 * NOT counted, on purpose — they are the item's own set-up, and when a wrongly
 * picked unit is put right they should follow the row, not block it:
 *  - the item card's own price, barcode, reorder and qty-price rows (the user's
 *    "quantities, prices and barcodes stay; only the unit changes");
 *  - supplier item buy unit, customer item rates, promotion / loyalty slabs,
 *    reorder policy, demand / forecast rows.
 *  - The base-unit columns (`*_base_uom_id`: balance, lot, average cost,
 *    reservation, transit): they only ever name the base row, every one of them
 *    comes from a ledger or document line above, and the base row is judged by
 *    the whole item anyway (see `UnitRowsInUse.itemUsed`).
 *
 * Identifiers below are constants, never request values.
 */
const UNIT_ROW_USES: ReadonlyArray<{
  table: string;
  column: string;
  deleted: string;
  usedBy: string;
}> = [
  { table: 'stock.stock_ledger', column: 'sml_uom_id', deleted: 'sml_is_deleted', usedBy: 'stock' },
  {
    table: 'stock.stock_voucher_item',
    column: 'svi_uom_id',
    deleted: 'svi_is_deleted',
    usedBy: 'stock voucher',
  },
  {
    table: 'sales.sale_bill_item',
    column: 'sbi_item_unit_id',
    deleted: 'sbi_is_deleted',
    usedBy: 'sale bill',
  },
  {
    table: 'sales.sale_order_item',
    column: 'soi_item_unit_id',
    deleted: 'soi_is_deleted',
    usedBy: 'sale order',
  },
  {
    table: 'sales.sale_quotation_item',
    column: 'sqi_item_unit_id',
    deleted: 'sqi_is_deleted',
    usedBy: 'quotation',
  },
  {
    table: 'sales.sale_return_item',
    column: 'sri_item_unit_id',
    deleted: 'sri_is_deleted',
    usedBy: 'sale return',
  },
  {
    table: 'sales.sale_dc_item',
    column: 'sdi_item_unit_id',
    deleted: 'sdi_is_deleted',
    usedBy: 'delivery challan',
  },
  {
    table: 'sales.sale_dc_return_item',
    column: 'sdri_item_unit_id',
    deleted: 'sdri_is_deleted',
    usedBy: 'challan return',
  },
  {
    table: 'sales.sale_delivery_note_item',
    column: 'sdni_item_unit_id',
    deleted: 'sdni_is_deleted',
    usedBy: 'delivery note',
  },
  {
    table: 'sales.loyalty_gift_redeem_item',
    column: 'lgd_unit_id',
    deleted: 'lgd_is_deleted',
    usedBy: 'gift redemption',
  },
  {
    table: 'purchase.pur_order_item',
    column: 'poi_uom_id',
    deleted: 'poi_is_deleted',
    usedBy: 'purchase order',
  },
  { table: 'purchase.pur_grn_item', column: 'gri_uom_id', deleted: 'gri_is_deleted', usedBy: 'GRN' },
  {
    table: 'purchase.pur_invoice_item',
    column: 'pii_uom_id',
    deleted: 'pii_is_deleted',
    usedBy: 'purchase invoice',
  },
  {
    table: 'purchase.pur_shortage_receipt_item',
    column: 'psri_uom_id',
    deleted: 'psri_is_deleted',
    usedBy: 'shortage receipt',
  },
  {
    table: 'purchase.pur_return_item',
    column: 'pri_uom_id',
    deleted: 'pri_is_deleted',
    usedBy: 'purchase return',
  },
  {
    table: 'accounts.acc_voucher_doc_detail',
    column: 'vtx_unit_id',
    deleted: 'vtx_is_deleted',
    usedBy: 'accounts voucher',
  },
];

/** The order the kinds are listed in, whatever order the query answers in. */
const USED_BY_ORDER = new Map(UNIT_ROW_USES.map((use, index) => [use.usedBy, index]));

export type UnitRowsInUse = {
  /** iuc_id → what holds it ("sale bill", "stock" …), for every used row of the item. */
  byRow: ReadonlyMap<string, readonly string[]>;
  /** Any unit row of the item, live or removed, is used: the item has been traded or stocked. */
  itemUsed: boolean;
  /** Every kind that holds any row of the item, in a fixed order. */
  itemUsedBy: readonly string[];
};

/**
 * Which of the item's unit conversion rows (removed ones included: an old bill
 * may still name one) are used, and by what. One statement, one scan per table
 * listed above; no rows when the item has no unit rows.
 */
export async function unitRowsInUse(
  client: InventoryWriteClient,
  itemId: string,
): Promise<UnitRowsInUse> {
  const ids = (
    await client.itemUnitConversion.findMany({
      where: { iucItemId: itemId },
      select: { iucId: true },
    })
  ).map((row) => row.iucId);
  if (ids.length === 0) {
    return { byRow: new Map(), itemUsed: false, itemUsedBy: [] };
  }
  const branches = UNIT_ROW_USES.map(
    (use) => Prisma.sql`
      SELECT DISTINCT x.${Prisma.raw(use.column)}::text AS iuc_id, ${use.usedBy}::text AS used_by
        FROM ${Prisma.raw(use.table)} x
       WHERE x.${Prisma.raw(use.column)} = ANY(${ids}::uuid[])
         AND x.${Prisma.raw(use.deleted)} = false`,
  );
  const rows = await client.$queryRaw<{ iuc_id: string; used_by: string }[]>`${Prisma.join(
    branches,
    ' UNION ALL ',
  )}`;
  const byRow = new Map<string, string[]>();
  const all = new Set<string>();
  for (const row of rows) {
    const kinds = byRow.get(row.iuc_id) ?? [];
    if (!kinds.includes(row.used_by)) kinds.push(row.used_by);
    byRow.set(row.iuc_id, kinds);
    all.add(row.used_by);
  }
  const ordered = (kinds: Iterable<string>) =>
    [...kinds].sort((a, b) => (USED_BY_ORDER.get(a) ?? 99) - (USED_BY_ORDER.get(b) ?? 99));
  for (const [iucId, kinds] of byRow) byRow.set(iucId, ordered(kinds));
  return { byRow, itemUsed: byRow.size > 0, itemUsedBy: ordered(all) };
}

/**
 * Whether a row's unit may no longer be re-picked, and why: the base row once the
 * item is used at all (stock is counted in it — a 0.5 KG till sale would read
 * 0.5 PC), any other row once that row itself is used.
 */
export function rowUnitLock(
  inUse: UnitRowsInUse,
  row: { iuc_id: string; iuc_is_base_unit: boolean },
): { locked: boolean; usedBy: readonly string[] } {
  if (row.iuc_is_base_unit) {
    return { locked: inUse.itemUsed, usedBy: inUse.itemUsedBy };
  }
  const usedBy = inUse.byRow.get(row.iuc_id) ?? [];
  return { locked: usedBy.length > 0, usedBy };
}
