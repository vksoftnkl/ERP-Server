import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { SaveCompanyGroupMasterDto } from './dto/save-company-group-master.dto';
import { CompanyGroupMasterPayload } from './types/company-group-master-api.types';
import { RequestContextService } from '../../../common/request-context/request-context.service';
export declare class CompanyGroupMasterService {
    private readonly prisma;
    private readonly auditLogService;
    private readonly requestContextService;
    constructor(prisma: PrismaService, auditLogService: AuditLogService, requestContextService: RequestContextService);
    save(saveCompanyGroupMasterDto: SaveCompanyGroupMasterDto): Promise<CompanyGroupMasterPayload>;
    getById(cogGroupId: string): Promise<CompanyGroupMasterPayload>;
    softDelete(cogGroupId: string): Promise<{
        cogGroupId: string;
        deleted: true;
    }>;
    private createGroup;
    private updateGroup;
    private ensureGroupNameIsUnique;
    private toUniqueIds;
    private toPayload;
}
