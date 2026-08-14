import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { SaveCompanyMasterDto } from './dto/save-company-master.dto';
import { CompanyMasterPayload } from './types/company-master-api.types';
import { RequestContextService } from '../../../common/request-context/request-context.service';
export declare class CompanyMasterService {
    private readonly prisma;
    private readonly auditLogService;
    private readonly requestContextService;
    constructor(prisma: PrismaService, auditLogService: AuditLogService, requestContextService: RequestContextService);
    save(saveCompanyMasterDto: SaveCompanyMasterDto): Promise<CompanyMasterPayload>;
    getById(compId: string): Promise<CompanyMasterPayload>;
    softDelete(compId: string): Promise<{
        compId: string;
        deleted: true;
    }>;
    private createCompany;
    private updateCompany;
    private ensureNameIsUnique;
    private ensureCodeIsUnique;
    private ensureGstinIsUnique;
    private clearDefaultCompany;
    private applyOptionalFields;
    private normalizeRequiredName;
    private normalizeLengthCode;
    private toPayload;
    private handleWriteError;
    private throwNotFound;
    private throwBadRequest;
    private buildErrorResponse;
}
