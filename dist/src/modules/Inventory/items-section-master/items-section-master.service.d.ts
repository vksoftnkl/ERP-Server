import { SaveItemSectionDto } from './dto/save-item-section.dto';
import { ItemSectionPayload } from './types/item-section-api.types';
import { PrismaService } from "../../../database/prisma/prisma.service";
import { AuditLogService } from "../../audit-log/audit-log.service";
import { RequestContextService } from '../../../common/request-context/request-context.service';
export declare class ItemsSectionMasterService {
    private readonly prisma;
    private readonly auditLogService;
    private readonly requestContextService;
    constructor(prisma: PrismaService, auditLogService: AuditLogService, requestContextService: RequestContextService);
    save(saveItemSectionDto: SaveItemSectionDto): Promise<ItemSectionPayload>;
    getById(secId: string): Promise<ItemSectionPayload>;
    private getParentName;
    toggleDelete(secId: string): Promise<{
        sec_id: string;
        deleted: boolean;
    }>;
    private createItemSection;
    private updateItemSection;
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
    private resolveSectionLevel;
}
