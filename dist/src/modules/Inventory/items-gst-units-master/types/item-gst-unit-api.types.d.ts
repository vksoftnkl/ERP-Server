export type { InventoryErrorDetail as ItemGstUnitErrorDetail } from "../../../../common/types/module-api.types";
export type { InventoryErrorResponse as ItemGstUnitErrorResponse } from "../../../../common/types/module-api.types";
export type { InventorySuccessResponse as ItemGstUnitSuccessResponse } from "../../../../common/types/module-api.types";
export interface ItemGstUnitPayload {
    item_gst_unit_id: number;
    item_gst_unit_code: string | null;
    item_gst_unit_name: string | null;
    item_gst_unit_created_on: string;
    item_gst_unit_created_by: string | null;
    item_gst_unit_modified_on: string;
    item_gst_unit_modified_by: string | null;
    item_gst_unit_sync_date: string | null;
}
