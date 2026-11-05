import { InventoryErrorFieldDto, InventoryErrorResponseDto } from "../../../../common/utils/module-response.dto";
export { InventoryErrorFieldDto as ItemCategoryErrorFieldDto };
export { InventoryErrorResponseDto as ItemCategoryErrorResponseDto };
export declare class ItemCategoryPayloadDto {
    category_id: string;
    category_name: string;
    category_alias: string | null;
    category_short: string | null;
    category_description: string | null;
    category_parent_id: string | null;
    category_parent_name: string | null;
    category_sort: number | null;
    category_level: number | null;
    category_path_ids_cache: string[];
    category_tax_claim: boolean | null;
    category_default_tax_id: string | null;
    category_default_hsn: string | null;
    category_default_uom_id: string | null;
    category_photo: string | null;
    category_photo_url: string | null;
    category_sync_date: string | null;
    category_is_active: boolean;
    category_is_deleted: boolean;
    category_created_on: string;
    category_created_by: string | null;
    category_modified_on: string;
    category_modified_by: string | null;
}
export declare class ItemCategoryDeleteResultDto {
    category_id: string;
    deleted: boolean;
}
export declare class ItemCategorySuccessSingleDto {
    success: true;
    message: string;
    data: ItemCategoryPayloadDto;
}
export declare class ItemCategorySuccessDeleteDto {
    success: true;
    message: string;
    data: ItemCategoryDeleteResultDto;
}
