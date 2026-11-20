import { Prisma } from '@prisma/client';
import { type PpdSlab } from '../../modules/accountsModule/receipt/ppd-slab';
export declare const MOBILE_ROUNDOFF_MAX: Prisma.Decimal;
export declare const billKeyOf: (row: {
    billId: string;
    billAccYear: string;
}) => string;
export interface PlanLine {
    billId: string;
    billAccYear: string;
    amount: Prisma.Decimal;
    discount: Prisma.Decimal;
    roundoff: Prisma.Decimal;
}
export interface PlanCredit {
    billId: string;
    billAccYear: string;
    amount: Prisma.Decimal;
}
export interface BillNow {
    billId: string;
    billAccYear: string;
    docRefno: string;
    docDate: Date;
    pending: Prisma.Decimal;
    live: boolean;
}
export interface CreditNow {
    billId: string;
    billAccYear: string;
    docRefno: string;
    held: Prisma.Decimal;
    live: boolean;
}
export interface PlanInput {
    lines: readonly PlanLine[];
    credits: readonly PlanCredit[];
    billsNow: ReadonlyMap<string, BillNow>;
    creditsNow: ReadonlyMap<string, CreditNow>;
    openOrder: readonly BillNow[];
    money: Prisma.Decimal;
    fillAll?: boolean;
}
export interface PlanResult {
    allocations: PlanLine[];
    creditsApplied: PlanCredit[];
    onAccount: Prisma.Decimal;
}
export declare function assertPhoneLimits(lines: readonly PlanLine[], billsNow: ReadonlyMap<string, BillNow>, receiptDate: Date, slabs: readonly PpdSlab[]): void;
export declare function reconcilePhonePlan(input: PlanInput): PlanResult;
export declare enum MobileReceiptAdjustReason {
    BILL_SETTLED = "BILL_SETTLED",
    BILL_REDUCED = "BILL_REDUCED",
    CREDIT_REDUCED = "CREDIT_REDUCED",
    PDC_ON_CLEARING = "PDC_ON_CLEARING"
}
export interface MobileReceiptAdjusted {
    billId: string;
    billAccYear: string;
    docRefno: string;
    planned: string;
    applied: string;
    reason: MobileReceiptAdjustReason;
}
export interface SettledFigure {
    amount: Prisma.Decimal;
    discount: Prisma.Decimal;
    roundoff: Prisma.Decimal;
}
export declare function adjustedAgainstPlan(plan: {
    lines: readonly PlanLine[];
    credits: readonly PlanCredit[];
}, settled: {
    bills: ReadonlyMap<string, SettledFigure>;
    credits: ReadonlyMap<string, Prisma.Decimal>;
}, docRefnoOf: (key: string) => string): MobileReceiptAdjusted[];
