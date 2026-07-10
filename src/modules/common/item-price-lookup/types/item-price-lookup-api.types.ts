import type { ModuleApiSuccessResponse } from 'src/common/types/module-api.types';
export type ItemPriceLookupSuccessResponse<T> = ModuleApiSuccessResponse<T, never, never>;
import { ItemPayload } from '../../items-master/types/item-api.types';
import { ItemPricePayload } from '../../items-price-master/types/item-price-api.types';
export type { InventoryErrorDetail as ItemPriceLookupErrorDetail } from 'src/common/types/module-api.types';
export type { InventoryErrorResponse as ItemPriceLookupErrorResponse } from 'src/common/types/module-api.types';
export interface ItemPriceLookupPayload {
  item: ItemPayload;
  item_prices: ItemPricePayload[];
}
