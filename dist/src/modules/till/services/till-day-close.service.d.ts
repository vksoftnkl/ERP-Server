import { PrismaService } from '../../../database/prisma/prisma.service';
import { TillContextService } from '../till-context.service';
import { TillApprovalService } from './till-approval.service';
import { TillDayService } from './till-day.service';
import { TillEventService } from './till-event.service';
import { TillLedgerService } from './till-ledger.service';
import { TillSafeService } from './till-safe.service';
import { TillSessionService } from './till-session.service';
import type { TillCountLineInput, TillDayCloseCheckPayload, TillDayClosePayload, TillDayReopenPayload } from '../types/till-api.types';
export interface DayKey {
    companyId: string;
    branchId: string;
    accYear: string;
    tbdId: string;
}
export interface DayCloseCount {
    tssId: string;
    lines: TillCountLineInput[];
    floatLeft?: number | null;
}
export interface DayCloseInput extends DayKey {
    notes?: string | null;
    exception?: {
        reasonId: string;
        approverId?: string | null;
        approverPin?: string | null;
        counts?: DayCloseCount[];
    } | null;
}
export declare class TillDayCloseService {
    private readonly prisma;
    private readonly context;
    private readonly approval;
    private readonly events;
    private readonly days;
    private readonly sessions;
    private readonly ledger;
    private readonly safes;
    constructor(prisma: PrismaService, context: TillContextService, approval: TillApprovalService, events: TillEventService, days: TillDayService, sessions: TillSessionService, ledger: TillLedgerService, safes: TillSafeService);
    closeCheck(key: DayKey): Promise<TillDayCloseCheckPayload>;
    private check;
    private safesOverInsured;
    close(input: DayCloseInput): Promise<TillDayClosePayload>;
    private liveCounts;
    reopen(key: DayKey & {
        reasonId: string;
        approverPin?: string | null;
        notes?: string | null;
    }): Promise<TillDayReopenPayload>;
    private assertReopenable;
    private loadDay;
    private lockDay;
    private assertClosable;
    private nextZ;
    private shippedReason;
    private dayApprover;
}
