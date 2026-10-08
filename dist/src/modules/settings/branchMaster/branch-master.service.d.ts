import { Company } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { SaveBranchMasterDto } from './dto/save-branch-master.dto';
import { BranchMasterPayload, SeededMainBranch } from './types/branch-master-api.types';
import { SettingsWriteClient } from "../../../common/utils/module-service.utils";
import { RequestContextService } from '../../../common/request-context/request-context.service';
import { GodownsMasterService } from "../../Inventory/godowns-master/godowns-master.service";
export declare const MAIN_BRANCH_NAME = "Main Branch";
export declare const MAIN_BRANCH_TYPE = "HEAD OFFICE";
type BranchMasterWriteClient = SettingsWriteClient;
export declare class BranchMasterService {
    private readonly prisma;
    private readonly auditLogService;
    private readonly requestContextService;
    private readonly godownsMasterService;
    constructor(prisma: PrismaService, auditLogService: AuditLogService, requestContextService: RequestContextService, godownsMasterService: GodownsMasterService);
    save(saveBranchMasterDto: SaveBranchMasterDto): Promise<BranchMasterPayload>;
    getById(brId: string): Promise<BranchMasterPayload>;
    softDelete(brId: string): Promise<{
        brId: string;
        deleted: true;
    }>;
    restore(brId: string): Promise<{
        brId: string;
        deleted: false;
    }>;
    seedMainBranch(tx: BranchMasterWriteClient, company: Company, actor: string, now: Date): Promise<SeededMainBranch>;
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
    private assertDeletable;
    private assertMayChangeCompany;
    private inUse;
    private assertGstin;
    private throwNotFound;
    private throwBadRequest;
    private buildErrorResponse;
}
export {};
