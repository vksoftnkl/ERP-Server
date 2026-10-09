import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import type { TillApprovalNeed } from '../types/till-api.types';
type Client = Prisma.TransactionClient | PrismaService;
export declare class TillApprovalService {
    ruleFor(client: Client, scope: {
        companyId: string;
        branchId: string;
        event: string;
        onDate: string;
    }): Promise<{
        tar_id: string;
        tar_event_code: string;
        tar_mode: string;
        tar_threshold_amount: Prisma.Decimal;
        tar_channel: string;
        tar_min_role: string;
        tar_two_person: boolean;
        tar_blocks_till: boolean;
    }>;
    assess(client: Client, scope: {
        companyId: string;
        branchId: string;
        event: string;
        onDate: string;
        amount: Prisma.Decimal;
    }): Promise<TillApprovalNeed | null>;
}
export {};
