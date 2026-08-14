import { PrismaService } from '../../database/prisma/prisma.service';
import { ListItemGroupQueryDto } from './dto/list-item-group-query.dto';
import { SaveItemGroupDto } from './dto/save-item-group.dto';
import { ItemGroupListMeta, ItemGroupPayload } from './types/item-group-api.types';
export declare class ItemsGroupMasterService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    save(saveItemGroupDto: SaveItemGroupDto): Promise<ItemGroupPayload>;
    list(queryDto: ListItemGroupQueryDto): Promise<{
        items: ItemGroupPayload[];
        meta: ItemGroupListMeta;
    }>;
    getById(itgId: string): Promise<ItemGroupPayload>;
    softDelete(itgId: string): Promise<{
        itg_id: string;
        deleted: true;
    }>;
    private createItemGroup;
    private updateItemGroup;
    private ensureParentExists;
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
