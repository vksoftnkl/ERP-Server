import { SaveItemCategoryDto } from './dto/save-item-category.dto';
import { ItemCategoryPayload } from './types/item-category-api.types';
import { PrismaService } from "../../../database/prisma/prisma.service";
import { AuditLogService } from "../../audit-log/audit-log.service";
import { RequestContextService } from '../../../common/request-context/request-context.service';
export declare class ItemsCategoryMasterService {
    private readonly prisma;
    private readonly auditLogService;
    private readonly requestContextService;
    constructor(prisma: PrismaService, auditLogService: AuditLogService, requestContextService: RequestContextService);
    save(saveItemCategoryDto: SaveItemCategoryDto): Promise<ItemCategoryPayload>;
    getById(categoryId: string): Promise<ItemCategoryPayload>;
    private getParentName;
    toggleDelete(categoryId: string): Promise<{
        category_id: string;
        deleted: boolean;
    }>;
    private createItemCategory;
    private updateItemCategory;
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
