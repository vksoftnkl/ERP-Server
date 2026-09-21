import { Prisma } from '@prisma/client';
import { type AllocationResult } from '../receipt/allocation-engine';
import { BillAdjType } from '../receipt/types/receipt-enum';
import type { ChequeBillRef } from './types/cheque-api.types';
import type { LockedCheque } from './cheques.guards';
import type { RestoredAllocation } from './cheque-reversal.helper';
import type { ChequeAllocationDto } from './dto/cheque-keys.dto';
export interface ChequeAllocationScope {
    voucherId: string;
    accYear: string;
    voucherTypeId: number;
    voucherNo: bigint;
    voucherRefno: string | null;
    companyId: string;
    branchId: string;
    tenantId: string | null;
    partyId: string;
    salesmanId: string | null;
    userId: string;
    sessionId: string | null;
    actor: string;
    adjDate: Date;
    isPostDated: boolean;
    cheque: LockedCheque;
    tenderId: string | null;
    tenderAccYear: string | null;
}
export type ChequeAllocationRequest = {
    mode: 'NAMED';
    rows: readonly ChequeAllocationDto[];
} | {
    mode: 'AUTO_FIFO';
} | {
    mode: 'RESTORE';
    rows: readonly RestoredAllocation[];
};
export declare function namedOrAutoFifo(rows: readonly ChequeAllocationDto[]): ChequeAllocationRequest;
export interface ChequeAllocationOutcome {
    plan: AllocationResult;
    bills: Array<{
        billId: string;
        accYear: string;
    }>;
    refs: ChequeBillRef[];
    partyCredit: Prisma.Decimal;
    onAccount: Prisma.Decimal;
}
export declare function allocateChequeMoney(tx: Prisma.TransactionClient, scope: ChequeAllocationScope, request: ChequeAllocationRequest): Promise<ChequeAllocationOutcome>;
export declare const ADVANCE_ADJ_TYPE = BillAdjType.ADVANCE_ADJUST;
