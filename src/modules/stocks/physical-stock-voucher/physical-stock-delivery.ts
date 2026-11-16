import { Prisma } from '@prisma/client';
import { wordingFor, type UserWording } from 'src/common/error-wording/error-wording';
import { DELIVERY_ERROR_CODES } from '../../sales/delivery/core/delivery.constants';
import {
  readHoldingUndelivered,
  readSellUnits,
  undeliveredKey,
} from '../stock-voucher/count-undelivered.helper';
import type {
  PagedResult,
  StockCountSheetRow,
  StockVoucherLineProblem,
  StockVoucherLinePayload,
  StockVoucherPayload,
} from '../stock-voucher/types/stock-voucher.types';

/**
 * Delivery tracking on menu 45 (plan §8.4 item 10, addendum §5.3): the keys
 * the Physical Stock screen needs to compare the shelf with PHYSICAL =
 * book + Billed not delivered.
 *
 *   count-sheet rows   undeliveredQty, physicalQty, undeliveredBills[] (oldest
 *                      first), sellUnitName, sellUnitFactor — live
 *   /get lines         shelfQty, undeliveredQty, physicalQty (the snapshot of
 *                      the last save, from the shared service) + the bills
 *                      behind it (live, DRAFT only; [] once posted) and the
 *                      selling unit
 *   /validate rows     + undeliveredQty (live), previousUndeliveredQty (the
 *                      snapshot), undeliveredChanged and the WARN
 *                      PHY_UNDELIVERED_CHANGED when the two differ
 *
 * Quantities are numbers in the base unit, as the rest of this route's keys.
 */
type Client = Pick<Prisma.TransactionClient, '$queryRaw'>;

export interface UndeliveredValidateWarning {
  code: string;
  level: 'WARN';
  message: string;
  params: Record<string, string | number>;
  user: UserWording | null;
}

export type ValidateRowWithUndelivered = StockVoucherLineProblem & {
  undeliveredQty?: number;
  previousUndeliveredQty?: number;
  undeliveredChanged?: boolean;
  warning?: UndeliveredValidateWarning | null;
};

/** count-sheet: every row gets its holding's Billed not delivered and the bills behind it. */
export async function withUndeliveredOnSheet(
  client: Client,
  scope: { companyId: string; branchId: string; godownId: string },
  page: PagedResult<StockCountSheetRow>,
): Promise<PagedResult<StockCountSheetRow>> {
  const itemIds = page.items.map((r) => r.itemId);
  const [bnd, units] = await Promise.all([
    readHoldingUndelivered(client, {
      companyId: scope.companyId,
      branchId: scope.branchId,
      godownIds: [scope.godownId],
      itemIds,
      withBills: true,
    }),
    readSellUnits(client, itemIds),
  ]);
  return {
    ...page,
    items: page.items.map((r) => {
      const h = bnd.get(undeliveredKey(r.godownId, r.itemId, r.lotId, r.bucket));
      const undeliveredQty = h ? Number(h.bndBase) : 0;
      const unit = units.get(r.itemId);
      return {
        ...r,
        undeliveredQty,
        physicalQty: Number(new Prisma.Decimal(r.bookQty ?? 0).plus(h?.bndBase ?? 0)),
        undeliveredBills: h?.bills ?? [],
        sellUnitName: unit?.name ?? r.unitName,
        sellUnitFactor: unit?.factor ?? 1,
      };
    }),
  };
}

/** /get with svhId: the selling unit on every line and, on a DRAFT, the bills behind its BND. */
export async function withUndeliveredOnDocument<T extends StockVoucherPayload>(
  client: Client,
  doc: T,
): Promise<T> {
  const lines = doc.lines as (StockVoucherLinePayload & Record<string, unknown>)[];
  const itemIds = lines.map((l) => l.itemId);
  const draft = doc.header.status === 'DRAFT';
  const [bnd, units] = await Promise.all([
    draft
      ? readHoldingUndelivered(client, {
          companyId: doc.header.companyId,
          branchId: doc.header.branchId,
          godownIds: lines.map((l) => l.godownId),
          itemIds,
          withBills: true,
        })
      : Promise.resolve(null),
    readSellUnits(client, itemIds),
  ]);
  return {
    ...doc,
    lines: lines.map((l) => {
      const unit = units.get(l.itemId);
      const h = bnd?.get(undeliveredKey(l.godownId, l.itemId, l.lotId, l.bucket));
      return {
        ...l,
        undeliveredBills: h?.bills ?? [],
        sellUnitName: unit?.name ?? l.unitName,
        sellUnitFactor: unit?.factor ?? 1,
      };
    }),
  } as T;
}

/**
 * /validate: compare each count line's Billed-not-delivered snapshot with the
 * live figure — the WARN PHY_UNDELIVERED_CHANGED (as the book drift check,
 * advisory: never a problem that blocks the post).
 */
export async function withUndeliveredOnValidate(
  client: Client,
  scope: { svhId: string; accYear: string; companyId: string; branchId: string },
  rows: readonly StockVoucherLineProblem[],
): Promise<ValidateRowWithUndelivered[]> {
  const stored = await client.$queryRaw<
    {
      svi_id: string;
      svi_line_no: number;
      svi_godown_id: string;
      svi_item_id: string;
      svi_lot_id: string | null;
      svi_bucket: string;
      svi_undelivered_qty: Prisma.Decimal | null;
      item_name: string | null;
    }[]
  >`
    SELECT svi.svi_id, svi.svi_line_no, svi.svi_godown_id, svi.svi_item_id, svi.svi_lot_id,
           svi.svi_bucket, svi.svi_undelivered_qty, itm.item_name_en AS item_name
      FROM stock.stock_voucher_item svi
      JOIN inventory.item_master itm ON itm.item_id = svi.svi_item_id
     WHERE svi.svi_voucher_id = ${scope.svhId}::uuid
       AND svi.svi_acc_year = ${scope.accYear}::bpchar
       AND svi.svi_is_deleted = false`;
  const live = await readHoldingUndelivered(client, {
    companyId: scope.companyId,
    branchId: scope.branchId,
    godownIds: stored.map((s) => s.svi_godown_id),
    itemIds: stored.map((s) => s.svi_item_id),
  });
  const byId = new Map(stored.map((s) => [s.svi_id, s]));
  return rows.map((r) => {
    const s = byId.get(r.sviId);
    if (!s) {
      return r;
    }
    const before = new Prisma.Decimal(s.svi_undelivered_qty ?? 0);
    const now = (
      live.get(undeliveredKey(s.svi_godown_id, s.svi_item_id, s.svi_lot_id, s.svi_bucket))?.bndBase ??
      new Prisma.Decimal(0)
    ).toDecimalPlaces(6, Prisma.Decimal.ROUND_HALF_UP);
    const changed = !before.equals(now);
    const item = s.item_name ?? r.itemName;
    const params = { n: r.lineNo, item, old: Number(before), new: Number(now) };
    const message =
      `Line ${r.lineNo}: ${item} had ${Number(before)} billed not delivered when the sheet was ` +
      `drawn; now ${Number(now)}. Check the count before posting.`;
    return {
      ...r,
      undeliveredQty: Number(now),
      previousUndeliveredQty: Number(before),
      undeliveredChanged: changed,
      warning: changed
        ? {
            code: DELIVERY_ERROR_CODES.PHY_UNDELIVERED_CHANGED,
            level: 'WARN' as const,
            message,
            params,
            user: wordingFor({ code: DELIVERY_ERROR_CODES.PHY_UNDELIVERED_CHANGED, params }),
          }
        : null,
    };
  });
}
