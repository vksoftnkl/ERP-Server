import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { SaveTenderTypeMasterDto } from './dto/save-tender-type-master.dto';
import { TenderTypeMasterPayload } from './types/tender-type-master-api.types';
import { RequestContextService } from '../../../common/request-context/request-context.service';
export declare class TenderTypeMasterService {
    private readonly prisma;
    private readonly auditLogService;
    private readonly requestContextService;
    constructor(prisma: PrismaService, auditLogService: AuditLogService, requestContextService: RequestContextService);
    save(saveTenderTypeMasterDto: SaveTenderTypeMasterDto): Promise<TenderTypeMasterPayload>;
    getById(ttmTypeId: string): Promise<TenderTypeMasterPayload>;
    softDelete(ttmTypeId: string): Promise<{
        ttmTypeId: string;
        deleted: true;
    }>;
    private createTenderType;
    private updateTenderType;
    private allocateTypeId;
    private ensureNameIsUnique;
    private buildDisplayName;
    private parseTenderTypeId;
    private toPayload;
}
