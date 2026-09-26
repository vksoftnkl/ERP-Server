import { InventoryListQueryBaseDto } from "../../../../common/utils/module-list-query.base.dto";
export declare class GetItemQtyPriceQueryDto extends InventoryListQueryBaseDto {
    iqp_id?: string;
    iqp_item_id?: string;
    iqp_item_unit_id?: string;
    iqp_company_id?: string;
    iqp_branch_id?: string;
    iqp_party_id?: string;
    iqp_price_level?: number;
    iqp_is_active?: boolean;
}
