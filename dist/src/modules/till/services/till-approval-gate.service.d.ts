import { PrismaService } from '../../../database/prisma/prisma.service';
import { TillContextService } from '../till-context.service';
import type { TillApprovalInboxPayload, TillApprovalPayload } from '../types/till-api.types';
import { TillApprovalService, type ApproverGrants } from './till-approval.service';
import { TillEventService } from './till-event.service';
export interface RequestApprovalInput {
    companyId: string;
    branchId: string;
    tenantId?: string | null;
    event: string;
    amount: number;
    sessionId?: string | null;
    accYear?: string | null;
    srcDocType?: string | null;
    srcDocId?: string | null;
    srcRefno?: string | null;
    reasonId?: string | null;
    note?: string | null;
    approverId?: string | null;
    approverPin?: string | null;
    secondId?: string | null;
    secondPin?: string | null;
}
export interface ApprovalKey {
    companyId: string;
    branchId: string;
    accYear: string;
    tapId: string;
}
export interface DecideApprovalInput extends ApprovalKey {
    decision: 'APPROVE' | 'REJECT';
    approverPin?: string | null;
    secondId?: string | null;
    secondPin?: string | null;
    note: string;
}
export declare class TillApprovalGateService {
    private readonly prisma;
    private readonly context;
    private readonly approval;
    private readonly events;
    constructor(prisma: PrismaService, context: TillContextService, approval: TillApprovalService, events: TillEventService);
    request(input: RequestApprovalInput): Promise<TillApprovalPayload>;
    decide(input: DecideApprovalInput): Promise<TillApprovalPayload>;
    cancel(input: ApprovalKey & {
        note?: string | null;
    }): Promise<TillApprovalPayload>;
    get(key: ApprovalKey): Promise<TillApprovalPayload>;
    pending(scope: {
        companyId: string;
        branchId: string;
    }): Promise<TillApprovalInboxPayload>;
    private judge;
    private provePerson;
    private decideIn;
    private logDecision;
    private pendingRow;
    private throwNotPending;
    private lockRow;
    private sweep;
    private namesOf;
}
export type { ApproverGrants };
