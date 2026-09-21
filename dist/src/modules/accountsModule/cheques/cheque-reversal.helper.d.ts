import { Prisma } from '@prisma/client';
import type { LockedCheque } from './cheques.guards';
import type { ChequeCascadeReport } from './types/cheque-api.types';
export interface ReversalVoucherScope {
    voucherId: string;
    accYear: string;
    companyId: string;
    branchId: string;
    tenantId: string | null;
    userId: string;
    sessionId: string | null;
    actor: string;
    reason: string;
}
export interface ReversedRows {
    bills: Array<{
        billId: string;
        accYear: string;
    }>;
    count: number;
}
export declare function reverseChequeAdjustments(tx: Prisma.TransactionClient, cheque: LockedCheque, scope: ReversalVoucherScope, startRowNo?: number): Promise<ReversedRows & {
    nextRowNo: number;
}>;
export interface RestoredAllocation {
    billId: string;
    billAccYear: string;
    amount: Prisma.Decimal;
    discount: Prisma.Decimal;
    writeoff: Prisma.Decimal;
    roundoff: Prisma.Decimal;
    writeoffApprovedBy: string | null;
}
export declare function allocationsReversedBy(tx: Prisma.TransactionClient, cheque: LockedCheque, bounce: {
    voucherId: string;
    accYear: string;
}): Promise<RestoredAllocation[]>;
export declare function cascadeAdvances(tx: Prisma.TransactionClient, cheque: LockedCheque, scope: ReversalVoucherScope, startRowNo?: number): Promise<{
    report: ChequeCascadeReport;
    bills: Array<{
        billId: string;
        accYear: string;
    }>;
    nextRowNo: number;
}>;
