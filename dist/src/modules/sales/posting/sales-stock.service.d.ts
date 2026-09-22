import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { StockPostingService } from '../../stocks/posting/stock-posting.service';
export type SalesStockDocType = 'SALE_BILL' | 'DELIVERY_CHALLAN' | 'SALE_RETURN' | 'DC_RETURN';
export type SalesStockTxnType = 'SALE' | 'DC_ISSUE' | 'SALE_RETURN' | 'DC_RETURN';
export interface SalesStockLine {
    lineId: string;
    lineNo: number;
    itemId: string;
    itemUnitId: string;
    godownId: string;
    lotId?: string | null;
    bucket?: string | null;
    qty: number;
    freeQty?: number;
    weightQty?: number | null;
    toBaseFactor?: number | null;
    batchNo?: string | null;
    batchDate?: string | null;
    expiryDate?: string | null;
    serialNo?: string | null;
    mrp?: number | null;
    rate?: number | null;
    costRate?: number | null;
    taxPerc?: number | null;
    isService?: boolean;
}
export interface SalesStockDoc {
    docType: SalesStockDocType;
    docId: string;
    accYear: string;
    companyId: string;
    branchId: string;
    tenantId?: string | null;
    deviceId: string | null;
    sessionId?: string | null;
    docDate: string;
    docDatetime: Date;
    refno: string;
    revision: number;
    partyId?: string | null;
    direction: 'OUT' | 'IN';
    txnType: SalesStockTxnType;
    remarks?: string | null;
    lines: SalesStockLine[];
}
export interface SalesStockResult {
    svhId: string | null;
    rowsPosted: number;
    costByLine: Map<string, number>;
    lotByLine: Map<string, string | null>;
    cogsTotal: number;
}
export declare class SalesStockService {
    private readonly prisma;
    private readonly stockPosting;
    constructor(prisma: PrismaService, stockPosting: StockPostingService);
    post(tx: Prisma.TransactionClient, doc: SalesStockDoc, actor: string, postedOn: Date): Promise<SalesStockResult>;
    cancel(tx: Prisma.TransactionClient, doc: Pick<SalesStockDoc, 'docType' | 'docId' | 'accYear' | 'companyId' | 'branchId' | 'direction' | 'txnType'>, actor: string, reason: string, cancelledOn: Date): Promise<number>;
    private rules;
    private units;
    private writeShadow;
}
