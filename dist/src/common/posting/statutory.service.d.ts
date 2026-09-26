import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { AatoClass, CancelWindowKind, StatutoryAppliesTo, StatutoryLimit } from './statutory.types';
export declare class StatutoryService {
    private readonly prisma;
    private readonly cache;
    constructor(prisma: PrismaService);
    limit(companyId: string, code: string, onDate: string, appliesTo?: StatutoryAppliesTo, aatoClass?: AatoClass | null, tx?: Prisma.TransactionClient): Promise<StatutoryLimit | null>;
    aatoClass(companyId: string, tx?: Prisma.TransactionClient): Promise<AatoClass | null>;
    assertCashLimit(companyId: string, cashAmount: number, onDate: string, tx?: Prisma.TransactionClient): Promise<{
        limit: StatutoryLimit | null;
        exceeded: boolean;
    }>;
    assertPanOrForm60(companyId: string, cashAmount: number, onDate: string, tx?: Prisma.TransactionClient): Promise<{
        limit: StatutoryLimit | null;
        required: boolean;
    }>;
    ewayApplicable(companyId: string, consignmentValue: number, onDate: string, opts: {
        interState: boolean;
        stateCode?: string | null;
    }, tx?: Prisma.TransactionClient): Promise<{
        limit: StatutoryLimit | null;
        applicable: boolean;
    }>;
    einvoiceApplicable(companyId: string, onDate: string, opts: {
        aatoAmount: number | null;
        companyFlag: boolean;
    }, tx?: Prisma.TransactionClient): Promise<{
        limit: StatutoryLimit | null;
        applicable: boolean;
        byLaw: boolean;
    }>;
    hsnDigits(companyId: string, onDate: string, tx?: Prisma.TransactionClient): Promise<{
        limit: StatutoryLimit | null;
        digits: number | null;
    }>;
    withinCancelWindow(companyId: string, kind: CancelWindowKind, generatedOn: Date, onDate: string, now?: Date, tx?: Prisma.TransactionClient): Promise<{
        limit: StatutoryLimit | null;
        within: boolean;
        hoursElapsed: number;
    }>;
    creditNoteCutoff(companyId: string, billDate: string, onDate: string, tx?: Prisma.TransactionClient): Promise<{
        limit: StatutoryLimit | null;
        cutoff: string | null;
        passed: boolean;
    }>;
    private toLimit;
}
