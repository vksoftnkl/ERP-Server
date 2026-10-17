export type { InventoryErrorDetail as StockTrackPresetsErrorDetail } from "../../../../common/types/module-api.types";
export type { InventoryErrorResponse as StockTrackPresetsErrorResponse } from "../../../../common/types/module-api.types";
export type { InventorySuccessResponse as StockTrackPresetsSuccessResponse } from "../../../../common/types/module-api.types";
export interface StockTrackPresetsPayload {
    spt_id: string;
    spt_company_id: string | null;
    spt_code: string;
    spt_name: string;
    spt_description: string | null;
    spt_track_batch: boolean;
    spt_track_mrp: boolean;
    spt_track_sale_price: boolean;
    spt_track_expiry: boolean;
    spt_track_serial: boolean;
    spt_track_supplier: boolean;
    spt_track_signature: string | null;
    spt_valuation_method: string;
    spt_issue_strategy: string;
    spt_allow_negative: string;
    spt_shelf_life_days: number | null;
    spt_near_expiry_days: number;
    spt_block_expired_sale: boolean;
    spt_ageing_basis: string;
    spt_sort_order: number;
    spt_remarks: string | null;
    spt_is_company_override: boolean;
}
export interface StockTrackPresetsGetMeta {
    company_id: string | null;
    spt_id?: string;
    spt_code?: string;
    count: number;
}
