import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { SaveAccGroupMasterDto } from './dto/save-acc-group-master.dto';
import { AccGroupMasterPayload } from './types/acc-group-master-api.types';
import { RequestContextService } from '../../../common/request-context/request-context.service';
export declare class AccGroupMasterService {
    private readonly prisma;
    private readonly auditLogService;
    private readonly requestContextService;
    constructor(prisma: PrismaService, auditLogService: AuditLogService, requestContextService: RequestContextService);
    save(saveAccGroupMasterDto: SaveAccGroupMasterDto): Promise<AccGroupMasterPayload>;
    getById(accGroupId: string): Promise<AccGroupMasterPayload>;
    softDelete(accGroupId: string): Promise<{
        accGroupId: string;
        deleted: true;
    }>;
    private createAccGroupMaster;
    private updateAccGroupMaster;
    private ensureParentExists;
    private ensureNameIsUnique;
    private applyOptionalFields;
    private getAncestorIds;
    private getActiveSubtreeIds;
    private appendChildIds;
    private removeChildIds;
    private ensureSelfInChildIds;
    private mergeChildIds;
    private excludeChildIds;
    private toUniqueIds;
    private areSameIds;
    private getParentName;
    private getCompanyName;
    private toPayload;
}
