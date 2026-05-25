import type { ModuleApiSuccessResponse } from 'src/common/types/module-api.types';
export type ItemPriceDetailSuccessResponse<T> = ModuleApiSuccessResponse<T, never, never>;
import { ItemPayload } from '../../items-master/types/item-api.types';
import { ItemPricePayload } from '../../items-price-master/types/item-price-api.types';
import { ItemTaxPayload } from '../../items-tax-master/types/item-tax-api.types';
export type { InventoryErrorDetail as ItemPriceDetailErrorDetail } from 'src/common/types/module-api.types';
export type { InventoryErrorResponse as ItemPriceDetailErrorResponse } from 'src/common/types/module-api.types';
export interface ItemPriceDetailPayload {
  item: ItemPayload;
  item_prices: ItemPricePayload[];
  item_tax: ItemTaxPayload | null;
}
