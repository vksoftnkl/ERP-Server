import { PrismaService } from '../../database/prisma/prisma.service';
export declare const PENDING_STATUSES: readonly ["DRAFT", "HELD", "CONFIRMED", "IN_TRANSIT"];
export interface PendingDocument {
    srcModule: string;
    srcDocType: string;
    srcDocId: string;
    refno: string | null;
    accYear: string;
    status: string;
    since: string;
    changedBy: string | null;
    changedByName: string | null;
    branchId: string;
}
export interface PendingCount {
    srcModule: string;
    srcDocType: string;
    status: string;
    count: number;
}
export interface PendingDocumentsResult {
    items: PendingDocument[];
    counts: PendingCount[];
    total: number;
}
export interface PendingQuery {
    companyId: string;
    branchId?: string | null;
    accYear: string;
    upToDate?: string | null;
    srcModule?: string | null;
    limit?: number;
    offset?: number;
}
export declare class TxnStatusService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    pending(query: PendingQuery): Promise<PendingDocumentsResult>;
}
