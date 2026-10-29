import { InventoryErrorFieldDto, InventoryErrorResponseDto } from "../../../../common/utils/module-response.dto";
export { InventoryErrorFieldDto as UnitErrorFieldDto };
export { InventoryErrorResponseDto as UnitErrorResponseDto };
export declare class UnitPayloadDto {
    unit_id: string;
    unit_name: string;
    unit_alias: string | null;
    unit_code: string | null;
    unit_code_name: string | null;
    unit_description: string | null;
    unit_decimal_count: number;
    unit_weight: number | null;
    unit_loading: number | null;
    unit_unloading: number | null;
    unit_attach_charge: number | null;
    unit_is_pack_unit: boolean;
    unit_base_unit_id: string | null;
    unit_base_unit_name: string | null;
    unit_conversion: number | null;
    unit_is_active: boolean;
}
export declare class UnitGridStyleDto {
    grid_column_number: number;
    grid_column_name: string;
    grid_column_width: number | null;
    grid_column_alignment: string | null;
    grid_column_visibility: boolean;
    grid_column_filter: boolean;
    grid_column_condition: string | null;
    grid_column_condition_color: string | null;
    grid_column_group: boolean;
    grid_column_total: boolean;
    grid_column_data_type: string | null;
    grid_column_color: string | null;
    grid_column_notes: string | null;
}
export declare class UnitDeleteResultDto {
    unit_id: string;
    deleted: boolean;
}
export declare class UnitSuccessSingleDto {
    success: true;
    message: string;
    data: UnitPayloadDto;
}
export declare class UnitSuccessDeleteDto {
    success: true;
    message: string;
    data: UnitDeleteResultDto;
}
