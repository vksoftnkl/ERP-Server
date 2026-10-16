import { Prisma, type TillApproval } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { TillContextService } from '../till-context.service';
import { TillErrorCode, type TillApproverRole } from '../types/till-enum';
import type { TillApprovalNeed } from '../types/till-api.types';
import { TillEventService } from './till-event.service';
type Client = Prisma.TransactionClient | PrismaService;
export interface TillApprovalRuleRow {
    tar_id: string | null;
    tar_event_code: string;
    tar_mode: string;
    tar_threshold_amount: Prisma.Decimal;
    tar_channel: string;
    tar_min_role: string;
    tar_two_person: boolean;
    tar_allow_self: boolean;
    tar_blocks_till: boolean;
    tar_expire_minutes?: number;
}
export interface ApproverAsk {
    companyId: string;
    branchId: string;
    event: string;
    amount: Prisma.Decimal;
    rule: TillApprovalRuleRow;
    approverId: string;
    requesterId: string;
    pin: string | null;
    selfExempt?: boolean;
    second?: {
        userId: string;
    } | null;
}
export interface ApproverVerdict {
    role: TillApproverRole;
    channel: 'COUNTER' | 'REMOTE';
    grantId: string | null;
    implicit: boolean;
    secondBy: string | null;
}
export interface ApprovalRecordInput {
    companyId: string;
    branchId: string;
    tenantId: string | null;
    accYear: string;
    event: string;
    sessionId: string | null;
    counterId: string | null;
    srcDocType: string;
    srcDocId: string;
    srcRefno: string | null;
    amount: Prisma.Decimal;
    rule: TillApprovalRuleRow;
    verdict: ApproverVerdict;
    requestedBy: string;
    requestedOn: Date;
    reasonId: string | null;
    status: 'APPROVED' | 'REJECTED';
    decidedBy: string;
    decidedOn: Date;
    decidedDeviceId: string | null;
    decisionNote: string;
    payload?: Record<string, unknown>;
    selfAllowed?: boolean;
    secondOn?: Date | null;
}
interface Grant {
    id: string | null;
    role: string;
    maxAmount: Prisma.Decimal | null;
    canRemote: boolean;
    implicit: boolean;
    event: string | null;
}
export interface ApproverGrants {
    userId: string;
    login: string;
    grants: Grant[];
}
export interface GateAsk {
    companyId: string;
    branchId: string;
    tenantId: string | null;
    accYear: string;
    event: string;
    onDate: string;
    amount: Prisma.Decimal;
    requesterId: string;
    deviceId: string | null;
    sessionId: string | null;
    counterId: string | null;
    srcDocType: string;
    srcDocId: string;
    srcRefno: string | null;
    approvalId: string | null;
    field: string;
    payload?: Record<string, unknown>;
}
export type GateVerdict = {
    state: 'NONE';
} | {
    state: 'APPROVED';
    need: TillApprovalNeed;
    rule: TillApprovalRuleRow;
    tapId: string;
} | {
    state: 'REFUSE';
    need: TillApprovalNeed;
    rule: TillApprovalRuleRow;
} | {
    state: 'WARN';
    need: TillApprovalNeed;
    rule: TillApprovalRuleRow;
};
export interface NewApprovalRequest {
    companyId: string;
    branchId: string;
    tenantId: string | null;
    accYear: string;
    event: string;
    rule: TillApprovalRuleRow;
    amount: Prisma.Decimal;
    requesterId: string;
    deviceId: string | null;
    sessionId: string | null;
    counterId: string | null;
    srcDocType: string | null;
    srcDocId: string | null;
    srcRefno: string | null;
    reasonId: string | null;
    note: string | null;
    selfAllowed?: boolean;
    payload?: Record<string, unknown>;
}
export declare class TillApprovalService {
    private readonly context;
    private readonly events;
    constructor(context: TillContextService, events: TillEventService);
    ruleFor(client: Client, scope: {
        companyId: string;
        branchId: string;
        event: string;
        onDate: string;
    }): Promise<(TillApprovalRuleRow & {
        tar_id: string;
    }) | null>;
    ruleOrDefault(client: Client, scope: {
        companyId: string;
        branchId: string;
        event: string;
        onDate: string;
    }): Promise<TillApprovalRuleRow>;
    assess(client: Client, scope: {
        companyId: string;
        branchId: string;
        event: string;
        onDate: string;
        amount: Prisma.Decimal;
    }): Promise<TillApprovalNeed | null>;
    assessGate(client: Client, ask: GateAsk): Promise<GateVerdict>;
    settleGate(tx: Prisma.TransactionClient, ask: GateAsk, verdict: GateVerdict): Promise<string | null>;
    throwApprovalRequired(need: TillApprovalNeed, ask: GateAsk): never;
    fileRequest(tx: Prisma.TransactionClient, input: NewApprovalRequest): Promise<string>;
    private approvedFor;
    assertApprover(client: Client, ask: ApproverAsk): Promise<ApproverVerdict>;
    grantsOf(client: Client, scope: {
        userId: string;
        companyId: string;
        branchId: string;
    }): Promise<ApproverGrants>;
    standing(held: ApproverGrants, ask: {
        event: string;
        amount: Prisma.Decimal;
        minRole: string;
        requesterId: string | null;
        selfAllowed: boolean;
    }): TillErrorCode | null;
    private assertSecond;
    record(tx: Prisma.TransactionClient, input: ApprovalRecordInput): Promise<string>;
}
export declare function ruleOfRequest(tap: TillApproval): TillApprovalRuleRow;
export {};
