import { PrismaService } from '../../../database/prisma/prisma.service';
import { TillContextService } from '../till-context.service';
import type { TillSlipCheckPayload, TillSlipCheckResultPayload } from '../types/till-api.types';
import { TillEventService } from './till-event.service';
import { TillLedgerService } from './till-ledger.service';
export declare class TillSlipCheckService {
    private readonly prisma;
    private readonly context;
    private readonly ledger;
    private readonly events;
    constructor(prisma: PrismaService, context: TillContextService, ledger: TillLedgerService, events: TillEventService);
    rows(key: SlipCheckKey): Promise<TillSlipCheckPayload>;
    record(input: SlipCheckRecord): Promise<TillSlipCheckResultPayload>;
    private session;
}
export interface SlipCheckKey {
    companyId: string;
    branchId: string;
    accYear: string;
    tssId: string;
    tenderId: string;
}
export interface SlipCheckRecord extends SlipCheckKey {
    ticked: number;
    noSlip: string[];
    amountDiffers: string[];
    slipsWithoutRow: {
        amount: number;
        authCode?: string | null;
        cardLast4?: string | null;
    }[];
    notes?: string | null;
}
