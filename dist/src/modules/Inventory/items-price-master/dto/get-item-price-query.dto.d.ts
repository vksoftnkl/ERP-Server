import { InventoryListQueryBaseDto } from "../../../../common/utils/module-list-query.base.dto";
export declare class GetItemPriceQueryDto extends InventoryListQueryBaseDto {
    ipm_id?: string;
    ipm_item_id?: string;
    ipm_company_id?: string;
    ipm_branch_id?: string;
    ipm_is_active?: boolean;
}
