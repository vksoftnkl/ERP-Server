import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { SaveGspProviderMasterDto } from './dto/save-gsp-provider-master.dto';
import { GspProviderMasterPayload } from './types/gsp-provider-master-api.types';
import { RequestContextService } from '../../../common/request-context/request-context.service';
export declare class GspProviderMasterService {
    private readonly prisma;
    private readonly auditLogService;
    private readonly requestContextService;
    constructor(prisma: PrismaService, auditLogService: AuditLogService, requestContextService: RequestContextService);
    save(saveGspProviderMasterDto: SaveGspProviderMasterDto): Promise<GspProviderMasterPayload>;
    getById(gspProviderId: string): Promise<GspProviderMasterPayload>;
    softDelete(gspProviderId: string): Promise<{
        gspProviderId: string;
        deleted: true;
    }>;
    private createProvider;
    private updateProvider;
    private ensureCodeIsUnique;
    private ensureNameIsUnique;
    private normalizeIpAddress;
    private toPayload;
}
