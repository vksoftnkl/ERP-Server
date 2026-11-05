import { InventoryListQueryBaseDto } from "../../../../common/utils/module-list-query.base.dto";
export declare class GetItemReorderQueryDto extends InventoryListQueryBaseDto {
    ir_id?: string;
    ir_item_id?: string;
    ir_branch_id?: string;
    ir_unit_id?: string;
    ir_godown_id?: string;
    ir_is_active?: boolean;
}
