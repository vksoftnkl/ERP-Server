import { PrismaService } from '../../database/prisma/prisma.service';
import { ListItemBrandQueryDto } from './dto/list-item-brand-query.dto';
import { SaveItemBrandDto } from './dto/save-item-brand.dto';
import { ItemBrandListMeta, ItemBrandPayload } from './types/item-brand-api.types';
export declare class ItemsBrandMasterService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    save(saveItemBrandDto: SaveItemBrandDto): Promise<ItemBrandPayload>;
    list(queryDto: ListItemBrandQueryDto): Promise<{
        items: ItemBrandPayload[];
        meta: ItemBrandListMeta;
    }>;
    getById(brandId: string): Promise<ItemBrandPayload>;
    softDelete(brandId: string): Promise<{
        brand_id: string;
        deleted: true;
    }>;
    private createItemBrand;
    private updateItemBrand;
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
