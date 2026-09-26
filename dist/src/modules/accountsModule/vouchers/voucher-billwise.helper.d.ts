import { Prisma } from '@prisma/client';
import type { BillKey } from '../billBalance/bill-balance-recompute.service';
import type { InternalAllocation, InternalBill } from './voucher-derive';
export interface BillWriteContext {
    companyId: string;
    branchId: string;
    tenantId: string | null;
    accYear: string;
    voucherId: string;
    voucherTypeId: number;
    voucherNo: bigint;
    voucherDate: string;
    voucherRefno: string;
    docDate: string | null;
    userId: string;
    sessionId: string | null;
    actor: string;
    now: Date;
}
export interface RaisedBill extends BillKey {
    lineRowNo: number;
}
export declare function raiseBill(tx: Prisma.TransactionClient, ctx: BillWriteContext, bill: InternalBill, legAvId: string | null): Promise<RaisedBill>;
export declare function writeAllocations(tx: Prisma.TransactionClient, ctx: BillWriteContext, allocations: readonly InternalAllocation[], raisedByLine: ReadonlyMap<number, RaisedBill>, legAvIdByRow: ReadonlyMap<number, string>): Promise<BillKey[]>;
export declare function reverseVoucherAllocations(tx: Prisma.TransactionClient, params: {
    voucherId: string;
    accYear: string;
    reversalVoucherId: string;
    reason: string;
    actor: string;
    now: Date;
}): Promise<{
    count: number;
    touched: BillKey[];
}>;
export declare function otherVoucherOnRaisedBills(tx: Prisma.TransactionClient, voucherId: string, accYear: string): Promise<{
    voucherRefno: string | null;
    billRefno: string;
}[]>;
