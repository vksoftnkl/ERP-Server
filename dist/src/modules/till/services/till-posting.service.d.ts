import { Prisma } from '@prisma/client';
import { VoucherPostingService } from '../../../common/posting/voucher-posting.service';
import type { TillCaller } from '../till-context.service';
import { TillEventService } from './till-event.service';
import { TillLedgerService, type SafeRef, type TillCashTender } from './till-ledger.service';
import { TillMovementKind, TillVarianceTreatment } from '../types/till-enum';
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
    notes?: string | null;
    deviceId?: string | null;
}
export declare class TillPostingService {
    private readonly posting;
    private readonly ledger;
    private readonly events;
    constructor(posting: VoucherPostingService, ledger: TillLedgerService, events: TillEventService);
    postMovement(tx: Tx, input: MovementInput): Promise<PostedMovement>;
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
        session: PostingSession;
        reasonId: string;
        reasonText: string;
        caller: TillCaller;
        approvalId?: string | null;
    }): Promise<string | null>;
    postVariance(tx: Tx, input: {
        session: PostingSession;
        tvrId: string;
        tenderLedgerId: string;
        tenderLabel: string;
        variance: Prisma.Decimal;
        treatment: TillVarianceTreatment.WITHIN_TOLERANCE | TillVarianceTreatment.EXPENSE;
        caller: TillCaller;
    }): Promise<string | null>;
    voucherTypeId(tx: Tx, code: string): Promise<number>;
    private newId;
}
export {};
