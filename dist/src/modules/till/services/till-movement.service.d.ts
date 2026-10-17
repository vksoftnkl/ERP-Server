import { PrismaService } from '../../../database/prisma/prisma.service';
import { TillContextService } from '../till-context.service';
import { TillApprovalService } from './till-approval.service';
import { TillEventService } from './till-event.service';
import { TillLedgerService } from './till-ledger.service';
import { TillPostingService } from './till-posting.service';
import { TillSessionService } from './till-session.service';
import { TillMovementKind, TillVarianceTreatment } from '../types/till-enum';
import type { TillAwaitingReceiptPayload, TillCashApprovalPayload, TillCountLineInput, TillMovementDetailPayload, TillReceivedPayload, TillSupervisorPayload } from '../types/till-api.types';
export interface ReceiveBagInput {
    tcmId: string;
    accYear: string;
    lines: TillCountLineInput[];
    notes?: string | null;
}
export interface ApproveCashInput {
    companyId: string;
    branchId: string;
    accYear: string;
    tssId: string;
    approverPin?: string | null;
    receivedAmount?: number | null;
    treatment?: TillVarianceTreatment | null;
    reasonId?: string | null;
    notes?: string | null;
}
export interface CreateMovementInput {
    companyId: string;
    branchId: string;
    accYear: string;
    tssId: string;
    kind: TillMovementKind;
    amount?: number | null;
    lines: TillCountLineInput[];
    outLines: TillCountLineInput[];
    reasonId?: string | null;
    ledgerId?: string | null;
    refNo?: string | null;
    refDate?: string | null;
    partyName?: string | null;
    bagNo?: string | null;
    sealNo?: string | null;
    witnessBy?: string | null;
    supervisorId?: string | null;
    supervisorPin?: string | null;
    notes?: string | null;
}
export declare class TillMovementService {
    private readonly prisma;
    private readonly context;
    private readonly ledger;
    private readonly posting;
    private readonly sessions;
    private readonly events;
    private readonly approval;
    constructor(prisma: PrismaService, context: TillContextService, ledger: TillLedgerService, posting: TillPostingService, sessions: TillSessionService, events: TillEventService, approval: TillApprovalService);
    create(input: CreateMovementInput): Promise<TillMovementDetailPayload>;
    change(input: {
        companyId: string;
        branchId: string;
        accYear: string;
        fromTssId: string;
        toTssId: string;
        lines: TillCountLineInput[];
        reasonId: string;
        fromWitnessPin?: string | null;
        toWitnessPin?: string | null;
        notes?: string | null;
    }): Promise<{
        from: TillMovementDetailPayload;
        to: TillMovementDetailPayload;
    }>;
    get(key: {
        companyId: string;
        branchId: string;
        accYear: string;
        tcmId: string;
    }): Promise<TillMovementDetailPayload>;
    void(input: {
        companyId: string;
        branchId: string;
        accYear: string;
        tcmId: string;
        reasonId: string;
        notes?: string | null;
    }): Promise<TillMovementDetailPayload>;
    operatorOf(key: {
        companyId: string;
        branchId: string;
        accYear: string;
        tcmId: string;
    }): Promise<string | null>;
    supervisors(key: {
        companyId: string;
        branchId: string;
        accYear: string;
        tssId: string;
    }): Promise<TillSupervisorPayload[]>;
    awaitingReceipt(scope: {
        companyId: string;
        branchId: string;
        dayId?: string | null;
        accYear?: string | null;
    }): Promise<TillAwaitingReceiptPayload[]>;
    receive(input: {
        companyId: string;
        branchId: string;
        receiverPin?: string | null;
        bags: ReceiveBagInput[];
    }): Promise<TillReceivedPayload[]>;
    approveCash(input: ApproveCashInput): Promise<TillCashApprovalPayload>;
    private awaitingOf;
    private refuseNothingAwaiting;
    private voucherNos;
    private assertAwaiting;
    private proveSupervisor;
    private readonly signerScope;
    private checkWitnessPin;
    private verifyPin;
    private peekSession;
    private lockSession;
    private assertMovable;
    private assertOperator;
    private assertAtCounter;
    private assertCashLines;
    private loadReason;
    private assertLedger;
    private postingSession;
    private newId;
}
