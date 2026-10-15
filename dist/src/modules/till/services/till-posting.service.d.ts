import { Prisma } from '@prisma/client';
import { VoucherPostingService } from '../../../common/posting/voucher-posting.service';
import type { TillCaller } from '../till-context.service';
import { TillEventService } from './till-event.service';
import { TillLedgerService, type SafeRef, type TillCashTender } from './till-ledger.service';
import { TillMovementKind, TillRemitMode, TillVarianceTreatment } from '../types/till-enum';
type Tx = Prisma.TransactionClient;
export interface PostingSession {
    tssId: string;
    tssAccYear: string;
    tssCompanyId: string;
    tssBranchId: string;
    tssTenantId: string | null;
    tssDayId: string;
    tssCounterId: string;
    tssDeviceId: string;
    sessionNo: string;
    businessDate: string;
}
export interface PostedMovement {
    tcmId: string;
    docNo: string;
    voucherId: string | null;
}
export interface MovementInput {
    session: PostingSession;
    kind: TillMovementKind;
    amount: Prisma.Decimal;
    safe: SafeRef | null;
    ledgerId?: string | null;
    tillCash: TillCashTender;
    caller: TillCaller;
    tcmId?: string;
    doneBy?: string;
    witnessBy?: string | null;
    reasonId?: string | null;
    refNo?: string | null;
    refDate?: string | null;
    partyName?: string | null;
    bagNo?: string | null;
    sealNo?: string | null;
    countId?: string | null;
    approvalId?: string | null;
    witnessVerifiedOn?: Date | null;
    notes?: string | null;
    deviceId?: string | null;
    awaitingLedgerId?: string | null;
}
export interface ReceiveInput {
    movement: {
        tcmId: string;
        tcmAccYear: string;
        tcmKind: string;
        tcmDocNo: string;
        tcmAmount: Prisma.Decimal;
    };
    session: PostingSession;
    safe: SafeRef;
    awaitingLedgerId: string;
    received: Prisma.Decimal;
    countId: string | null;
    on: {
        date: string;
        accYear: string;
    };
    caller: TillCaller;
    notes?: string | null;
}
export interface SafeScope {
    companyId: string;
    branchId: string;
    tenantId: string | null;
    accYear: string;
    date: string;
    dayId: string;
}
export interface RemitInput {
    scope: SafeScope;
    safe: SafeRef;
    amount: Prisma.Decimal;
    mode: TillRemitMode;
    bankLedgerId: string;
    transitLedgerId: string | null;
    caller: TillCaller;
    tcmId?: string;
    bagNo?: string | null;
    sealNo?: string | null;
    citAgency?: string | null;
    slipNo?: string | null;
    slipDate?: string | null;
    countId?: string | null;
    approvalId?: string | null;
    notes?: string | null;
}
export interface RemitConfirmInput {
    movement: {
        tcmId: string;
        tcmAccYear: string;
        tcmDocNo: string;
        tcmAmount: Prisma.Decimal;
        tcmDayId: string;
        tcmSafeId: string | null;
        tcmLedgerId: string | null;
    };
    scope: Omit<SafeScope, 'dayId'>;
    transitLedgerId: string;
    bankAmount: Prisma.Decimal;
    bankDate: string;
    bankRef: string;
    caller: TillCaller;
    notes?: string | null;
}
export declare class TillPostingService {
    private readonly posting;
    private readonly ledger;
    private readonly events;
    constructor(posting: VoucherPostingService, ledger: TillLedgerService, events: TillEventService);
    postMovement(tx: Tx, input: MovementInput): Promise<PostedMovement>;
    postRemit(tx: Tx, input: RemitInput): Promise<PostedMovement>;
    postRemitConfirm(tx: Tx, input: RemitConfirmInput): Promise<string | null>;
    postReceive(tx: Tx, input: ReceiveInput): Promise<string | null>;
    voidMovement(tx: Tx, input: {
        movement: {
            tcmId: string;
            tcmAccYear: string;
            tcmKind: string;
            tcmDocNo: string;
            tcmAmount: Prisma.Decimal;
            tcmVoucherId: string | null;
            tcmVoucherAccYear: string | null;
        };
        session: PostingSession | null;
        dayId?: string | null;
        companyId?: string;
        branchId?: string;
        reasonId: string;
        reasonText: string;
        caller: TillCaller;
        approvalId?: string | null;
    }): Promise<string | null>;
    reverseVariance(tx: Tx, input: {
        variance: {
            tvrId: string;
            tvrAccYear: string;
            tvrVoucherId: string | null;
            tvrVoucherAccYear: string | null;
        };
        reasonText: string;
        caller: TillCaller;
    }): Promise<string | null>;
    postVariance(tx: Tx, input: {
        session: PostingSession;
        tvrId: string;
        tenderLedgerId: string;
        tenderLabel: string;
        variance: Prisma.Decimal;
        treatment: PostedTreatment;
        recoveryLedgerId?: string | null;
        caller: TillCaller;
        on?: {
            date: string;
            accYear: string;
        } | null;
    }): Promise<string | null>;
    postSafeVariance(tx: Tx, input: {
        scope: Omit<SafeScope, 'dayId'>;
        tvrId: string;
        tvrAccYear: string;
        ledgerId: string;
        label: string;
        variance: Prisma.Decimal;
        treatment: PostedTreatment;
        caller: TillCaller;
    }): Promise<string | null>;
    private postVarianceVoucher;
    private markVariancePosted;
    private varianceCounterLedger;
    voucherTypeId(tx: Tx, code: string): Promise<number>;
    private newId;
}
type PostedTreatment = Exclude<TillVarianceTreatment, TillVarianceTreatment.PENDING | TillVarianceTreatment.RETENDERED>;
export {};
