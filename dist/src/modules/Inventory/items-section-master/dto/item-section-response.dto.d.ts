import { InventoryErrorFieldDto, InventoryErrorResponseDto } from "../../../../common/utils/module-response.dto";
export { InventoryErrorFieldDto as ItemSectionErrorFieldDto };
export { InventoryErrorResponseDto as ItemSectionErrorResponseDto };
export declare class ItemSectionPayloadDto {
    sec_id: string;
    sec_name: string;
    sec_alias: string | null;
    sec_short: string | null;
    sec_description: string | null;
    sec_parent_id: string | null;
    sec_parent_name: string | null;
    sec_sort: number | null;
    sec_level: number | null;
    sec_path_ids: string[];
    sec_position: number | null;
    sec_color_code: string | null;
    sec_icon: string | null;
    sec_photo: string | null;
    sec_photo_url: string | null;
    sec_sync_date: string | null;
    sec_is_active: boolean;
    sec_is_deleted: boolean;
    sec_created_on: string;
    sec_created_by: string | null;
    sec_modified_on: string;
    sec_modified_by: string | null;
}
export declare class ItemSectionDeleteResultDto {
    sec_id: string;
    deleted: boolean;
}
export declare class ItemSectionSuccessSingleDto {
    success: true;
    message: string;
    data: ItemSectionPayloadDto;
}
export declare class ItemSectionSuccessDeleteDto {
    success: true;
    message: string;
    data: ItemSectionDeleteResultDto;
}
