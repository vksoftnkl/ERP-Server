import { SaveItemBrandDto } from './dto/save-item-brand.dto';
import { ItemBrandPayload } from './types/item-brand-api.types';
import { PrismaService } from "../../../database/prisma/prisma.service";
import { AuditLogService } from "../../audit-log/audit-log.service";
import { RequestContextService } from '../../../common/request-context/request-context.service';
export declare class ItemsBrandMasterService {
    private readonly prisma;
    private readonly auditLogService;
    private readonly requestContextService;
    constructor(prisma: PrismaService, auditLogService: AuditLogService, requestContextService: RequestContextService);
    save(saveItemBrandDto: SaveItemBrandDto): Promise<ItemBrandPayload>;
    getById(brandId: string): Promise<ItemBrandPayload>;
    private getParentName;
    toggleDelete(brandId: string): Promise<{
        brand_id: string;
        deleted: boolean;
    }>;
    private createItemBrand;
    private updateItemBrand;
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
