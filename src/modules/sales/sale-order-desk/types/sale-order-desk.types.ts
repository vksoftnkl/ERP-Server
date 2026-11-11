import type { ReservationShort } from '../../posting/stock-reservation.service';
import type { SaleOrderCancelledLine } from '../../sale-order/types/sale-order-api.types';

/**
 * Sales Order Management — the order desk (menu 299). Plan
 * share/sales/plan-sales-order-management-qt-2026-11-10.md §4, addendum-1 §5.
 *
 * Every action is judged on the Sales Order menu (11); amounts only with
 * Receipt (menu 99) View — without it a money key is ABSENT, not zero.
 */
export const SALE_ORDER_DESK_RECEIPT_MENU_ID = 99;
/** The audit screen every sales-order row files under: 87 'Sale Order' (SALE_ORDER_AUDIT_SCREEN_NAME, user 2026-11-11). */
export const SALE_ORDER_DESK_AUDIT_SCREEN = 'Sale Order';
/** The order statuses the desk acts on: confirmed and part-billed. */
export const SALE_ORDER_DESK_OPEN_STATUSES: readonly string[] = ['CONFIRMED', 'PARTIAL'];
export const SALE_ORDER_DESK_PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT'] as const;
export const SALE_ORDER_DESK_MERGE_MAX = 20;
export const SALE_ORDER_DESK_COVER_MAX = 500;
export const SALE_ORDER_DESK_FIGURES_MAX = 2000;
export const SALE_ORDER_DESK_DEFAULT_MERGE_REASON = 'Merged on the order desk';

export type SaleOrderDeskResponse<T> = { success: true; message: string; data: T };

/** POST /sale-order-desk/delivery-hold */
export interface DeliveryHoldResult {
  soId: string;
  soAccYear: string;
  soOrderRefno: string;
  soStatus: string;
  soDeliveryHold: boolean;
  soDeliveryHoldReason: string | null;
  soDeliveryHoldBy: string | null;
  soDeliveryHoldByName: string | null;
  soDeliveryHoldOn: string | null;
}

/** POST /sale-order-desk/priority */
export interface PriorityResult {
  soId: string;
  soAccYear: string;
  soOrderRefno: string;
  soPriority: string;
}

/** POST /sale-order-desk/close-open-lines — SaleOrderCancelLinesResult + releasedReservations. */
export interface CloseOpenLinesResult {
  soId: string;
  soAccYear: string;
  soStatus: string;
  soFulfilStatus: string;
  cancelledLines: number;
  cancelledQty: number;
  /** Menu 99 View only. */
  soCancelledAmt?: number;
  /** Menu 99 View only. */
  soPendingAmt?: number;
  lines: SaleOrderCancelledLine[];
  releasedReservations: number;
}

/** POST /sale-order-desk/stock-cover */
export interface StockCoverItem {
  itemId: string;
  itemName: string | null;
  pendingBaseQty: number;
  freeBaseQty: number;
  coverBaseQty: number;
  orderKg: number;
  coverKg: number;
}
export interface StockCoverResult {
  orderKg: number;
  coverKg: number;
  shortKg: number;
  coverPerc: number;
  items: StockCoverItem[];
  missing: string[];
}

/** POST /sale-order-desk/figures (menu 99 View) */
export interface FiguresOrder {
  soId: string;
  soAccYear: string;
  openValue: number;
  orderOpenValue: number;
  orderAmt: number;
}
export interface FiguresCustomer {
  custId: string;
  pending: number;
  openBills: number;
  overdue: number;
  overdueBills: number;
  creditAmtLimit: number;
  availCredit: number | null;
}
export interface FiguresResult {
  orders: FiguresOrder[];
  customers: FiguresCustomer[];
  listValue: number;
}

/** A merge refusal, as merge-preview lists them (the merge route throws the first). */
export interface MergeRefusal {
  code: string;
  message: string;
  /** The order the refusal is about, when it is about one. */
  soId?: string;
  /** What merge would answer (400 / 403 / 404 / 409). */
  httpStatus: number;
  field: string;
}

/** POST /sale-order-desk/merge-preview */
export interface MergePreviewOrder {
  soId: string;
  soAccYear: string;
  soOrderRefno: string;
  soOrderDate: string | null;
  openLines: number;
  openQty: number;
  openKg: number;
  /** Menu 99 View only. */
  openValue?: number;
}
export interface MergePreviewResult {
  ok: boolean;
  refusals: Omit<MergeRefusal, 'httpStatus' | 'field'>[];
  fingerprint: string;
  customer: { custId: string; custName: string } | null;
  orders: MergePreviewOrder[];
  newOrder: {
    lines: number;
    totQty: number;
    totKg: number;
    /** Menu 99 View only. */
    orderAmt?: number;
    /** Menu 99 View only. */
    roundOff?: number;
    priority: string | null;
    deliveryDate: string | null;
  } | null;
}

/** POST /sale-order-desk/merge */
export interface MergedSource {
  soId: string;
  soAccYear: string;
  soOrderRefno: string;
  soStatus: string;
  soFulfilStatus: string;
  cancelledLines: number;
}
export interface MergeResult {
  soId: string;
  soCompanyId: string;
  soBranchId: string;
  soAccYear: string;
  soOrderRefno: string;
  soStatus: string;
  soTotItems: number;
  soTotBags: number;
  soTotWeight: number;
  /** Menu 99 View only. */
  soOrderAmt?: number;
  warnings: ReservationShort[];
  mergedSources: MergedSource[];
}
