import { SaveItemGroupDto } from './dto/save-item-group.dto';
import { ItemGroupPayload } from './types/item-group-api.types';
import { PrismaService } from "../../../database/prisma/prisma.service";
import { AuditLogService } from "../../audit-log/audit-log.service";
import { RequestContextService } from '../../../common/request-context/request-context.service';
export declare class ItemsGroupMasterService {
    private readonly prisma;
    private readonly auditLogService;
    private readonly requestContextService;
    constructor(prisma: PrismaService, auditLogService: AuditLogService, requestContextService: RequestContextService);
    save(saveItemGroupDto: SaveItemGroupDto): Promise<ItemGroupPayload>;
    getById(itgId: string): Promise<ItemGroupPayload>;
    private resolveParentName;
    toggleDelete(itgId: string): Promise<{
        itg_id: string;
        deleted: boolean;
    }>;
    private createItemGroup;
    private updateItemGroup;
    private ensureParentExists;
    private applyOptionalFields;
    private getAncestorIds;
    private getActiveSubtreeIds;
    private appendPathIds;
    private removePathIds;
    private ensureSelfInPath;
    private mergePathIds;
    private excludePathIds;
    private toUniqueIds;
    private areSameIds;
    private decodePhotoInput;
    private toPayload;
    private handleWriteError;
}
