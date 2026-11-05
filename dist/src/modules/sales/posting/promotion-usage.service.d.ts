import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import type { PromotionApplied, PromotionCapReport, PromotionUsageDoc } from './types/promotion.types';
export declare class PromotionUsageService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    record(tx: Prisma.TransactionClient, doc: PromotionUsageDoc, applied: PromotionApplied[]): Promise<number>;
    reverse(tx: Prisma.TransactionClient, doc: {
        docId: string;
        accYear: string;
    }, reason: string, createdBy?: string): Promise<number>;
    validateApplied(tx: Prisma.TransactionClient, doc: PromotionUsageDoc, schemeIds: string[], opts?: {
        throwOnFirst?: boolean;
    }): Promise<{
        code: string;
        message: string;
        schemeId: string;
    }[]>;
    caps(tx: Prisma.TransactionClient, schemeId: string, custId: string | null): Promise<PromotionCapReport>;
}
