import { Prisma } from '@prisma/client';
import type { LockedCheque } from './cheques.guards';
import type { ChequeBillRef } from './types/cheque-api.types';
export interface SaleBillOfCheque {
    sbId: string;
    sbAccYear: string;
    ablId: string;
    ablAccYear: string;
}
export declare function findSaleBillOfCheque(tx: Prisma.TransactionClient, cheque: Pick<LockedCheque, 'apdTenderId'>): Promise<SaleBillOfCheque | null>;
export declare function moveSaleBillSettlement(tx: Prisma.TransactionClient, link: SaleBillOfCheque, delta: Prisma.Decimal, settledOn: Date, actor: string): Promise<ChequeBillRef>;
