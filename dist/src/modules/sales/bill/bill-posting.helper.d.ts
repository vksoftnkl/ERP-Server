import { Prisma } from '@prisma/client';
export interface BillPostingRef {
    sbId: string;
    sbCompanyId: string;
    sbAccYear: string;
}
export interface BillPostingSource extends BillPostingRef {
    sbBranchId: string;
    sbTenantId: string | null;
    sbBillSlno: bigint | null;
    sbBillRefno: string | null;
    sbUsrRefno: string | null;
    sbBillDate: Date;
    sbBillDatetime: Date;
    sbDueDate: Date | null;
    sbDueDays: number | null;
    sbCustId: string;
    sbUserId: string;
    sbSessionId: string | null;
    sbDeviceType: string | null;
    sbDeviceId: string | null;
    sbSalesmanId: string[];
    sbAgentId: string | null;
    sbBillAmt: Prisma.Decimal;
    sbRoundOff: Prisma.Decimal | null;
    sbPaidAmt: Prisma.Decimal;
    sbRemarks: string | null;
    sbStatus: string;
    sbCancelReason: string | null;
}
export interface BillPostingResult {
    voucherId: string;
    billId: string | null;
    postedOn: Date;
}
export declare function postBillToAccounts(tx: Prisma.TransactionClient, bill: BillPostingSource, vchrTypeId: number, actor: string, postedOn: Date): Promise<BillPostingResult>;
export type BillPostingAction = 'created' | 'updated' | 'cancelled' | 'unchanged';
export interface BillPostingSyncResult {
    action: BillPostingAction;
    voucherId: string | null;
    billId: string | null;
    postedOn: Date | null;
}
export declare function syncBillPosting(tx: Prisma.TransactionClient, bill: BillPostingSource, vchrTypeId: number, actor: string, now: Date): Promise<BillPostingSyncResult>;
export interface BillPostingDeleteResult {
    voucherIds: string[];
    billIds: string[];
}
export declare function deleteBillPosting(tx: Prisma.TransactionClient, bill: BillPostingRef, actor: string, now: Date): Promise<BillPostingDeleteResult>;
