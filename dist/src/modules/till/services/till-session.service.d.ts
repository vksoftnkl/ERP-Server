import { Prisma, type TillSession } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { TillContextService, type TillCaller } from '../till-context.service';
import { throwTillBadRequest } from '../till-errors';
import { TillDayService } from './till-day.service';
import { TillEventService } from './till-event.service';
import { TillLedgerService } from './till-ledger.service';
import { TillPostingService } from './till-posting.service';
import { TillCountKind, TillEventCode, TillFloatMode } from '../types/till-enum';
import type { TillCountLineInput, TillCountResultPayload, TillOpenCheckPayload, TillSessionPayload } from '../types/till-api.types';
type Tx = Prisma.TransactionClient;
export interface SessionKey {
    companyId: string;
    branchId: string;
    accYear: string;
    tssId: string;
}
export interface LiveSessionRef {
    tssId: string;
    tssAccYear: string;
    tssCounterId: string;
    tssDeviceId: string;
    tssOperatorId: string;
    businessDate: string;
}
export declare class TillSessionService {
    private readonly prisma;
    private readonly context;
    private readonly days;
    private readonly ledger;
    private readonly posting;
    private readonly events;
    constructor(prisma: PrismaService, context: TillContextService, days: TillDayService, ledger: TillLedgerService, posting: TillPostingService, events: TillEventService);
    open(input: {
        companyId: string;
        branchId: string;
        tenantId?: string | null;
        counterId?: string | null;
        floatMode?: TillFloatMode | null;
        floatIssued?: number | null;
        prevSessionId?: string | null;
        lines: TillCountLineInput[];
        reasonId?: string | null;
        notes?: string | null;
    }): Promise<TillSessionPayload>;
    current(scope: {
        companyId: string;
        branchId: string;
    }): Promise<TillSessionPayload | null>;
    openCheck(scope: {
        companyId: string;
        branchId: string;
        deviceId?: string | null;
        userId?: string | null;
        counterId?: string | null;
    }): Promise<TillOpenCheckPayload>;
    get(key: SessionKey, opts?: {
        asOperator?: boolean;
    }): Promise<TillSessionPayload>;
    getWithExpected(key: SessionKey): Promise<TillSessionPayload>;
    suspend(key: SessionKey, reasonId?: string | null): Promise<TillSessionPayload>;
    resume(key: SessionKey): Promise<TillSessionPayload>;
    endBilling(key: SessionKey, sync?: {
        outboxCount?: number | null;
        lastClientSeq?: number | null;
    }): Promise<TillSessionPayload>;
    private assertDeviceSynced;
    count(key: SessionKey, input: {
        lines: TillCountLineInput[];
        witnessBy?: string | null;
        notes?: string | null;
    }): Promise<TillCountResultPayload>;
    close(key: SessionKey, input: {
        floatLeft?: number | null;
        notes?: string | null;
    }): Promise<TillSessionPayload>;
    resolveForMoney(client: Tx | PrismaService, scope: {
        companyId: string;
        branchId: string;
        sessionId: string | null | undefined;
        field: string;
        docTime?: Date | null;
        arrivedAt?: Date | null;
        lateArrivalOk?: boolean;
        optional?: boolean;
        cashIn?: boolean;
    }): Promise<LiveSessionRef | null>;
    cashState(client: Tx | PrismaService, session: TillSession, counter?: {
        tcnCashAlertLimit: Prisma.Decimal;
        tcnCashBlockLimit: Prisma.Decimal;
    }): Promise<{
        state: 'NORMAL' | 'ALERT' | 'BLOCKED';
        gauge: number | null;
        alertLimit: number;
        blockLimit: number;
        cash: Prisma.Decimal;
    }>;
    stampTenderRows(tx: Tx, ref: LiveSessionRef, doc: {
        srcDocType: string;
        srcDocId: string;
        accYear: string;
    }, actorName: string): Promise<number>;
    stampVoucher(tx: Tx, ref: LiveSessionRef, doc: {
        voucherId: string;
        accYear: string;
        srcDocType: string;
    }, actorName: string): Promise<void>;
    routeMoneyDoc(client: Tx | PrismaService, scope: {
        companyId: string;
        branchId: string;
        sessionId: string | null | undefined;
        field: string;
        hasCash: boolean;
        cashIn?: boolean;
    }): Promise<{
        ref: LiveSessionRef | null;
        cashLedgerId: string | null;
        safeName: string | null;
    }>;
    routeCashToLedger(tx: Tx, doc: {
        srcDocType: string;
        srcDocId: string;
        accYear: string;
        ledgerId: string;
        actor: string;
    }): Promise<void>;
    assertMoneyDocCancellable(client: Tx | PrismaService, doc: {
        sessionId: string | null;
        field: string;
    }): Promise<void>;
    logMoneyDoc(tx: Tx, doc: {
        sessionId: string;
        code: TillEventCode.RECEIPT_POSTED | TillEventCode.PAYMENT_POSTED | TillEventCode.EXPENSE_POSTED | TillEventCode.MONEY_DOC_CANCELLED | TillEventCode.RETENDER;
        srcDocType: 'RECEIPT' | 'PAYMENT' | 'EXPENSE' | 'SALE_BILL';
        srcDocId: string;
        srcRefno: string | null;
        amount: Prisma.Decimal | number;
        payload?: Prisma.InputJsonValue;
    }): Promise<void>;
    assertNoTillCashLeg(client: Tx | PrismaService, scope: {
        companyId: string;
        branchId: string;
        ledgerIds: readonly string[];
        field: string;
    }): Promise<void>;
    assertCancellable(client: Tx | PrismaService, doc: {
        sessionId: string | null;
        srcDocType: string;
        srcDocId: string;
        accYear: string;
        field: string;
    }): Promise<void>;
    private assertOwnedHere;
    assertLive(session: TillSession, scope: {
        companyId: string;
        branchId: string;
        userId: string;
        deviceId: string;
        field: string;
    }): LiveSessionRef;
    private requireDevice;
    private knownDevice;
    private linkedCounter;
    private counterBoard;
    private counterRow;
    private holdingSessions;
    private claimCounter;
    private lockCounter;
    private rethrowCounterTaken;
    private assertDeviceFree;
    private assertCounterFree;
    private assertOperatorFree;
    private floatMismatchReason;
    private carriedFrom;
    private lastClosed;
    private nextDaySeq;
    private lockOwn;
    private lockForCount;
    private lock;
    priceLines(tx: Tx, companyId: string, lines: TillCountLineInput[]): Promise<(TillCountLineInput & {
        faceValue: Prisma.Decimal;
        amount: Prisma.Decimal;
    })[]>;
    writeMovementCount(tx: Tx, session: TillSession, input: {
        kind: TillCountKind;
        lines: (TillCountLineInput & {
            faceValue: Prisma.Decimal;
            amount: Prisma.Decimal;
        })[];
        safeId: string | null;
        movementId: string;
        caller: TillCaller;
        deviceId: string;
        witnessBy?: string | null;
    }): Promise<string>;
    private assertCountable;
    private assertTerminalNamed;
    private countedByTender;
    private compare;
    private varianceRow;
    private writeCount;
    private frozenTotals;
    private tenderLedger;
    private expectedVisible;
    private toPayload;
    private expectationSession;
    private postingSession;
    private logSessionEvent;
}
export { throwTillBadRequest };
