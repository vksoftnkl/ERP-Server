import { Prisma, SaleBill } from '@prisma/client';
export type BillPdcSource = Pick<SaleBill, 'sbId' | 'sbCompanyId' | 'sbBranchId' | 'sbTenantId' | 'sbAccYear' | 'sbBillRefno' | 'sbBillDate' | 'sbCustId' | 'sbCustName' | 'sbSalesmanId' | 'sbUserId'>;
export declare function syncBillPdcRegister(tx: Prisma.TransactionClient, bill: BillPdcSource, voucher: {
    voucherId: string;
    accYear: string;
}, actor: string, now: Date, opts?: {
    keepStoredVoucher?: boolean;
}): Promise<string[]>;
export declare function cancelBillPdcRegister(tx: Prisma.TransactionClient, bill: Pick<BillPdcSource, 'sbId' | 'sbAccYear' | 'sbUserId'>, reason: string, actor: string, now: Date): Promise<string[]>;
export declare function assertBillPdcHeld(tx: Prisma.TransactionClient, bill: Pick<BillPdcSource, 'sbId' | 'sbAccYear'>): Promise<void>;
