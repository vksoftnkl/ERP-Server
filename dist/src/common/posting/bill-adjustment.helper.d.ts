import { Prisma } from '@prisma/client';
export interface BillAdjustmentInput {
    againstBillId: string;
    againstBillAccYear: string;
    amount: number;
    remarks?: string | null;
    billType?: string;
    adjType?: string;
    settlementMode?: string;
}
export interface BillAdjustmentContext {
    billId: string;
    billAccYear: string;
    billAmount: Prisma.Decimal;
    paidAmount: Prisma.Decimal;
    companyId: string;
    branchId: string;
    tenantId: string | null;
    accYear: string;
    partyId: string;
    adjDate: Date;
    userId: string;
    sessionId: string | null;
}
export interface BillAdjustmentSyncResult {
    action: 'unchanged' | 'posted' | 'reversed' | 'replaced';
    adjustments: PostedAdjustment[];
}
export interface PostedAdjustment {
    againstBillId: string;
    againstBillAccYear: string;
    amount: Prisma.Decimal;
    adjType: string;
    settlementMode: string;
}
export declare function syncBillAdjustments(tx: Prisma.TransactionClient, ctx: BillAdjustmentContext, adjustments: BillAdjustmentInput[] | undefined, actor: string, now: Date): Promise<BillAdjustmentSyncResult>;
export interface SetOffCredit {
    ablId: string;
    ablAccYear: string;
    billType: string;
    holdingLedgerId: string;
}
export declare function loadSetOffCredits(tx: Prisma.TransactionClient, adjustments: readonly {
    againstBillId: string;
    againstBillAccYear: string;
}[]): Promise<Map<string, SetOffCredit>>;
export declare function setOffKey(ablId: string, ablAccYear: string): string;
export declare function splitSetOffs(adjustments: readonly {
    againstBillId: string;
    againstBillAccYear: string;
    amount: unknown;
}[], credits: Map<string, SetOffCredit>): {
    advance: number;
    note: number;
};
