import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { SaveBranchMasterDto } from './dto/save-branch-master.dto';
import { BranchMasterPayload } from './types/branch-master-api.types';
import { RequestContextService } from '../../../common/request-context/request-context.service';
export declare class BranchMasterService {
    private readonly prisma;
    private readonly auditLogService;
    private readonly requestContextService;
    constructor(prisma: PrismaService, auditLogService: AuditLogService, requestContextService: RequestContextService);
    save(saveBranchMasterDto: SaveBranchMasterDto): Promise<BranchMasterPayload>;
    getById(brId: string): Promise<BranchMasterPayload>;
    softDelete(brId: string): Promise<{
        brId: string;
        deleted: true;
    }>;
    private createBranch;
    private updateBranch;
    private resolveRelatedNames;
    private ensureCompanyExists;
    private ensureNameIsUnique;
    private ensureCodeIsUnique;
    private clearDefaultBranch;
    private applyOptionalFields;
    private normalizeRequiredName;
    private normalizeStateCode;
    private toPayload;
    private handleWriteError;
    private throwNotFound;
    private throwBadRequest;
    private buildErrorResponse;
}
