import { PrismaService } from '../../../database/prisma/prisma.service';
import { TillContextService } from '../till-context.service';
import { TillLedgerService } from './till-ledger.service';
import { TillPostingService } from './till-posting.service';
import { TillSessionService } from './till-session.service';
import { TillMovementKind } from '../types/till-enum';
import type { TillCountLineInput, TillMovementDetailPayload } from '../types/till-api.types';
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
    notes?: string | null;
}
export declare class TillMovementService {
    private readonly prisma;
    private readonly context;
    private readonly ledger;
    private readonly posting;
    private readonly sessions;
    constructor(prisma: PrismaService, context: TillContextService, ledger: TillLedgerService, posting: TillPostingService, sessions: TillSessionService);
    create(input: CreateMovementInput): Promise<TillMovementDetailPayload>;
    change(input: {
        companyId: string;
        branchId: string;
        accYear: string;
        fromTssId: string;
        toTssId: string;
        lines: TillCountLineInput[];
        reasonId: string;
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
    private lockSession;
    private assertOperator;
    private assertCashLines;
    private loadReason;
    private assertLedger;
    private postingSession;
    private newId;
}
