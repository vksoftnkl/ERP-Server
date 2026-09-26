import { Prisma } from '@prisma/client';
import { SaveItemCompositeDto } from './dto/save-item-composite.dto';
import { ItemCompositePayload } from './types/item-composite-api.types';
import { ItemUnitConversionService } from '../item-unit-conversion/item-unit-conversion.service';
import { ItemsPriceMasterService } from '../items-price-master/items-price-master.service';
import { ItemsEanCodeMasterService } from '../items-ean-code-master/items-ean-code-master.service';
import { ItemsReorderMasterService } from '../items-reorder-master/items-reorder-master.service';
export type ItemChildrenSyncResult = Omit<ItemCompositePayload, 'item'>;
export declare class ItemMasterUpdateService {
    private readonly itemUnitConversionService;
    private readonly itemsPriceMasterService;
    private readonly itemsEanCodeMasterService;
    private readonly itemsReorderMasterService;
    constructor(itemUnitConversionService: ItemUnitConversionService, itemsPriceMasterService: ItemsPriceMasterService, itemsEanCodeMasterService: ItemsEanCodeMasterService, itemsReorderMasterService: ItemsReorderMasterService);
    syncChildren(itemId: string, dto: SaveItemCompositeDto, tx: Prisma.TransactionClient): Promise<ItemChildrenSyncResult>;
    private indexUnitConversions;
    private resolveUnitConversionId;
    private syncUnitConversions;
    private syncPrices;
    private syncEanCodes;
    private syncReorders;
    private rowChanged;
    private pairKey;
}
