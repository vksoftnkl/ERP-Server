import { PrismaService } from '../../../database/prisma/prisma.service';
import { TillContextService } from '../till-context.service';
import { TillEventService } from './till-event.service';
import { TillLedgerService } from './till-ledger.service';
import { TillPostingService } from './till-posting.service';
import { TillSessionService } from './till-session.service';
import { TillMovementKind } from '../types/till-enum';
import type { TillCountLineInput, TillMovementDetailPayload, TillSupervisorPayload } from '../types/till-api.types';
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
    constructor(prisma: PrismaService, context: TillContextService, ledger: TillLedgerService, posting: TillPostingService, sessions: TillSessionService, events: TillEventService);
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
