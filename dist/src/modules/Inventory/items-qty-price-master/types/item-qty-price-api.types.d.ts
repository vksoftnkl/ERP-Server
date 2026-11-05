export type { InventoryErrorDetail as ItemQtyPriceErrorDetail } from "../../../../common/types/module-api.types";
export type { InventoryErrorResponse as ItemQtyPriceErrorResponse } from "../../../../common/types/module-api.types";
export type { InventorySuccessResponse as ItemQtyPriceSuccessResponse } from "../../../../common/types/module-api.types";
export type { InventoryListMeta as ItemQtyPriceListMeta } from "../../../../common/utils/module-list.utils";
export interface ItemQtyPriceDeleteResult {
    iqp_id: string;
    deleted: boolean;
}
export interface ItemQtyPricePayload {
    iqp_id: string;
    iqp_company_id: string | null;
    iqp_branch_id: string | null;
    iqp_party_id: string | null;
    iqp_price_level: number | null;
    iqp_item_id: string;
    iqp_item_unit_id: string;
    iqp_from_qty: number;
    iqp_to_qty: number | null;
    iqp_price_mode: string;
    iqp_disc_pct: number | null;
    iqp_flat_off: number | null;
    iqp_price: number | null;
    iqp_is_tax_incl: boolean;
    iqp_effective_from: string | null;
    iqp_effective_to: string | null;
    iqp_is_active: boolean;
    iqp_is_deleted: boolean;
    iqp_sync_date: string | null;
    iqp_created_on: string;
    iqp_created_by: string | null;
    iqp_modified_on: string;
    iqp_modified_by: string | null;
    iqp_item_name: string | null;
    iqp_unit_name: string | null;
    iqp_company_name: string | null;
    iqp_branch_name: string | null;
    iqp_price_level_name: string | null;
    iqp_party_name: string | null;
}
export type ItemQtyPriceListItem = ItemQtyPricePayload | Record<string, unknown>;
