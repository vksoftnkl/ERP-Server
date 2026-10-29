import { Prisma } from '@prisma/client';
import { type PaymentChequeScope } from './payment-cheque-links';
export type UnwindVerb = 'cancelled' | 'amended';
export declare function assertIssuedChequesStillHeld(tx: Prisma.TransactionClient, scope: PaymentChequeScope, verb: UnwindVerb): Promise<void>;
export declare function assertNoSettledTransfer(tx: Prisma.TransactionClient, paymentVoucherId: string, verb: UnwindVerb): Promise<void>;
export declare function assertAdvancesUntouched(tx: Prisma.TransactionClient, voucherIds: readonly string[], years: readonly string[], verb: UnwindVerb): Promise<Array<{
    ablId: string;
    ablAccYear: string;
    ablDocRefno: string;
}>>;
