export type { InventoryErrorDetail as GodownErrorDetail } from "../../../../common/types/module-api.types";
export type { InventoryErrorResponse as GodownErrorResponse } from "../../../../common/types/module-api.types";
export type { InventorySuccessResponse as GodownSuccessResponse } from "../../../../common/types/module-api.types";
export interface GodownPayload {
    gdl_id: string;
    gdl_branch_id: string;
    gdl_branch_name?: string | null;
    gdl_name: string;
    gdl_short: string | null;
    gdl_code: string | null;
    gdl_type: string;
    gdl_parent_id: string | null;
    gdl_parent_name?: string | null;
    gdl_sort: number;
    gdl_level: number;
    gdl_path_ids_cache: string[];
    gdl_del_sheet: boolean;
    gdl_split_stock: boolean;
    gdl_negative_stock: boolean;
    gdl_volume: number;
    gdl_is_active: boolean;
    gdl_is_deleted: boolean;
    gdl_created_on: string;
    gdl_created_by: string | null;
    gdl_modified_on: string;
    gdl_modified_by: string | null;
    gdl_remarks: string | null;
}
