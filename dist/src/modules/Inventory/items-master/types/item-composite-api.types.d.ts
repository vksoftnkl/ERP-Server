export type { InventorySuccessResponse as ItemCompositeSuccessResponse } from "../../../../common/types/module-api.types";
import { ItemPayload } from './item-api.types';
import { ItemUnitConversionPayload } from '../../item-unit-conversion/types/item-unit-conversion-api.types';
import { ItemUnitConversionDeleteResult } from '../../item-unit-conversion/types/item-unit-conversion-api.types';
import { ItemPricePayload } from '../../items-price-master/types/item-price-api.types';
import { ItemPriceDeleteResult } from '../../items-price-master/types/item-price-api.types';
import { ItemEanCodePayload } from '../../items-ean-code-master/types/item-ean-code-api.types';
import { ItemEanCodeDeleteResult } from '../../items-ean-code-master/types/item-ean-code-api.types';
import { ItemReorderPayload } from '../../items-reorder-master/types/item-reorder-api.types';
import { ItemReorderDeleteResult } from '../../items-reorder-master/types/item-reorder-api.types';
export interface ItemCompositePayload {
    item: ItemPayload;
    unit_conversions: ItemUnitConversionPayload[];
    prices: ItemPricePayload[];
    ean_codes: ItemEanCodePayload[];
    reorders: ItemReorderPayload[];
}
export interface ItemCompositeDeleteResult {
    item: {
        item_id: string;
        deleted: boolean;
    };
    unit_conversions: ItemUnitConversionDeleteResult[];
    prices: ItemPriceDeleteResult[];
    ean_codes: ItemEanCodeDeleteResult[];
    reorders: ItemReorderDeleteResult[];
}
