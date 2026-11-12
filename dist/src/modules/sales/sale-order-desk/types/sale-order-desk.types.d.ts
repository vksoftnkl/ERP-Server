import type { ReservationShort } from '../../posting/stock-reservation.service';
import type { SaleOrderCancelledLine } from '../../sale-order/types/sale-order-api.types';
export declare const SALE_ORDER_DESK_RECEIPT_MENU_ID = 99;
export declare const SALE_ORDER_DESK_AUDIT_SCREEN = "Sale Order";
export declare const SALE_ORDER_DESK_OPEN_STATUSES: readonly string[];
export declare const SALE_ORDER_DESK_PRIORITIES: readonly ["LOW", "NORMAL", "HIGH", "URGENT"];
export declare const SALE_ORDER_DESK_MERGE_MAX = 20;
export declare const SALE_ORDER_DESK_COVER_MAX = 500;
export declare const SALE_ORDER_DESK_FIGURES_MAX = 2000;
export declare const SALE_ORDER_DESK_DEFAULT_MERGE_REASON = "Merged on the order desk";
export type SaleOrderDeskResponse<T> = {
    success: true;
    message: string;
    data: T;
};
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
export interface PriorityResult {
    soId: string;
    soAccYear: string;
    soOrderRefno: string;
    soPriority: string;
}
export interface CloseOpenLinesResult {
    soId: string;
    soAccYear: string;
    soStatus: string;
    soFulfilStatus: string;
    cancelledLines: number;
    cancelledQty: number;
    soCancelledAmt?: number;
    soPendingAmt?: number;
    lines: SaleOrderCancelledLine[];
    releasedReservations: number;
}
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
export interface MergeRefusal {
    code: string;
    message: string;
    soId?: string;
    httpStatus: number;
    field: string;
}
export interface MergePreviewOrder {
    soId: string;
    soAccYear: string;
    soOrderRefno: string;
    soOrderDate: string | null;
    openLines: number;
    openQty: number;
    openKg: number;
    openValue?: number;
}
export interface MergePreviewResult {
    ok: boolean;
    refusals: Omit<MergeRefusal, 'httpStatus' | 'field'>[];
    fingerprint: string;
    customer: {
        custId: string;
        custName: string;
    } | null;
    orders: MergePreviewOrder[];
    newOrder: {
        lines: number;
        totQty: number;
        totKg: number;
        orderAmt?: number;
        roundOff?: number;
        priority: string | null;
        deliveryDate: string | null;
    } | null;
}
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
    soOrderAmt?: number;
    warnings: ReservationShort[];
    mergedSources: MergedSource[];
}
