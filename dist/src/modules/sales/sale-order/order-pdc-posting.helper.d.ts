import { Prisma } from '@prisma/client';
export declare const CHEQUE_TENDER_TYPE_ID = 5;
export interface OrderPdcRef {
    soId: string;
    soCompanyId: string;
    soAccYear: string;
}
export interface OrderPdcSource extends OrderPdcRef {
    soBranchId: string;
    soTenantId: string | null;
    soOrderRefno: string;
    soOrderDate: Date;
    soCustId: string;
    soCustName: string;
    soSalesmanId: string[];
    soUserId: string;
}
export interface OrderPdcTenderLine {
    tdId: string;
    tdRowNo: number;
    tdTenderTypeId: number;
    tdTotalAmt: Prisma.Decimal;
    tdRefNo: string | null;
    tdInstrumentDate: Date | null;
    tdBankName: string | null;
    tdSettleLedgerId: string | null;
    tdNotes: string | null;
}
export interface OrderPdcVoucher {
    voucherId: string;
    accYear: string;
}
export declare function syncOrderPdcRegister(tx: Prisma.TransactionClient, order: OrderPdcSource, tenders: OrderPdcTenderLine[], voucher: OrderPdcVoucher | null, actor: string, now: Date): Promise<string[]>;
export declare function cancelOrderPdcRegister(tx: Prisma.TransactionClient, order: OrderPdcRef, reason: 'unposted' | 'deleted', statusBy: string | null, actor: string, now: Date): Promise<string[]>;
