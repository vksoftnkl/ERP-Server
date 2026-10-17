import { Prisma } from '@prisma/client';
export interface CounterAllocationScope {
    bill: {
        sbId: string;
        sbAccYear: string;
        sbCompanyId: string;
        sbBranchId: string;
        sbTenantId: string | null;
        sbBillDate: Date;
        sbUserId: string | null;
        sbSessionId: string | null;
    };
    abl: {
        ablId: string;
        ablAccYear: string;
    };
    partyId: string;
    voucherFor: (tdId: string) => {
        voucherId: string;
        accYear: string;
    } | null;
    cap?: Prisma.Decimal;
    actor: string;
    now: Date;
}
export interface CounterAllocationResult {
    added: {
        abjId: string;
        tdId: string;
        amount: Prisma.Decimal;
        chequeId: string | null;
    }[];
    dropped: number;
    capped: {
        tdId: string;
        wanted: Prisma.Decimal;
        written: Prisma.Decimal;
    }[];
}
export declare function syncCounterAllocations(tx: Prisma.TransactionClient, scope: CounterAllocationScope): Promise<CounterAllocationResult>;
export declare function retireCounterAllocations(tx: Prisma.TransactionClient, bill: {
    sbId: string;
    sbAccYear: string;
}, abl: {
    ablId: string;
    ablAccYear: string;
}, actor: string, now: Date): Promise<number>;
