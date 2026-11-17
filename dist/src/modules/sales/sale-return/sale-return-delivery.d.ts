import { Prisma } from '@prisma/client';
import type { DeliveryPendingService } from '../delivery/core/delivery-pending.service';
import type { DocRow } from '../posting/sales-doc-store';
import { type Dec } from './sale-return-money';
export interface NotTakenRow {
    index: number;
    lineNo: number;
    sriId: string | null;
    billItemId: string | null;
    billAccYear: string | null;
    godownId: string | null;
    lotId: string | null;
    condition: string | null;
    qty: Dec;
    factor: Dec;
    typed: Dec | null;
    unitName: string | null;
    kept?: Dec | null;
}
export interface NotTakenBillLine {
    billItemId: string;
    billAccYear: string;
    billId: string;
    billRefno: string | null;
    lineNo: number;
    itemId: string;
    eligible: boolean;
    godownId: string;
    lotId: string | null;
    factor: Dec;
    pendingBase: Dec;
    givenBase: Dec;
    takenBeforeBase: Dec;
    unitName: string | null;
    godownName: string | null;
    lotNo: string | null;
}
export interface NotTakenIssue {
    code: string;
    message: string;
    field: string;
    line: number;
    params: Record<string, string | number>;
}
export interface NotTakenResolved {
    index: number;
    defaultQty: Dec;
    resolvedQty: Dec;
    resolvedBase: Dec;
    billPendingQty: Dec;
    billPendingBase: Dec;
}
export interface NotTakenBillLineAfter {
    billId: string;
    billAccYear: string;
    billRefno: string | null;
    billItemId: string;
    billLineNo: number;
    unitName: string | null;
    pendingBefore: Dec;
    pendingAfter: Dec;
    settleQty: Dec;
    settleBase: Dec;
}
export interface NotTakenVerdict {
    rows: NotTakenResolved[];
    issues: NotTakenIssue[];
    delivery: NotTakenBillLineAfter[];
}
export declare const DELIVERY_RETURN_CODES_ADDED: {
    readonly DELIVERY_RETURN_AMEND_LOCKED: "DELIVERY_RETURN_AMEND_LOCKED";
};
export declare function resolveNotTaken(rows: readonly NotTakenRow[], billLines: ReadonlyMap<string, NotTakenBillLine>, claim: boolean): NotTakenVerdict;
export declare function deliveryStatusOf(lines: readonly {
    eligible: boolean;
    pending: Dec;
    settled: Dec;
    given: Dec;
}[], billPostedWaiting: boolean): string;
export declare function notTakenRowsOf(items: readonly DocRow[], money: {
    lines: readonly {
        qty: Dec;
        factor: Dec;
        billItemId: string | null;
        billAccYear: string | null;
    }[];
}, unitNames: ReadonlyMap<string, string>): NotTakenRow[];
export declare function withKeptNotTaken(rows: readonly NotTakenRow[], posted: ReadonlyMap<string, {
    qty: Dec;
    factor: Dec;
}>): NotTakenRow[];
export declare function postedNotTakenOf(items: readonly DocRow[]): Map<string, {
    qty: Dec;
    factor: Dec;
}>;
export declare function loadNotTakenLines(tx: Prisma.TransactionClient, pending: Pick<DeliveryPendingService, 'linesByKeys'>, rows: readonly NotTakenRow[], srId: string | null): Promise<Map<string, NotTakenBillLine>>;
export declare function returnEventsOf(tx: Prisma.TransactionClient, srId: string): Promise<{
    live: Map<string, {
        sdeId: string;
        accYear: string;
        settleQty: Dec;
        settleBase: Dec;
        billItemId: string;
        billAccYear: string;
        billId: string;
    }>;
    ever: Set<string>;
}>;
export declare function amendLockIssues(rows: readonly NotTakenRow[], verdict: NotTakenVerdict, events: {
    live: ReadonlyMap<string, {
        settleBase: Dec;
    }>;
    ever: ReadonlySet<string>;
}): NotTakenIssue[];
export declare const num: (v: Dec | null | undefined) => number | null;
export declare function unitNamesOf(tx: Prisma.TransactionClient, iucIds: readonly (string | null | undefined)[]): Promise<Map<string, string>>;
