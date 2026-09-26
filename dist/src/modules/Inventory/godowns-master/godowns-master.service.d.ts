import { SaveGodownDto } from './dto/save-godown.dto';
import { GodownPayload } from './types/godown-api.types';
import { PrismaService } from "../../../database/prisma/prisma.service";
import { AuditLogService } from "../../audit-log/audit-log.service";
import { RequestContextService } from '../../../common/request-context/request-context.service';
export declare class GodownsMasterService {
    private readonly prisma;
    private readonly auditLogService;
    private readonly requestContextService;
    constructor(prisma: PrismaService, auditLogService: AuditLogService, requestContextService: RequestContextService);
    save(saveGodownDto: SaveGodownDto): Promise<GodownPayload>;
    getById(gdlId: string): Promise<GodownPayload>;
    toggleDelete(gdlId: string): Promise<{
        gdl_id: string;
        deleted: boolean;
    }>;
    private createGodownLocation;
    private updateGodownLocation;
    private normalizeLegacySaveGodownDto;
    private validateCreatePayload;
    private findActiveLocation;
    private getParentName;
    private getBranchName;
    private getActiveLocationOrThrow;
    private validateParentAssignment;
    private getAncestorIds;
    private getActiveSubtreeIds;
    private appendPathIds;
    private removePathIds;
    private ensureSelfInPath;
    private mergePathIds;
    private excludePathIds;
    private toUniqueIds;
    private areSameIds;
    private applyOptionalFields;
    private toPayload;
    private handleWriteError;
}
