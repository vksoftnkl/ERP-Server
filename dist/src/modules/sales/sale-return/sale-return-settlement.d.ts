import { Prisma } from '@prisma/client';
import { type Dec } from './sale-return-money';
import type { BillTenderRow, LoyaltyRule, OpenBillFacts, SaleReturnBillReader, SchemeFacts, UnwindAddBack } from './sale-return-bill-reader';
import type { MoneyIssue, ReturnMoney } from './sale-return-preview';
type Client = Prisma.TransactionClient;
export type SettleMode = 'CASH' | 'ADJUST' | 'ADVANCE';
export declare const REFUND_TENDER_TYPES: readonly number[];
export declare const REFUND_REF_TYPES: readonly number[];
export interface ShareFigures {
    pointsBackAmt: Dec;
    points: Dec;
    rate: Dec;
    voucherShare: Dec;
}
export declare function roundPoints(v: Dec, rounding: string | null | undefined, decimals: number): Dec;
export declare function sharesOf(input: {
    creditNote: Dec;
    billAmt: Dec;
    billPoints: Dec;
    billPointsUnits: Dec;
    billVoucher: Dec;
    priorPointsBackAmt: Dec;
    priorVoucherShare: Dec;
    emptiesBill: boolean;
    pointsDecimals?: number | null;
    priorPoints?: Dec;
}): ShareFigures;
export declare function loyaltyBackOf(input: {
    earned: Dec;
    priorReversed: Dec;
    lineTaxable: Dec;
    billLineTaxable: Dec;
    emptiesBill: boolean;
    rule: LoyaltyRule | null;
}): Dec;
export declare function proRataBack(input: {
    onBill: Dec;
    prior: Dec;
    part: Dec;
    whole: Dec;
    emptiesBill: boolean;
    scale?: 2 | 4;
}): Dec;
export interface RefundTender {
    index: number;
    tenderId: string | null;
    tenderTypeId: number;
    amount: Dec;
    refNo: string | null;
}
export declare function refundableOf(input: {
    creditNote: Dec;
    pointsBackAmt: Dec;
    voucherShare: Dec;
    cap: Dec | null;
}): Dec;
export declare function checkRefund(tenders: readonly RefundTender[], refundable: Dec): MoneyIssue[];
export declare function startTenders(billRows: readonly BillTenderRow[], refundable: Dec): {
    tenderId: string | null;
    tenderTypeId: number;
    name: string | null;
    ledgerId: string | null;
    amount: number;
}[];
export interface AdjustAsk {
    index: number;
    ablId: string;
    ablAccYear: string;
    amount: Dec;
    dueNow: Dec | null;
}
export interface AdjustLine {
    bill: OpenBillFacts;
    isThisBill: boolean;
    amount: Dec;
}
export declare function proposeAdjust(bills: readonly OpenBillFacts[], adjustable: Dec, thisSbId: string | null): AdjustLine[];
export declare function checkAdjust(asks: readonly AdjustAsk[], bills: readonly OpenBillFacts[], adjustable: Dec, thisSbId: string | null, closed?: ReadonlyMap<string, OpenBillFacts>): {
    lines: AdjustLine[];
    issues: MoneyIssue[];
};
export declare function defaultSettleMode(setting: string | null, ctx: {
    adjustable: boolean;
    billDue: Dec;
}): SettleMode;
export interface SchemeShort {
    schemeId: string;
    kind: string;
    keptValue: Dec;
    text: string;
}
export declare function schemeShorts(money: Pick<ReturnMoney, 'billLines' | 'prior' | 'lines' | 'emptiesBill'>, schemes: ReadonlyMap<string, SchemeFacts>): SchemeShort[];
export interface SettlementPlan {
    mode: SettleMode;
    creditNote: Dec;
    shares: ShareFigures;
    memberId: string | null;
    agentCommBack: Dec;
    loyaltyReverse: Dec;
    adjust: {
        lines: AdjustLine[];
        adjustable: Dec;
        adjusted: Dec;
        leftAsCredit: Dec;
        proposed: boolean;
    } | null;
    refund: {
        paidInMoney: Dec;
        receivedLater: Dec;
        refundedBefore: Dec;
        cap: Dec | null;
        refundable: Dec;
        tenders: RefundTender[];
        refunded: Dec;
        cashOut: Dec;
        leftAsCredit: Dec;
        start: ReturnType<typeof startTenders>;
    } | null;
    credited: Dec;
    customerBalance: {
        before: Dec;
        after: Dec;
    } | null;
    promoCheck: SchemeShort[];
    issues: MoneyIssue[];
}
export interface SettlementInput {
    mode: string | null;
    companyId: string;
    branchId: string;
    custId: string | null;
    tenders: readonly RefundTender[];
    adjustments: readonly AdjustAsk[] | null;
    billSort: string | null;
    lock: boolean;
    unwound: UnwindAddBack | null;
}
export declare function buildSettlement(reader: SaleReturnBillReader, c: Client, money: ReturnMoney, input: SettlementInput): Promise<SettlementPlan>;
export declare function settlementJson(p: SettlementPlan): Record<string, unknown>;
export {};
