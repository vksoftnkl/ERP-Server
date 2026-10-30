import { Prisma, type TillBusinessDay } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { TillContextService } from '../till-context.service';
import { TillApprovalService } from './till-approval.service';
import { TillDayService } from './till-day.service';
import { TillEventService } from './till-event.service';
import { TillLedgerService } from './till-ledger.service';
import { TillMovementService } from './till-movement.service';
import { TillPostingService } from './till-posting.service';
import { TillSessionService } from './till-session.service';
import { TillRemitMode, type TillSafeGapTreatment } from '../types/till-enum';
import type { TillCountLineInput, TillRemitConfirmPayload, TillRemitPayload, TillSafeBalancePayload, TillSafeCountPayload, TillSafeDecisionPayload } from '../types/till-api.types';
type Tx = Prisma.TransactionClient;
type Client = Tx | PrismaService;
export interface SafeCountInput {
    companyId: string;
    branchId: string;
    tenantId?: string | null;
    safeId: string;
    lines: TillCountLineInput[];
    notes?: string | null;
    witnessId?: string | null;
    witnessPin?: string | null;
    treatment?: TillSafeGapTreatment | null;
    reasonId?: string | null;
    approverPin?: string | null;
}
export interface SafeDecideInput {
    companyId: string;
    branchId: string;
    accYear: string;
    tvrId: string;
    treatment: TillSafeGapTreatment;
    reasonId: string;
    notes?: string | null;
    approverPin?: string | null;
    secondId?: string | null;
    secondPin?: string | null;
}
export interface RemitCreateInput {
    companyId: string;
    branchId: string;
    tenantId?: string | null;
    safeId: string;
    amount: number;
    bankLedgerId: string;
    mode: TillRemitMode;
    bagNo?: string | null;
    sealNo?: string | null;
    citAgency?: string | null;
    slipNo?: string | null;
    slipDate?: string | null;
    lines?: TillCountLineInput[] | null;
    notes?: string | null;
    approverId?: string | null;
    approverPin?: string | null;
}
export interface RemitConfirmCreateInput {
    companyId: string;
    branchId: string;
    accYear: string;
    tcmId: string;
    bankDate: string;
    bankRef: string;
    bankAmount?: number | null;
    treatment?: TillSafeGapTreatment | null;
    reasonId?: string | null;
    notes?: string | null;
    approverPin?: string | null;
    witnessId?: string | null;
    witnessPin?: string | null;
}
export declare class TillSafeService {
    private readonly prisma;
    private readonly context;
    private readonly ledger;
    private readonly posting;
    private readonly sessions;
    private readonly events;
    private readonly approval;
    private readonly days;
    private readonly movements;
    constructor(prisma: PrismaService, context: TillContextService, ledger: TillLedgerService, posting: TillPostingService, sessions: TillSessionService, events: TillEventService, approval: TillApprovalService, days: TillDayService, movements: TillMovementService);
    balance(scope: {
        companyId: string;
        branchId: string;
        safeId?: string | null;
    }): Promise<TillSafeBalancePayload>;
    private stateOf;
    private flowsOf;
    private statePayload;
    private inTransit;
    count(input: SafeCountInput): Promise<TillSafeCountPayload>;
    decideVariance(input: SafeDecideInput): Promise<TillSafeDecisionPayload>;
    remit(input: RemitCreateInput): Promise<TillRemitPayload>;
    confirmRemit(input: RemitConfirmCreateInput): Promise<TillRemitConfirmPayload>;
    voidRemit(input: {
        companyId: string;
        branchId: string;
        accYear: string;
        tcmId: string;
        reasonId: string;
        notes?: string | null;
    }): Promise<void>;
    refreshDay(tx: Tx, tbdId: string, accYear: string): Promise<void>;
    uncountedSafes(client: Client, day: TillBusinessDay): Promise<{
        safeId: string;
        name: string;
    }[]>;
    pendingGapsOfDay(client: Client, day: TillBusinessDay): Promise<number>;
    private raiseGap;
    private decisionPayload;
    private judgeGap;
    private withPinFail;
    private provePerson;
    private dayFor;
    private loadSafe;
    private branchSafes;
    private lockSafe;
    private customPlans;
    private figuresVisible;
    private assertCashLines;
    private assertWithinBalance;
    private assertBank;
    private loadRemit;
    private assertInTransit;
    private pendingGap;
    private requesterOf;
    private safeRef;
    private voucherNos;
}
export {};
