import { Prisma } from '@prisma/client';
import { type Tx } from '../common/purchase-doc.helpers';
export type IssueLevel = 'WARN' | 'REFUSE';
export interface PurIssue {
    code: string;
    level: IssueLevel;
    lineNo: number | null;
    field: string;
    message: string;
    needsRight: 'OVERRIDE' | null;
}
export declare const PUR_CHECK: {
    readonly RATE_ABOVE_PO: "PUR_RATE_ABOVE_PO";
    readonly RATE_ABOVE_LAST: "PUR_RATE_ABOVE_LAST";
    readonly SHORT_QTY: "PUR_SHORT_QTY";
    readonly SERIAL_COUNT: "PUR_SERIAL_COUNT";
    readonly SERIAL_DUPLICATE: "PUR_SERIAL_DUPLICATE";
    readonly PRICE_BELOW_COST: "PUR_PRICE_BELOW_COST";
    readonly PRICE_ABOVE_MRP: "PUR_PRICE_ABOVE_MRP";
    readonly RCM_NOT_SUPPORTED: "PUR_RCM_NOT_SUPPORTED";
};
export interface LineFact {
    index: number;
    lineNo: number;
    itemId: string;
    itemName: string | null;
    factor: Prisma.Decimal;
    billed: Prisma.Decimal;
    taxable: Prisma.Decimal;
    costInclUnit: Prisma.Decimal | null;
    pieces: Prisma.Decimal;
    srcType: string | null;
    srcItemId: string | null;
    serials: string[];
    mrps: Prisma.Decimal[];
    sellA: Prisma.Decimal | null;
    pendingShort: Prisma.Decimal;
    shortValue: Prisma.Decimal;
    gstOnShort: Prisma.Decimal;
    priceUpdateResult: string | null;
}
export interface RateRef {
    basis: 'PO' | 'LAST';
    refno: string;
    refBase: Prisma.Decimal;
}
export interface LineCheck {
    rate: {
        basis: 'PO' | 'LAST';
        refno: string;
        refRate: string;
        billRate: string;
        diffPct: string;
        tolerancePct: string;
        over: boolean;
    } | null;
    newMrp: {
        mrp: string;
        stockMrps: string[];
    } | null;
    priceKept: boolean;
    serials: {
        have: number;
        need: string;
    } | null;
    shortQty: string;
}
export declare function rateRefs(tx: Tx, companyId: string, exceptPiId: string | null, facts: LineFact[]): Promise<Map<number, RateRef>>;
export declare function serialFacts(tx: Tx, companyId: string, branchId: string, docDate: string, facts: LineFact[]): Promise<{
    tracked: Set<string>;
    onHand: Set<string>;
}>;
export declare function stockMrps(tx: Tx, companyId: string, branchId: string, itemIds: string[]): Promise<Map<string, Prisma.Decimal[]>>;
export declare function judgeLines(facts: LineFact[], refs: Map<number, RateRef>, tolerancePct: Prisma.Decimal.Value, serial: {
    tracked: Set<string>;
    onHand: Set<string>;
}, mrps: Map<string, Prisma.Decimal[]>): {
    issues: PurIssue[];
    checks: Map<number, LineCheck>;
};
export declare function checkLines(tx: Tx, scope: {
    companyId: string;
    branchId: string;
    docDate: string;
    piId: string | null;
    tolerancePct: number;
}, facts: LineFact[]): Promise<{
    issues: PurIssue[];
    checks: Map<number, LineCheck>;
}>;
