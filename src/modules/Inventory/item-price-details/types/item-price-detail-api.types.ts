import type { ModuleApiSuccessResponse } from 'src/common/types/module-api.types';
export type ItemPriceDetailSuccessResponse<T> = ModuleApiSuccessResponse<T, never, never>;
import { ItemPayload } from '../../items-master/types/item-api.types';
import { ItemPricePayload } from '../../items-price-master/types/item-price-api.types';
import { ItemUnitConversionPayload } from '../../item-unit-conversion/types/item-unit-conversion-api.types';
import { ItemTaxPayload } from '../../items-tax-master/types/item-tax-api.types';
export type { InventoryErrorDetail as ItemPriceDetailErrorDetail } from 'src/common/types/module-api.types';
export type { InventoryErrorResponse as ItemPriceDetailErrorResponse } from 'src/common/types/module-api.types';
export interface ItemPriceDetailPayload {
  item: ItemPayload;
  item_prices: ItemPricePayload[];
  /**
   * The item's live unit conversions, returned alongside the prices because a
   * price row only points at one (ipm_uc_unit_id -> iuc_id) and carries none of
   * its shape. Callers that convert quantities or build unit pickers join the
   * two here instead of making a second round trip.
   */
  item_unit_conversions: ItemUnitConversionPayload[];
  item_tax: ItemTaxPayload | null;
}
