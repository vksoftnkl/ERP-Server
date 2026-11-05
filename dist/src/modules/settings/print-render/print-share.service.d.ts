import { PrismaService } from "../../../database/prisma/prisma.service";
import { PrintLogService } from './print-log.service';
import { PrintRenderService } from './print-render.service';
import type { RenderOutcome } from './types/print-render-api.types';
export declare const PRINT_SHARE_DEFAULT_TTL_DAYS = 30;
export declare const PRINT_SHARE_TOKEN_PATTERN: RegExp;
export type CreatePrintShareInput = {
    versionId: string;
    docId: string;
    companyId: string;
    branchId: string | null;
    accYear: string | null;
    deviceId: string | null;
    userId: string | null;
    filename: string | null;
};
export type CreatedPrintShare = {
    token: string;
    path: string;
    url: string | null;
    expiresAt: string;
};
export type OpenedPrintShare = {
    status: 'OK';
    outcome: RenderOutcome;
    filename: string;
} | {
    status: 'MISSING';
} | {
    status: 'EXPIRED';
    expiredOn: Date;
};
export declare function safeFileStem(raw: string | null | undefined): string;
export declare function shareTtlDays(raw: string | undefined): number;
export declare class PrintShareService {
    private readonly prisma;
    private readonly printRender;
    private readonly printLog;
    private readonly logger;
    constructor(prisma: PrismaService, printRender: PrintRenderService, printLog: PrintLogService);
    create(input: CreatePrintShareInput): Promise<CreatedPrintShare>;
    open(token: string): Promise<OpenedPrintShare>;
}
