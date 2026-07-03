export type { InventorySuccessResponse as ItemCompositeSuccessResponse } from 'src/common/types/module-api.types';
import { ItemPayload } from './item-api.types';
import { ItemUnitConversionPayload } from '../../item-unit-conversion/types/item-unit-conversion-api.types';
import { ItemPricePayload } from '../../items-price-master/types/item-price-api.types';
import { ItemEanCodePayload } from '../../items-ean-code-master/types/item-ean-code-api.types';
import { ItemReorderPayload } from '../../items-reorder-master/types/item-reorder-api.types';

export interface ItemCompositePayload {
  item: ItemPayload;
  unit_conversions: ItemUnitConversionPayload[];
  prices: ItemPricePayload[];
  ean_codes: ItemEanCodePayload[];
  reorders: ItemReorderPayload[];
}
