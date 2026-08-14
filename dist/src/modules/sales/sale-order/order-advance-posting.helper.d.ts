import { Prisma } from '@prisma/client';
export declare const ORDER_ADVANCE_VCHR_TYPE_ID = 5;
export interface OrderAdvancePostingRef {
    soId: string;
    soCompanyId: string;
    soAccYear: string;
}
export interface OrderAdvancePostingSource extends OrderAdvancePostingRef {
    soBranchId: string;
    soTenantId: string | null;
    soOrderRefno: string;
    soUsrRefno: string | null;
    soOrderDate: Date;
    soOrderDatetime: Date;
    soCustName: string;
    soOrderAmt: Prisma.Decimal;
    soRoundOff: Prisma.Decimal | null;
    soCustId: string;
    soAdvanceLedgerId: string | null;
    soAdvanceRecdAmt: Prisma.Decimal;
    soAdvanceAdjustedAmt: Prisma.Decimal;
    soAdvanceRefundAmt: Prisma.Decimal;
    soAdvanceForfeitAmt: Prisma.Decimal;
    soSalesmanId: string[];
    soAgentId: string | null;
    soUserId: string;
    soSessionId: string | null;
    soDeviceId: string;
    soRemarks: string | null;
    soStatus: string;
}
export interface OrderAdvanceTenderLine {
    tdId: string;
    tdRowNo: number;
    tdTenderId: string;
    tdTenderTypeId: number;
    tdTenderLedgerId: string;
    tdAmount: Prisma.Decimal;
    tdSurchargeAmt: Prisma.Decimal;
    tdSurchargeLedgerId: string | null;
    tdTotalAmt: Prisma.Decimal;
    tdRefNo: string | null;
    tdNotes: string | null;
    tdInstrumentDate: Date | null;
    tdBankName: string | null;
    tdSettleLedgerId: string | null;
}
export interface OrderAdvancePostingResult {
    voucherId: string;
    voucherNo: bigint;
    voucherRefno: string;
    lineIds: string[];
    billId: string | null;
    pdcIds: string[];
    totalAmount: Prisma.Decimal;
    postedOn: Date;
}
export declare function postOrderAdvanceToAccounts(tx: Prisma.TransactionClient, order: OrderAdvancePostingSource, tenders: OrderAdvanceTenderLine[], actor: string, postedOn: Date): Promise<OrderAdvancePostingResult>;
export type OrderAdvancePostingAction = 'created' | 'updated' | 'cancelled' | 'unchanged';
export interface OrderAdvancePostingSyncResult {
    action: OrderAdvancePostingAction;
    voucherId: string | null;
    billId: string | null;
    pdcIds: string[];
    totalAmount: Prisma.Decimal | null;
    postedOn: Date | null;
}
export declare function syncOrderAdvancePosting(tx: Prisma.TransactionClient, order: OrderAdvancePostingSource, tenders: OrderAdvanceTenderLine[], actor: string, now: Date): Promise<OrderAdvancePostingSyncResult>;
export interface OrderAdvancePostingDeleteResult {
    voucherIds: string[];
    billIds: string[];
    pdcIds: string[];
}
export declare function deleteOrderAdvancePosting(tx: Prisma.TransactionClient, order: OrderAdvancePostingRef, actor: string, now: Date): Promise<OrderAdvancePostingDeleteResult>;
