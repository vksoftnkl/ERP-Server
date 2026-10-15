import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { type TillApproverRole } from '../types/till-enum';
import type { TillApprovalNeed } from '../types/till-api.types';
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
export declare class TillApprovalService {
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
    assertApprover(client: Client, ask: ApproverAsk): Promise<ApproverVerdict>;
    private assertSecond;
    record(tx: Prisma.TransactionClient, input: ApprovalRecordInput): Promise<string>;
}
export {};
