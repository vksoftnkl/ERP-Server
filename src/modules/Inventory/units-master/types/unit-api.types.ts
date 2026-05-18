import type { ConfiguredGridListResult } from 'src/common/configured-grid-sql/configured-grid-sql.service';
import type { InventoryListMeta } from 'src/common/types/module-list.types';

export type { InventoryErrorDetail as UnitErrorDetail } from 'src/common/types/module-api.types';
export type { InventoryErrorResponse as UnitErrorResponse } from 'src/common/types/module-api.types';
export type { InventorySuccessResponse as UnitSuccessResponse } from 'src/common/types/module-api.types';
export type { InventoryListMeta as UnitListMeta } from 'src/common/types/module-list.types';
export type { UnitGridStyleDto as UnitGridStyle } from '../dto/unit-response.dto';

export interface UnitPayload {
  unit_id: string;
  unit_name: string;
  unit_alias: string | null;
  unit_code: string | null;
  unit_description: string | null;
  unit_decimal_count: number;
  unit_weight: number | null;
  unit_loading: number | null;
  unit_unloading: number | null;
  unit_attach_charge: number | null;
  unit_is_pack_unit: boolean;
  unit_base_unit_id: string | null;
  unit_conversion: number | null;
  unit_is_active: boolean;
  unit_is_deleted: boolean;
  unit_sync_date: string | null;
  unit_created_on: string;
  unit_created_by: string | null;
  unit_modified_on: string;
  unit_modified_by: string | null;
}

export type UnitListItem = UnitPayload | Record<string, unknown>;
export type UnitListResult = ConfiguredGridListResult<UnitListItem, InventoryListMeta>;
