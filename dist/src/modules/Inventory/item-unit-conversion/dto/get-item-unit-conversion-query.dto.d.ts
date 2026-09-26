import { InventoryListQueryBaseDto } from "../../../../common/utils/module-list-query.base.dto";
export declare class GetItemUnitConversionQueryDto extends InventoryListQueryBaseDto {
    iuc_id?: string;
    iuc_item_id?: string;
    iuc_is_active?: boolean;
}
