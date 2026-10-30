import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
export interface ReservationLine {
    lineId: string;
    lineNo: number;
    itemId: string;
    itemUnitId: string;
    godownId: string | null;
    bucket?: string | null;
    qty: number;
    expiresOn?: Date | null;
}
export interface ReservationShort {
    code: 'SALES_RESERVE_SHORT';
    line: number;
    short: number;
    message: string;
}
export declare class StockReservationService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    reserve(tx: Prisma.TransactionClient, doc: {
        docType: 'SALES_ORDER';
        docId: string;
        accYear: string;
        companyId: string;
        branchId: string;
        tenantId?: string | null;
        refno: string | null;
    }, lines: ReservationLine[], actor: string, now: Date): Promise<{
        reserved: Map<string, number>;
        warnings: ReservationShort[];
    }>;
    release(tx: Prisma.TransactionClient, doc: {
        docType: string;
        docId: string;
    }, reason: string, actor: string, now: Date): Promise<number>;
    consume(tx: Prisma.TransactionClient, order: {
        docId: string;
        lineNo: number;
    }, baseQty: number, actor: string, now: Date): Promise<void>;
}
