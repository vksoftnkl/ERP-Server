import { Prisma } from '@prisma/client';
import { PrismaService } from "../../../database/prisma/prisma.service";
import { RequestContextService } from "../../../common/request-context/request-context.service";
import type { DeactivateStockReasonDto, SaveStockReasonDto, StockReasonPickerQueryDto } from './dto/stock-reason.dto';
import { type StockAdjustmentKind } from './stock-adjustment.rules';
export interface StockReasonRow {
    srmId: string;
    companyId: string | null;
    isShared: boolean;
    code: string;
    name: string;
    direction: string;
    allowedTxnTypes: string[];
    requireRemarks: boolean;
    glLedgerId: string | null;
    glLedgerName: string | null;
    sortOrder: number;
    remarks: string | null;
    isActive: boolean;
}
export interface StockReasonListRow extends StockReasonRow {
    isOverridden: boolean;
    usageCount: number;
    canDelete: boolean;
}
export interface StockReasonUsage {
    srmId: string;
    ledgerRows: number;
    voucherHeaders: number;
    voucherLines: number;
    lastUsedOn: string | null;
}
export declare class StockReasonsService {
    private readonly prisma;
    private readonly requestContextService;
    constructor(prisma: PrismaService, requestContextService: RequestContextService);
    pick(query: StockReasonPickerQueryDto): Promise<StockReasonRow[]>;
    list(companyId: string, includeInactive?: boolean): Promise<StockReasonListRow[]>;
    getOne(companyId: string, srmId: string): Promise<StockReasonListRow>;
    usage(companyId: string, srmId: string): Promise<StockReasonUsage>;
    save(dto: SaveStockReasonDto): Promise<StockReasonListRow>;
    deactivate(dto: DeactivateStockReasonDto): Promise<StockReasonListRow | {
        srmId: string;
        deleted: true;
    }>;
    private assertCodeFree;
}
export type { StockAdjustmentKind, Prisma };
