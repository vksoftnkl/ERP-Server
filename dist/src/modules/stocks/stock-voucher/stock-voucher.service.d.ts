import { PrismaService } from "../../../database/prisma/prisma.service";
import { AuditLogService } from "../../audit-log/audit-log.service";
import { RequestContextService } from "../../../common/request-context/request-context.service";
import { SaveStockVoucherDto } from './dto/save-stock-voucher.dto';
import { type OpeningReconcileRow, type PagedResult, type PendingOpeningItem, type StockVoucherCancelResult, type StockVoucherDeleteResult, type StockVoucherLineProblem, type StockVoucherListResult, type StockVoucherPayload, type StockVoucherPostResult, type StockVoucherStatus, type StockVoucherTypeRules } from './types/stock-voucher.types';
interface ListStockVouchersQuery {
    companyId: string;
    branchId: string;
    accYear: string;
    status?: StockVoucherStatus;
    fromDate?: string;
    toDate?: string;
    search?: string;
    limit?: number;
    offset?: number;
}
export declare class StockVoucherService {
    private readonly prisma;
    private readonly auditLogService;
    private readonly requestContextService;
    constructor(prisma: PrismaService, auditLogService: AuditLogService, requestContextService: RequestContextService);
    save(rules: StockVoucherTypeRules, dto: SaveStockVoucherDto): Promise<StockVoucherPayload>;
    private assertPayloadRules;
    private resolveConversions;
    private assertUnitsBelongToItems;
    private createDraft;
    private updateDraft;
    private replaceLines;
    list(rules: StockVoucherTypeRules, query: ListStockVouchersQuery): Promise<StockVoucherListResult>;
    getById(rules: StockVoucherTypeRules, svhId: string, accYear: string, companyId: string, branchId: string): Promise<StockVoucherPayload>;
    validate(rules: StockVoucherTypeRules, svhId: string, accYear: string, companyId: string, branchId: string): Promise<StockVoucherLineProblem[]>;
    post(rules: StockVoucherTypeRules, svhId: string, accYear: string, companyId: string, branchId: string, userId?: string): Promise<StockVoucherPostResult>;
    cancel(rules: StockVoucherTypeRules, svhId: string, accYear: string, reason: string, companyId: string, branchId: string, userId?: string): Promise<StockVoucherCancelResult>;
    softDelete(rules: StockVoucherTypeRules, svhId: string, accYear: string, companyId: string, branchId: string, userId?: string): Promise<StockVoucherDeleteResult>;
    pendingItems(rules: StockVoucherTypeRules, companyId: string, branchId: string, accYear: string, limit?: number, offset?: number): Promise<PagedResult<PendingOpeningItem>>;
    reconcile(rules: StockVoucherTypeRules, companyId: string, branchId: string, accYear: string, limit?: number, offset?: number): Promise<PagedResult<OpeningReconcileRow>>;
    private loadForWrite;
    private loadHeaderOrThrow;
    private assertDraft;
    private toHeaderPayload;
    private toLinePayload;
    private toIsoDate;
    private toDecimalNumber;
    private toNullableDecimal;
    private clamp;
}
export {};
