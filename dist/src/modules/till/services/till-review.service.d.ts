import { PrismaService } from '../../../database/prisma/prisma.service';
import { TillContextService } from '../till-context.service';
import { TillReviewOutcome } from '../types/till-enum';
import type { TillReviewCreatePayload, TillReviewListPayload } from '../types/till-api.types';
import { TillEventService } from './till-event.service';
export interface TillReviewInput {
    companyId: string;
    branchId: string;
    accYear: string;
    dayId: string | null;
    sessionId: string | null;
    outcome: TillReviewOutcome;
    note: string | null;
    refVoucherId: string | null;
    refVoucherAccYear: string | null;
}
export interface TillReviewListInput {
    companyId: string;
    branchId: string;
    dayId: string | null;
    sessionId: string | null;
}
export declare class TillReviewService {
    private readonly prisma;
    private readonly context;
    private readonly events;
    constructor(prisma: PrismaService, context: TillContextService, events: TillEventService);
    create(input: TillReviewInput): Promise<TillReviewCreatePayload>;
    list(input: TillReviewListInput): Promise<TillReviewListPayload>;
    private read;
    private target;
    private assertRefVoucher;
}
