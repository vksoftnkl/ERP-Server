import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import type { TillCaller } from '../till-context.service';
import type { TillSettings } from '../till.settings';
import { TillEventService } from './till-event.service';
import type { TillDayPayload } from '../types/till-api.types';
type Tx = Prisma.TransactionClient;
export interface OpenDay {
    tbdId: string;
    tbdAccYear: string;
    businessDate: string;
    created: boolean;
}
export declare class TillDayService {
    private readonly prisma;
    private readonly events;
    constructor(prisma: PrismaService, events: TillEventService);
    ensureOpenDay(tx: Tx, scope: {
        companyId: string;
        branchId: string;
        tenantId: string | null;
    }, settings: TillSettings, caller: TillCaller, by: 'SESSION' | 'MANAGER'): Promise<OpenDay>;
    open(scope: {
        companyId: string;
        branchId: string;
        tenantId: string | null;
    }, settings: TillSettings, caller: TillCaller): Promise<{
        day: TillDayPayload;
        created: boolean;
    }>;
    get(scope: {
        companyId: string;
        branchId: string;
        accYear: string;
        tbdId?: string | null;
    }, settings?: TillSettings): Promise<TillDayPayload>;
}
export {};
