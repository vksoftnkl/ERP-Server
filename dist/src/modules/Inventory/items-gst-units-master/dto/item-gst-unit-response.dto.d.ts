import { InventoryErrorFieldDto, InventoryErrorResponseDto } from "../../../../common/utils/module-response.dto";
export { InventoryErrorFieldDto as ItemGstUnitErrorFieldDto };
export { InventoryErrorResponseDto as ItemGstUnitErrorResponseDto };
export declare class ItemGstUnitPayloadDto {
    item_gst_unit_id: number;
    item_gst_unit_code: string | null;
    item_gst_unit_name: string | null;
    item_gst_unit_created_on: string;
    item_gst_unit_created_by: string | null;
    item_gst_unit_modified_on: string;
    item_gst_unit_modified_by: string | null;
    item_gst_unit_sync_date: string | null;
}
export declare class ItemGstUnitSuccessListDto {
    success: true;
    message: string;
    data: ItemGstUnitPayloadDto[];
}
