import { Prisma } from '@prisma/client';
export type UnwindVerb = 'cancelled' | 'amended';
export declare function assertChequesStillHeld(tx: Prisma.TransactionClient, voucherIds: readonly string[], verb: UnwindVerb): Promise<void>;
export declare function assertAdvancesUntouched(tx: Prisma.TransactionClient, voucherIds: readonly string[], years: readonly string[], verb: UnwindVerb): Promise<Array<{
    ablId: string;
    ablAccYear: string;
    ablDocRefno: string;
}>>;
