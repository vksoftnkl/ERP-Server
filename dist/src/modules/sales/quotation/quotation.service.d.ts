import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { SaveQuotationDto } from './dto/save-quotation.dto';
import { QuotationPayload } from './types/quotation-api.types';
import { RequestContextService } from '../../../common/request-context/request-context.service';
export declare class QuotationService {
    private readonly prisma;
    private readonly auditLogService;
    private readonly requestContextService;
    constructor(prisma: PrismaService, auditLogService: AuditLogService, requestContextService: RequestContextService);
    save(saveQuotationDto: SaveQuotationDto): Promise<QuotationPayload>;
    getById(sqId: string | undefined, sqQuoteNo: string | undefined, sqCompanyId: string, sqBranchId: string, sqAccYear: string): Promise<QuotationPayload>;
    softDelete(sqId: string, sqCompanyId: string, sqBranchId: string, sqAccYear: string): Promise<{
        sqId: string;
        deleted: true;
    }>;
    private createQuotation;
    private updateQuotation;
    private syncItems;
    private softDeleteItems;
    private resolveDuplicateIndex;
    private describeDuplicate;
    private requireItemField;
    private findCharges;
    private findAgent;
    private syncCharges;
    private requireChargeField;
    private toVoucherNo;
    private ensureChargeValuesAreAllowed;
    private logStatusStep;
    private toStatusEvent;
    private applyOptionalFields;
    private applyParentRevision;
    private toPayload;
    private toChargePayload;
    private toItemPayload;
}
