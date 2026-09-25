import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { StatutoryService } from './statutory.service';
import type { RegisterDoc, RegisterWriteResult } from './doc-register.types';
export declare class DocRegisterService {
    private readonly prisma;
    private readonly statutory;
    constructor(prisma: PrismaService, statutory: StatutoryService);
    write(tx: Prisma.TransactionClient, doc: RegisterDoc, opts?: {
        companyEinvoiceFlag?: boolean;
        aatoAmount?: number | null;
        interState?: boolean;
    }): Promise<RegisterWriteResult>;
    registerIdOf(c: Prisma.TransactionClient, sourceDocId: string, accYear: string): Promise<string | null>;
    cancel(tx: Prisma.TransactionClient, gdrId: string, accYear: string, reason: string, actor?: string): Promise<number>;
    retire(tx: Prisma.TransactionClient, gdrId: string, accYear: string, actor?: string): Promise<number>;
    reissue(tx: Prisma.TransactionClient, oldGdrId: string, doc: RegisterDoc, opts?: {
        reason?: string;
        actor?: string;
        companyEinvoiceFlag?: boolean;
        aatoAmount?: number | null;
        interState?: boolean;
    }): Promise<RegisterWriteResult>;
    private writeDetails;
}
