export type { InventoryErrorDetail as ItemTaxHistoryErrorDetail } from 'src/common/types/module-api.types';
export type { InventoryErrorResponse as ItemTaxHistoryErrorResponse } from 'src/common/types/module-api.types';
export type { InventorySuccessResponse as ItemTaxHistorySuccessResponse } from 'src/common/types/module-api.types';
export type { InventoryListMeta as ItemTaxHistoryListMeta } from 'src/common/types/module-list.types';
export interface ItemTaxHistoryPayload {
  ith_id: string;
  ith_item_id: string;
  ith_tax_id: string;
  ith_effective_from: string;
  ith_effective_to: string | null;
  ith_reason: string | null;
  ith_created_on: string;
  ith_created_by: string | null;
}
export type ItemTaxHistoryListItem = ItemTaxHistoryPayload | Record<string, unknown>;
