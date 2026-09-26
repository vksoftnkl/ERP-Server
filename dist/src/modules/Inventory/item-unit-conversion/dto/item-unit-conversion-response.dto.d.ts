import { InventoryErrorFieldDto, InventoryErrorResponseDto, InventoryListMetaDto } from "../../../../common/utils/module-response.dto";
export { InventoryErrorFieldDto as ItemUnitConversionErrorFieldDto };
export { InventoryErrorResponseDto as ItemUnitConversionErrorResponseDto };
export { InventoryListMetaDto as ItemUnitConversionListMetaDto };
export declare class ItemUnitConversionPayloadDto {
    iuc_id: string;
    iuc_item_id: string;
    iuc_unit_id: string;
    iuc_base_unit_id: string;
    iuc_to_base_factor: number;
    iuc_unit_slno: number;
    iuc_unit_factor: number;
    iuc_is_default_unit: boolean;
    iuc_is_base_unit: boolean;
    iuc_is_big_unit: boolean;
    iuc_uom_weight: number;
    iuc_uom_remarks: string | null;
    iuc_is_active: boolean;
    iuc_is_deleted: boolean;
    iuc_sync_date: string | null;
    iuc_created_on: string;
    iuc_created_by: string | null;
    iuc_updated_on: string | null;
    iuc_updated_by: string | null;
    iuc_unit_name?: string | null;
    iuc_base_unit_name?: string | null;
}
export declare class ItemUnitConversionDeleteResultDto {
    iuc_id: string;
    deleted: boolean;
}
export declare class ItemUnitConversionSuccessSingleDto {
    success: true;
    message: string;
    data: ItemUnitConversionPayloadDto;
}
export declare class ItemUnitConversionSuccessSaveDto {
    success: true;
    message: string;
    data: ItemUnitConversionPayloadDto | ItemUnitConversionPayloadDto[];
}
export declare class ItemUnitConversionSuccessListDto {
    success: true;
    message: string;
    data: ItemUnitConversionPayloadDto[];
    meta: InventoryListMetaDto;
}
export declare class ItemUnitConversionSuccessDeleteDto {
    success: true;
    message: string;
    data: ItemUnitConversionDeleteResultDto | ItemUnitConversionDeleteResultDto[];
}
