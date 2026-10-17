import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { type TillEventCode } from '../types/till-enum';
import type { TillEventBatchPayload } from '../types/till-api.types';
export interface TillEventInput {
    companyId: string;
    branchId: string;
    accYear: string;
    code: TillEventCode;
    eventOn?: Date;
    sessionId?: string | null;
    dayId?: string | null;
    counterId?: string | null;
    deviceId?: string | null;
    userId?: string | null;
    srcDocType?: string | null;
    srcDocId?: string | null;
    srcRefno?: string | null;
    amount?: Prisma.Decimal | null;
    reasonId?: string | null;
    approvalId?: string | null;
    clientSeq?: bigint | null;
    payload?: Prisma.InputJsonValue | null;
}
export interface ClientEventInput {
    code: string;
    eventOn: Date;
    clientSeq: bigint;
    sessionId?: string | null;
    srcDocType?: string | null;
    srcDocId?: string | null;
    srcRefno?: string | null;
    amount?: Prisma.Decimal | null;
    reasonId?: string | null;
    payload?: Prisma.InputJsonValue | null;
}
export declare class TillEventService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    log(tx: Prisma.TransactionClient, event: TillEventInput): Promise<void>;
    ingestBatch(scope: {
        companyId: string;
        branchId: string;
        accYear: string;
        deviceId: string;
        userId: string;
        events: ClientEventInput[];
    }): Promise<TillEventBatchPayload>;
    private insertBatch;
}
