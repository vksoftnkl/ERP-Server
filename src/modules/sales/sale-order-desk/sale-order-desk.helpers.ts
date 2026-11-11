import { Prisma, SaleOrder } from '@prisma/client';
import {
  appendTxnStatusLog,
  TxnStatusEvent,
} from 'src/common/txn-status-log/txn-status-log.helper';
import { throwSalesNotFound } from 'src/common/utils/module-service.utils';
import { throwSalesInvalid, throwSalesLocked } from '../posting/sales.errors';
import { SALES_ERROR_CODES } from '../posting/types/posting.types';
import {
  SALE_ORDER_STATUS_SRC_DOC_TYPE,
  SALE_ORDER_STATUS_SRC_MODULE,
  type SaleOrderErrorDetail,
  type SaleOrderErrorResponse,
} from '../sale-order/types/sale-order-api.types';
import { SALE_ORDER_DESK_OPEN_STATUSES } from './types/sale-order-desk.types';

/** The four keys of one order. */
export interface DeskOrderKeys {
  soId: string;
  soCompanyId: string;
  soBranchId: string;
  soAccYear: string;
}

/** A reason the desk must have: trimmed, or 400 SALES_ORDER_REASON_REQUIRED. */
export function requireReason(reason: string | null | undefined, field = 'reason'): string {
  const text = (reason ?? '').trim();
  if (!text) {
    throwSalesInvalid(
      'Say why: a reason is required',
      SALES_ERROR_CODES.ORDER_REASON_REQUIRED,
      field,
    );
  }
  return text;
}

/** Cut to a column's length (the reason columns are varchar(250)). */
export function clip(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) : text;
}

/**
 * The order under a row lock (`SELECT … FOR UPDATE`, the lifecycle `lock()`
 * way), live in this company and branch, or 404 SALES_NOT_FOUND.
 */
export async function lockDeskOrder(
  tx: Prisma.TransactionClient,
  keys: DeskOrderKeys,
): Promise<SaleOrder> {
  const rows = await tx.$queryRaw<{ so_id: string }[]>`
    SELECT so_id FROM sales.sale_order
     WHERE so_id = ${keys.soId}::uuid AND so_acc_year = ${keys.soAccYear}::char(9)
       AND so_company_id = ${keys.soCompanyId}::uuid AND so_branch_id = ${keys.soBranchId}::uuid
       AND so_is_deleted = false
     FOR UPDATE`;
  const order =
    rows.length > 0
      ? await tx.saleOrder.findFirst({ where: { soId: keys.soId, soAccYear: keys.soAccYear } })
      : null;
  if (!order) {
    throwSalesNotFound<SaleOrderErrorDetail, SaleOrderErrorResponse>(
      'Order not found',
      'soId',
      `No live order ${keys.soId} (${keys.soAccYear}) in this company and branch`,
      SALES_ERROR_CODES.NOT_FOUND,
    );
  }
  return order;
}

/** How many of the order's live lines still have something to deliver. */
export async function countOpenLines(
  tx: Prisma.TransactionClient,
  order: Pick<SaleOrder, 'soId' | 'soAccYear'>,
): Promise<number> {
  return tx.saleOrderItem.count({
    where: {
      soiOrderId: order.soId,
      soiAccYear: order.soAccYear,
      soiIsDeleted: false,
      soiPendingQty: { gt: 0 },
    },
  });
}

/**
 * The desk acts only on a CONFIRMED / PARTIAL order with a line still open.
 * Anything else — a DRAFT, or a finished order (COMPLETED / CANCELLED /
 * CLOSED / EXPIRED, sale-order.service's SALE_ORDER_TERMINAL_STATUSES) — or
 * one whose lines are all settled is 409 SALES_ORDER_CLOSED, with the stored
 * status on the detail.
 */
export function assertDeskOrderOpen(order: SaleOrder, openLines: number): void {
  if (!SALE_ORDER_DESK_OPEN_STATUSES.includes(order.soStatus)) {
    throwSalesLocked(
      `Order ${order.soOrderRefno} is ${order.soStatus}: nothing is left open on it`,
      SALES_ERROR_CODES.ORDER_CLOSED,
      'soId',
      { status: order.soStatus },
    );
  }
  if (openLines <= 0) {
    throwSalesLocked(
      `Order ${order.soOrderRefno} has no open line left`,
      SALES_ERROR_CODES.ORDER_CLOSED,
      'soId',
      { status: order.soStatus },
    );
  }
}

/** One step of the order's trail (public.txn_status_log), in the caller's transaction. */
export async function appendDeskStep(
  tx: Prisma.TransactionClient,
  order: SaleOrder,
  step: {
    event: TxnStatusEvent;
    fromStatus: string | null;
    toStatus: string;
    remarks: string | null;
  },
  actor: string,
  now: Date,
): Promise<void> {
  await appendTxnStatusLog(tx, {
    companyId: order.soCompanyId,
    branchId: order.soBranchId,
    tenantId: order.soTenantId,
    accYear: order.soAccYear,
    srcModule: SALE_ORDER_STATUS_SRC_MODULE,
    srcDocType: SALE_ORDER_STATUS_SRC_DOC_TYPE,
    srcDocId: order.soId,
    srcDocRefno: order.soOrderRefno,
    event: step.event,
    fromStatus: step.fromStatus,
    toStatus: step.toStatus,
    changedOn: now,
    changedBy: actor,
    remarks: step.remarks === null ? null : clip(step.remarks, 500),
    deviceId: order.soDeviceId,
    sessionId: order.soSessionId,
  });
}

/** A Decimal as a JSON number at the column's scale (the cancel-lines convention). */
export function money(value: Prisma.Decimal | null | undefined): number {
  return (value ?? new Prisma.Decimal(0))
    .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)
    .toNumber();
}
export function qty(value: Prisma.Decimal | null | undefined): number {
  return (value ?? new Prisma.Decimal(0))
    .toDecimalPlaces(3, Prisma.Decimal.ROUND_HALF_UP)
    .toNumber();
}
export function dec(value: Prisma.Decimal | number | string | null | undefined): Prisma.Decimal {
  if (value === null || value === undefined || value === '') {
    return new Prisma.Decimal(0);
  }
  return value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value);
}
