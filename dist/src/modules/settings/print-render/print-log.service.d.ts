import { PrismaService } from "../../../database/prisma/prisma.service";
import { PlgOutputMode, PlgStatus } from './print-render.constants';
export interface PrintLogEntry {
    accYear: string;
    companyId: string;
    branchId: string | null;
    deviceId: string | null;
    srcModule: string;
    srcDocType: string;
    srcDocId: string | null;
    srcAccYear: string | null;
    purposeId: string;
    templateId: string;
    versionId: string;
    printerId: string | null;
    outputMode: PlgOutputMode;
    copyNo: number;
    copyLabel: string | null;
    lang: string | null;
    params: Record<string, unknown> | null;
    status: PlgStatus;
    error: string | null;
    pageCount: number | null;
    byteCount: number | null;
    durationMs: number | null;
    printedBy: string | null;
}
export declare class PrintLogService {
    private readonly prisma;
    private readonly logger;
    constructor(prisma: PrismaService);
    currentAccYear(companyId: string, fallback: string | null): Promise<string>;
    record(entries: readonly PrintLogEntry[]): Promise<string[]>;
    private insert;
    private createPartition;
    private isMissingPartition;
    private reportSwallowed;
}
