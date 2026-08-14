import { PrismaService } from '../../database/prisma/prisma.service';
import { ListItemSectionQueryDto } from './dto/list-item-section-query.dto';
import { SaveItemSectionDto } from './dto/save-item-section.dto';
import { ItemSectionListMeta, ItemSectionPayload } from './types/item-section-api.types';
export declare class ItemsSectionMasterService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    save(saveItemSectionDto: SaveItemSectionDto): Promise<ItemSectionPayload>;
    list(queryDto: ListItemSectionQueryDto): Promise<{
        items: ItemSectionPayload[];
        meta: ItemSectionListMeta;
    }>;
    getById(secId: string): Promise<ItemSectionPayload>;
    softDelete(secId: string): Promise<{
        sec_id: string;
        deleted: true;
    }>;
    private createItemSection;
    private updateItemSection;
    private ensureParentExistsAndSameCompany;
    private applyOptionalFields;
    private decodePhotoInput;
    private toPayload;
    private handleWriteError;
    private isUniqueConstraintError;
    private throwNotFound;
    private throwBadRequest;
    private buildErrorResponse;
    private hasOwnProperty;
}
