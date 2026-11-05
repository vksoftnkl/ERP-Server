import { Prisma } from '@prisma/client';
import { type PdcTenderLine, type PdcVoucher } from '../posting/pdc-register.helper';
export { CHEQUE_TENDER_TYPE_ID } from '../posting/pdc-register.helper';
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
export type OrderPdcTenderLine = PdcTenderLine;
export type OrderPdcVoucher = PdcVoucher;
export declare function syncOrderPdcRegister(tx: Prisma.TransactionClient, order: OrderPdcSource, tenders: OrderPdcTenderLine[], voucher: OrderPdcVoucher | null, actor: string, now: Date): Promise<string[]>;
export declare function cancelOrderPdcRegister(tx: Prisma.TransactionClient, order: OrderPdcRef, reason: 'unposted' | 'deleted', statusBy: string | null, actor: string, now: Date): Promise<string[]>;
