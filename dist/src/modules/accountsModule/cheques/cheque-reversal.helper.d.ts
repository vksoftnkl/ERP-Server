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
export declare function cascadeAdvances(tx: Prisma.TransactionClient, cheque: LockedCheque, scope: ReversalVoucherScope, startRowNo?: number): Promise<{
    report: ChequeCascadeReport;
    bills: Array<{
        billId: string;
        accYear: string;
    }>;
    nextRowNo: number;
}>;
