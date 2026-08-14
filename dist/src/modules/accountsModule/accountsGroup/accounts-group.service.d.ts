import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { SaveAccountGroupDto } from './dto/save-account-group.dto';
import { AccountGroupPayload } from './types/account-group-api.types';
import { RequestContextService } from '../../../common/request-context/request-context.service';
export declare class AccountsGroupService {
    private readonly prisma;
    private readonly auditLogService;
    private readonly requestContextService;
    constructor(prisma: PrismaService, auditLogService: AuditLogService, requestContextService: RequestContextService);
    save(saveAccountGroupDto: SaveAccountGroupDto): Promise<AccountGroupPayload>;
    getById(accGroupId: string): Promise<AccountGroupPayload>;
    softDelete(accGroupId: string): Promise<{
        accGroupId: string;
        deleted: true;
    }>;
    private createAccountGroup;
    private updateAccountGroup;
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
