import { InventoryListQueryBaseDto } from "../../../../common/utils/module-list-query.base.dto";
export declare class GetItemEanCodeQueryDto extends InventoryListQueryBaseDto {
    ean_id?: string;
    ean_item_id?: string;
    ean_unit_id?: string;
    ean_is_default?: boolean;
    ean_is_active?: boolean;
}
