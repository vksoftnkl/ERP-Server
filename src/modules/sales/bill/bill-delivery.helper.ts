import { Prisma } from '@prisma/client';
import { throwSalesLocked, throwSalesRefused } from '../posting/sales.errors';
import type { SalesRefusal } from '../posting/types/posting.types';
import {
  DELIVERY_ERROR_CODES,
  DELIVERY_MODES,
  type DeliveryMode,
} from '../delivery/core/delivery.constants';
import type { BillLineFacts } from '../delivery/core/delivery-pending.service';

/**
 * Delivery tracking plan §8.4 — the bill's side of delivery: its mode at save,
 * and the D6 guards an amend / cancel / void must pass before anything is
 * unwound (and before the IRN is cancelled at the portal, C7).
 */

/** Sales Bill (3): the base every child voucher type inherits a NULL mode from. */
const SALES_BILL_TYPE_ID = 3;

export function isDeliveryMode(v: unknown): v is DeliveryMode {
  return typeof v === 'string' && (DELIVERY_MODES as readonly string[]).includes(v);
}

/**
 * Decision 42: a counter (POS) bill is always INSTANT. The refusal when another
 * mode is asked for, or null. Pure: /bills/create checks it BEFORE the number is
 * drawn (round 2: it used to be met after the numbering), /bills/validate lists
 * it in refusals[], and resolveBillDeliveryMode throws it, so all three agree.
 */
export function posDeliveryModeRefusal(
  billMode: string | null | undefined,
  requestedMode: string | null | undefined,
): SalesRefusal | null {
  const requested = isDeliveryMode(requestedMode) ? requestedMode : null;
  if ((billMode ?? '').toUpperCase() !== 'POS' || !requested || requested === 'INSTANT') {
    return null;
  }
  return {
    code: DELIVERY_ERROR_CODES.BILL_DELIVERY_MODE_POS,
    message: `A counter (POS) bill is always INSTANT; ${requested} was asked for`,
    field: 'sbDeliveryMode',
  };
}

/** Throw BILL_DELIVERY_MODE_POS (422) when posDeliveryModeRefusal finds one. */
export function assertPosDeliveryMode(
  billMode: string | null | undefined,
  requestedMode: string | null | undefined,
): void {
  const refusal = posDeliveryModeRefusal(billMode, requestedMode);
  if (refusal) {
    throwSalesRefused(refusal.message, refusal.code, refusal.field ?? 'sbDeliveryMode');
  }
}

/**
 * The mode a bill is saved with (§8.4 item 1, Q3, decision 42, N5).
 *
 *   POS bill                      → INSTANT; any other mode asked for is refused
 *   asked for (PICKUP / DISPATCH / INSTANT) → that
 *   the voucher type's mode (child → Sales Bill 3), else INSTANT:
 *     INSTANT                     → INSTANT (an order does not change it, N5)
 *     PICKUP / DISPATCH           → the order's, when the bill is made from a
 *                                   Sales Order (Store pickup → PICKUP, any
 *                                   other → DISPATCH), else the type's
 */
export async function resolveBillDeliveryMode(
  tx: Prisma.TransactionClient,
  input: {
    billMode: string | null | undefined;
    vchrTypeId: number | null | undefined;
    requested: string | null | undefined;
    srcDocType?: string | null;
    srcDocId?: string | null;
    items?: readonly { sbiSrcDocType?: string | null; sbiSrcDocId?: string | null }[] | null;
  },
): Promise<DeliveryMode> {
  const requested = isDeliveryMode(input.requested) ? input.requested : null;
  if ((input.billMode ?? '').toUpperCase() === 'POS') {
    assertPosDeliveryMode(input.billMode, input.requested);
    return 'INSTANT';
  }
  if (requested) {
    return requested;
  }
  const typeMode = await voucherTypeDeliveryMode(tx, input.vchrTypeId ?? SALES_BILL_TYPE_ID);
  if (typeMode === 'INSTANT') {
    return 'INSTANT';
  }
  const orderId =
    input.srcDocType === 'SALES_ORDER' && input.srcDocId
      ? input.srcDocId
      : ((input.items ?? []).find((i) => i.sbiSrcDocType === 'SALES_ORDER' && i.sbiSrcDocId)
          ?.sbiSrcDocId ?? null);
  if (orderId) {
    const [order] = await tx.$queryRaw<{ so_delivery_mode: string | null }[]>`
      SELECT so_delivery_mode FROM sales.sale_order WHERE so_id = ${orderId}::uuid LIMIT 1`;
    const om = (order?.so_delivery_mode ?? '').trim().toUpperCase();
    if (om) {
      return om === 'STORE_PICKUP' ? 'PICKUP' : 'DISPATCH';
    }
  }
  return typeMode;
}

/** A voucher type's delivery mode: its own, else its parent's, else INSTANT. */
export async function voucherTypeDeliveryMode(
  client: Prisma.TransactionClient,
  vchrTypeId: number,
): Promise<DeliveryMode> {
  const [row] = await client.$queryRaw<{ own: string | null; base: string | null }[]>`
    SELECT t.vchr_delivery_mode AS own, p.vchr_delivery_mode AS base
      FROM accounts.acc_voucher_types t
      LEFT JOIN accounts.acc_voucher_types p ON p.vchr_type_id = t.vchr_parent_id
     WHERE t.vchr_type_id = ${vchrTypeId}::int`;
  const mode = row?.own ?? row?.base ?? null;
  return isDeliveryMode(mode) ? mode : 'INSTANT';
}

/**
 * D6 on amend (§8.4 item 4), BEFORE the unwind and the IRN step: every line
 * with any delivery event must be kept (same sbiId) with the same item, unit,
 * godown, lot and bucket, and its new qty may not go below what is settled
 * (given or returned). A different mode → BILL_DELIVERY_MODE_LOCKED.
 */
export function assertAmendKeepsDelivery(
  bill: { sbDeliveryMode: string; sbBillRefno: string | null },
  requestedMode: string | null | undefined,
  lines: readonly BillLineFacts[],
  newItems: readonly {
    sbiId?: string | null;
    sbiItemId?: string | null;
    sbiItemUnitId?: string | null;
    sbiGodownId?: string | null;
    sbiLotId?: string | null;
    sbiBucket?: string | null;
    sbiBillQty?: string | number | null;
  }[],
  names: ReadonlyMap<string, { itemName: string; unitName: string }>,
): void {
  if (isDeliveryMode(requestedMode) && requestedMode !== bill.sbDeliveryMode) {
    throwSalesLocked(
      `The delivery mode of a posted bill changes only on Pending Deliveries (Pickup ↔ Dispatch); ${bill.sbDeliveryMode} → ${requestedMode} was asked for`,
      DELIVERY_ERROR_CODES.BILL_DELIVERY_MODE_LOCKED,
      'sbDeliveryMode',
    );
  }
  const byId = new Map(newItems.filter((i) => i.sbiId).map((i) => [i.sbiId as string, i]));
  for (const l of lines) {
    // Any event at all: a line once given and fully cancelled nets to 0 and is free.
    if (l.settledQty.isZero() && l.givenQty.isZero()) {
      continue;
    }
    const n = names.get(l.billItemId) ?? { itemName: l.itemId, unitName: '' };
    const params = {
      n: l.lineNo,
      item: n.itemName,
      given: l.settledQty.toString(),
      unit: n.unitName,
    };
    const next = byId.get(l.billItemId);
    const fail = (why: string): never =>
      throwSalesLocked(
        `Line ${l.lineNo} (${n.itemName}): ${l.settledQty.toString()} ${n.unitName} already given or returned — ${why}`,
        DELIVERY_ERROR_CODES.BILL_DELIVERED_AMEND,
        `items[${l.lineNo}]`,
        { line: l.lineNo, params },
      );
    if (!next) {
      fail('the line cannot be dropped');
    }
    const same = (a: string | null | undefined, b: string | null | undefined) =>
      (a ?? null) === (b ?? null);
    if (
      (next!.sbiItemId !== undefined && !same(next!.sbiItemId, l.itemId)) ||
      (next!.sbiItemUnitId !== undefined && !same(next!.sbiItemUnitId, l.unitId)) ||
      (next!.sbiGodownId !== undefined && !same(next!.sbiGodownId, l.godownId)) ||
      (next!.sbiLotId !== undefined && !same(next!.sbiLotId, l.lotId)) ||
      (next!.sbiBucket !== undefined && !same(next!.sbiBucket ?? 'SALEABLE', l.bucket))
    ) {
      fail('its item, unit, godown, lot and bucket must stay');
    }
    const qty =
      next!.sbiBillQty === undefined || next!.sbiBillQty === null
        ? l.billedQty
        : new Prisma.Decimal(String(next!.sbiBillQty));
    if (qty.lessThan(l.settledQty)) {
      fail(`the qty cannot go below ${l.settledQty.toString()}`);
    }
  }
}

/** D6 on cancel / void (§8.4 item 3): any line with given ≠ 0. */
export function assertNothingGiven(
  bill: { sbBillRefno: string | null },
  lines: readonly BillLineFacts[],
  lastNote: { refno: string | null; date: string | null } | null,
): void {
  const given = lines.find((l) => !l.givenQty.isZero());
  if (given) {
    throwSalesLocked(
      `${bill.sbBillRefno ?? 'This bill'}: goods left the godown${lastNote?.refno ? ` on ${lastNote.refno}` : ''}; a bill with given goods cannot be cancelled — make a sale return instead`,
      DELIVERY_ERROR_CODES.BILL_DELIVERED_CANCEL,
      'sbId',
      {
        params: {
          bill: bill.sbBillRefno ?? '',
          dn: lastNote?.refno ?? '',
          date: lastNote?.date ?? '',
        },
      },
    );
  }
}

/** Item and unit names of bill lines, for the D6 wording. */
export async function deliveryLineNames(
  tx: Prisma.TransactionClient,
  billItemIds: readonly string[],
): Promise<Map<string, { itemName: string; unitName: string }>> {
  const out = new Map<string, { itemName: string; unitName: string }>();
  if (billItemIds.length === 0) {
    return out;
  }
  const rows = await tx.$queryRaw<{ sbi_id: string; item_name: string | null; unit_name: string | null }[]>`
    SELECT i.sbi_id, im.item_name_en AS item_name, um.unit_name
      FROM sales.sale_bill_item i
      JOIN inventory.item_master im ON im.item_id = i.sbi_item_id
      LEFT JOIN inventory.item_unit_conversion u ON u.iuc_id = i.sbi_item_unit_id
      LEFT JOIN inventory.item_unit_master um ON um.unit_id = u.iuc_unit_id
     WHERE i.sbi_id = ANY(${[...billItemIds]}::uuid[])`;
  for (const r of rows) {
    out.set(r.sbi_id, { itemName: r.item_name ?? '', unitName: r.unit_name ?? '' });
  }
  return out;
}

/** An instant as the IST date a person reads: DD-MM-YYYY. */
export function istDateText(at: Date | null | undefined): string {
  if (!at) {
    return '';
  }
  const ist = new Date(at.getTime() + 330 * 60_000);
  const dd = String(ist.getUTCDate()).padStart(2, '0');
  const mm = String(ist.getUTCMonth() + 1).padStart(2, '0');
  return `${dd}-${mm}-${ist.getUTCFullYear()}`;
}
