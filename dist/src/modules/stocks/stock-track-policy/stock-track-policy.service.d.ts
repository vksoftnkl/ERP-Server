import { Prisma, StockTrackPolicy } from '@prisma/client';
import { PrismaService } from "../../../database/prisma/prisma.service";
import { AuditLogService } from "../../audit-log/audit-log.service";
import { RequestContextService } from "../../../common/request-context/request-context.service";
import { DerivedTrackPolicy, ItemTrackPolicySource, StockTrackPolicySyncResult } from './types/stock-track-policy.types';
export declare const DERIVED_FROM_ITEM_REMARK = "Auto-derived from item master";
export declare class StockTrackPolicyService {
    private readonly prisma;
    private readonly auditLogService;
    private readonly requestContextService;
    constructor(prisma: PrismaService, auditLogService: AuditLogService, requestContextService: RequestContextService);
    syncFromItem(item: ItemTrackPolicySource, tx?: Prisma.TransactionClient): Promise<StockTrackPolicySyncResult>;
    deriveFromItem(item: ItemTrackPolicySource): DerivedTrackPolicy;
    findByItemId(itemId: string, tx?: Prisma.TransactionClient): Promise<StockTrackPolicy | null>;
    private createDerived;
    private updateDerived;
    private toColumns;
    private hasChanged;
    private actor;
    private positiveOrNull;
    private nonNegativeOr;
    private logChange;
    private toAuditRecord;
}
