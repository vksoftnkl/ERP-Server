import type { Prisma } from '@prisma/client';
export declare const PURCHASE_INVOICE_MENU = 24;
export interface BillHold {
    ablId: string;
    piId: string;
    accYear: string;
    companyId: string;
    branchId: string;
    refno: string;
    supplierInvNo: string;
    reason: string | null;
}
export declare function holdsOfBills(tx: Prisma.TransactionClient, ablIds: string[]): Promise<Map<string, BillHold>>;
export declare function assertPaymentHoldCleared(tx: Prisma.TransactionClient, bills: {
    billId: string;
    field: string;
}[], userId: string | null, paymentRef: string): Promise<void>;
