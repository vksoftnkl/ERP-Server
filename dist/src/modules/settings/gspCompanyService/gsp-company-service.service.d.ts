import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { SaveGspCompanyServiceDto } from './dto/save-gsp-company-service.dto';
import { GspCompanyServicePayload } from './types/gsp-company-service-api.types';
import { RequestContextService } from '../../../common/request-context/request-context.service';
export declare class GspCompanyServiceService {
    private readonly prisma;
    private readonly auditLogService;
    private readonly requestContextService;
    constructor(prisma: PrismaService, auditLogService: AuditLogService, requestContextService: RequestContextService);
    save(saveGspCompanyServiceDto: SaveGspCompanyServiceDto): Promise<GspCompanyServicePayload>;
    getById(csgCompanyServiceId: string): Promise<GspCompanyServicePayload>;
    softDelete(csgCompanyServiceId: string): Promise<{
        csgCompanyServiceId: string;
        deleted: true;
    }>;
    private createGspCompanyService;
    private updateGspCompanyService;
    private ensureCompanyExists;
    private ensureGspProviderExists;
    private normalizeRequiredString;
    private loadProviderNameMap;
    private buildReferenceDisplay;
    private toPayload;
    private handleWriteError;
    private throwNotFound;
    private throwBadRequest;
    private buildErrorResponse;
    private buildDisplayName;
}
